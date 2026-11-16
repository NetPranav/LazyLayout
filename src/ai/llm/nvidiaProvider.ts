import { assertServerExecution } from "./anthropicProvider";
import {
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  NVIDIA_API_BASE_URL,
  NVIDIA_MODEL_ID,
  redactSecrets,
} from "./constants";
import {
  buildStableSystemPrefix,
  computePrefixHash,
  formatDocumentContextText,
} from "./promptPrefix";
import { buildStrictLlmTools } from "./schemas";
import { readSseFrames } from "./sse";
import {
  normalizeStopReason,
  type LlmChatRequest,
  type LlmProvider,
  type LlmStreamEvent,
  type TokenUsageSummary,
} from "./types";

export interface NvidiaProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function mapNvidiaFinishReason(reason: string | null | undefined): string {
  switch (reason) {
    case "stop":
      return "end_turn";
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    default:
      return reason ?? "end_turn";
  }
}

/**
 * Server-only NVIDIA NIM (`build.nvidia.com`) provider targeting the OpenAI-compatible
 * `/v1/chat/completions` streaming endpoint with `nvapi-*` API keys.
 */
export class NvidiaLlmProvider implements LlmProvider {
  public readonly id = "nvidia";
  private readonly explicitApiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NvidiaProviderOptions = {}) {
    assertServerExecution();
    this.explicitApiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? NVIDIA_API_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private resolveApiKey(requestKey?: string): string | null {
    const key = (requestKey ?? this.explicitApiKey ?? process.env.NVIDIA_API_KEY)?.trim();
    return key || null;
  }

  public async *streamChat(
    request: LlmChatRequest,
    options: { signal?: AbortSignal } = {},
  ): AsyncIterable<LlmStreamEvent> {
    assertServerExecution();
    const apiKey = this.resolveApiKey(request.apiKey);
    if (!apiKey) {
      yield {
        type: "error",
        code: "MISSING_API_KEY",
        message: "NVIDIA_API_KEY (from build.nvidia.com) is not configured.",
        status: 503,
      };
      return;
    }

    const model = request.model?.trim() || NVIDIA_MODEL_ID;
    const systemBlocks = buildStableSystemPrefix(request.commandSchemas);
    const cachePrefixHash = computePrefixHash(systemBlocks);
    const tools = buildStrictLlmTools(request.commandSchemas);

    const lastUserIdx = (() => {
      for (let i = request.messages.length - 1; i >= 0; i -= 1) {
        if (request.messages[i].role === "user") return i;
      }
      return -1;
    })();

    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: systemBlocks.map((b) => b.text).join("\n") },
      ...request.messages.map((msg, idx) => {
        if (msg.role === "assistant") {
          return { role: "assistant", content: msg.content };
        }
        const hasVision = Boolean(msg.attachments && msg.attachments.length > 0);
        const contextText =
          request.documentContext && idx === lastUserIdx
            ? `${formatDocumentContextText(request.documentContext)}\n\n`
            : "";

        if (!hasVision) {
          return { role: "user", content: `${contextText}${msg.content}` };
        }

        const parts: Array<Record<string, unknown>> = [];
        if (contextText) parts.push({ type: "text", text: contextText });
        for (const att of msg.attachments ?? []) {
          parts.push({
            type: "image_url",
            image_url: { url: `data:${att.mediaType};base64,${att.base64Data}` },
          });
        }
        parts.push({ type: "text", text: msg.content });
        return { role: "user", content: parts };
      }),
    ];

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools: tools.map((t) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description ?? "",
              parameters: t.input_schema,
            },
          })),
          tool_choice: "auto",
          max_tokens: request.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
          stream: true,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.stopSequences ? { stop: request.stopSequences } : {}),
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const errBody = redactSecrets(await response.text().catch(() => ""));
        yield {
          type: "error",
          code: `NVIDIA_${response.status}`,
          message: errBody || `NVIDIA NIM API failed with HTTP ${response.status}.`,
          status: response.status,
        };
        return;
      }

      if (!response.body) {
        yield { type: "error", code: "NVIDIA_EMPTY_BODY", message: "NVIDIA NIM returned an empty stream.", status: 502 };
        return;
      }

      yield { type: "meta", provider: this.id, model, cachePrefixHash };

      const usage: TokenUsageSummary = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      let finishReason: string | null = null;
      const pendingTools = new Map<number, { id: string; name: string; argsJson: string }>();

      for await (const frame of readSseFrames(response.body)) {
        if (!frame.data || frame.data === "[DONE]") continue;
        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(frame.data) as Record<string, unknown>;
        } catch {
          continue;
        }

        const chunkUsage = chunk.usage as Record<string, unknown> | undefined;
        if (chunkUsage) {
          usage.inputTokens = Number(chunkUsage.prompt_tokens ?? usage.inputTokens);
          usage.outputTokens = Number(chunkUsage.completion_tokens ?? usage.outputTokens);
        }

        const choice = Array.isArray(chunk.choices)
          ? (chunk.choices[0] as Record<string, unknown> | undefined)
          : undefined;
        if (!choice) continue;

        if (typeof choice.finish_reason === "string") {
          finishReason = choice.finish_reason;
        }

        const delta = (choice.delta ?? {}) as Record<string, unknown>;
        if (typeof delta.content === "string" && delta.content.length > 0) {
          yield { type: "text_delta", delta: delta.content };
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
            const idx = typeof tc.index === "number" ? tc.index : 0;
            const current = pendingTools.get(idx) ?? {
              id: typeof tc.id === "string" ? tc.id : `nvidia_call_${idx + 1}`,
              name: "",
              argsJson: "",
            };
            if (typeof tc.id === "string") current.id = tc.id;
            const fn = tc.function as Record<string, unknown> | undefined;
            if (typeof fn?.name === "string") current.name = fn.name;
            if (typeof fn?.arguments === "string") current.argsJson += fn.arguments;
            pendingTools.set(idx, current);
          }
        }
      }

      for (const entry of pendingTools.values()) {
        let parsedInput: unknown = {};
        if (entry.argsJson.trim()) {
          try {
            parsedInput = JSON.parse(entry.argsJson);
          } catch {
            parsedInput = { rawJson: entry.argsJson };
          }
        }
        yield {
          type: "tool_use",
          id: entry.id,
          name: entry.name || "answer_about_document",
          input: parsedInput,
        };
      }

      yield { type: "usage", usage };
      yield { type: "stop", handling: normalizeStopReason(mapNvidiaFinishReason(finishReason)) };
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      yield {
        type: "error",
        code: isAbort ? "ABORTED" : "NVIDIA_STREAM_ERROR",
        message: redactSecrets(err instanceof Error ? err.message : "NVIDIA NIM request failed."),
        status: isAbort ? 499 : 502,
      };
    }
  }
}

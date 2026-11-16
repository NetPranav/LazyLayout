import { assertServerExecution } from "./anthropicProvider";
import {
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  GEMINI_API_BASE_URL,
  GEMINI_MODEL_ID,
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

export interface GeminiProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Strips JSON Schema fields rejected by Gemini's OpenAPI schema subset (`additionalProperties`, `$schema`, `pattern`). */
function toGeminiParameterSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiParameterSchema);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "$schema" || key === "additionalProperties" || key === "pattern") continue;
    out[key] = toGeminiParameterSchema(value);
  }
  return out;
}

function mapGeminiFinishReason(reason: string | undefined): string {
  switch (reason) {
    case "STOP":
      return "end_turn";
    case "MAX_TOKENS":
      return "max_tokens";
    case "SAFETY":
    case "RECITATION":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
      return "refusal";
    default:
      return reason ? reason.toLowerCase() : "end_turn";
  }
}

/**
 * Server-only Google Gemini provider via `generativelanguage.googleapis.com` SSE API.
 * Uses `GEMINI_API_KEY` / `GOOGLE_API_KEY` or user BYOK `apiKey` cleanly via `x-goog-api-key` header.
 */
export class GeminiLlmProvider implements LlmProvider {
  public readonly id = "gemini";
  private readonly explicitApiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiProviderOptions = {}) {
    assertServerExecution();
    this.explicitApiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? GEMINI_API_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private resolveApiKey(requestKey?: string): string | null {
    const key = (
      requestKey ??
      this.explicitApiKey ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY
    )?.trim();
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
        message: "GEMINI_API_KEY (or user API key) is not configured.",
        status: 503,
      };
      return;
    }

    const model = request.model?.trim() || GEMINI_MODEL_ID;
    const systemBlocks = buildStableSystemPrefix(request.commandSchemas);
    const cachePrefixHash = computePrefixHash(systemBlocks);
    const tools = buildStrictLlmTools(request.commandSchemas);

    const lastUserIdx = (() => {
      for (let i = request.messages.length - 1; i >= 0; i -= 1) {
        if (request.messages[i].role === "user") return i;
      }
      return -1;
    })();

    const contents = request.messages.map((msg, idx) => {
      const parts: Array<Record<string, unknown>> = [];
      if (msg.role === "user" && request.documentContext && idx === lastUserIdx) {
        parts.push({ text: formatDocumentContextText(request.documentContext) });
      }
      if (msg.attachments) {
        for (const att of msg.attachments) {
          if (att.label) parts.push({ text: `[Image: ${att.label}]` });
          parts.push({ inlineData: { mimeType: att.mediaType, data: att.base64Data } });
        }
      }
      parts.push({ text: msg.content });
      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts,
      };
    });

    const endpoint = `${this.baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemBlocks.map((b) => b.text).join("\n") }],
          },
          contents,
          tools: [
            {
              functionDeclarations: tools.map((tool) => ({
                name: tool.name,
                description: tool.description ?? "",
                parameters: toGeminiParameterSchema(tool.input_schema),
              })),
            },
          ],
          generationConfig: {
            maxOutputTokens: request.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
            ...(request.stopSequences ? { stopSequences: request.stopSequences } : {}),
          },
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const errBody = redactSecrets(await response.text().catch(() => ""));
        yield {
          type: "error",
          code: `GEMINI_${response.status}`,
          message: errBody || `Gemini API failed with HTTP ${response.status}.`,
          status: response.status,
        };
        return;
      }

      if (!response.body) {
        yield { type: "error", code: "GEMINI_EMPTY_BODY", message: "Gemini returned an empty stream.", status: 502 };
        return;
      }

      yield { type: "meta", provider: this.id, model, cachePrefixHash };

      const usage: TokenUsageSummary = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      let finishReason: string | undefined;
      let sawToolCall = false;
      let toolIndex = 0;

      for await (const frame of readSseFrames(response.body)) {
        if (!frame.data || frame.data === "[DONE]") continue;
        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(frame.data) as Record<string, unknown>;
        } catch {
          continue;
        }

        const usageMeta = chunk.usageMetadata as Record<string, unknown> | undefined;
        if (usageMeta) {
          usage.inputTokens = Number(usageMeta.promptTokenCount ?? usage.inputTokens);
          usage.outputTokens = Number(usageMeta.candidatesTokenCount ?? usage.outputTokens);
          usage.cacheReadInputTokens = Number(
            usageMeta.cachedContentTokenCount ?? usage.cacheReadInputTokens,
          );
        }

        const candidate = Array.isArray(chunk.candidates) ? (chunk.candidates[0] as Record<string, unknown>) : undefined;
        if (typeof candidate?.finishReason === "string") {
          finishReason = candidate.finishReason;
        }

        const parts = ((candidate?.content as Record<string, unknown> | undefined)?.parts ?? []) as Array<
          Record<string, unknown>
        >;
        for (const part of parts) {
          if (typeof part.text === "string" && part.text.length > 0) {
            yield { type: "text_delta", delta: part.text };
          }
          if (part.functionCall && typeof part.functionCall === "object") {
            const fc = part.functionCall as { name?: unknown; args?: unknown };
            if (typeof fc.name === "string") {
              sawToolCall = true;
              toolIndex += 1;
              yield {
                type: "tool_use",
                id: `gemini_call_${toolIndex}`,
                name: fc.name,
                input: fc.args ?? {},
              };
            }
          }
        }
      }

      const normalizedReason =
        sawToolCall && (!finishReason || finishReason === "STOP")
          ? "tool_use"
          : mapGeminiFinishReason(finishReason);
      yield { type: "usage", usage };
      yield { type: "stop", handling: normalizeStopReason(normalizedReason) };
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      yield {
        type: "error",
        code: isAbort ? "ABORTED" : "GEMINI_STREAM_ERROR",
        message: redactSecrets(err instanceof Error ? err.message : "Gemini request failed."),
        status: isAbort ? 499 : 502,
      };
    }
  }
}

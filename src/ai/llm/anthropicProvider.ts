import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type {
  MessageCreateParamsStreaming,
  MessageStreamEvent,
} from "@anthropic-ai/sdk/resources/messages";
import {
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  ANTHROPIC_MODEL_ID,
  redactSecrets,
} from "./constants";
import {
  buildAnthropicMessages,
  buildStableSystemPrefix,
  computePrefixHash,
} from "./promptPrefix";
import { buildStrictLlmTools } from "./schemas";
import {
  normalizeStopReason,
  type LlmChatRequest,
  type LlmProvider,
  type LlmStreamEvent,
  type TokenUsageSummary,
} from "./types";

export interface AnthropicMessagesClient {
  messages: {
    stream(
      params: MessageCreateParamsStreaming,
      options?: { signal?: AbortSignal },
    ): AsyncIterable<MessageStreamEvent>;
  };
}

export class MissingAnthropicApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured on the server.");
    this.name = "MissingAnthropicApiKeyError";
  }
}

export function assertServerExecution(): void {
  if (typeof window !== "undefined") {
    throw new Error("AnthropicLlmProvider must only run on the server.");
  }
}

export interface AnthropicProviderOptions {
  apiKey?: string;
  client?: AnthropicMessagesClient;
}

interface PendingToolBlock {
  id: string;
  name: string;
  partialJson: string;
  initialInput: unknown;
}

function parseAccumulatedToolInput(pending: PendingToolBlock): unknown {
  const trimmed = pending.partialJson.trim();
  if (!trimmed) return pending.initialInput ?? {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return pending.initialInput ?? { rawJson: trimmed };
  }
}

function sanitizeErrorMessage(err: unknown): { code: string; message: string; status?: number } {
  if (err instanceof MissingAnthropicApiKeyError) {
    return { code: "MISSING_API_KEY", message: err.message, status: 503 };
  }
  if (err instanceof APIError) {
    const safeMsg = redactSecrets(
      err.message || `Anthropic API request failed (${err.status ?? 502}).`,
    );
    return {
      code: `ANTHROPIC_${err.status ?? "ERROR"}`,
      message: safeMsg,
      status: err.status ?? 502,
    };
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return { code: "ABORTED", message: "AI request was cancelled.", status: 499 };
    }
    return { code: "LLM_STREAM_ERROR", message: redactSecrets(err.message), status: 500 };
  }
  return { code: "LLM_STREAM_ERROR", message: "Unexpected LLM provider failure.", status: 500 };
}

/**
 * Server-only Anthropic Claude Messages API provider using `@anthropic-ai/sdk`.
 */
export class AnthropicLlmProvider implements LlmProvider {
  public readonly id = "anthropic";
  private readonly explicitClient?: AnthropicMessagesClient;
  private readonly explicitApiKey?: string;

  constructor(options: AnthropicProviderOptions = {}) {
    assertServerExecution();
    this.explicitClient = options.client;
    this.explicitApiKey = options.apiKey;
  }

  private resolveClient(requestApiKey?: string): AnthropicMessagesClient {
    assertServerExecution();
    if (this.explicitClient) return this.explicitClient;

    const apiKey = (requestApiKey ?? this.explicitApiKey ?? process.env.ANTHROPIC_API_KEY)?.trim();
    if (!apiKey) {
      throw new MissingAnthropicApiKeyError();
    }
    return new Anthropic({ apiKey });
  }

  /** Builds the exact `MessageCreateParamsStreaming` payload sent to Claude. */
  public buildStreamParams(request: LlmChatRequest): {
    params: MessageCreateParamsStreaming;
    cachePrefixHash: string;
  } {
    const system = buildStableSystemPrefix(request.commandSchemas);
    const cachePrefixHash = computePrefixHash(system);
    const tools = buildStrictLlmTools(request.commandSchemas);
    const messages = buildAnthropicMessages(request.messages, request.documentContext);

    const params: MessageCreateParamsStreaming = {
      model: request.model?.trim() || ANTHROPIC_MODEL_ID,
      max_tokens: request.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
      system,
      tools,
      messages,
      stream: true,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.stopSequences && request.stopSequences.length > 0
        ? { stop_sequences: request.stopSequences }
        : {}),
    };

    return { params, cachePrefixHash };
  }

  public async *streamChat(
    request: LlmChatRequest,
    options: { signal?: AbortSignal } = {},
  ): AsyncIterable<LlmStreamEvent> {
    let client: AnthropicMessagesClient;
    try {
      client = this.resolveClient(request.apiKey);
    } catch (err) {
      const safe = sanitizeErrorMessage(err);
      yield { type: "error", ...safe };
      return;
    }

    const { params, cachePrefixHash } = this.buildStreamParams(request);

    const usage: TokenUsageSummary = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };

    let requestId: string | null = null;
    let stopReason: string | null = null;
    const pendingTools = new Map<number, PendingToolBlock>();

    try {
      const stream = client.messages.stream(params, { signal: options.signal });

      for await (const event of stream) {
        if (options.signal?.aborted) {
          yield { type: "error", code: "ABORTED", message: "AI request was cancelled.", status: 499 };
          return;
        }

        switch (event.type) {
          case "message_start": {
            requestId = event.message.id ?? null;
            const u = event.message.usage;
            if (u) {
              usage.inputTokens = u.input_tokens ?? usage.inputTokens;
              usage.outputTokens = u.output_tokens ?? usage.outputTokens;
              usage.cacheCreationInputTokens =
                u.cache_creation_input_tokens ?? usage.cacheCreationInputTokens;
              usage.cacheReadInputTokens = u.cache_read_input_tokens ?? usage.cacheReadInputTokens;
            }
            yield {
              type: "meta",
              provider: this.id,
              model: event.message.model ?? ANTHROPIC_MODEL_ID,
              requestId,
              cachePrefixHash,
            };
            break;
          }

          case "content_block_start": {
            if (event.content_block.type === "text" && event.content_block.text) {
              yield { type: "text_delta", delta: event.content_block.text };
            } else if (event.content_block.type === "tool_use") {
              pendingTools.set(event.index, {
                id: event.content_block.id,
                name: event.content_block.name,
                partialJson: "",
                initialInput: event.content_block.input,
              });
            }
            break;
          }

          case "content_block_delta": {
            if (event.delta.type === "text_delta" && event.delta.text) {
              yield { type: "text_delta", delta: event.delta.text };
            } else if (event.delta.type === "input_json_delta") {
              const entry = pendingTools.get(event.index);
              if (entry) entry.partialJson += event.delta.partial_json;
            }
            break;
          }

          case "content_block_stop": {
            const entry = pendingTools.get(event.index);
            if (entry) {
              pendingTools.delete(event.index);
              yield {
                type: "tool_use",
                id: entry.id,
                name: entry.name,
                input: parseAccumulatedToolInput(entry),
              };
            }
            break;
          }

          case "message_delta": {
            stopReason = event.delta.stop_reason ?? stopReason;
            const u = event.usage;
            if (u) {
              usage.inputTokens = u.input_tokens ?? usage.inputTokens;
              usage.outputTokens = u.output_tokens ?? usage.outputTokens;
              usage.cacheCreationInputTokens =
                u.cache_creation_input_tokens ?? usage.cacheCreationInputTokens;
              usage.cacheReadInputTokens = u.cache_read_input_tokens ?? usage.cacheReadInputTokens;
            }
            break;
          }

          case "message_stop":
            break;
        }
      }

      // Flush any unclosed tool blocks in case a stream ended abruptly (e.g. max_tokens)
      for (const entry of pendingTools.values()) {
        yield {
          type: "tool_use",
          id: entry.id,
          name: entry.name,
          input: parseAccumulatedToolInput(entry),
        };
      }
      pendingTools.clear();

      yield { type: "usage", usage };
      yield { type: "stop", handling: normalizeStopReason(stopReason) };
    } catch (err) {
      const safe = sanitizeErrorMessage(err);
      yield { type: "error", ...safe };
    }
  }
}

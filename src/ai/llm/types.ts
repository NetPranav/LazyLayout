import type { StopReason } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { CommandSchemaEntrySchema } from "./schemas";
import {
  ALLOWED_VISION_MEDIA_TYPES,
  LLM_PROVIDER_IDS,
  MAX_CHAT_HISTORY_MESSAGES,
  MAX_PROMPT_CHARS,
  MAX_VISION_BASE64_BYTES,
  MAX_VISION_IMAGES,
  type LlmProviderId,
} from "./constants";

export const VisionAttachmentSchema = z.object({
  mediaType: z.enum(ALLOWED_VISION_MEDIA_TYPES),
  /** Base64 payload without the `data:...;base64,` URL prefix. */
  base64Data: z
    .string()
    .min(1)
    .max(MAX_VISION_BASE64_BYTES * 2),
  label: z.string().max(120).optional(),
});

export type VisionAttachment = z.infer<typeof VisionAttachmentSchema>;

export const MdmJsonPatchSchema = z.object({
  op: z.enum(["add", "remove", "replace", "move", "copy", "test"]),
  path: z.string().regex(/^\/.*/, "JSON Pointer path must start with `/`"),
  from: z.string().regex(/^\/.*/, "JSON Pointer `from` must start with `/`").optional(),
  value: z.unknown().optional(),
});

export type MdmJsonPatch = z.infer<typeof MdmJsonPatchSchema>;

export const NodeScriptGraphProposalSchema = z.object({
  graphName: z.string().min(1).max(120),
  graphType: z.enum(["event", "function", "macro"]).default("event"),
  /** NodeScript (`.nls`) DSL text; never raw JSON blueprint blobs. */
  source: z.string().min(1),
  summary: z.string().min(1).max(500),
});

export type NodeScriptGraphProposal = z.infer<typeof NodeScriptGraphProposalSchema>;

export const CommandInvocationProposalSchema = z.object({
  commandId: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
  rationale: z.string().max(500).optional(),
});

export type CommandInvocationProposal = z.infer<typeof CommandInvocationProposalSchema>;

export const AiChatMessageInputSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_PROMPT_CHARS),
  attachments: z.array(VisionAttachmentSchema).max(MAX_VISION_IMAGES).optional(),
});

export type AiChatMessageInput = z.infer<typeof AiChatMessageInputSchema>;

export const AiDocumentLayerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  parentId: z.string().nullable(),
  childCount: z.number().int().nonnegative(),
  propsSample: z.record(z.string(), z.unknown()).optional(),
});

export type AiDocumentLayerSummary = z.infer<typeof AiDocumentLayerSummarySchema>;

export const AiDocumentContextSchema = z.object({
  documentName: z.string().max(200).optional(),
  activeMode: z.enum(["design", "motion", "code"]).optional(),
  activePageId: z.string().nullable().optional(),
  pageCount: z.number().int().nonnegative().optional(),
  layerCount: z.number().int().nonnegative().optional(),
  clipCount: z.number().int().nonnegative().optional(),
  trackCount: z.number().int().nonnegative().optional(),
  selectedIds: z.array(z.string()).max(100).optional(),
  rootIds: z.array(z.string()).max(100).optional(),
  layers: z.array(AiDocumentLayerSummarySchema).max(200).optional(),
  tokensSummary: z.record(z.string(), z.unknown()).optional(),
});

export type AiDocumentContext = z.infer<typeof AiDocumentContextSchema>;

export const LlmProviderIdSchema = z.enum(LLM_PROVIDER_IDS);

export const LlmChatRequestSchema = z.object({
  provider: LlmProviderIdSchema.optional(),
  /** Optional model ID override (e.g. a specific NVIDIA build.nim or Gemini model). */
  model: z.string().min(1).max(160).optional(),
  /** Optional user-supplied BYOK key forwarded over HTTPS for this turn only (never persisted server-side). */
  apiKey: z.string().min(1).max(512).optional(),
  messages: z.array(AiChatMessageInputSchema).min(1).max(MAX_CHAT_HISTORY_MESSAGES),
  documentContext: AiDocumentContextSchema.optional(),
  commandSchemas: z.array(CommandSchemaEntrySchema).max(150).optional(),
  maxTokens: z.number().int().min(128).max(16384).optional(),
  temperature: z.number().min(0).max(1).optional(),
  stopSequences: z.array(z.string().min(1).max(64)).max(4).optional(),
});

export interface ProviderStatusEntry {
  configured: boolean;
  defaultModel: string;
}

export type ProviderAvailabilityMap = Record<LlmProviderId, ProviderStatusEntry>;

export type LlmChatRequest = z.infer<typeof LlmChatRequestSchema>;

export interface TokenUsageSummary {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export type StopOutcome =
  | "complete"
  | "tool_use"
  | "truncated"
  | "stopped"
  | "paused"
  | "refused"
  | "context_exceeded"
  | "unknown";

export interface StopReasonHandling {
  stopReason: StopReason | string | null;
  outcome: StopOutcome;
  retryable: boolean;
  userMessage?: string;
}

/**
 * Gracefully translates every Anthropic `StopReason` into an actionable
 * outcome and user-facing notice when output stopped abnormally.
 */
export function normalizeStopReason(stopReason: StopReason | string | null | undefined): StopReasonHandling {
  switch (stopReason) {
    case "end_turn":
      return { stopReason, outcome: "complete", retryable: false };
    case "tool_use":
      return { stopReason, outcome: "tool_use", retryable: false };
    case "stop_sequence":
      return {
        stopReason,
        outcome: "stopped",
        retryable: false,
        userMessage: "Response stopped at a configured stop sequence.",
      };
    case "max_tokens":
      return {
        stopReason,
        outcome: "truncated",
        retryable: true,
        userMessage: "Response reached the output token limit before finishing; ask to continue.",
      };
    case "pause_turn":
      return {
        stopReason,
        outcome: "paused",
        retryable: true,
        userMessage: "The model paused a long turn; continue to resume generation.",
      };
    case "refusal":
      return {
        stopReason,
        outcome: "refused",
        retryable: false,
        userMessage: "The model refused this request due to safety constraints.",
      };
    case "model_context_window_exceeded":
      return {
        stopReason,
        outcome: "context_exceeded",
        retryable: true,
        userMessage: "The document and chat context exceeded the model window; trim history or selection.",
      };
    default:
      return {
        stopReason: stopReason ?? null,
        outcome: "unknown",
        retryable: false,
        userMessage: stopReason
          ? `Generation ended with unrecognised stop reason: ${stopReason}.`
          : "Generation ended without an explicit stop reason.",
      };
  }
}

export type LlmStreamEvent =
  | {
      type: "meta";
      provider: string;
      model: string;
      requestId?: string | null;
      cachePrefixHash: string;
    }
  | { type: "text_delta"; delta: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "usage"; usage: TokenUsageSummary }
  | { type: "stop"; handling: StopReasonHandling }
  | { type: "error"; code: string; message: string; status?: number };

export interface LlmProvider {
  readonly id: string;
  streamChat(request: LlmChatRequest, options?: { signal?: AbortSignal }): AsyncIterable<LlmStreamEvent>;
}

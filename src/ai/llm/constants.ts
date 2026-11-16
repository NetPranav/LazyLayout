import type { Model } from "@anthropic-ai/sdk/resources/messages";

export const LLM_PROVIDER_IDS = ["anthropic", "gemini", "nvidia", "offline"] as const;
export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

/**
 * Single authoritative Anthropic model constant for Stage 7 LLM integration
 * (ROADMAP Phase 241, checked against the 2026 Claude 5.5 lineup).
 */
export const ANTHROPIC_MODEL_ID: Model = "claude-sonnet-5-5";

/** Built-in Google Gemini default model ID & REST endpoint. */
export const GEMINI_MODEL_ID = "gemini-2.5-flash";
export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Built-in NVIDIA NIM (`build.nvidia.com`) default model ID & OpenAI-compatible endpoint. */
export const NVIDIA_MODEL_ID = "nvidia/nemotron-3.5-super-vl-120b-a12b";
export const NVIDIA_API_BASE_URL = "https://integrate.api.nvidia.com/v1";

/** Deterministic v1.1 offline fallback provider ID (ROADMAP Phase 242). */
export const OFFLINE_MODEL_ID = "lazylayout-deterministic-v1.1";

export const DEFAULT_MODELS_BY_PROVIDER: Record<LlmProviderId, string> = {
  anthropic: ANTHROPIC_MODEL_ID,
  gemini: GEMINI_MODEL_ID,
  nvidia: NVIDIA_MODEL_ID,
  offline: OFFLINE_MODEL_ID,
};

export interface ProviderModelOption {
  id: string;
  label: string;
}

export const PROVIDER_MODEL_OPTIONS: Record<LlmProviderId, readonly ProviderModelOption[]> = {
  anthropic: [
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
  ],
  nvidia: [
    { id: "nvidia/nemotron-3.5-super-vl-120b-a12b", label: "Nemotron 3.5 Super 120B" },
    { id: "nvidia/nemotron-3.5-lightning-30b-a3b", label: "Nemotron 3.5 Lightning 30B" },
    { id: "nvidia/nemotron-3.5-bolt-e4b", label: "Nemotron 3.5 Bolt E4B" },
    { id: "mistralai/mistral-large-4-1t-a52b", label: "Mistral Large 4 (1T)" },
  ],
  offline: [{ id: OFFLINE_MODEL_ID, label: "Deterministic v1.1 (Offline)" }],
};

export const ANTHROPIC_DEFAULT_MAX_TOKENS = 8192;
export const ANTHROPIC_MAX_REQUEST_TOKENS = 16384;

/** Server env var overriding production gate for developer testing before Phases 259/260. */
export const PRIVATE_AI_ROUTE_ENV_FLAG = "LAZYLAYOUT_ENABLE_AI_ROUTE";

export const MAX_CHAT_HISTORY_MESSAGES = 40;
export const MAX_PROMPT_CHARS = 32_000;
export const MAX_VISION_IMAGES = 4;
export const MAX_VISION_BASE64_BYTES = 5 * 1024 * 1024;

export const ALLOWED_VISION_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedVisionMediaType = (typeof ALLOWED_VISION_MEDIA_TYPES)[number];

/** Redacts provider API key formats (`sk-ant-*`, `AIza*`, `AQ.*`, `nvapi-*`) from error strings. */
export function redactSecrets(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{16,}/g, "[REDACTED]")
    .replace(/AQ\.[A-Za-z0-9._-]{16,}/g, "[REDACTED]")
    .replace(/nvapi-[A-Za-z0-9_-]+/g, "[REDACTED]");
}

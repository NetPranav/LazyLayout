import { AnthropicLlmProvider, assertServerExecution } from "./anthropicProvider";
import {
  DEFAULT_MODELS_BY_PROVIDER,
  PRIVATE_AI_ROUTE_ENV_FLAG,
  PROVIDER_MODEL_OPTIONS,
  type LlmProviderId,
} from "./constants";
import { GeminiLlmProvider } from "./geminiProvider";
import { NvidiaLlmProvider } from "./nvidiaProvider";
import { OfflineDeterministicProvider } from "./offlineProvider";
import {
  LlmChatRequestSchema,
  type LlmProvider,
  type LlmStreamEvent,
  type ProviderAvailabilityMap,
} from "./types";

export interface RouteEnv {
  NODE_ENV?: string;
  NEXT_PUBLIC_ENABLE_LABS?: string;
  LAZYLAYOUT_ENABLE_AI_ROUTE?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  NVIDIA_API_KEY?: string;
}

/**
 * The server's own provider keys stay private (developer use only) until auth and usage caps land in Phases 259
 * & 260. A production build uses them only with the server-side opt-in `LAZYLAYOUT_ENABLE_AI_ROUTE=1`.
 * `NEXT_PUBLIC_ENABLE_LABS` no longer opens them: it is a public build flag (it turns the lab pages on, for demos
 * and CI), and turning it on must not hand the server's key to anyone who can reach the site.
 */
export function isPrivateAiRouteEnabled(env?: RouteEnv): boolean {
  const src = env ?? process.env;
  return src.NODE_ENV !== "production" || src[PRIVATE_AI_ROUTE_ENV_FLAG] === "1";
}

/** Server-key requests may only name a model listed for the provider (a client can't pick any model on our key). */
export function isAllowedServerModel(providerId: LlmProviderId, model: string | undefined): boolean {
  if (!model) return true;
  return PROVIDER_MODEL_OPTIONS[providerId].some((m) => m.id === model.trim());
}

/** Per-client limits for the public paths (BYOK and offline) until real accounts and caps exist (Phases 259, 260). */
export const PUBLIC_RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 } as const;
const publicHits = new Map<string, number[]>();

/** Best-effort, per-process sliding window. Returns true when `clientKey` may make another request now. */
export function takePublicRateLimitToken(clientKey: string, nowMs = Date.now()): boolean {
  const since = nowMs - PUBLIC_RATE_LIMIT.windowMs;
  const hits = (publicHits.get(clientKey) ?? []).filter((t) => t > since);
  if (hits.length >= PUBLIC_RATE_LIMIT.maxRequests) {
    publicHits.set(clientKey, hits);
    return false;
  }
  hits.push(nowMs);
  publicHits.set(clientKey, hits);
  if (publicHits.size > 10_000) {
    for (const [k, v] of publicHits) if (v.every((t) => t <= since)) publicHits.delete(k);
  }
  return true;
}

/** Test hook: forget every client's hits. */
export function resetPublicRateLimit(): void {
  publicHits.clear();
}

function clientKeyOf(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function readEnvKey(provider: LlmProviderId, env?: RouteEnv): string | null {
  const src = env ?? process.env;
  if (provider === "anthropic") return src.ANTHROPIC_API_KEY?.trim() || null;
  if (provider === "gemini") return (src.GEMINI_API_KEY ?? src.GOOGLE_API_KEY)?.trim() || null;
  if (provider === "nvidia") return src.NVIDIA_API_KEY?.trim() || null;
  return "offline";
}

export function getProviderAvailability(env?: RouteEnv): ProviderAvailabilityMap {
  return {
    anthropic: {
      configured: Boolean(readEnvKey("anthropic", env)),
      defaultModel: DEFAULT_MODELS_BY_PROVIDER.anthropic,
    },
    gemini: {
      configured: Boolean(readEnvKey("gemini", env)),
      defaultModel: DEFAULT_MODELS_BY_PROVIDER.gemini,
    },
    nvidia: {
      configured: Boolean(readEnvKey("nvidia", env)),
      defaultModel: DEFAULT_MODELS_BY_PROVIDER.nvidia,
    },
    offline: {
      configured: true,
      defaultModel: DEFAULT_MODELS_BY_PROVIDER.offline,
    },
  };
}

export interface HandleAiChatDeps {
  provider?: LlmProvider;
  providers?: Partial<Record<LlmProviderId, LlmProvider>>;
  env?: RouteEnv;
}

function encodeSseEvent(event: LlmStreamEvent): Uint8Array {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  return new TextEncoder().encode(payload);
}

function createProviderInstance(
  providerId: LlmProviderId,
  apiKey?: string,
): LlmProvider {
  switch (providerId) {
    case "gemini":
      return new GeminiLlmProvider({ apiKey });
    case "nvidia":
      return new NvidiaLlmProvider({ apiKey });
    case "offline":
      return new OfflineDeterministicProvider();
    case "anthropic":
    default:
      return new AnthropicLlmProvider({ apiKey });
  }
}

function sanitizeKey(rawKey?: string): string | undefined {
  const cleaned = rawKey
    ?.trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer(?:\s+|$)/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  return cleaned || undefined;
}

function createLockedProviderAvailability(): ProviderAvailabilityMap {
  return {
    anthropic: { configured: false, defaultModel: DEFAULT_MODELS_BY_PROVIDER.anthropic },
    gemini: { configured: false, defaultModel: DEFAULT_MODELS_BY_PROVIDER.gemini },
    nvidia: { configured: false, defaultModel: DEFAULT_MODELS_BY_PROVIDER.nvidia },
    offline: { configured: true, defaultModel: DEFAULT_MODELS_BY_PROVIDER.offline },
  };
}

function createPrivateRouteResponse(): Response {
  return Response.json(
    { error: "Not found", code: "ROUTE_PRIVATE" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Reports built-in server provider availability (booleans only, never keys)
 * so the studio AI UI knows which built-in providers are configured vs. need BYOK.
 * When the private server-key route is disabled in production, built-in keys stay masked
 * as unconfigured while BYOK and Offline modes remain advertised.
 */
export async function handleAiChatGet(deps: HandleAiChatDeps = {}): Promise<Response> {
  assertServerExecution();
  const routeEnabled = isPrivateAiRouteEnabled(deps.env);
  return Response.json(
    {
      routeEnabled,
      byokSupported: true,
      providers: routeEnabled
        ? getProviderAvailability(deps.env)
        : createLockedProviderAvailability(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Handles `POST /api/ai/chat`: allows user BYOK requests (`apiKey`) and `offline`
 * deterministic mode everywhere (including public production), while gating server-key
 * access behind `isPrivateAiRouteEnabled`.
 */
export async function handleAiChatPost(
  request: Request,
  deps: HandleAiChatDeps = {},
): Promise<Response> {
  assertServerExecution();
  const routeEnabled = isPrivateAiRouteEnabled(deps.env);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    if (!routeEnabled) return createPrivateRouteResponse();
    return Response.json(
      { error: "Request body must be valid JSON.", code: "INVALID_JSON" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = LlmChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    if (!routeEnabled) return createPrivateRouteResponse();
    return Response.json(
      {
        error: "Invalid chat request payload.",
        code: "INVALID_REQUEST",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const providerId: LlmProviderId = parsed.data.provider ?? "anthropic";
  const userApiKey = sanitizeKey(parsed.data.apiKey);
  const canBypassPrivateGate = providerId === "offline" || Boolean(userApiKey);
  if (!routeEnabled && !canBypassPrivateGate) {
    return createPrivateRouteResponse();
  }
  if (!routeEnabled && !takePublicRateLimitToken(clientKeyOf(request))) {
    return Response.json(
      { error: "Too many AI requests. Wait a minute and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }

  const injectedProvider = deps.providers?.[providerId] ?? deps.provider;
  const envApiKey = routeEnabled
    ? sanitizeKey(readEnvKey(providerId, deps.env) ?? undefined)
    : undefined;
  const effectiveKey = userApiKey ?? envApiKey;
  const keySource: "byok" | "server" | "offline" =
    providerId === "offline" ? "offline" : userApiKey ? "byok" : "server";

  if (keySource === "server" && !isAllowedServerModel(providerId, parsed.data.model)) {
    return Response.json(
      { error: "That model is not available with the server's key.", code: "MODEL_NOT_ALLOWED" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!injectedProvider && providerId !== "offline" && !effectiveKey) {
    const envVarName =
      providerId === "gemini"
        ? "GEMINI_API_KEY"
        : providerId === "nvidia"
          ? "NVIDIA_API_KEY"
          : "ANTHROPIC_API_KEY";
    return Response.json(
      {
        error: `${envVarName} is not configured on the server and no user API key was attached.`,
        code: "MISSING_API_KEY",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const provider = injectedProvider ?? createProviderInstance(providerId, effectiveKey);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of provider.streamChat(
          { ...parsed.data, ...(effectiveKey ? { apiKey: effectiveKey } : {}) },
          { signal: request.signal },
        )) {
          if (event.type === "meta") {
            controller.enqueue(encodeSseEvent({ ...event, keySource } as LlmStreamEvent));
          } else {
            controller.enqueue(encodeSseEvent(event));
          }
        }
      } catch (err) {
        // Provider errors can carry request details; log them on the server, send the client a plain message.
        console.error("[ai/chat] stream failed:", err instanceof Error ? err.message : err);
        controller.enqueue(
          encodeSseEvent({
            type: "error",
            code: "STREAM_FAILURE",
            message: "The AI provider stopped responding. Try again.",
            status: 500,
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

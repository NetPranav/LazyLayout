import { labsEnabled } from "@/app/editor/labsEnabled";
import { AnthropicLlmProvider, assertServerExecution } from "./anthropicProvider";
import {
  DEFAULT_MODELS_BY_PROVIDER,
  PRIVATE_AI_ROUTE_ENV_FLAG,
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
 * Route stays private (developer/labs use only) until auth and usage caps land
 * in Phases 259 & 260. Production builds without explicit opt-in return 404.
 */
export function isPrivateAiRouteEnabled(env?: RouteEnv): boolean {
  if (env) {
    return (
      env.NODE_ENV !== "production" ||
      env.NEXT_PUBLIC_ENABLE_LABS === "1" ||
      env[PRIVATE_AI_ROUTE_ENV_FLAG] === "1"
    );
  }
  return labsEnabled || process.env[PRIVATE_AI_ROUTE_ENV_FLAG] === "1";
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

/**
 * Reports built-in server provider availability (booleans only, never keys)
 * so the studio AI UI knows which built-in providers are configured vs. need BYOK.
 */
export async function handleAiChatGet(deps: HandleAiChatDeps = {}): Promise<Response> {
  assertServerExecution();
  if (!isPrivateAiRouteEnabled(deps.env)) {
    return Response.json(
      { error: "Not found", code: "ROUTE_PRIVATE" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    {
      routeEnabled: true,
      providers: getProviderAvailability(deps.env),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Handles `POST /api/ai/chat`: gates non-developer production traffic,
 * validates the payload via Zod, supports Anthropic, Gemini, NVIDIA NIM (`build.nvidia.com`),
 * and Offline deterministic provider, honoring optional BYOK `apiKey` cleanly.
 */
export async function handleAiChatPost(
  request: Request,
  deps: HandleAiChatDeps = {},
): Promise<Response> {
  assertServerExecution();

  if (!isPrivateAiRouteEnabled(deps.env)) {
    return Response.json(
      { error: "Not found", code: "ROUTE_PRIVATE" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON.", code: "INVALID_JSON" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = LlmChatRequestSchema.safeParse(body);
  if (!parsed.success) {
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
  const injectedProvider = deps.providers?.[providerId] ?? deps.provider;
  const userApiKey = parsed.data.apiKey?.trim() || undefined;
  const envApiKey = readEnvKey(providerId, deps.env) ?? undefined;
  const effectiveKey = userApiKey ?? envApiKey;

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
        for await (const event of provider.streamChat(parsed.data, { signal: request.signal })) {
          controller.enqueue(encodeSseEvent(event));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Streaming interrupted.";
        controller.enqueue(
          encodeSseEvent({ type: "error", code: "STREAM_FAILURE", message, status: 500 }),
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

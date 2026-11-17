import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createDocumentFromLayers, createLayer } from "@/core/document/factories";
import { rules } from "@/core/rules";
import {
  GEMINI_MODEL_ID,
  GeminiLlmProvider,
  NVIDIA_MODEL_ID,
  NvidiaLlmProvider,
  OfflineDeterministicProvider,
  PROVIDER_MODEL_OPTIONS,
  executeValidatedLlmTurn,
  handleAiChatGet,
  handleAiChatPost,
  normalizeStopReason,
  type LlmChatRequest,
  type LlmProvider,
  type LlmStreamEvent,
} from "../index";

function createSseResponse(frames: unknown[], status = 200): Response {
  const encoder = new TextEncoder();
  const payload = frames
    .map((frame) =>
      typeof frame === "string" ? frame : `data: ${JSON.stringify(frame)}\n\n`,
    )
    .join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function buildTestDocument() {
  const hero = createLayer({
    id: "layer-hero",
    name: "HeroCard",
    archetype: "container",
  });
  const title = createLayer({
    id: "layer-title",
    name: "HeadlineText",
    archetype: "text",
  });
  const button = createLayer({
    id: "layer-cta",
    name: "PrimaryButton",
    archetype: "button",
  });
  const badge = createLayer({
    id: "layer-badge",
    name: "StatusBadge",
    archetype: "badge",
  });
  return createDocumentFromLayers([hero, title, button, badge]);
}

function buildRequest(prompt: string, doc = buildTestDocument()): LlmChatRequest {
  const layerList = Object.values(doc.layers).map((layer) => ({
    id: layer.id,
    name: layer.name,
    type: layer.archetype,
    parentId: layer.parentId,
    childCount: layer.children.length,
    propsSample: layer.properties,
  }));

  return {
    provider: "offline",
    messages: [{ role: "user", content: prompt }],
    documentContext: {
      documentName: "Phase242 Test Studio",
      activeMode: "motion",
      layerCount: layerList.length,
      clipCount: Object.keys(doc.clips).length,
      selectedIds: ["layer-hero"],
      layers: layerList,
    },
  };
}

describe("Multi-provider LLM adapters (Gemini + NVIDIA NIM + BYOK)", () => {
  it("streams Gemini SSE chunks and functionCall via x-goog-api-key without leaking key in URL", async () => {
    let seenUrl = "";
    let seenHeaderKey = "";

    const provider = new GeminiLlmProvider({
      fetchImpl: async (input, init) => {
        seenUrl = String(input);
        const headers = new Headers(init?.headers);
        seenHeaderKey = headers.get("x-goog-api-key") ?? "";
        return createSseResponse([
          {
            candidates: [
              {
                content: {
                  parts: [
                    { text: "Adding " },
                    {
                      functionCall: {
                        name: "answer_about_document",
                        args: { answer: "HeroCard is a container archetype layer." },
                      },
                    },
                  ],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 40,
              candidatesTokenCount: 15,
              totalTokenCount: 55,
            },
          },
        ]);
      },
    });

    const events: LlmStreamEvent[] = [];
    for await (const evt of provider.streamChat({
      provider: "gemini",
      apiKey: "AIzaSyByokUserKey12345",
      messages: [{ role: "user", content: "What is HeroCard?" }],
    })) {
      events.push(evt);
    }

    assert.ok(seenUrl.includes(`models/${GEMINI_MODEL_ID}:streamGenerateContent?alt=sse`));
    assert.equal(seenUrl.includes("AIza"), false, "API key must never appear in request URL");
    assert.equal(seenHeaderKey, "AIzaSyByokUserKey12345");
    assert.equal(
      events
        .filter((e): e is Extract<LlmStreamEvent, { type: "text_delta" }> => e.type === "text_delta")
        .map((e) => e.delta)
        .join(""),
      "Adding ",
    );
    const toolEvt = events.find((e) => e.type === "tool_use");
    assert.ok(toolEvt && toolEvt.type === "tool_use");
    assert.equal(toolEvt.name, "answer_about_document");
    const stopEvt = events.find((e) => e.type === "stop");
    assert.ok(stopEvt && stopEvt.type === "stop");
    assert.equal(stopEvt.handling.outcome, "tool_use");
  });

  it("streams NVIDIA NIM build.nvidia.com OpenAI-compatible SSE deltas & tool_calls with BYOK", async () => {
    let seenUrl = "";
    let seenAuth = "";
    let seenModel = "";

    const provider = new NvidiaLlmProvider({
      fetchImpl: async (input, init) => {
        seenUrl = String(input);
        const headers = new Headers(init?.headers);
        seenAuth = headers.get("authorization") ?? "";
        const body = JSON.parse(String(init?.body)) as { model: string };
        seenModel = body.model;
        return createSseResponse([
          {
            choices: [
              {
                delta: {
                  content: "Creating flow...",
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_nv_1",
                      function: {
                        name: "propose_nodescript_graph",
                        arguments: '{"graphName":"AuthFlow',
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      function: {
                        arguments: '","source":"#nls-version: 1.0","summary":"Auth graph"}',
                      },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
            usage: { prompt_tokens: 60, completion_tokens: 20 },
          },
          "data: [DONE]\n\n",
        ]);
      },
    });

    const events: LlmStreamEvent[] = [];
    for await (const evt of provider.streamChat({
      provider: "nvidia",
      model: "deepseek-ai/deepseek-r1",
      apiKey: "nvapi-byok-secret-token-999",
      messages: [{ role: "user", content: "Build auth flow" }],
    })) {
      events.push(evt);
    }

    assert.equal(seenUrl, "https://integrate.api.nvidia.com/v1/chat/completions");
    assert.equal(seenAuth, "Bearer nvapi-byok-secret-token-999");
    assert.equal(seenModel, "deepseek-ai/deepseek-r1");
    const toolEvt = events.find((e) => e.type === "tool_use");
    assert.ok(toolEvt && toolEvt.type === "tool_use");
    assert.equal(toolEvt.name, "propose_nodescript_graph");
    assert.deepEqual(toolEvt.input, {
      graphName: "AuthFlow",
      source: "#nls-version: 1.0",
      summary: "Auth graph",
    });
    const stopEvt = events.find((e) => e.type === "stop");
    assert.ok(stopEvt && stopEvt.type === "stop");
    assert.equal(stopEvt.handling.outcome, "tool_use");
  });

  it("exposes GET /api/ai/chat availability flags without leaking keys and routes POST by provider", async () => {
    const getRes = await handleAiChatGet({
      env: {
        NODE_ENV: "development",
        GEMINI_API_KEY: "AIzaShouldNotLeak",
        NVIDIA_API_KEY: "nvapi-ShouldNotLeak",
      },
    });
    assert.equal(getRes.status, 200);
    const bodyText = await getRes.text();
    assert.equal(bodyText.includes("AIzaShouldNotLeak"), false);
    assert.equal(bodyText.includes("nvapi-ShouldNotLeak"), false);
    const statusJson = JSON.parse(bodyText) as {
      providers: Record<string, { configured: boolean; defaultModel: string }>;
    };
    assert.equal(statusJson.providers.anthropic.configured, false);
    assert.equal(statusJson.providers.gemini.configured, true);
    assert.equal(statusJson.providers.nvidia.configured, true);
    assert.equal(statusJson.providers.nvidia.defaultModel, NVIDIA_MODEL_ID);
    assert.equal(statusJson.providers.offline.configured, true);

    const postRes = await handleAiChatPost(
      new Request("http://localhost:3000/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest("How many layers are in this document?")),
      }),
      { env: { NODE_ENV: "development" } },
    );
    assert.equal(postRes.status, 200);
    const sseText = await postRes.text();
    assert.ok(sseText.includes("4 layer(s)"));
    assert.ok(sseText.includes("event: stop"));
  });
});

describe("Phase 242 validation loop, repair limit & ConstrainedDecoder removal", () => {
  it("removes legacy ConstrainedDecoder.ts from src/ai/scaffold", () => {
    assert.equal(
      existsSync(join(process.cwd(), "src/ai/scaffold/ConstrainedDecoder.ts")),
      false,
    );
  });

  it("repairs a rules.validate failure (PERF_LAYOUT) within 1 repair turn", async () => {
    const doc = buildTestDocument();
    let callCount = 0;

    const mockProvider: LlmProvider = {
      id: "mock-repair",
      async *streamChat(request) {
        callCount += 1;
        if (callCount === 1) {
          yield {
            type: "tool_use",
            id: "call_1",
            name: "propose_mdm_patches",
            input: {
              summary: "Animate width on entrance",
              patches: [
                {
                  op: "add",
                  path: "/clips/clip-bad-width",
                  value: {
                    id: "clip-bad-width",
                    layerId: "layer-hero",
                    name: "Bad Width Scroll",
                    type: "scroll",
                    trigger: "inView",
                    duration: 0.4,
                    easing: "power2.out",
                    enabled: true,
                    tracks: [
                      {
                        id: "trk-bad-width",
                        property: "frame.width",
                        keyframes: [
                          { id: "kf-0", time: 0, value: 100 },
                          { id: "kf-1", time: 0.4, value: 300 },
                        ],
                      },
                    ],
                  },
                },
                {
                  op: "add",
                  path: "/compositions/comp_clip-bad-width",
                  value: {
                    id: "comp_clip-bad-width",
                    name: "Bad Width Scroll",
                    kind: "interaction",
                    duration: 1,
                    fps: 60,
                    workArea: { start: 0, end: 1 },
                    trigger: { on: "inView", layerId: "layer-hero", playback: "play" },
                    markers: [],
                    layers: {},
                    clips: [{ clipId: "clip-bad-width", offset: 0 }],
                    nested: [],
                  },
                },
              ],
            },
          };
          yield {
            type: "stop",
            handling: { stopReason: "tool_use", outcome: "tool_use", retryable: false },
          };
          return;
        }

        // Verify repair turn actually received the PERF_LAYOUT diagnostic
        const lastMsg = request.messages[request.messages.length - 1];
        assert.ok(lastMsg.content.includes("PERF_LAYOUT"));

        yield {
          type: "tool_use",
          id: "call_2",
          name: "propose_mdm_patches",
          input: {
            summary: "Repaired to GPU-composited opacity",
            patches: [
              {
                op: "add",
                path: "/clips/clip-fixed-opacity",
                value: {
                  id: "clip-fixed-opacity",
                  layerId: "layer-hero",
                  name: "Repaired Fade",
                  type: "entrance",
                  trigger: "mount",
                  duration: 0.4,
                  easing: "power2.out",
                  enabled: true,
                  tracks: [
                    {
                      id: "trk-fixed-opacity",
                      property: "appearance.opacity",
                      keyframes: [
                        { id: "kf-0", time: 0, value: 0 },
                        { id: "kf-1", time: 0.4, value: 1 },
                      ],
                    },
                  ],
                },
              },
              {
                op: "add",
                path: "/compositions/comp_main/clips/-",
                value: { clipId: "clip-fixed-opacity", offset: 0 },
              },
            ],
          },
        };
        yield {
          type: "stop",
          handling: { stopReason: "tool_use", outcome: "tool_use", retryable: false },
        };
      },
    };

    const result = await executeValidatedLlmTurn({
      baseDocument: doc,
      provider: mockProvider,
      request: buildRequest("Fade in the hero card", doc),
      validateRules: rules.validate,
    });

    assert.equal(callCount, 2);
    assert.equal(result.accepted, true);
    assert.equal(result.attempts, 2);
    assert.equal(result.repaired, true);
    assert.equal(Object.keys(result.candidateDocument?.clips ?? {}).length, 1);
  });

  it("rejects persistent rule violations after at most 1 repair turn with explanation", async () => {
    const doc = buildTestDocument();
    let callCount = 0;

    const stubbornProvider: LlmProvider = {
      id: "stubborn-invalid",
      async *streamChat() {
        callCount += 1;
        yield {
          type: "tool_use",
          id: `call_${callCount}`,
          name: "propose_mdm_patches",
          input: {
            summary: "Unsupported tap clip on plain text layer",
            patches: [
              {
                op: "add",
                path: `/clips/clip-text-tap-${callCount}`,
                value: {
                  id: `clip-text-tap-${callCount}`,
                  layerId: "layer-title",
                  name: "Tap Text",
                  type: "tap",
                  trigger: "press",
                  duration: 0.25,
                  easing: "power2.out",
                  enabled: true,
                  tracks: [
                    {
                      id: `trk-tap-${callCount}`,
                      property: "appearance.opacity",
                      keyframes: [
                        { id: "kf-0", time: 0, value: 1 },
                        { id: "kf-1", time: 0.25, value: 0.7 },
                      ],
                    },
                  ],
                },
              },
              {
                op: "add",
                path: `/compositions/comp_clip-text-tap-${callCount}`,
                value: {
                  id: `comp_clip-text-tap-${callCount}`,
                  name: "Tap Text",
                  kind: "interaction",
                  duration: 1,
                  fps: 60,
                  workArea: { start: 0, end: 1 },
                  trigger: { on: "press", layerId: "layer-title", playback: "restart" },
                  markers: [],
                  layers: {},
                  clips: [{ clipId: `clip-text-tap-${callCount}`, offset: 0 }],
                  nested: [],
                },
              },
            ],
          },
        };
        yield {
          type: "stop",
          handling: { stopReason: "tool_use", outcome: "tool_use", retryable: false },
        };
      },
    };

    const result = await executeValidatedLlmTurn({
      baseDocument: doc,
      provider: stubbornProvider,
      request: buildRequest("Make headline tap trigger", doc),
      validateRules: rules.validate,
    });

    assert.equal(callCount, 2, "Must attempt at most 1 repair turn (2 total calls)");
    assert.equal(result.accepted, false);
    assert.equal(result.attempts, 2);
    assert.ok(result.rejectionReason?.includes("ANIM_COMPAT"));
  });

  it("50 scripted prompts pass schema + rules validation at >= 95% rate with at most 1 repair", async () => {
    const doc = buildTestDocument();
    const provider = new OfflineDeterministicProvider();

    const scriptedPrompts: string[] = [
      // Motion prompts (20)
      "Fade in the hero card on mount",
      "Slide up the hero card slowly on page load",
      "Add a bounce entrance animation to the hero card",
      "Add hover scale effect on the card",
      "Animate button on tap click with crisp spring feel",
      "Add press scale feedback to PrimaryButton",
      "Create scroll reveal motion for HeroCard",
      "Add continuous floating loop to StatusBadge",
      "Slow continuous pulse on the badge",
      "Fast fade reveal when mounted",
      "Pop entrance animation on HeroCard",
      "Smooth slide-left entrance for the card",
      "Hover lift motion on HeroCard",
      "Click tap animation for CTA",
      "Scroll fade opacity animation",
      "Looping gentle bobbing float motion",
      "Snappy fade in for HeroCard",
      "Dramatic slide down entrance",
      "Add hover opacity highlight on HeroCard",
      "Entrance animation on page load",
      // Design & Q&A prompts (15)
      "Change opacity to 0.85",
      "Move HeroCard right by 40px",
      "Hide HeroCard",
      "Show HeroCard",
      "What layers are in this document?",
      "Explain the selected layer properties",
      "How many clips are currently in the scene?",
      "Describe the archetype of HeadlineText",
      "Change HeroCard opacity to 0.92",
      "Round corners on HeroCard",
      "Which layer is selected right now?",
      "Explain why animating width causes layout thrashing",
      "Change opacity to 1",
      "Rename HeroCard to ProductCard",
      "List all layers and animations",
      // NodeScript (.nls) workflow prompts (15)
      "Build an authentication login workflow with NodeScript",
      "Create a NodeScript flow for user signup and dashboard navigation",
      "Generate a CRUD database query and insert pipeline in .nls",
      "Build a NodeScript ecommerce add to cart and checkout flow",
      "Create an analytics dashboard NodeScript graph",
      "Generate a form submission workflow with NodeScript",
      "Build a REST API fetch workflow in NodeScript",
      "Create an auth login flow in .nls",
      "Build a CRUD items database workflow in NodeScript",
      "Generate an online store checkout flow in .nls",
      "Create a live dashboard metrics API workflow",
      "Build a contact form submit NodeScript graph",
      "Create a NodeScript workflow for OAuth login",
      "Generate a NodeScript pipeline to load database records on page load",
      "Build a cart state update NodeScript logic graph",
    ];

    assert.equal(scriptedPrompts.length, 50);

    let acceptedCount = 0;
    const failures: string[] = [];

    for (const prompt of scriptedPrompts) {
      const outcome = await executeValidatedLlmTurn({
        baseDocument: doc,
        provider,
        request: buildRequest(prompt, doc),
        validateRules: rules.validate,
      });

      if (outcome.accepted && outcome.attempts <= 2) {
        acceptedCount += 1;
      } else {
        failures.push(`"${prompt}" -> ${outcome.rejectionReason ?? "unknown"}`);
      }
    }

    const passRate = acceptedCount / scriptedPrompts.length;
    assert.ok(
      passRate >= 0.95,
      `Expected >= 95% valid rate across 50 prompts, got ${(passRate * 100).toFixed(1)}%. Failures: ${failures.join(" | ")}`,
    );
  });

  it("exposes curated non-deprecated model options for every provider including NVIDIA NIM", () => {
    assert.equal(NVIDIA_MODEL_ID, "nvidia/nemotron-3.5-super-vl-120b-a12b");
    for (const providerId of ["anthropic", "gemini", "nvidia", "offline"] as const) {
      const options = PROVIDER_MODEL_OPTIONS[providerId];
      assert.ok(Array.isArray(options) && options.length >= 1, `Missing options for ${providerId}`);
      assert.ok(
        options.every((opt) => !opt.id.includes("llama-3.3-70b-instruct")),
        `Deprecated model still listed for ${providerId}`,
      );
    }
    assert.equal(PROVIDER_MODEL_OPTIONS.nvidia[0]?.id, NVIDIA_MODEL_ID);
  });

  it("allows BYOK and offline requests in locked production while still blocking server-key requests", async () => {
    const prodEnv = {
      NODE_ENV: "production",
      NVIDIA_API_KEY: "nvapi-server-secret-should-not-be-used",
      ANTHROPIC_API_KEY: "sk-ant-server-secret-should-not-be-used",
    };

    // GET stays 200 in production so /editor avoids 404 console errors and masks server key flags.
    const prodGet = await handleAiChatGet({ env: prodEnv });
    assert.equal(prodGet.status, 200);
    const prodGetJson = (await prodGet.json()) as {
      routeEnabled: boolean;
      byokSupported: boolean;
      providers: Record<string, { configured: boolean }>;
    };
    assert.equal(prodGetJson.routeEnabled, false);
    assert.equal(prodGetJson.byokSupported, true);
    assert.equal(prodGetJson.providers.nvidia.configured, false);
    assert.equal(prodGetJson.providers.anthropic.configured, false);
    assert.equal(prodGetJson.providers.offline.configured, true);

    // Server-key POST without BYOK apiKey remains 404 Not found in production.
    const blockedRes = await handleAiChatPost(
      new Request("https://lazylayout.in/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "nvidia",
          messages: [{ role: "user", content: "hi" }],
        }),
      }),
      { env: prodEnv },
    );
    assert.equal(blockedRes.status, 404);

    // Whitespace / bare Bearer prefix BYOK key must also stay blocked.
    const emptyKeyRes = await handleAiChatPost(
      new Request("https://lazylayout.in/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "nvidia",
          apiKey: "Bearer   ",
          messages: [{ role: "user", content: "hi" }],
        }),
      }),
      { env: prodEnv },
    );
    assert.equal(emptyKeyRes.status, 404);

    // Offline provider succeeds in production without an API key.
    const offlineProdRes = await handleAiChatPost(
      new Request("https://lazylayout.in/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "offline",
          messages: [{ role: "user", content: "How many layers are in this document?" }],
          documentContext: { layerCount: 4 },
        }),
      }),
      { env: prodEnv },
    );
    assert.equal(offlineProdRes.status, 200);
    const offlineBody = await offlineProdRes.text();
    assert.match(offlineBody, /"keySource":"offline"/);
    assert.match(offlineBody, /4 layer\(s\)/);

    // BYOK POST succeeds in production and receives ONLY the caller's attached key.
    let forwardedKey: string | undefined;
    const stubNvidia: LlmProvider = {
      id: "nvidia",
      async *streamChat(req) {
        forwardedKey = req.apiKey;
        yield {
          type: "meta",
          provider: "nvidia",
          model: NVIDIA_MODEL_ID,
          cachePrefixHash: "feedface",
        };
        yield { type: "text_delta", delta: "Glassmorphic hover applied." };
        yield { type: "stop", handling: normalizeStopReason("end_turn") };
      },
    };

    const byokProdRes = await handleAiChatPost(
      new Request("https://lazylayout.in/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "nvidia",
          apiKey: "Bearer nvapi-user-byok-key-123",
          messages: [{ role: "user", content: "Make Get started glassmorphic" }],
        }),
      }),
      { env: prodEnv, providers: { nvidia: stubNvidia } },
    );
    assert.equal(byokProdRes.status, 200);
    const byokBody = await byokProdRes.text();
    assert.equal(forwardedKey, "nvapi-user-byok-key-123");
    assert.match(byokBody, /"keySource":"byok"/);
    assert.match(byokBody, /Glassmorphic hover applied\./);
  });
});

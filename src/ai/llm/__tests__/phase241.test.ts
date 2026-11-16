import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { MessageStreamEvent } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { NodeScriptParser } from "@/core/nodescript/Parser";
import {
  ANTHROPIC_MODEL_ID,
  AnthropicLlmProvider,
  buildAnthropicMessages,
  buildPerCommandStrictTools,
  buildStableSystemPrefix,
  buildStrictLlmTools,
  computePrefixHash,
  handleAiChatPost,
  isPrivateAiRouteEnabled,
  normalizeStopReason,
  serializeCommandsToSchemas,
  type LlmChatRequest,
  type LlmProvider,
  type LlmStreamEvent,
} from "../index";

function mockStream(events: MessageStreamEvent[]): AsyncIterable<MessageStreamEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const evt of events) {
        yield evt;
      }
    },
  };
}

function makeMessageEvents(opts: {
  id: string;
  text?: string;
  tool?: { id: string; name: string; json: string };
  stopReason:
    | "end_turn"
    | "tool_use"
    | "max_tokens"
    | "stop_sequence"
    | "pause_turn"
    | "refusal"
    | "model_context_window_exceeded"
    | null;
  cacheCreate?: number;
  cacheRead?: number;
}): MessageStreamEvent[] {
  const out: MessageStreamEvent[] = [
    {
      type: "message_start",
      message: {
        id: opts.id,
        type: "message",
        role: "assistant",
        model: ANTHROPIC_MODEL_ID,
        container: null,
        content: [],
        diagnostics: null,
        stop_reason: null,
        stop_sequence: null,
        stop_details: null,
        usage: {
          input_tokens: 120,
          output_tokens: 1,
          output_tokens_details: null,
          cache_creation_input_tokens: opts.cacheCreate ?? 0,
          cache_read_input_tokens: opts.cacheRead ?? 0,
          cache_creation: null,
          inference_geo: null,
          server_tool_use: null,
          service_tier: null,
          speed: null,
        },
      },
    },
  ];

  let index = 0;
  if (opts.text) {
    out.push({
      type: "content_block_start",
      index,
      content_block: { type: "text", text: "", citations: null },
    });
    out.push({
      type: "content_block_delta",
      index,
      delta: { type: "text_delta", text: opts.text },
    });
    out.push({ type: "content_block_stop", index });
    index += 1;
  }

  if (opts.tool) {
    out.push({
      type: "content_block_start",
      index,
      content_block: {
        type: "tool_use",
        id: opts.tool.id,
        name: opts.tool.name,
        input: {},
        caller: { type: "direct" },
      },
    });
    out.push({
      type: "content_block_delta",
      index,
      delta: { type: "input_json_delta", partial_json: opts.tool.json },
    });
    out.push({ type: "content_block_stop", index });
  }

  out.push({
    type: "message_delta",
    delta: {
      container: null,
      stop_details: null,
      stop_reason: opts.stopReason,
      stop_sequence: null,
    },
    usage: {
      input_tokens: null,
      output_tokens: 42,
      output_tokens_details: null,
      cache_creation_input_tokens: opts.cacheCreate ?? null,
      cache_read_input_tokens: opts.cacheRead ?? null,
      server_tool_use: null,
    },
  });
  out.push({ type: "message_stop" });
  return out;
}

describe("Phase 241 · LLM integration layer", () => {
  it("uses the single current 2026 Claude model constant", () => {
    assert.equal(ANTHROPIC_MODEL_ID, "claude-sonnet-5-5");
    const provider = new AnthropicLlmProvider({
      client: { messages: { stream: () => mockStream([]) } },
    });
    const { params } = provider.buildStreamParams({
      messages: [{ role: "user", content: "Summarize this document." }],
    });
    assert.equal(params.model, ANTHROPIC_MODEL_ID);
  });

  it("derives strict schema-constrained tools from MDM JSON Schema and Phase 13 commands", () => {
    const commandCatalog = serializeCommandsToSchemas([
      {
        id: "layer.nudge",
        title: "Nudge Layer",
        category: "Layer",
        description: "Move selected layers by dx, dy.",
        args: z.object({ dx: z.number(), dy: z.number() }),
      },
      {
        id: "edit.undo",
        title: "Undo",
        category: "Edit",
      },
    ]);

    const tools = buildStrictLlmTools(commandCatalog);
    assert.equal(tools.every((t) => t.strict === true), true);
    assert.deepEqual(tools[tools.length - 1].cache_control, { type: "ephemeral" });

    const mdmTool = tools.find((t) => t.name === "propose_mdm_patches");
    const patchesProp = (mdmTool?.input_schema.properties as Record<string, unknown>)
      .patches as Record<string, unknown>;
    const pathSchema = (
      (patchesProp.items as Record<string, unknown>).properties as Record<string, unknown>
    ).path as Record<string, unknown>;
    assert.match(String(pathSchema.pattern), /layers/);
    assert.match(String(pathSchema.pattern), /clips/);

    const cmdTool = tools.find((t) => t.name === "invoke_editor_command");
    const cmdIdSchema = (cmdTool?.input_schema.properties as Record<string, unknown>)
      .commandId as { enum?: string[] };
    assert.deepEqual(cmdIdSchema.enum, ["edit.undo", "layer.nudge"]);

    const perCmd = buildPerCommandStrictTools(commandCatalog);
    const nudgeTool = perCmd.find((t) => t.name === "cmd_layer_nudge");
    assert.equal(nudgeTool?.strict, true);
    assert.equal(nudgeTool?.input_schema.additionalProperties, false);
    assert.deepEqual(Object.keys(nudgeTool?.input_schema.properties ?? {}), ["dx", "dy"]);

    // Verify canonical .nls snippet recommended by tool contract parses cleanly with NodeScriptParser
    const sampleNls = [
      "#nls-version: 1.0",
      "graph FadeOnHover (type: event) {",
      "  var amount: number = 1",
      "}",
    ].join("\n");
    const parsedGraph = NodeScriptParser.parse(sampleNls);
    assert.equal(parsedGraph.name, "FadeOnHover");
  });

  it("keeps the cached system prefix deterministic across changing document contexts and reports cache reads", async () => {
    const prefixA = buildStableSystemPrefix();
    const prefixB = buildStableSystemPrefix();
    assert.deepEqual(prefixA, prefixB);
    assert.deepEqual(prefixA[0].cache_control, { type: "ephemeral" });
    assert.equal(computePrefixHash(prefixA), computePrefixHash(prefixB));

    let callIndex = 0;
    const provider = new AnthropicLlmProvider({
      client: {
        messages: {
          stream: () => {
            callIndex += 1;
            if (callIndex === 1) {
              return mockStream(
                makeMessageEvents({
                  id: "msg_cold",
                  text: "Your document has 2 layers.",
                  stopReason: "end_turn",
                  cacheCreate: 1850,
                  cacheRead: 0,
                }),
              );
            }
            return mockStream(
              makeMessageEvents({
                id: "msg_warm",
                text: "Selected layer is Hero.",
                stopReason: "end_turn",
                cacheCreate: 0,
                cacheRead: 1850,
              }),
            );
          },
        },
      },
    });

    const collect = async (req: LlmChatRequest) => {
      const out: LlmStreamEvent[] = [];
      for await (const evt of provider.streamChat(req)) out.push(evt);
      return out;
    };

    const firstEvents = await collect({
      messages: [{ role: "user", content: "How many layers?" }],
      documentContext: { layerCount: 2, selectedIds: [] },
    });
    const secondEvents = await collect({
      messages: [{ role: "user", content: "What is selected?" }],
      documentContext: { layerCount: 2, selectedIds: ["layer_hero"] },
    });

    const meta1 = firstEvents.find((e) => e.type === "meta");
    const meta2 = secondEvents.find((e) => e.type === "meta");
    assert.equal(meta1?.type, "meta");
    assert.equal(meta2?.type, "meta");
    if (meta1?.type === "meta" && meta2?.type === "meta") {
      assert.equal(meta1.cachePrefixHash, meta2.cachePrefixHash);
    }

    const usage1 = firstEvents.find((e) => e.type === "usage");
    const usage2 = secondEvents.find((e) => e.type === "usage");
    assert.equal(usage1?.type === "usage" ? usage1.usage.cacheCreationInputTokens : -1, 1850);
    assert.equal(usage2?.type === "usage" ? usage2.usage.cacheReadInputTokens : -1, 1850);
  });

  it("includes vision image content blocks in user messages", () => {
    const msgs = buildAnthropicMessages(
      [
        {
          role: "user",
          content: "Inspect this viewport frame.",
          attachments: [
            {
              mediaType: "image/png",
              base64Data: "iVBORw0KGgo=",
              label: "Stage preview",
            },
          ],
        },
      ],
      { documentName: "Landing", layerCount: 4 },
    );

    assert.equal(Array.isArray(msgs[0].content), true);
    const blocks = msgs[0].content as Array<{
      type: string;
      source?: { type: string; media_type: string; data: string };
    }>;
    const imgBlock = blocks.find((b) => b.type === "image");
    assert.deepEqual(imgBlock?.source, {
      type: "base64",
      media_type: "image/png",
      data: "iVBORw0KGgo=",
    });
  });

  it("handles every Anthropic StopReason gracefully", async () => {
    const cases = [
      ["end_turn", "complete"],
      ["tool_use", "tool_use"],
      ["max_tokens", "truncated"],
      ["stop_sequence", "stopped"],
      ["pause_turn", "paused"],
      ["refusal", "refused"],
      ["model_context_window_exceeded", "context_exceeded"],
      [null, "unknown"],
      ["future_reason", "unknown"],
    ] as const;

    for (const [reason, expectedOutcome] of cases) {
      const normalized = normalizeStopReason(reason);
      assert.equal(normalized.outcome, expectedOutcome);
      if (reason !== "end_turn" && reason !== "tool_use") {
        assert.ok(normalized.userMessage);
      }
    }

    const refusalProvider = new AnthropicLlmProvider({
      client: {
        messages: {
          stream: () =>
            mockStream(
              makeMessageEvents({
                id: "msg_refuse",
                text: "Partial text",
                stopReason: "refusal",
              }),
            ),
        },
      },
    });
    const events: LlmStreamEvent[] = [];
    for await (const e of refusalProvider.streamChat({
      messages: [{ role: "user", content: "hi" }],
    })) {
      events.push(e);
    }
    const stopEvt = events.find((e) => e.type === "stop");
    assert.equal(stopEvt?.type === "stop" ? stopEvt.handling.outcome : null, "refused");
  });

  it("gates the route handler for developer use only and streams valid requests as SSE", async () => {
    assert.equal(isPrivateAiRouteEnabled({ NODE_ENV: "production" }), false);
    assert.equal(
      isPrivateAiRouteEnabled({ NODE_ENV: "production", NEXT_PUBLIC_ENABLE_LABS: "1" }),
      true,
    );
    assert.equal(
      isPrivateAiRouteEnabled({ NODE_ENV: "production", LAZYLAYOUT_ENABLE_AI_ROUTE: "1" }),
      true,
    );

    const lockedRes = await handleAiChatPost(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
      { env: { NODE_ENV: "production" } },
    );
    assert.equal(lockedRes.status, 404);

    const missingKeyRes = await handleAiChatPost(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
      { env: { NODE_ENV: "development" } },
    );
    assert.equal(missingKeyRes.status, 503);

    const badPayloadRes = await handleAiChatPost(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [] }),
      }),
      { env: { NODE_ENV: "development", ANTHROPIC_API_KEY: "test-key" } },
    );
    assert.equal(badPayloadRes.status, 400);

    const stubProvider: LlmProvider = {
      id: "stub",
      async *streamChat() {
        yield {
          type: "meta",
          provider: "anthropic",
          model: ANTHROPIC_MODEL_ID,
          cachePrefixHash: "0123456789abcdef",
        };
        yield { type: "text_delta", delta: "There are 3 layers in this document." };
        yield {
          type: "usage",
          usage: {
            inputTokens: 100,
            outputTokens: 12,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 900,
          },
        };
        yield { type: "stop", handling: normalizeStopReason("end_turn") };
      },
    };

    const okRes = await handleAiChatPost(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "How many layers exist?" }],
          documentContext: { layerCount: 3 },
        }),
      }),
      { provider: stubProvider, env: { NODE_ENV: "development" } },
    );
    assert.equal(okRes.status, 200);
    assert.match(okRes.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.match(okRes.headers.get("cache-control") ?? "", /no-store/);

    const sseBody = await okRes.text();
    assert.match(sseBody, /event: meta/);
    assert.match(sseBody, /There are 3 layers in this document\./);
    assert.match(sseBody, /"cacheReadInputTokens":900/);
    assert.match(sseBody, /event: stop/);
  });

  it("keeps server SDK and API key references isolated from client UI files", () => {
    const clientFiles = [
      "src/editor/shell/right-panel/useAiChat.ts",
      "src/editor/shell/RightPanelConnected.tsx",
      "src/editor/shell/EditorShell.tsx",
      "src/editor/shell/right-panel/RightPanelAiChat.tsx",
    ];
    for (const rel of clientFiles) {
      const text = readFileSync(join(process.cwd(), rel), "utf8");
      assert.equal(text.includes("@anthropic-ai/sdk"), false);
      assert.equal(text.includes("ANTHROPIC_API_KEY"), false);
      assert.equal(text.includes("NEXT_PUBLIC_ANTHROPIC"), false);
    }
  });
});

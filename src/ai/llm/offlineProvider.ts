import { IntentParser } from "@/ai/intent/IntentParser";
import type { StructuredIntent } from "@/ai/intent/intent-types";
import type { BlueprintGraph } from "@/core/ast/ASTManager";
import { TypeChecker } from "@/core/ast/TypeChecker";
import { NodeScriptParser } from "@/core/nodescript/Parser";
import { toRegistryNodeType } from "@/core/nodescript/stdlib";
import { getNodeDefinition } from "@/core/types/node-registry";
import { OFFLINE_MODEL_ID } from "./constants";
import { planBuilderTurn } from "./builderPlanner";
import { buildStableSystemPrefix, computePrefixHash } from "./promptPrefix";
import {
  normalizeStopReason,
  type LlmChatRequest,
  type LlmProvider,
  type LlmStreamEvent,
  type NodeScriptGraphProposal,
} from "./types";

function toPascalGraphName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "");
  if (!cleaned) return "DefaultGraph";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Deterministic NodeScript (`.nls`) synthesizer migrated from v1.1 heuristics
 * (replaces the removed `ConstrainedDecoder.ts` in Phase 242).
 */
export function synthesizeNodeScriptFromIntent(intent: StructuredIntent): string {
  const lines: string[] = [];
  lines.push("#nls-version: 1.0");

  const graphName = toPascalGraphName(
    intent.primaryGoal.length < 30 ? intent.primaryGoal : `${intent.category}Flow`,
  );
  lines.push(`graph ${graphName} {`);

  const category = intent.category;
  const mainEntity = intent.entities[0]?.name || "Item";

  switch (category) {
    case "auth":
      lines.push('  node onLogin : Event.onClick(component: "LoginButton")');
      lines.push('  node authApi : API.request(endpoint: "/api/auth/login", method: "POST")');
      lines.push("  node branchOk : Flow.branch");
      lines.push('  node navHome : Navigation.push(route: "/dashboard")');
      lines.push("");
      lines.push("  wire onLogin.exec -> authApi.execIn");
      lines.push("  wire authApi.execOut -> branchOk.execIn");
      lines.push("  wire authApi.isOk -> branchOk.condition");
      lines.push("  wire branchOk.trueExec -> navHome.execIn");
      break;

    case "crud":
      lines.push("  node onPageLoad : Event.onPageLoad");
      lines.push(`  node queryDb : Database.query(table: "${mainEntity}s", limit: 50)`);
      lines.push(`  node logResult : Utility.printString(message: "${mainEntity}s loaded")`);
      lines.push("");
      lines.push("  wire onPageLoad.exec -> queryDb.execIn");
      lines.push("  wire queryDb.execOut -> logResult.execIn");
      if (intent.actions.some((a) => a.flowType === "create")) {
        lines.push(`  node onFormSub : Event.onSubmit(formId: "${mainEntity}Form")`);
        lines.push(`  node insertRow : Database.insert(table: "${mainEntity}s")`);
        lines.push("  wire onFormSub.exec -> insertRow.execIn");
      }
      break;

    case "e-commerce":
      lines.push('  node onAddCart : Event.onClick(component: "AddToCartBtn")');
      lines.push('  node cartState : Variables.set(varName: "cartCount")');
      lines.push('  node onCheckout : Event.onClick(component: "CheckoutBtn")');
      lines.push('  node payApi : API.request(endpoint: "/api/checkout", method: "POST")');
      lines.push('  node navConfirm : Navigation.push(route: "/order-confirmation")');
      lines.push("");
      lines.push("  wire onAddCart.exec -> cartState.execIn");
      lines.push("  wire onCheckout.exec -> payApi.execIn");
      lines.push("  wire payApi.execOut -> navConfirm.execIn");
      break;

    case "dashboard":
      lines.push("  node onPageLoad : Event.onPageLoad");
      lines.push('  node fetchMetrics : API.request(endpoint: "/api/analytics", method: "GET")');
      lines.push('  node logMetrics : Utility.printString(message: "Metrics loaded")');
      lines.push("");
      lines.push("  wire onPageLoad.exec -> fetchMetrics.execIn");
      lines.push("  wire fetchMetrics.execOut -> logMetrics.execIn");
      break;

    case "form":
      lines.push('  node onFormSub : Event.onSubmit(formId: "UserForm")');
      lines.push(`  node saveDb : Database.insert(table: "${mainEntity}s")`);
      lines.push('  node logDone : Utility.printString(message: "Form saved successfully")');
      lines.push("");
      lines.push("  wire onFormSub.exec -> saveDb.execIn");
      lines.push("  wire saveDb.execOut -> logDone.execIn");
      break;

    default:
      lines.push("  node onPageLoad : Event.onPageLoad");
      lines.push('  node printMsg : Utility.printString(message: "Graph Initialized")');
      lines.push("");
      lines.push("  wire onPageLoad.exec -> printMsg.execIn");
      break;
  }

  lines.push("}");
  return lines.join("\n");
}

/** Validates parsed NodeScript graph wire connections and pin types. */
export function validateNodeScriptGraph(graph: BlueprintGraph): string[] {
  const errors: string[] = [];
  for (const wire of graph.wires) {
    const sourceNode = graph.nodes[wire.sourceNodeId];
    const targetNode = graph.nodes[wire.targetNodeId];
    if (!sourceNode || !targetNode) {
      errors.push(`Missing node reference in wire '${wire.id}'`);
      continue;
    }

    const sourceDef = getNodeDefinition(toRegistryNodeType(sourceNode.type));
    const targetDef = getNodeDefinition(toRegistryNodeType(targetNode.type));
    const sourcePin = sourceDef?.outputs.find(
      (p) => p.name === wire.sourcePinId || p.id === wire.sourcePinId,
    );
    const targetPin = targetDef?.inputs.find(
      (p) => p.name === wire.targetPinId || p.id === wire.targetPinId,
    );

    if (!sourcePin) {
      errors.push(`UNKNOWN_PIN: Output pin '${wire.sourcePinId}' not found on '${sourceNode.id}'`);
      continue;
    }
    if (!targetPin) {
      errors.push(`UNKNOWN_PIN: Input pin '${wire.targetPinId}' not found on '${targetNode.id}'`);
      continue;
    }

    const check = TypeChecker.validateWireConnection(
      {
        sourceNodeId: wire.sourceNodeId,
        sourcePin,
        targetNodeId: wire.targetNodeId,
        targetPin,
      },
      { silent: true },
    );
    if (!check.isValid) {
      errors.push(`PIN_TYPE_MISMATCH: ${check.error || "Type incompatibility"}`);
    }
  }
  return errors;
}

/** Synthesizes and parses a valid `.nls` BlueprintGraph from a structured intent. */
export function buildNodeScriptFromIntent(intent: StructuredIntent): {
  script: string;
  graph: BlueprintGraph;
  diagnostics: string[];
} {
  const script = synthesizeNodeScriptFromIntent(intent);
  const graph = NodeScriptParser.parse(script);
  const diagnostics = validateNodeScriptGraph(graph);
  return { script, graph, diagnostics };
}

/**
 * Deterministic v1.1 offline LLM provider (`id = "offline"`), doubling as
 * zero-key studio fallback and Phase 242 validation oracle.
 */
export class OfflineDeterministicProvider implements LlmProvider {
  public readonly id = "offline";

  public async *streamChat(
    request: LlmChatRequest,
    _options: { signal?: AbortSignal } = {},
  ): AsyncIterable<LlmStreamEvent> {
    const prefix = buildStableSystemPrefix(request.commandSchemas);
    const cachePrefixHash = computePrefixHash(prefix);
    const userMessages = request.messages.filter((m) => m.role === "user");
    const lastUser = userMessages[userMessages.length - 1];
    const effectiveUser =
      lastUser?.content.startsWith("Your previous output failed validation")
        ? ([...userMessages]
            .reverse()
            .find((m) => !m.content.startsWith("Your previous output failed validation")) ?? lastUser)
        : lastUser;
    const prompt = effectiveUser?.content.trim() ?? "";
    const lower = prompt.toLowerCase();

    yield {
      type: "meta",
      provider: this.id,
      model: OFFLINE_MODEL_ID,
      cachePrefixHash,
    };

    const isQuestion =
      /^(what|how many|which|list|explain|summarize|describe|tell me|show me)\b/.test(lower) ||
      prompt.endsWith("?");
    const isGraphFlow = /\b(\.nls|nodescript|graph|auth|login|checkout|crud|dashboard|workflow|pipeline)\b/.test(
      lower,
    );

    if (isQuestion) {
      const ctx = request.documentContext;
      const layerCount = ctx?.layerCount ?? ctx?.layers?.length ?? 0;
      const selected = ctx?.selectedIds ?? [];
      const layerNames = (ctx?.layers ?? []).slice(0, 8).map((l) => `${l.name} (${l.type})`);
      const answer = [
        `Document "${ctx?.documentName ?? "Untitled"}" currently has ${layerCount} layer(s), ${ctx?.clipCount ?? 0} clip(s), and ${ctx?.trackCount ?? 0} track(s).`,
        selected.length > 0 ? `Selected IDs: ${selected.join(", ")}.` : "No layer is currently selected.",
        layerNames.length > 0 ? `Layers: ${layerNames.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" ");

      yield { type: "text_delta", delta: answer };
      yield {
        type: "tool_use",
        id: "offline_answer_1",
        name: "answer_about_document",
        input: {
          answer,
          referencedLayerIds: selected,
          referencedPropertyPaths: [],
        },
      };
    } else if (isGraphFlow) {
      const intent = IntentParser.parse(prompt);
      const { script } = buildNodeScriptFromIntent(intent);
      const proposal: NodeScriptGraphProposal = {
        graphName: toPascalGraphName(intent.category + "Flow"),
        graphType: "event",
        source: script,
        summary: `Synthesized deterministic .nls graph (${intent.category}) from "${prompt}".`,
      };
      yield { type: "text_delta", delta: proposal.summary };
      yield {
        type: "tool_use",
        id: "offline_nls_1",
        name: "propose_nodescript_graph",
        input: proposal,
      };
    } else {
      const result = planBuilderTurn({
        prompt,
        documentContext: request.documentContext,
        messages: request.messages,
      });
      yield { type: "text_delta", delta: result.explanation };
      yield {
        type: "tool_use",
        id: "offline_patch_1",
        name: "propose_mdm_patches",
        input: {
          summary: result.summary,
          patches: result.patches,
        },
      };
    }

    yield {
      type: "usage",
      usage: {
        inputTokens: prompt.length,
        outputTokens: 64,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
    };
    yield { type: "stop", handling: normalizeStopReason("end_turn") };
  }
}

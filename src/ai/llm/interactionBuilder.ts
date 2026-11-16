import type { MotionDocument } from "@/core/document/schema";
import { NodeScriptParser } from "@/core/nodescript/Parser";
import { validateNodeScriptGraph } from "./offlineProvider";
import type { NodeScriptGraphProposal } from "./types";

export type InteractionTrigger = "click" | "hover" | "scroll" | "load" | "submit" | "escape";

export interface InteractionRuleSpec {
  trigger: InteractionTrigger;
  targetLayerId: string;
  targetLayerName: string;
  actions: string[];
}

export interface BuiltInteractionResult {
  valid: boolean;
  rule: InteractionRuleSpec;
  nodeScript: NodeScriptGraphProposal;
  summary: string;
  errors: string[];
}

function detectTrigger(prompt: string): InteractionTrigger {
  const p = prompt.toLowerCase();
  if (/\b(hover|pointer\s*enter|mouse\s*over|cursor)\b/.test(p)) return "hover";
  if (/\bscroll\b/.test(p)) return "scroll";
  if (/\b(submit|form)\b/.test(p)) return "submit";
  if (/\bescape|esc\b/.test(p)) return "escape";
  if (/\b(load|mount|start)\b/.test(p)) return "load";
  return "click";
}

function detectActions(prompt: string): string[] {
  const p = prompt.toLowerCase();
  const actions: string[] = [];
  if (/\bconfetti|burst|spark|particle\b/.test(p)) actions.push("EmitConfetti");
  if (/\bflip\b/.test(p)) actions.push("FlipCard");
  if (/\bmagnetic|pull|attract\b/.test(p)) actions.push("MagneticPull");
  if (/\belevat|lift|shadow\b/.test(p)) actions.push("Elevate");
  if (/\bopen|show|expand|reveal\b/.test(p)) actions.push("RevealTarget");
  if (/\bclose|dismiss|hide|collapse\b/.test(p)) actions.push("HideTarget");
  if (/\btoggle|switch|theme\b/.test(p)) actions.push("ToggleState");
  if (/\btoast|notif|copied\b/.test(p)) actions.push("ShowToast");
  if (/\bnavigate|route|next|step\b/.test(p)) actions.push("NavigateNext");
  if (actions.length === 0) actions.push("PlayTransition");
  return actions;
}

function pickTargetLayer(
  doc: MotionDocument,
  prompt: string,
  preferredIds?: readonly string[],
): { id: string; name: string } {
  if (preferredIds && preferredIds.length > 0) {
    const layer = doc.layers[preferredIds[0]];
    if (layer) return { id: layer.id, name: layer.name };
  }
  const p = prompt.toLowerCase();
  const layers = Object.values(doc.layers);
  const byName = layers.find((l) => p.includes(l.name.toLowerCase()));
  if (byName) return { id: byName.id, name: byName.name };
  if (/\bbutton|cta\b/.test(p)) {
    const btn = layers.find((l) => l.archetype === "button");
    if (btn) return { id: btn.id, name: btn.name };
  }
  const fallback = layers[0];
  return fallback ? { id: fallback.id, name: fallback.name } : { id: "root", name: "Root" };
}

/**
 * Phase 246 AI interaction builder:
 * Converts natural-language interaction descriptions into a validated `.nls` NodeScript
 * graph (`NodeScriptParser.parse` + `validateNodeScriptGraph`) ready to stage as a Ghost Diff.
 */
export function buildInteractionFromPrompt(
  doc: MotionDocument,
  prompt: string,
  selectedLayerIds?: readonly string[],
): BuiltInteractionResult {
  const trigger = detectTrigger(prompt);
  const actions = detectActions(prompt);
  const target = pickTargetLayer(doc, prompt, selectedLayerIds);

  const eventNodeMap: Record<InteractionTrigger, string> = {
    click: `Event.onClick(component: "${target.name}")`,
    hover: `Event.onClick(component: "${target.name}")`,
    scroll: "Event.onPageLoad",
    load: "Event.onPageLoad",
    submit: `Event.onSubmit(formId: "${target.name}")`,
    escape: "Event.onPageLoad",
  };

  const lines: string[] = [
    "#nls-version: 1.0",
    "graph InteractionRule (type: event) {",
    `  node trigger : ${eventNodeMap[trigger]}`,
  ];

  let prevNode = "trigger";
  let prevPin = "exec";
  actions.forEach((action, idx) => {
    const alias = `step${idx + 1}`;
    const nodeExpr =
      action === "NavigateNext"
        ? 'Navigation.push(route: "/next")'
        : action === "ToggleState"
          ? `Variables.set(varName: "${target.id}Active")`
          : `Utility.printString(message: "${action} on ${target.name}")`;
    lines.push(`  node ${alias} : ${nodeExpr}`);
    lines.push(`  wire ${prevNode}.${prevPin} -> ${alias}.execIn`);
    prevNode = alias;
    prevPin = "execOut";
  });

  lines.push("}");
  const source = lines.join("\n");

  const errors: string[] = [];
  try {
    const graph = NodeScriptParser.parse(source);
    errors.push(...validateNodeScriptGraph(graph));
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Failed to parse generated .nls graph.");
  }

  return {
    valid: errors.length === 0,
    rule: {
      trigger,
      targetLayerId: target.id,
      targetLayerName: target.name,
      actions,
    },
    nodeScript: {
      graphName: "InteractionRule",
      graphType: "event",
      source,
      summary: `When ${trigger} on "${target.name}", run ${actions.join(" -> ")}.`,
    },
    summary: `Built ${trigger} interaction rule for "${target.name}" (${actions.join(", ")}) in .nls format.`,
    errors,
  };
}

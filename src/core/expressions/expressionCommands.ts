import { z } from "zod";
import { defineTypedCommand } from "../commands";
import type { PropValue } from "../document/registry";
import { setLayerProps, transaction } from "../editing/editOps";
import { evaluate } from "../kernel/evaluate";
import { describeChain, expressionCycleIf, isLinkable, linkCycleMessage } from "../links/linkModel";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import { getTransport } from "../time/transport";
import { setKeyframeAt } from "../timeline/keyframeOps";
import { setStopwatch } from "../timeline/timelineOps";
import { EXPR_SLOTS, exprPath, readExpressions } from "./exprModel";
import { parseExpression } from "./parse";

/**
 * Expression commands (ROADMAP Phase 77, Law 20): put an expression on a property, take it off, or bake it to keyframes
 * (After Effects' "Convert Expression to Keyframes"). A bad expression, or one that would close a cycle through the layers
 * it refers to, is refused with a code and a message before anything is written.
 */
const selected = () => useSelectionStore.getState().selectedIds[0];

/** The most keyframes a bake writes (one per frame). */
export const MAX_BAKED_KEYFRAMES = 2400;

export function registerExpressionCommands(): () => void {
  const offs: Array<() => void> = [];

  offs.push(defineTypedCommand({
    id: "layer.setExpression", title: "Put an Expression on a Property", category: "Expressions",
    args: z.object({
      id: z.string().optional(),
      property: z.string(),
      text: z.string().max(2000),
      slot: z.number().int().min(1).max(EXPR_SLOTS).optional(),
      enabled: z.boolean().optional(),
    }),
    run: ({ id: given, property, text, slot: wanted, enabled }) => {
      const doc = getDocument();
      const id = given ?? selected();
      const layer = id ? doc.layers[id] : undefined;
      if (!id || !layer) return { ok: false, code: "NO_LAYER", message: "No layer to put an expression on." };
      if (!isLinkable(property, layer.archetype)) return { ok: false, code: "NOT_LINKABLE", message: `${property} can't be driven by an expression (it must be a number, length or angle this layer has).` };
      const parsed = parseExpression(text);
      if (!parsed.ok) {
        const first = parsed.errors[0];
        return { ok: false, code: first.code, errors: parsed.errors, message: `[${first.code}] ${first.message} (at character ${first.at + 1})` };
      }
      const existing = readExpressions(layer.properties);
      const slot = wanted ?? existing.find((e) => e.target === property)?.slot ?? Array.from({ length: EXPR_SLOTS }, (_, i) => i + 1).find((s) => !existing.some((e) => e.slot === s));
      if (slot === undefined) return { ok: false, code: "EXPR_SLOTS_FULL", message: `A layer can have ${EXPR_SLOTS} expressions.` };
      const without = { layers: { ...doc.layers, [id]: { ...layer, properties: { ...layer.properties, [exprPath(slot, "enabled")]: false } } } };
      const chain = expressionCycleIf(without, id, property, text);
      if (chain) return { ok: false, code: "LINK_CYCLE", chain: chain.map((n) => ({ layerId: n.layerId, property: n.property })), message: linkCycleMessage(doc, chain) };
      setLayerProps([id], { [exprPath(slot, "target")]: property, [exprPath(slot, "text")]: text, [exprPath(slot, "enabled")]: enabled ?? true }, "Set expression");
      return { ok: true, slot, description: describeChain(getDocument(), [{ layerId: id, property }]) };
    },
  }));

  offs.push(defineTypedCommand({
    id: "layer.removeExpression", title: "Remove an Expression", category: "Expressions",
    args: z.object({ id: z.string().optional(), slot: z.number().int().min(1).max(EXPR_SLOTS).optional(), property: z.string().optional() }),
    run: ({ id: given, slot, property }) => {
      const id = given ?? selected();
      const layer = id ? getDocument().layers[id] : undefined;
      if (!id || !layer) return { removed: 0 };
      const found = readExpressions(layer.properties).filter((e) => (slot === undefined || e.slot === slot) && (property === undefined || e.target === property));
      if (found.length === 0) return { removed: 0 };
      const patch: Record<string, PropValue | null> = {};
      for (const e of found) for (const name of ["target", "text", "enabled"] as const) patch[exprPath(e.slot, name)] = null;
      setLayerProps([id], patch, "Remove expression");
      return { removed: found.length };
    },
  }));

  offs.push(defineTypedCommand({
    id: "layer.bakeExpression", title: "Convert an Expression to Keyframes", category: "Expressions",
    args: z.object({ id: z.string().optional(), property: z.string(), from: z.number().min(0).optional(), to: z.number().min(0).optional() }),
    run: ({ id: given, property, from, to }) => {
      const id = given ?? selected();
      const transport = getTransport();
      const doc = getDocument();
      const layer = id ? doc.layers[id] : undefined;
      const comp = doc.compositions[transport.compositionId];
      if (!id || !layer || !comp) return { ok: false, code: "NO_LAYER", message: "No layer to bake." };
      const expr = readExpressions(layer.properties).find((e) => e.enabled && e.target === property);
      if (!expr) return { ok: false, code: "NO_EXPRESSION", message: `${property} has no expression to bake.` };
      const start = from ?? comp.workArea.start;
      const end = Math.min(to ?? comp.workArea.end, comp.duration);
      const frames = Math.floor((end - start) * comp.fps + 1e-9) + 1;
      if (frames > MAX_BAKED_KEYFRAMES) return { ok: false, code: "TOO_LONG", message: `That is ${frames} frames; a bake writes at most ${MAX_BAKED_KEYFRAMES} (narrow the work area).` };
      // sample with the expression still on, a keyframe per frame
      const samples: Array<{ time: number; value: number }> = [];
      for (let f = 0; f < frames; f++) {
        const time = Math.round((start + f / comp.fps) * 1e6) / 1e6;
        const v = evaluate(doc, comp.id, id, time)[property];
        if (typeof v === "number" && Number.isFinite(v)) samples.push({ time, value: v });
      }
      transaction("Convert expression to keyframes", () => {
        const patch: Record<string, PropValue | null> = {};
        for (const name of ["target", "text", "enabled"] as const) patch[exprPath(expr.slot, name)] = null;
        setLayerProps([id], patch, "Remove expression");
        setStopwatch(id, property, false); // any keyframes the property had give way to the baked ones
        for (const s of samples) setKeyframeAt(id, property, s.time, { value: s.value, compositionId: comp.id });
      });
      return { ok: true, keyframes: samples.length };
    },
  }));

  return () => offs.forEach((off) => off());
}

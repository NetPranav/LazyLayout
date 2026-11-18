"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/editor/components/Button";
import { NumberField } from "@/editor/components/NumberField";
import { Toggle } from "@/editor/components/Toggle";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { useEditBreakpointId } from "@/core/store/useBreakpointStore";
import { appliedBreakpoints, breakpointsOf, isBase, resolveLayerAt } from "@/core/breakpoints/breakpoints";
import { MOTION_AT_PATHS, motionAtOf, reducedPolicyOf } from "@/core/breakpoints/breakpointMotion";
import { useMotionPreferenceStore } from "@/core/store/useMotionPreferenceStore";
import { Select } from "@/editor/components/Select";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Motion at this size (ROADMAP Phase 88): whether the layer's animation plays at the breakpoint being viewed, how
 * slow and how far. Set while viewing Mobile, they are Mobile's (and anything smaller); set at the largest size they
 * are the layer's everywhere. Every control calls `layer.setMotionAt`.
 */
/** Phase 93: what is left of the animation for someone who asked for reduced motion. */
const REDUCED = [
  { value: "auto", label: "Fades only", hint: "Opacity and colour still animate; movement and loops don't" },
  { value: "full", label: "Plays in full", hint: "This animation is safe for everyone" },
  { value: "off", label: "Doesn't play" },
];
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const MotionAtSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document);
  const editing = useEditBreakpointId();
  const [message, setMessage] = useState("");
  const reducedView = useMotionPreferenceStore((p) => p.reduced);
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  if (!layer || !selectedId) return null;

  const list = breakpointsOf(doc);
  const base = isBase(list, editing);
  const here = base ? list[0] : list.find((b) => b.id === editing)!;
  const seen = base ? layer : resolveLayerAt(layer, appliedBreakpoints(list, editing));
  const m = motionAtOf(seen.properties);
  const ownHere = !base && MOTION_AT_PATHS.some((p) => layer.overrides?.[here.id]?.[p] !== undefined);
  const run = (args: Record<string, unknown>) => {
    const out = tryRunCommand("layer.setMotionAt", { ids: [selectedId], ...args });
    setMessage(out.ok ? "" : (out.message ?? "That did not work."));
  };

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="motion-at">
      <p className="ll:m-0 ll:text-micro ll:text-primary" role="status" aria-label="Motion breakpoint">
        {base ? `At every size (${here.name} and smaller)` : `At ${here.name} and smaller`}
      </p>
      <OptionRow label="Plays">
        <Toggle size="sm" aria-label="Animation plays at this size" checked={m.plays} onChange={(plays) => run({ plays })} />
      </OptionRow>
      <OptionRow label="Time">
        <NumberField size="sm" aria-label="Animation time at this size" title="Every delay and duration is multiplied by this: 200 % is twice as slow" value={+(m.timeScale * 100).toFixed(1)} min={10} max={1000} step={10} suffix="%" onChange={(v) => run({ timeScale: clamp(v, 10, 1000) / 100 })} />
      </OptionRow>
      <OptionRow label="Distance">
        <NumberField size="sm" aria-label="Animation distance at this size" title="How far the layer travels, turns and grows: 50 % is half the movement, 0 % leaves only fades and colour" value={+(m.distance * 100).toFixed(1)} min={0} max={400} step={10} suffix="%" onChange={(v) => run({ distance: clamp(v, 0, 400) / 100 })} />
      </OptionRow>
      <OptionRow label="Loops">
        <Toggle size="sm" aria-label="Loops run at this size" checked={m.loops} onChange={(loops) => run({ loops })} />
      </OptionRow>
      <OptionRow label="Reduced">
        <Select aria-label="Animation under reduced motion" size="sm" width="100%" options={REDUCED} value={reducedPolicyOf(seen.properties)} onChange={(v) => run({ reduced: v })} />
      </OptionRow>
      <OptionRow label="Show it">
        <Toggle size="sm" aria-label="Show the canvas as reduced motion" checked={reducedView} onChange={(on) => void tryRunCommand("view.reducedMotion", { on })} />
      </OptionRow>
      {ownHere && (
        <Button size="sm" aria-label="Same motion as larger sizes" title={`Takes off what was set for ${here.name}`} onClick={() => run({ reset: true })}>
          Same as larger sizes
        </Button>
      )}
      <p className="ll:m-0 ll:text-micro ll:text-muted">{base ? "Switch the frame to a smaller size (Tablet, Mobile) to make the animation calmer there only." : `Changes here apply at ${here.name} and anything smaller.`}</p>
      {message && (
        <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">
          {message}
        </p>
      )}
    </div>
  );
};

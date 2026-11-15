"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { subpathCount } from "@/core/paths/morphMatch";
import { hasDraw } from "@/core/paths/strokeDraw";
import { placementsOf, toComposition } from "@/core/timeline/keyframeOps";
import { getTransport } from "@/core/time/transport";
import { Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Morph & draw (ROADMAP Phase 85), for a layer drawn from one path (a path or an icon): how much of its stroke is drawn
 * (and a button that animates it drawing on), and morphing it into another path, with the fixes for a morph that
 * twists. Every control calls a command (`path.setDraw`, `path.animateDraw`, `path.morphTo`, `path.setMorph`), so each
 * change is one undo step. `draw.start`, `draw.end` and `draw.offset` are properties, so the timeline keyframes them.
 */
const NONE = "__none__";
const MATCHES = [
  { value: "auto", label: "Automatic", hint: "Start point and direction chosen so the points travel least" },
  { value: "order", label: "As drawn", hint: "Morph the two paths point by point, as each was drawn" },
];
/** The animations this section makes, by the property they keyframe. The timeline has no rows for them yet, so they are listed (and removed) here. */
const ANIMATIONS: Record<string, string> = { "draw.end": "Stroke draws on", "draw.start": "Stroke draws off", "draw.offset": "Stroke slides", "svg.path": "Path morphs" };
const seconds = (t: number) => `${(Math.round(t * 100) / 100).toFixed(2)}s`;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pressClass = (on: boolean) =>
  `ll:h-7 ll:px-2 ll:text-left ll:text-small ll:rounded-sm ll:border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ${on ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active" : "ll:bg-surface-bar ll:text-muted ll:border-border ll:hover:text-primary"}`;

export const MorphDrawSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document); // re-read on every change (undo, redo, the timeline, an agent)
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(1);
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  if (!layer || !selectedId || (layer.archetype !== "svgPath" && layer.archetype !== "icon")) return null;

  const p = layer.properties;
  const num = (path: string, fallback: number) => (typeof p[path] === "number" ? (p[path] as number) : fallback);
  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, args);
    const inner = out.ok ? (out.result as { ok?: boolean; message?: string } | undefined) : undefined;
    setMessage(!out.ok ? (out.message ?? "That did not work.") : inner?.ok === false ? (inner.message ?? "That did not work.") : "");
  };
  const draw = (args: Record<string, unknown>) => run("path.setDraw", { ids: [selectedId], ...args });
  const morph = (args: Record<string, unknown>) => run("path.setMorph", { ids: [selectedId], ...args });

  const drawing = hasDraw(p);
  const several = subpathCount(typeof p["svg.path"] === "string" ? (p["svg.path"] as string) : "") > 1;
  const animations = placementsOf(doc, getTransport().compositionId, selectedId).flatMap((placement) =>
    placement.clip.tracks
      .filter((t) => ANIMATIONS[t.property] !== undefined && t.keyframes.length > 0)
      .map((t) => ({ property: t.property, label: ANIMATIONS[t.property], keys: t.keyframes.length, from: toComposition(placement, t.keyframes[0].time), to: toComposition(placement, t.keyframes[t.keyframes.length - 1].time) })),
  );
  const morphs = animations.some((a) => a.property === "svg.path" && a.keys > 1);
  // the layers this one can morph into: the same kind (a path's drawing space is not an icon's), with a path
  const others = Object.values(doc.layers).filter((l) => l.id !== selectedId && l.archetype === layer.archetype && typeof l.properties["svg.path"] === "string" && l.properties["svg.path"] !== "");
  const morphTargets = [{ value: NONE, label: others.length > 0 ? "Morph into…" : `No other ${layer.archetype === "icon" ? "icon" : "path"} to morph into` }, ...others.map((l) => ({ value: l.id, label: l.name }))];

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="morph-draw">
      <OptionRow label="Length">
        <NumberField size="sm" aria-label="Animation length" title="How long the two buttons below make their animation, in seconds, starting at the playhead." value={duration} min={0.05} max={600} step={0.1} suffix="s" onChange={(v) => setDuration(clamp(v, 0.05, 600))} />
      </OptionRow>

      {/* Stroke drawing */}
      <button type="button" aria-label="Draw stroke on" title="Adds two keyframes at the playhead: the stroke starts undrawn and is drawn to its end over the length above." onClick={() => run("path.animateDraw", { ids: [selectedId], duration })} className={pressClass(false)}>
        Draw the stroke on
      </button>
      <button type="button" aria-pressed={drawing} aria-label="Trim stroke" title="Show only part of the stroke. Start, End and Offset can be keyframed in the timeline." onClick={() => draw(drawing ? { clear: true } : { start: 0, end: 1 })} className={pressClass(drawing)}>
        {drawing ? "Trim stroke: on" : "Trim stroke"}
      </button>
      {drawing && (
        <OptionGroup>
          <OptionRow label="Start">
            <NumberField size="sm" aria-label="Draw start" title="Where the drawn part begins, as a percentage of the stroke's length." value={+(num("draw.start", 0) * 100).toFixed(2)} min={0} max={100} step={5} suffix="%" onChange={(v) => draw({ start: clamp(v, 0, 100) / 100 })} />
          </OptionRow>
          <OptionRow label="End">
            <NumberField size="sm" aria-label="Draw end" title="Where the drawn part ends, as a percentage of the stroke's length." value={+(num("draw.end", 1) * 100).toFixed(2)} min={0} max={100} step={5} suffix="%" onChange={(v) => draw({ end: clamp(v, 0, 100) / 100 })} />
          </OptionRow>
          <OptionRow label="Offset">
            <NumberField size="sm" aria-label="Draw offset" title="Slides the drawn part along the path: 100 is once round." value={+(num("draw.offset", 0) * 100).toFixed(2)} min={-10000} max={10000} step={5} suffix="%" onChange={(v) => draw({ offset: clamp(v, -10000, 10000) / 100 })} />
          </OptionRow>
          <button type="button" aria-pressed={p["draw.reverse"] === true} aria-label="Draw from the other end" title="Draws the stroke from the path's end towards its start." onClick={() => draw({ reverse: p["draw.reverse"] !== true })} className={pressClass(p["draw.reverse"] === true)}>
            {p["draw.reverse"] === true ? "From the other end: on" : "From the other end"}
          </button>
          {several && (
            <OptionRow label="Stagger">
              <NumberField size="sm" aria-label="Draw stagger" title="This path has several separate strokes. 0 draws them together; 100 draws them one after another." value={+(num("draw.stagger", 0) * 100).toFixed(2)} min={0} max={100} step={10} suffix="%" onChange={(v) => draw({ stagger: clamp(v, 0, 100) / 100 })} />
            </OptionRow>
          )}
          <p className="ll:m-0 ll:text-micro ll:text-muted">A stroke that is being drawn is not dashed, and a stroke with a brush, an alignment or arrowheads is not trimmed.</p>
        </OptionGroup>
      )}

      {/* Morph */}
      <Select aria-label="Morph into layer" size="sm" width="100%" options={morphTargets} value={NONE} onChange={(v) => v !== NONE && run("path.morphTo", { id: selectedId, source: v, duration })} />
      {morphs && (
        <OptionGroup>
          <OptionRow label="Matching">
            <Select aria-label="Morph matching" size="sm" width="100%" options={MATCHES} value={p["morph.match"] === "order" ? "order" : "auto"} onChange={(v) => morph({ match: v })} />
          </OptionRow>
          <OptionRow label="Start point">
            <NumberField size="sm" aria-label="Morph start point" title="Moves the second shape's start point on by this many points, when the morph turns the shape on the way (closed shapes)." value={num("morph.startOffset", 0)} min={-256} max={256} step={1} onChange={(v) => morph({ startOffset: Math.round(clamp(v, -256, 256)) })} />
          </OptionRow>
          <button type="button" aria-pressed={p["morph.reverse"] === true} aria-label="Reverse morph direction" title="Flips the second shape's direction, when the morph turns the shape inside out on the way." onClick={() => morph({ reverse: p["morph.reverse"] !== true })} className={pressClass(p["morph.reverse"] === true)}>
            {p["morph.reverse"] === true ? "Direction reversed: on" : "Reverse direction"}
          </button>
        </OptionGroup>
      )}
      {animations.map((a) => (
        <div key={a.property} data-path-animation={a.property} className="ll:flex ll:items-center ll:gap-1 ll:min-h-7">
          <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ll:text-primary" title={`${a.keys} keyframes`}>
            {a.label} · {seconds(a.from)} to {seconds(a.to)}
          </span>
          <button
            type="button"
            aria-label={`Remove animation: ${a.label}`}
            title="Remove these keyframes"
            onClick={() => run("timeline.setStopwatch", { layerId: selectedId, property: a.property, on: false })}
            className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
          >
            <Icon icon={Minus} size={14} />
          </button>
        </div>
      ))}
      <p className="ll:m-0 ll:text-micro ll:text-muted">Both are seen in Motion and Preview, at the playhead. Their keyframes are listed here; the timeline has no rows for them yet.</p>
      {message && (
        <p role="alert" aria-label="Morph and draw error" className="ll:m-0 ll:text-micro ll:text-primary">
          {message}
        </p>
      )}
    </div>
  );
};

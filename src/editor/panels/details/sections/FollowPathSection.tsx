"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { placementsOf, toComposition } from "@/core/timeline/keyframeOps";
import { getTransport } from "@/core/time/transport";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Follow a path (ROADMAP Phase 86): put the layer on a path drawn with the Pen or Pencil, and it travels along it at
 * constant speed. Every control calls a command (`path.follow`, `path.animateFollow`), one undo step each. The position
 * on the path is the property `motionPath.progress`; the timeline has no row for it yet, so its animation is listed
 * (and removed) here.
 */
const NONE = "__none__";
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const seconds = (t: number) => `${(Math.round(t * 100) / 100).toFixed(2)}s`;
const pressClass = (on: boolean) =>
  `ll:h-7 ll:px-2 ll:text-left ll:text-small ll:rounded-sm ll:border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ${on ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active" : "ll:bg-surface-bar ll:text-muted ll:border-border ll:hover:text-primary"}`;

export const FollowPathSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document); // re-read on every change (undo, redo, the timeline, an agent)
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(2);
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  if (!layer || !selectedId) return null;

  const p = layer.properties;
  const num = (path: string, fallback: number) => (typeof p[path] === "number" ? (p[path] as number) : fallback);
  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, args);
    const inner = out.ok ? (out.result as { ok?: boolean; message?: string } | undefined) : undefined;
    setMessage(!out.ok ? (out.message ?? "That did not work.") : inner?.ok === false ? (inner.message ?? "That did not work.") : "");
  };
  const follow = (args: Record<string, unknown>) => run("path.follow", { ids: [selectedId], ...args });

  const source = typeof p["motionPath.source"] === "string" && p["motionPath.source"] !== "" ? (p["motionPath.source"] as string) : "";
  const ownPath = typeof p["transform.motionPath"] === "string" && p["transform.motionPath"] !== "";
  const on = source !== "" || ownPath;
  const paths = Object.values(doc.layers).filter((l) => l.id !== selectedId && l.archetype === "svgPath" && typeof l.properties["svg.path"] === "string" && l.properties["svg.path"] !== "");
  const options = [{ value: NONE, label: paths.length > 0 || on ? "None" : "No path on the page (draw one with the Pen)" }, ...paths.map((l) => ({ value: l.id, label: l.name }))];
  const travels = placementsOf(doc, getTransport().compositionId, selectedId).flatMap((placement) =>
    placement.clip.tracks
      .filter((t) => t.property === "motionPath.progress" && t.keyframes.length > 0)
      .map((t) => ({ from: toComposition(placement, t.keyframes[0].time), to: toComposition(placement, t.keyframes[t.keyframes.length - 1].time) })),
  );
  const autoRotate = p["motionPath.autoRotate"] === true;

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="follow-path">
      <OptionRow label="Path">
        <Select aria-label="Path to follow" size="sm" width="100%" options={options} value={source !== "" && paths.some((l) => l.id === source) ? source : NONE} onChange={(v) => follow({ source: v === NONE ? null : v })} />
      </OptionRow>
      {on && (
        <OptionGroup>
          <OptionRow label="Position">
            <NumberField size="sm" aria-label="Path position" title="How far along the path the layer is: 0 is the start, 100 the end. On a closed path, more than 100 goes round again." value={+(num("motionPath.progress", 0) * 100).toFixed(2)} min={-10000} max={10000} step={5} suffix="%" onChange={(v) => follow({ progress: clamp(v, -10000, 10000) / 100 })} />
          </OptionRow>
          <OptionRow label="Offset">
            <NumberField size="sm" aria-label="Path offset" title="Added to the position. Give two layers on one path different offsets and one follows the other." value={+(num("motionPath.offset", 0) * 100).toFixed(2)} min={-10000} max={10000} step={5} suffix="%" onChange={(v) => follow({ offset: clamp(v, -10000, 10000) / 100 })} />
          </OptionRow>
          <button type="button" aria-pressed={autoRotate} aria-label="Turn along the path" title="The layer turns to face the way it is travelling." onClick={() => follow({ autoRotate: !autoRotate })} className={pressClass(autoRotate)}>
            {autoRotate ? "Turns along the path: on" : "Turn along the path"}
          </button>
          <OptionRow label="Turn">
            <NumberField size="sm" aria-label="Path turn offset" title="Degrees added to the layer's rotation while it is on the path (90 points its top along the path)." value={num("motionPath.rotate", 0)} min={-3600} max={3600} step={15} suffix="°" onChange={(v) => follow({ rotate: clamp(v, -3600, 3600) })} />
          </OptionRow>
          <OptionRow label="Length">
            <NumberField size="sm" aria-label="Travel length" title="How long the button below makes the journey, in seconds, starting at the playhead." value={duration} min={0.05} max={600} step={0.1} suffix="s" onChange={(v) => setDuration(clamp(v, 0.05, 600))} />
          </OptionRow>
          <button type="button" aria-label="Travel along the path" title="Adds two keyframes at the playhead: the layer starts at the path's start and reaches its end after the length above, at constant speed." onClick={() => run("path.animateFollow", { ids: [selectedId], duration })} className={pressClass(false)}>
            Travel along the path
          </button>
          {travels.map((a, i) => (
            <div key={i} data-path-animation="motionPath.progress" className="ll:flex ll:items-center ll:gap-1 ll:min-h-7">
              <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ll:text-primary">
                Travels · {seconds(a.from)} to {seconds(a.to)}
              </span>
              <button
                type="button"
                aria-label="Remove animation: Travels along the path"
                title="Remove these keyframes"
                onClick={() => run("timeline.setStopwatch", { layerId: selectedId, property: "motionPath.progress", on: false })}
                className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
              >
                <Icon icon={Minus} size={14} />
              </button>
            </div>
          ))}
          <p className="ll:m-0 ll:text-micro ll:text-muted">The layer sits on the path in Motion and Preview; Design shows it where it rests. Both layers must be placed freely, not inside an auto-layout stack.</p>
        </OptionGroup>
      )}
      {message && (
        <p role="alert" aria-label="Follow path error" className="ll:m-0 ll:text-micro ll:text-primary">
          {message}
        </p>
      )}
    </div>
  );
};

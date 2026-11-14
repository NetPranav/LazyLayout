"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { Button } from "@/editor/components/Button";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { documentCommands } from "@/core/store/useDocumentStore";
import { isScrollPosition } from "@/core/scroll/model";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Scroll (Design track D11, Phase 81 on the new editor): make a layer follow the scroll (a parallax that is scrubbed by how far the
 * page is scrolled) or play once when it comes into view (a reveal), with a range, and pin it so it holds still while its section
 * scrolls past. They run in a previewed frame (its Preview toggle), the way the page behaves when visited.
 */
const PROPS: Record<string, { label: string; from: number; to: number }> = {
  "transform.y": { label: "Position Y", from: 0, to: -120 },
  "transform.x": { label: "Position X", from: 0, to: 120 },
  "appearance.opacity": { label: "Opacity", from: 0, to: 1 },
  "transform.scale": { label: "Scale", from: 0.8, to: 1 },
  "transform.rotate": { label: "Rotation", from: 0, to: 90 },
};
const PROP_OPTIONS = Object.entries(PROPS).map(([value, p]) => ({ value, label: p.label }));
const MODES = [
  { value: "scrub", label: "Follows the scroll", hint: "A parallax: its value follows how far the page is scrolled" },
  { value: "reveal", label: "Plays when seen", hint: "A reveal: plays once when it comes into view" },
] as const;

const inputClass = "ll-dfield ll:w-full ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:font-mono ll:text-micro ll:text-primary ll:outline-none ll:placeholder:text-muted";

export const ScrollSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const clips = useStore(documentStore, (s) => s.document.clips);
  const [prop, setProp] = useState("transform.y");
  const [mode, setMode] = useState<"scrub" | "reveal">("scrub");
  const [from, setFrom] = useState(PROPS["transform.y"].from);
  const [to, setTo] = useState(PROPS["transform.y"].to);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pin, setPin] = useState(false);
  const [message, setMessage] = useState("");
  if (!selectedId || isMulti) return null;

  const mine = Object.values(clips).filter((c) => c.layerId === selectedId && (c.trigger === "scrollProgress" || c.trigger === "inView"));
  const badStart = start.trim() !== "" && !isScrollPosition(start.trim());
  const badEnd = end.trim() !== "" && !isScrollPosition(end.trim());

  const add = () => {
    if (badStart || badEnd) return;
    const out = tryRunCommand("motion.addScrollClip", { layerId: selectedId, property: prop, from, to, mode, ...(start.trim() ? { start: start.trim() } : {}), ...(end.trim() ? { end: end.trim() } : {}), ...(pin ? { pin: true } : {}) });
    const inner = out.ok ? (out.result as { clipId?: string | null; reason?: string } | undefined) : undefined;
    setMessage(!out.ok ? (out.message ?? "That did not work.") : inner?.clipId ? "" : (inner?.reason ?? "That did not work."));
  };

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      {mine.map((c) => (
        <div key={c.id} data-scroll-clip={c.id} className="ll:flex ll:items-center ll:gap-1.5 ll:min-h-7">
          <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ll:text-primary" title={`${c.name}: ${c.scrollTrigger?.start ?? "default start"} to ${c.scrollTrigger?.end ?? "default end"}`}>
            {c.trigger === "inView" ? "Reveal" : "Follows scroll"} · {PROPS[c.tracks[0]?.property ?? ""]?.label ?? c.tracks[0]?.property}
            {c.scrollTrigger?.pin ? " · pinned" : ""}
          </span>
          <button
            type="button"
            aria-pressed={c.scrollTrigger?.pin === true}
            aria-label={`Pin ${c.name}`}
            title="Hold the layer still while its section scrolls past."
            onClick={() => tryRunCommand("motion.setScrollTrigger", { clipId: c.id, pin: c.scrollTrigger?.pin !== true })}
            className={`ll:h-7 ll:px-2 ll:text-small ll:rounded-sm ll:border ll:cursor-pointer ll:outline-none ${c.scrollTrigger?.pin ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active" : "ll:bg-surface-bar ll:text-muted ll:border-border ll:hover:text-primary"}`}
          >
            Pin
          </button>
          <button type="button" aria-label={`Remove ${c.name}`} title="Remove" onClick={() => documentCommands.removeClip(c.id)} className="ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:text-secondary ll:hover:text-primary">
            <Icon icon={Minus} size={14} />
          </button>
        </div>
      ))}

      <OptionRow label="Animate">
        <Select
          aria-label="Scroll property"
          size="sm"
          width="100%"
          options={PROP_OPTIONS}
          value={prop}
          onChange={(v) => {
            setProp(v);
            setFrom(PROPS[v].from);
            setTo(PROPS[v].to);
          }}
        />
      </OptionRow>
      <OptionRow label="How">
        <Select aria-label="Scroll mode" size="sm" width="100%" options={MODES} value={mode} onChange={(v) => setMode(v as "scrub" | "reveal")} />
      </OptionRow>
      <OptionRow label="From → to">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <NumberField size="sm" aria-label="Scroll from" title="The value when the animation starts." value={from} step={PROPS[prop].to <= 1 && PROPS[prop].from <= 1 ? 0.1 : 10} onChange={setFrom} />
          <NumberField size="sm" aria-label="Scroll to" title="The value when it ends." value={to} step={PROPS[prop].to <= 1 && PROPS[prop].from <= 1 ? 0.1 : 10} onChange={setTo} />
        </div>
      </OptionRow>
      <OptionRow label="Starts">
        <input aria-label="Scroll start" aria-invalid={badStart} placeholder="top 80%" spellCheck={false} value={start} onChange={(e) => setStart(e.target.value)} title='When it starts: an edge of the layer, then an edge of the screen, like "top 80%" or "center center".' className={inputClass} />
      </OptionRow>
      <OptionRow label="Ends">
        <input aria-label="Scroll end" aria-invalid={badEnd} placeholder="bottom top" spellCheck={false} value={end} onChange={(e) => setEnd(e.target.value)} title='When it ends, like "bottom top".' className={inputClass} />
      </OptionRow>
      <OptionRow label="Pin">
        <button
          type="button"
          aria-pressed={pin}
          aria-label="Pin while scrolling"
          title="Hold the layer still while its section scrolls past."
          onClick={() => setPin((p) => !p)}
          className={`ll:h-7 ll:px-2 ll:text-small ll:rounded-sm ll:border ll:cursor-pointer ll:outline-none ${pin ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active" : "ll:bg-surface-bar ll:text-muted ll:border-border"}`}
        >
          {pin ? "On" : "Off"}
        </button>
      </OptionRow>
      {(badStart || badEnd) && (
        <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">
          A position is an edge of the layer, then an edge of the screen: like top 80%, center center or bottom top.
        </p>
      )}
      <Button size="sm" aria-label="Add scroll animation" onClick={add}>
        Add scroll animation
      </Button>
      {message && (
        <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">
          {message}
        </p>
      )}
    </div>
  );
};

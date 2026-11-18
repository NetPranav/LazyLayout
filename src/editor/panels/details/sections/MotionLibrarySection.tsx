"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/editor/components/Button";
import { Icon } from "@/editor/components/Icon";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { LIBRARY_CATEGORIES, getEffect, searchEffects, thumbnailOf, whyNotOn, type LibraryCategory, type LibraryEffect, type ThumbFrame } from "@/core/motionLibrary/library";
import { instancesOn, valuesOf } from "@/core/motionLibrary/libraryCommands";
import type { InspectorSectionProps } from "../types";

/**
 * The motion library (ROADMAP Phase 91): search the 51 ready-made effects, put one on the selected layer, tune it,
 * detach it into plain animation. Every control calls `library.*`. Thumbnails are loops drawn from numbers
 * (`thumbnailOf`) and played by the browser only while hovered; nothing here is a live scene.
 */
const ALL = "all";
const CATEGORY_LABEL: Record<LibraryCategory, string> = { interactive: "Interactive", media: "Media", structural: "Structural", text: "Text" };
const SHOWN = 12;

const frame = (f: ThumbFrame) => ({ opacity: f.opacity, transform: `translate(${f.x}px, ${f.y}px) scale(${f.scale}) rotate(${f.rotate}deg)`, offset: f.t });

const Thumb: React.FC<{ effect: LibraryEffect; playing: boolean }> = ({ effect, playing }) => {
  const thumb = useMemo(() => thumbnailOf(effect), [effect]);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!playing || typeof el.animate !== "function") return;
    const a = el.animate(thumb.frames.map(frame), { duration: thumb.duration * 1000, iterations: Infinity });
    return () => a.cancel();
  }, [playing, thumb]);
  const still = frame(thumb.frames[thumb.poster]);
  return (
    <span aria-hidden="true" data-testid="library-thumb" className="ll:relative ll:inline-flex ll:items-center ll:justify-center ll:w-9 ll:h-9 ll:shrink-0 ll:rounded-xs ll:bg-surface-bar ll:overflow-hidden">
      <span ref={ref} className="ll:block ll:w-4 ll:h-4 ll:rounded-xs ll:bg-control-primary-bg" style={playing ? undefined : { opacity: still.opacity, transform: still.transform }} />
    </span>
  );
};

export const MotionLibrarySection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [all, setAll] = useState(false);
  const [message, setMessage] = useState("");
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  const found = useMemo(() => searchEffects({ query, category: category === ALL ? undefined : (category as LibraryCategory) }), [query, category]);
  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, args);
    setMessage(out.ok ? "" : (out.message ?? "That did not work."));
    return out;
  };
  if (!layer || !selectedId) return null;
  const mine = instancesOn(layer.id); // re-read on every change of the document (above), so the list follows undo
  const shown = all ? found : found.slice(0, SHOWN);

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="motion-library">
      {mine.length > 0 && (
        <div className="ll:flex ll:flex-col ll:gap-1" data-testid="library-instances">
          {mine.map((fx) => {
            const effect = getEffect(fx.effectId)!;
            const values = valuesOf(fx);
            const expanded = open[fx.id] ?? true;
            return (
              <div key={fx.id} className="ll:rounded-sm ll:border ll:border-border ll:p-1.5 ll:flex ll:flex-col ll:gap-1" data-instance={fx.id}>
                <button type="button" aria-expanded={expanded} aria-label={`${effect.name} effect`} onClick={() => setOpen({ ...open, [fx.id]: !expanded })} className="ll:flex ll:items-center ll:gap-1 ll:bg-transparent ll:border-0 ll:p-0 ll:text-micro ll:text-primary ll:cursor-pointer ll:text-left">
                  <Icon icon={expanded ? ChevronDown : ChevronRight} size={12} />
                  <strong>{effect.name}</strong>
                  <span className="ll:text-muted">v{effect.version}</span>
                </button>
                {expanded && (
                  <>
                    {effect.props.map((p) => (
                      <div key={p.key} className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                        <span className="ll:font-mono ll:text-micro ll:text-muted">{p.label}</span>
                        <NumberField size="sm" aria-label={`${effect.name} ${p.label}`} value={+values[p.key].toFixed(2)} min={p.min} max={p.max} step={p.step} suffix={p.unit} onChange={(v) => run("library.setProps", { instance: fx.id, values: { [p.key]: v } })} />
                      </div>
                    ))}
                    <div className="ll:flex ll:gap-1.5">
                      <Button size="sm" aria-label={`Detach ${effect.name}`} title="Keeps the animation as ordinary clips you can edit in the timeline" onClick={() => run("library.detach", { instance: fx.id })}>Detach</Button>
                      <Button size="sm" aria-label={`Remove ${effect.name}`} onClick={() => run("library.remove", { instance: fx.id })}>Remove</Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="ll:flex ll:gap-1.5">
        <input aria-label="Search the motion library" type="search" spellCheck={false} placeholder="Search motion" value={query} onChange={(e) => setQuery(e.target.value)} className="ll-dfield ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:text-micro ll:text-primary ll:outline-none" />
        <Select aria-label="Library category" size="sm" width="104px" options={[{ value: ALL, label: "All" }, ...LIBRARY_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]} value={category} onChange={setCategory} />
      </div>
      <p className="ll:m-0 ll:text-micro ll:text-muted" role="status" aria-label="Library results">{found.length} {found.length === 1 ? "effect" : "effects"}</p>
      <ul className="ll:m-0 ll:p-0 ll:list-none ll:flex ll:flex-col ll:gap-1 ll:max-h-72 ll:overflow-y-auto" aria-label="Library effects">
        {shown.map((e) => {
          const why = whyNotOn(e, layer.archetype);
          return (
            <li key={e.id} data-effect={e.id} onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)} className="ll:flex ll:items-center ll:gap-2 ll:p-1 ll:rounded-sm ll:hover:bg-surface-bar">
              <Thumb effect={e} playing={hover === e.id} />
              <span className="ll:flex ll:flex-col ll:min-w-0 ll:flex-1">
                <span className="ll:text-micro ll:text-primary ll:truncate">{e.name}</span>
                <span className="ll:text-nano ll:text-muted ll:truncate">{CATEGORY_LABEL[e.category]} · {e.badge}</span>
              </span>
              <Button size="sm" aria-label={`Insert ${e.name}`} disabled={why !== null} title={why ?? `Put ${e.name} on ${layer.name}`} onClick={() => run("library.insert", { effectId: e.id, ids: [layer.id] })}>Insert</Button>
            </li>
          );
        })}
      </ul>
      {!all && found.length > SHOWN && <Button size="sm" aria-label="Show all library effects" onClick={() => setAll(true)}>Show all {found.length}</Button>}
      {message && <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">{message}</p>}
    </div>
  );
};

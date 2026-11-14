"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { RowColorField } from "../controls/RowColorField";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Compositing (ROADMAP Phase 74): isolate a group, filter what is behind the layer (an adjustment), cut the layer with a
 * mask, or let another layer be its matte. Every control calls a command (`layer.setBlend`, `layer.setAdjustment`,
 * `layer.setMask`, `layer.setMatte`), so each change is one undo step and agents set the same things the same way.
 */
const MODES = [
  { value: "none", label: "None" },
  { value: "alpha", label: "Alpha", hint: "Show the layer inside the shape" },
  { value: "alphaInverted", label: "Alpha inverted", hint: "Show the layer outside the shape" },
  { value: "luma", label: "Luma", hint: "The brighter the shape's fill, the more shows" },
  { value: "lumaInverted", label: "Luma inverted", hint: "The darker the shape's fill, the more shows" },
];
const SHAPES = [
  { value: "rect", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "path", label: "Path" },
];
const NONE = "__none__";
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The adjustment filters: label, command argument, property path, default, limits, and whether shown as a percentage. */
const ADJUST: ReadonlyArray<{ label: string; arg: string; path: string; fallback: number; min?: number; max?: number; step: number; percent?: boolean; title: string }> = [
  { label: "Blur", arg: "blur", path: "adjust.blur", fallback: 0, min: 0, max: 200, step: 1, title: "Blurs what is behind the layer, in pixels." },
  { label: "Brightness", arg: "brightness", path: "adjust.brightness", fallback: 1, min: 0, max: 500, step: 5, percent: true, title: "100 leaves what is behind as it is; less is darker, more is brighter." },
  { label: "Contrast", arg: "contrast", path: "adjust.contrast", fallback: 1, min: 0, max: 500, step: 5, percent: true, title: "100 leaves what is behind as it is." },
  { label: "Saturation", arg: "saturate", path: "adjust.saturate", fallback: 1, min: 0, max: 500, step: 5, percent: true, title: "0 is grey, 100 is unchanged, more is more vivid." },
  { label: "Hue", arg: "hueRotate", path: "adjust.hueRotate", fallback: 0, step: 5, title: "Turns every colour behind the layer around the colour wheel, in degrees." },
  { label: "Grayscale", arg: "grayscale", path: "adjust.grayscale", fallback: 0, min: 0, max: 100, step: 5, percent: true, title: "How grey what is behind becomes: 100 is fully grey." },
  { label: "Sepia", arg: "sepia", path: "adjust.sepia", fallback: 0, min: 0, max: 100, step: 5, percent: true, title: "How brown-toned what is behind becomes." },
  { label: "Invert", arg: "invert", path: "adjust.invert", fallback: 0, min: 0, max: 100, step: 5, percent: true, title: "How far the colours behind are inverted: 100 is a negative." },
];

const pressClass = (on: boolean) =>
  `ll:h-7 ll:px-2 ll:text-left ll:text-small ll:rounded-sm ll:border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ${on ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active" : "ll:bg-surface-bar ll:text-muted ll:border-border ll:hover:text-primary"}`;

export const CompositingSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document); // re-read on every change (undo, redo, the timeline, an agent)
  const [message, setMessage] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  if (!layer || !selectedId) return null;

  const p = layer.properties;
  const num = (path: string, fallback: number) => (typeof p[path] === "number" ? (p[path] as number) : fallback);
  const str = (path: string, fallback: string) => (typeof p[path] === "string" && p[path] !== "" ? (p[path] as string) : fallback);
  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, { ids: [selectedId], ...args });
    const inner = out.ok ? (out.result as { reason?: string } | undefined) : undefined;
    setMessage(!out.ok ? (out.message ?? "That did not work.") : (inner?.reason ?? ""));
  };

  const isolated = p["appearance.isolation"] === "isolate";
  const isAdjustment = p["render.role"] === "adjustment";
  const adjusted = ADJUST.some((a) => num(a.path, a.fallback) !== a.fallback);
  const showAdjust = adjustOpen || isAdjustment || adjusted;
  const maskMode = str("mask.mode", "none");
  const maskShape = str("mask.shape", "rect");
  const matteSource = str("matte.source", "");
  const others = Object.values(doc.layers).filter((l) => l.id !== selectedId && l.parentId !== null);
  const matteOptions = [{ value: NONE, label: "None" }, ...others.map((l) => ({ value: l.id, label: l.name }))];
  const maskNumber = (label: string, arg: string, path: string, fallback: number, title: string, opts: { min?: number; max?: number } = {}) => (
    <NumberField size="sm" aria-label={label} title={title} value={num(path, fallback)} min={opts.min} max={opts.max} step={1} onChange={(v) => run("layer.setMask", { [arg]: clamp(v, opts.min ?? -100000, opts.max ?? 100000) })} />
  );

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="compositing">
      <button
        type="button"
        aria-pressed={isolated}
        aria-label="Isolate group"
        title="Blend modes of the layers inside stop at this layer: they mix with each other, not with what is behind the group."
        onClick={() => run("layer.setBlend", { isolate: !isolated })}
        className={pressClass(isolated)}
      >
        {isolated ? "Isolated group: on" : "Isolate group"}
      </button>

      <button
        type="button"
        aria-pressed={showAdjust}
        aria-label="Adjust what is behind"
        title="Filters everything behind this layer, inside its box: blur, brightness, contrast, saturation and more."
        disabled={isAdjustment || adjusted}
        onClick={() => setAdjustOpen((o) => !o)}
        className={pressClass(showAdjust)}
      >
        {showAdjust ? "Adjusting what is behind" : "Adjust what is behind"}
      </button>
      {showAdjust && (
        <OptionGroup>
          <button
            type="button"
            aria-pressed={isAdjustment}
            aria-label="Adjustment layer"
            title="An adjustment layer draws nothing of its own: it only filters what is behind it."
            onClick={() => run("layer.setAdjustment", { asLayer: !isAdjustment })}
            className={`ll:w-full ${pressClass(isAdjustment)}`}
          >
            {isAdjustment ? "Adjustment layer: on" : "Make an adjustment layer"}
          </button>
          {ADJUST.map((a) => (
            <OptionRow key={a.arg} label={a.label}>
              <NumberField
                size="sm"
                aria-label={`Adjust ${a.label.toLowerCase()}`}
                title={a.title}
                value={+(num(a.path, a.fallback) * (a.percent ? 100 : 1)).toFixed(2)}
                min={a.min}
                max={a.max}
                step={a.step}
                suffix={a.percent ? "%" : undefined}
                onChange={(v) => run("layer.setAdjustment", { [a.arg]: clamp(v, a.min ?? -100000, a.max ?? 100000) / (a.percent ? 100 : 1) })}
              />
            </OptionRow>
          ))}
        </OptionGroup>
      )}

      <OptionRow label="Mask">
        <Select aria-label="Mask mode" size="sm" width="100%" options={MODES} value={maskMode} onChange={(v) => run("layer.setMask", { mode: v })} />
      </OptionRow>
      {maskMode !== "none" && (
        <OptionGroup>
          <OptionRow label="Shape">
            <Select aria-label="Mask shape" size="sm" width="100%" options={SHAPES} value={maskShape} onChange={(v) => run("layer.setMask", { shape: v })} />
          </OptionRow>
          {maskShape === "path" ? (
            <input
              aria-label="Mask path"
              placeholder="M0 0 L100 0 L50 100 Z"
              title="An SVG path in the layer's own pixels. Keyframe it and the mask morphs point to point."
              spellCheck={false}
              defaultValue={str("mask.path", "")}
              key={str("mask.path", "")}
              onBlur={(e) => e.target.value !== str("mask.path", "") && run("layer.setMask", { path: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="ll-dfield ll:w-full ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:font-mono ll:text-micro ll:text-primary ll:outline-none ll:placeholder:text-muted"
            />
          ) : (
            <>
              <OptionRow label="Position">
                <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
                  {maskNumber("Mask X", "x", "mask.x", 0, "The shape's left edge, from the layer's left edge.")}
                  {maskNumber("Mask Y", "y", "mask.y", 0, "The shape's top edge, from the layer's top edge.")}
                </div>
              </OptionRow>
              <OptionRow label="Size">
                <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
                  {maskNumber("Mask width", "width", "mask.width", -1, "The shape's width. -1 means as wide as the layer; 0 is a real zero, so a shape can grow from nothing.", { min: -1 })}
                  {maskNumber("Mask height", "height", "mask.height", -1, "The shape's height. -1 means as tall as the layer.", { min: -1 })}
                </div>
              </OptionRow>
              {maskShape === "rect" && <OptionRow label="Radius">{maskNumber("Mask radius", "radius", "mask.radius", 0, "Rounds the rectangle's corners.", { min: 0 })}</OptionRow>}
            </>
          )}
          <OptionRow label="Feather">{maskNumber("Mask feather", "feather", "mask.feather", 0, "Softens the mask's edge, in pixels.", { min: 0, max: 200 })}</OptionRow>
          <OptionRow label="Expand">{maskNumber("Mask expansion", "expansion", "mask.expansion", 0, "Grows the shape outward, in pixels.", { min: 0, max: 200 })}</OptionRow>
          <OptionRow label="Opacity">
            <NumberField size="sm" aria-label="Mask opacity" title="How much of the layer the mask lets through where it shows." value={Math.round(num("mask.opacity", 1) * 100)} min={0} max={100} step={5} suffix="%" onChange={(v) => run("layer.setMask", { opacity: clamp(v, 0, 100) / 100 })} />
          </OptionRow>
          {(maskMode === "luma" || maskMode === "lumaInverted") && (
            <OptionRow label="Fill">
              <RowColorField hex={str("mask.fill", "#ffffff").replace("#", "")} label="Mask fill picker" hexLabel="Mask fill hex" onChange={(hex) => run("layer.setMask", { fill: `#${hex}` })} />
            </OptionRow>
          )}
        </OptionGroup>
      )}

      {others.length > 0 && (
        <>
          <OptionRow label="Matte" title="Another layer's shape decides where this layer shows, and follows that layer as it animates.">
            <Select aria-label="Matte source layer" size="sm" width="100%" options={matteOptions} value={matteSource || NONE} onChange={(v) => run("layer.setMatte", { sourceId: v === NONE ? null : v })} />
          </OptionRow>
          {matteSource && (
            <OptionGroup>
              <OptionRow label="Mode">
                <Select aria-label="Matte mode" size="sm" width="100%" options={MODES.slice(1)} value={str("matte.mode", "alpha")} onChange={(v) => run("layer.setMatte", { mode: v })} />
              </OptionRow>
              <button
                type="button"
                aria-pressed={p["matte.showSource"] === true}
                aria-label="Show matte source"
                title="The matte layer is hidden while it is used as a matte. Turn this on to keep drawing it."
                onClick={() => run("layer.setMatte", { showSource: p["matte.showSource"] !== true })}
                className={`ll:w-full ${pressClass(p["matte.showSource"] === true)}`}
              >
                {p["matte.showSource"] === true ? "Matte layer: shown" : "Matte layer: hidden"}
              </button>
              <p data-matte-note className="ll:m-0 ll:text-micro ll:text-muted">A matte follows its layer as it animates, so it is drawn in Motion and Preview, not in Design.</p>
            </OptionGroup>
          )}
        </>
      )}
      {message && (
        <p role="alert" aria-label="Compositing error" className="ll:m-0 ll:text-micro ll:text-primary">
          {message}
        </p>
      )}
    </div>
  );
};

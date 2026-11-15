"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { ChevronDown, ChevronUp, Eye, EyeOff, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { readerOf } from "@/core/render/compositing";
import { FX_LABELS, FX_PARAMS, FX_SLOTS, FX_TYPES, fxPath, readStack, type FxType } from "@/core/render/fxStack";
import { MOTION_BLUR_ROUTE, routeEffect } from "@/core/rules/effectRouting";
import type { PropValue } from "@/core/document/registry";
import { RowColorField } from "../controls/RowColorField";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Effect stack and motion blur (ROADMAP Phase 75): an ordered list of up to eight effects, each with its settings and the
 * route the rules chose for it (CSS or SVG, with the reason), and the opt-in motion blur. Every control calls a command
 * (`layer.addEffect`, `setEffect`, `moveEffect`, `removeEffect`, `setMotionBlur`). Each setting is the property
 * `fx.<slot>.<name>`, so the timeline's stopwatches keyframe it.
 */
const ADD = "__add__";
const ADD_OPTIONS = [{ value: ADD, label: "Add an effect…" }, ...FX_TYPES.map((t) => ({ value: t as string, label: FX_LABELS[t] }))];

/** How each setting is shown: its label, limits, and whether it is a percentage of 1. */
const PARAM: Record<string, { label: string; min?: number; max?: number; step: number; percent?: boolean; title: string }> = {
  radius: { label: "Radius", min: 0, max: 400, step: 1, title: "How far the effect spreads, in pixels." },
  intensity: { label: "Intensity", min: 0, max: 8, step: 1, title: "How many times the glow is laid over itself: more is stronger." },
  x: { label: "X", step: 1, title: "How far the shadow sits to the right (negative: left)." },
  y: { label: "Y", step: 1, title: "How far the shadow sits down (negative: up)." },
  opacity: { label: "Opacity", min: 0, max: 100, step: 5, percent: true, title: "How strong the effect's colour is." },
  brightness: { label: "Brightness", min: 0, max: 500, step: 5, percent: true, title: "100 leaves the layer as it is." },
  contrast: { label: "Contrast", min: 0, max: 500, step: 5, percent: true, title: "100 leaves the layer as it is." },
  saturate: { label: "Saturation", min: 0, max: 500, step: 5, percent: true, title: "0 is grey, 100 is unchanged." },
  hueRotate: { label: "Hue", step: 5, title: "Turns the layer's colours around the colour wheel, in degrees." },
  scale: { label: "Scale", min: 0, max: 500, step: 1, title: "How far the pixels are pushed, in pixels." },
  frequency: { label: "Frequency", min: 0.001, max: 1, step: 0.005, title: "How fine the pattern is: smaller is broader waves." },
  seed: { label: "Seed", min: 0, max: 9999, step: 1, title: "A different number gives a different pattern." },
  amount: { label: "Amount", min: 0, max: 100, step: 5, percent: true, title: "How much grain is laid over the layer." },
  size: { label: "Size", min: 0.1, max: 20, step: 0.1, title: "How coarse the grain is." },
};
const clamp = (v: number, min?: number, max?: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
const iconButton = "ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:disabled:opacity-40 ll:disabled:cursor-default";

export const EffectStackSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document); // re-read on every change (undo, redo, the timeline, an agent)
  const [message, setMessage] = useState("");
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  if (!layer || !selectedId) return null;

  const props = layer.properties as Record<string, PropValue>;
  const stack = readStack(readerOf(props));
  const motionBlur = layer.motionBlur === true;
  const shutter = typeof props["motion.shutterAngle"] === "number" ? (props["motion.shutterAngle"] as number) : 180;
  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, { ids: [selectedId], ...args });
    const refused = out.ok ? (out.result as { refused?: string[] } | undefined)?.refused : undefined;
    setMessage(!out.ok ? (out.message ?? "That did not work.") : refused && refused.length > 0 ? `A layer holds at most ${FX_SLOTS} effects.` : "");
  };

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="effect-stack">
      {stack.map((effect, index) => {
        const route = routeEffect(effect.type as FxType);
        const label = FX_LABELS[effect.type as FxType];
        const n = index + 1;
        return (
          <OptionGroup key={effect.slot}>
            <div data-fx-slot={effect.slot} data-fx-type={effect.type} className={`ll:flex ll:items-center ll:gap-1 ll:min-h-7 ${effect.enabled ? "" : "ll:opacity-50"}`}>
              <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ll:text-primary">{label}</span>
              <span data-fx-route={route.backend} title={route.reason} className="ll:px-1 ll:font-mono ll:text-micro ll:uppercase ll:text-muted ll:border ll:border-border ll:rounded-sm">
                {route.backend}
              </span>
              <button type="button" aria-label={`Move effect ${n} up`} title="Move up: effects are applied from the top down." disabled={index === 0} onClick={() => run("layer.moveEffect", { slot: effect.slot, to: index })} className={iconButton}>
                <Icon icon={ChevronUp} size={14} />
              </button>
              <button type="button" aria-label={`Move effect ${n} down`} title="Move down" disabled={index === stack.length - 1} onClick={() => run("layer.moveEffect", { slot: effect.slot, to: index + 2 })} className={iconButton}>
                <Icon icon={ChevronDown} size={14} />
              </button>
              <button type="button" aria-pressed={effect.enabled} aria-label={`Stack effect ${n} on`} title={effect.enabled ? "Switch this effect off" : "Switch this effect on"} onClick={() => run("layer.setEffect", { slot: effect.slot, enabled: !effect.enabled })} className={iconButton}>
                <Icon icon={effect.enabled ? Eye : EyeOff} size={14} />
              </button>
              <button type="button" aria-label={`Remove stack effect ${n}`} title="Remove" onClick={() => run("layer.removeEffect", { slot: effect.slot })} className={iconButton}>
                <Icon icon={Minus} size={14} />
              </button>
            </div>
            {FX_PARAMS[effect.type as FxType].map((name) => {
              const raw = props[fxPath(effect.slot, name)];
              if (name === "color") {
                const hex = (typeof raw === "string" && raw !== "" ? raw : "#ffffff").replace("#", "");
                return (
                  <OptionRow key={name} label="Colour">
                    <RowColorField hex={hex} label={`${label} ${n} colour picker`} hexLabel={`${label} ${n} colour hex`} onChange={(next) => run("layer.setEffect", { slot: effect.slot, params: { color: `#${next}` } })} />
                  </OptionRow>
                );
              }
              const spec = PARAM[name];
              const value = typeof raw === "number" ? raw : 0;
              return (
                <OptionRow key={name} label={spec.label}>
                  <NumberField
                    size="sm"
                    aria-label={`${label} ${n} ${spec.label.toLowerCase()}`}
                    title={spec.title}
                    value={+(value * (spec.percent ? 100 : 1)).toFixed(3)}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    suffix={spec.percent ? "%" : undefined}
                    onChange={(v) => run("layer.setEffect", { slot: effect.slot, params: { [name]: clamp(v, spec.min, spec.max) / (spec.percent ? 100 : 1) } })}
                  />
                </OptionRow>
              );
            })}
            <p className="ll:m-0 ll:text-micro ll:text-muted">
              {route.reason}
              {route.backend === "svg" ? " It is drawn in Motion and Preview, not in Design." : ""}
            </p>
          </OptionGroup>
        );
      })}

      {stack.length < FX_SLOTS && (
        <Select aria-label="Add stack effect" size="sm" width="100%" options={ADD_OPTIONS} value={ADD} onChange={(v) => v !== ADD && run("layer.addEffect", { type: v })} />
      )}

      <button
        type="button"
        aria-pressed={motionBlur}
        aria-label="Motion blur"
        title={`Blurs the layer along the way it moves, by how fast it moves; a layer at rest is sharp. ${MOTION_BLUR_ROUTE.reason}`}
        onClick={() => run("layer.setMotionBlur", { on: !motionBlur })}
        className={`ll:h-7 ll:px-2 ll:text-left ll:text-small ll:rounded-sm ll:border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ${motionBlur ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active" : "ll:bg-surface-bar ll:text-muted ll:border-border ll:hover:text-primary"}`}
      >
        {motionBlur ? "Motion blur: on" : "Motion blur"}
      </button>
      {motionBlur && <p className="ll:m-0 ll:text-micro ll:text-muted">Seen while the layer moves, in Motion and Preview.</p>}
      {motionBlur && (
        <OptionRow label="Shutter">
          <NumberField size="sm" aria-label="Shutter angle" title="How long the shutter is open, as an angle: 180 is half a frame (the film look), 360 a whole frame (more blur)." value={shutter} min={1} max={720} step={15} suffix="°" onChange={(v) => run("layer.setMotionBlur", { shutterAngle: clamp(v, 1, 720) })} />
        </OptionRow>
      )}
      {message && (
        <p role="alert" aria-label="Effect stack error" className="ll:m-0 ll:text-micro ll:text-primary">
          {message}
        </p>
      )}
    </div>
  );
};

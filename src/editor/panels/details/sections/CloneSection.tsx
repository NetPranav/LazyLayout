"use client";
import React from "react";
import { useStore } from "zustand";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { documentStore } from "@/core/store/documentState";
import { getLayerGeometry } from "@/core/document/properties";
import { MAX_CLONES, clonerCopies, readCloner } from "@/core/render/cloner";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Clone (Design track D9): copies of the layer as a grid (rows and columns), a ring, or filling the area of its parent.
 * Drawn by the renderer from `clone.*`, so the canvas, Preview and the export agree. Absolutely placed layers only.
 */
const MODES = [
  { value: "off", label: "Off", hint: "Just the layer" },
  { value: "grid", label: "Grid", hint: "Rows and columns" },
  { value: "radial", label: "Ring", hint: "Around a circle" },
  { value: "fill", label: "Fill area", hint: "As many as fit in the frame it sits in" },
] as const;

export const CloneSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, getValue, onUpdateProp, className = "" }) => {
  const layers = useStore(documentStore, (s) => s.document.layers); // the fill count follows the parent's size
  if (!selectedId || isMulti) return null;
  const num = (path: string, fallback: number) => {
    const v = getValue?.(path);
    return typeof v === "number" ? v : fallback;
  };
  const mode = (getValue?.("clone.mode") as string) || "off";
  const layer = layers[selectedId];
  const absolute = getValue?.("positioning") === "absolute";
  const field = (label: string, path: string, fallback: number, title: string, opts: { min?: number; step?: number; int?: boolean } = {}) => (
    <NumberField
      size="sm"
      aria-label={label}
      title={title}
      value={num(path, fallback)}
      min={opts.min}
      step={opts.step ?? 1}
      precision={opts.int ? 0 : undefined}
      onChange={(v) => onUpdateProp?.(path, opts.int ? Math.round(v) : v)}
    />
  );

  let fillNote = "";
  if (mode === "fill" && layer) {
    const settings = readCloner((p) => getValue?.(p));
    const parent = layer.parentId ? layers[layer.parentId] : undefined;
    if (settings && parent) {
      const n = clonerCopies(settings, getLayerGeometry(layer).frame, getLayerGeometry(parent).frame).length + 1;
      fillNote = n > MAX_CLONES ? `More than ${MAX_CLONES} fit; the first ${MAX_CLONES} are drawn.` : `${n} in all.`;
    }
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      <OptionRow label="Clone">
        <Select aria-label="Clone mode" size="sm" width="100%" options={MODES} value={mode} onChange={(v) => onUpdateProp?.("clone.mode", v)} />
      </OptionRow>
      {mode !== "off" && !absolute && (
        <p className="ll:m-0 ll:text-micro ll:text-muted" role="note">
          Clones are drawn for layers placed freely (not inside an auto-layout frame).
        </p>
      )}
      {mode === "grid" && (
        <>
          <OptionRow label="Columns × rows">
            <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
              {field("Clone columns", "clone.cols", 3, "How many across.", { min: 1, int: true })}
              {field("Clone rows", "clone.rows", 3, "How many down.", { min: 1, int: true })}
            </div>
          </OptionRow>
          <OptionRow label="Gap">
            <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
              {field("Clone gap X", "clone.gapX", 10, "Space between columns, in px.")}
              {field("Clone gap Y", "clone.gapY", 10, "Space between rows, in px.")}
            </div>
          </OptionRow>
        </>
      )}
      {mode === "radial" && (
        <>
          <OptionRow label="Copies">{field("Clone count", "clone.count", 8, "How many in all, around the ring.", { min: 1, int: true })}</OptionRow>
          <OptionRow label="Radius">{field("Clone radius", "clone.radius", 100, "Radius of the ring, in px.", { min: 0 })}</OptionRow>
          <OptionRow label="Start">{field("Clone start angle", "clone.start", 0, "Where the layer sits on the ring, in degrees: 0 is straight up, 90 on the right.")}</OptionRow>
          <OptionRow label="Face out">
            <button
              type="button"
              aria-pressed={getValue?.("clone.faceOut") === true}
              aria-label="Clone face out"
              title="Turn each copy to face away from the centre."
              onClick={() => onUpdateProp?.("clone.faceOut", getValue?.("clone.faceOut") !== true)}
              className={`ll:h-7 ll:px-2 ll:text-small ll:rounded-sm ll:border ll:cursor-pointer ll:outline-none ${getValue?.("clone.faceOut") === true ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active" : "ll:bg-surface-bar ll:text-muted ll:border-border"}`}
            >
              {getValue?.("clone.faceOut") === true ? "On" : "Off"}
            </button>
          </OptionRow>
        </>
      )}
      {mode === "fill" && (
        <>
          <OptionRow label="Gap">
            <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
              {field("Clone gap X", "clone.gapX", 10, "Space between columns, in px.")}
              {field("Clone gap Y", "clone.gapY", 10, "Space between rows, in px.")}
            </div>
          </OptionRow>
          {fillNote && (
            <p className="ll:m-0 ll:text-micro ll:text-muted" role="status" aria-label="Clone count">
              {fillNote}
            </p>
          )}
        </>
      )}
    </div>
  );
};

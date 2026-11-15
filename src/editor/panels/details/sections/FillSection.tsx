"use client";

import React, { useState, useEffect } from "react";
import { GripVertical, Eye, EyeOff, Minus, Plus, Sliders } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Select } from "@/editor/components/Select";
import { ColorPicker } from "@/editor/components/ColorPicker";
import { NumberField } from "@/editor/components/NumberField";
import { importFiles } from "@/core/assets/assetImport";
import { CutoutDialog, type CutoutFill } from "../CutoutDialog";
import { assetSrc } from "@/core/assets/useAssetUrl";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import { RowColorField } from "../controls/RowColorField";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps, FillItem } from "../types";
import { useLayers } from "@/core/store/useDocumentStore";
import { fillsOf, hasFills, setFills as setEngineFills } from "@/core/paint/paintOps";
import { addPaint, changeType, movePaint, paintColor, removePaint, updatePaint } from "@/core/paint/paintEdits";
import { parseCss, toHex, fromHex, toCss } from "@/core/paint/color";
import type { Paint, PaintMask, PaintType } from "@/core/paint/paints";
import { BLEND_MODES, type BlendMode } from "@/core/paint/color";
import { Toggle } from "@/editor/components/Toggle";
import { tileFromLayer } from "@/core/editing/patternTile";
import type { Layer } from "@/core/document/schema";

/** Noise and pattern controls (Phase 114). */
function ProceduralControls({ paint: p, layers, layerOptions, onChange }: { paint: Paint; layers: Readonly<Record<string, Layer>>; layerOptions: { value: string; label: string }[]; onChange: (next: Paint) => void }) {
  if (p.type === "noise") {
    return (
      <OptionGroup>
        <OptionRow label="Kind">
          <Select aria-label="Noise kind" size="sm" width="100%" options={[{ value: "grain", label: "Grain" }, { value: "noise", label: "Soft noise" }]} value={p.kind} onChange={(v) => onChange({ ...p, kind: v === "noise" ? "noise" : "grain" })} />
        </OptionRow>
        <OptionRow label="Size">
          <NumberField size="sm" aria-label="Noise size" suffix="px" value={p.scale} min={0.5} max={2000} step={0.5} onChange={(v) => onChange({ ...p, scale: Math.max(0.5, v) })} />
        </OptionRow>
        <OptionRow label="Contrast">
          <NumberField size="sm" aria-label="Noise contrast" unit="%" value={Math.round(p.contrast * 100)} min={0} max={100} onChange={(v) => onChange({ ...p, contrast: Math.min(1, Math.max(0, v / 100)) })} />
        </OptionRow>
        <OptionRow label="Seed">
          <NumberField size="sm" aria-label="Noise seed" value={p.seed} min={0} max={1_000_000} step={1} onChange={(v) => onChange({ ...p, seed: Math.round(v) })} />
        </OptionRow>
      </OptionGroup>
    );
  }
  if (p.type === "pattern") {
    return (
      <OptionGroup>
        <OptionRow label="Tile">
          <Select
            aria-label="Pattern tile from layer"
            size="sm"
            width="100%"
            placeholder="Make the tile from a layer"
            options={layerOptions}
            value=""
            onChange={(id) => {
              const tile = tileFromLayer(id, layers);
              if (tile) onChange({ ...p, tile });
            }}
          />
        </OptionRow>
        <OptionRow label="Scale">
          <NumberField size="sm" aria-label="Pattern scale" unit="%" value={Math.round(p.scale * 100)} min={5} max={2000} onChange={(v) => onChange({ ...p, scale: Math.max(0.05, v / 100) })} />
        </OptionRow>
        <OptionRow label="Spacing">
          <NumberField size="sm" aria-label="Pattern spacing" suffix="px" value={p.spacing} min={0} max={2000} onChange={(v) => onChange({ ...p, spacing: Math.max(0, v) })} />
        </OptionRow>
        <OptionRow label="Rotation">
          <NumberField size="sm" aria-label="Pattern rotation" suffix="°" value={p.rotation} min={-360} max={360} onChange={(v) => onChange({ ...p, rotation: v })} />
        </OptionRow>
      </OptionGroup>
    );
  }
  return null;
}

/** Per-fill blend modes (FigCraft port F2), as the select lists them. */
const FILL_BLEND_OPTIONS = BLEND_MODES.filter((b) => b !== "passThrough").map((b) => ({ value: b, label: b.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) }));
/** A fill's mask controls (Phase 113): the kind, then the fade's range and angle, or the layer and Outside. */
function FillMaskControls({ mask: m, siblings, onSet }: { mask: PaintMask | undefined; siblings: { value: string; label: string }[]; onSet: (kind: string, patch?: Partial<{ start: number; end: number; angle: number; id: string; invert: boolean }>) => void }) {
  return (
    <OptionGroup>
      <OptionRow label="Mask">
        <Select aria-label="Fill mask" options={MASK_OPTIONS} value={m?.type ?? "none"} width="100%" size="sm" onChange={(v) => onSet(v)} />
      </OptionRow>
      {m && m.type !== "layer" && (
        <>
          <OptionRow label="Shown to">
            <NumberField size="sm" aria-label="Mask start" title="Fully shown up to here" unit="%" value={Math.round(m.start * 100)} min={0} max={100} onChange={(v) => onSet(m.type, { start: v / 100 })} />
          </OptionRow>
          <OptionRow label="Gone at">
            <NumberField size="sm" aria-label="Mask end" title="Faded out completely by here" unit="%" value={Math.round(m.end * 100)} min={0} max={100} onChange={(v) => onSet(m.type, { end: v / 100 })} />
          </OptionRow>
          {m.type !== "radial" && (
            <OptionRow label="Angle">
              <NumberField size="sm" aria-label="Mask angle" title={m.type === "linear" ? "0 fades downward, 90 to the right" : "Where the fade starts round the centre"} suffix="°" value={m.angle} step={1} onChange={(v) => onSet(m.type, { angle: v })} />
            </OptionRow>
          )}
        </>
      )}
      {m && m.type === "layer" && (
        <>
          <OptionRow label="Layer">
            <Select aria-label="Mask layer" options={siblings} value={m.id} width="100%" size="sm" placeholder="No sibling layer" onChange={(v) => onSet("layer", { id: v })} />
          </OptionRow>
          <OptionRow label="Outside">
            <Toggle size="sm" aria-label="Mask invert" checked={m.invert} onChange={(on) => onSet("layer", { invert: on })} />
          </OptionRow>
        </>
      )}
    </OptionGroup>
  );
}

/** Per-fill masks (Phase 113). */
const MASK_OPTIONS = [
  { value: "none", label: "None" },
  { value: "linear", label: "Linear fade", hint: "Fades out along a direction" },
  { value: "radial", label: "Radial fade", hint: "Fades out from the centre" },
  { value: "conic", label: "Conic fade", hint: "Fades out round the centre" },
  { value: "layer", label: "Another layer", hint: "Shows the fill inside (or outside) a sibling layer" },
];

const hexOf = (css: string): string => {
  const c = parseCss(css);
  return c ? toHex(c).replace(/^#/, "").slice(0, 6).toUpperCase() : "FFFFFF";
};
const cssOfHex = (hex: string, like: string): string => {
  const c = fromHex(`#${hex.padEnd(6, "0").slice(0, 6)}`);
  return c ? toCss({ ...c, a: parseCss(like)?.a ?? 1 }) : like;
};
const itemOf = (p: Paint, i: number): FillItem => ({
  id: `fill-${i}`,
  type: (p.type === "diamond" ? "radial" : p.type) as FillItem["type"],
  hex: hexOf(paintColor(p)),
  opacity: Math.round(p.opacity * 100),
  stops: "stops" in p ? p.stops.map((s, k) => ({ id: `s${k}`, hex: hexOf(s.color), position: Math.round(s.at * 100) })) : undefined,
  imageFit: p.type === "image" && p.mode !== "tile" ? p.mode : undefined,
  hidden: !p.visible,
});
/** A linear gradient's direction in degrees: 0 runs up, 90 to the right, 180 down. */
const linearAngle = (p: Paint | undefined): number => {
  if (!p || p.type !== "linear") return 180;
  const deg = (Math.atan2(p.to.x - p.from.x, -(p.to.y - p.from.y)) * 180) / Math.PI;
  return Math.round(deg < 0 ? deg + 360 : deg);
};

/** The paint with the edits of a row applied (hex edits the colour, or the first stop of a gradient). */
const applyItem = (p: Paint, patch: Partial<FillItem>): Paint => {
  let next = p;
  if (patch.type && patch.type !== (p.type === "diamond" ? "radial" : p.type)) next = changeType(next, patch.type as PaintType);
  if (patch.hex !== undefined && patch.hex.length === 6) {
    if (next.type === "solid") next = { ...next, color: cssOfHex(patch.hex, next.color) };
    else if (next.type === "noise") next = { ...next, color: cssOfHex(patch.hex, next.color) };
    else if ("stops" in next) next = { ...next, stops: next.stops.map((s, k) => (k === 0 ? { ...s, color: cssOfHex(patch.hex!, s.color) } : s)) } as Paint;
  }
  if (patch.opacity !== undefined) next = { ...next, opacity: patch.opacity / 100 };
  if (patch.hidden !== undefined) next = { ...next, visible: !patch.hidden };
  if (patch.imageFit && next.type === "image") next = { ...next, mode: patch.imageFit };
  return next;
};

const DEFAULT_FILL: FillItem = {
  id: "fill-default",
  type: "solid",
  hex: "FFFFFF",
  opacity: 100,
  angle: 180,
  stops: [
    { id: "s1", hex: "6C5CE7", position: 0 },
    { id: "s2", hex: "F0A8C8", position: 100 },
  ],
  imageFit: "fill",
};

const PAINT_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
  { value: "conic", label: "Conic" },
  { value: "image", label: "Image" },
  { value: "noise", label: "Noise", hint: "Seeded grain or soft noise" },
  { value: "pattern", label: "Pattern", hint: "Shapes repeated as a tile" },
] as const;

const IMAGE_FIT_OPTIONS = [
  { value: "fill", label: "Fill" },
  { value: "fit", label: "Fit" },
  { value: "crop", label: "Crop" },
  { value: "tile", label: "Tile" },
] as const;

export interface FillSectionProps extends InspectorSectionProps {
  onAddFillRef?: { current?: () => void };
}

export const FillSection: React.FC<FillSectionProps> = ({
  selectedId,
  selectedIds,
  layer,
  getValue,
  onUpdateProp,
  onAddFillRef,
  className = "",
}) => {
  // Read existing background color, typography color or fills from layer
  // (only a text layer's fill is its text colour: other layers answer typography.color with a default that is not theirs)
  const textFirst = layer?.archetype === "text";
  const initialHex =
    (textFirst ? (getValue?.("typography.color") as string) : "") ||
    (getValue?.("appearance.background.color") as string) ||
    (getValue?.("typography.color") as string) ||
    (getValue?.("backgroundColor") as string) ||
    "FFFFFF";
  // The colour may carry its own alpha (rgba): the row shows the six digits and the percentage separately.
  const parsedInitial = parseCss(String(initialHex));
  const cleanHex = parsedInitial ? toHex(parsedInitial).replace(/^#/, "").slice(0, 6).toUpperCase() : String(initialHex).replace(/^#/, "").toUpperCase();
  const initialFo = parsedInitial ? Math.round(parsedInitial.a * 100) : 100;

  useLayers(); // re-read the fills when the document changes
  const engineIds = (selectedIds && selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : []).filter(Boolean) as string[];
  const primary = selectedId ?? engineIds[0] ?? null;
  const engine = Boolean(layer && hasFills(layer.archetype) && primary);
  const enginePaints: Paint[] = engine && primary ? fillsOf(primary) : [];
  const writeEngine = (next: Paint[]) => setEngineFills(engineIds, next);
  const allLayers = useLayers();
  /** The layers a fill can be masked by: this layer's siblings. */
  const siblingOptions = (() => {
    const me = primary ? allLayers[primary] : undefined;
    const parent = me?.parentId ? allLayers[me.parentId] : undefined;
    return (parent?.children ?? []).filter((c) => c !== primary && allLayers[c]).map((c) => ({ value: c, label: allLayers[c].name || c }));
  })();
  /** Sets one fill's mask (Phase 113); "none" removes it. */
  const setMask = (index: number, kind: string, patch: Partial<{ start: number; end: number; angle: number; id: string; invert: boolean }> = {}) => {
    writeEngine(
      updatePaint(enginePaints, index, (p) => {
        if (kind === "none") {
          const { mask: _drop, ...rest } = p;
          void _drop;
          return rest as Paint;
        }
        const was = p.mask;
        const mask: PaintMask =
          kind === "layer"
            ? { type: "layer", id: patch.id ?? (was?.type === "layer" ? was.id : siblingOptions[0]?.value ?? ""), invert: patch.invert ?? (was?.type === "layer" ? was.invert : false) }
            : { type: kind as "linear" | "radial" | "conic", start: patch.start ?? (was && was.type !== "layer" ? was.start : 0.4), end: patch.end ?? (was && was.type !== "layer" ? was.end : 1), angle: patch.angle ?? (was && was.type !== "layer" ? was.angle : 0) };
        return { ...p, mask };
      }),
    );
  };

  const [localFills, setFills] = useState<FillItem[]>([
    {
      ...DEFAULT_FILL,
      hex: cleanHex || "FFFFFF",
      opacity: initialFo,
    },
  ]);

  const fills: FillItem[] = engine ? enginePaints.map(itemOf) : localFills;
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const [activeColorPickerEl, setActiveColorPickerEl] = useState<HTMLElement | null>(null);
  // the picker stays mounted after it closes so its exit animation can play
  const [shownPickerId, setShownPickerId] = useState<string | null>(null);
  if (activeColorPickerId && activeColorPickerId !== shownPickerId) setShownPickerId(activeColorPickerId);
  // The hex field keeps what is typed until it has six digits; only then does it write the colour.
  const [hexDraft, setHexDraft] = useState<{ id: string; value: string } | null>(null);
  // The row of a layer without a fill list (text, buttons) is local; a different layer starts again from its own colour.
  const [localFor, setLocalFor] = useState(selectedId);
  if (localFor !== selectedId) {
    setLocalFor(selectedId);
    setFills([{ ...DEFAULT_FILL, hex: cleanHex || "FFFFFF", opacity: initialFo }]);
    setActivePopoverId(null);
  }
  const indexOf = (id: string) => Number(id.replace("fill-", ""));

  const syncPrimaryToStore = (updatedFills: FillItem[]) => {
    const visibleFill = updatedFills.find((f) => !f.hidden);
    if (visibleFill && visibleFill.type === "solid") {
      // A layer without a fill list keeps its opacity inside the colour itself (rgba), so the percentage shows on the canvas.
      const h = visibleFill.hex.padEnd(6, "0");
      const css =
        visibleFill.opacity < 100
          ? `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${(visibleFill.opacity / 100).toFixed(2)})`
          : `#${visibleFill.hex}`;
      onUpdateProp?.("appearance.background.color", css);
    }
  };

  const handleAddFill = () => {
    if (engine) {
      writeEngine(addPaint(enginePaints, "solid", enginePaints.length ? undefined : "#cbd5e1"));
      return;
    }
    const newId = `fill-${Date.now()}`;
    const newFill: FillItem = {
      id: newId,
      type: "solid",
      hex: "FFFFFF",
      opacity: 100,
      angle: 180,
      stops: [
        { id: "s1", hex: "6C5CE7", position: 0 },
        { id: "s2", hex: "F0A8C8", position: 100 },
      ],
      imageFit: "fill",
    };
    const next = [...fills, newFill];
    setFills(next);
    syncPrimaryToStore(next);
  };

  // Expose handleAddFill to parent so section header "+" button calls it
  useEffect(() => {
    if (onAddFillRef) {
      onAddFillRef.current = handleAddFill;
    }
  });

  const handleUpdateFill = (id: string, patch: Partial<FillItem>) => {
    if (engine) {
      writeEngine(updatePaint(enginePaints, indexOf(id), (p) => applyItem(p, patch)));
      return;
    }
    const next = fills.map((f) => (f.id === id ? { ...f, ...patch } : f));
    setFills(next);
    syncPrimaryToStore(next);
  };

  const handleRemoveFill = (id: string) => {
    if (engine) {
      writeEngine(removePaint(enginePaints, indexOf(id)));
      setActivePopoverId(null);
      return;
    }
    const next = fills.filter((f) => f.id !== id);
    setFills(next);
    if (activePopoverId === id) setActivePopoverId(null);
    syncPrimaryToStore(next);
  };

  /** Replaces the colour stops of a gradient (a colour keeps the alpha of the stop at its place). */
  const setStops = (id: string, stops: { hex: string; position: number }[]) => {
    writeEngine(
      updatePaint(enginePaints, indexOf(id), (p) => {
        if (!("stops" in p)) return p;
        return { ...p, stops: stops.map((st, k) => ({ color: cssOfHex(st.hex, p.stops[Math.min(k, p.stops.length - 1)].color), at: st.position / 100 })) } as Paint;
      }),
    );
  };

  /** A linear gradient's direction: 0 runs up, 90 to the right, 180 down. */
  const setAngle = (id: string, deg: number) => {
    const a = (deg * Math.PI) / 180;
    const dx = Math.sin(a) / 2;
    const dy = -Math.cos(a) / 2;
    writeEngine(updatePaint(enginePaints, indexOf(id), (p) => (p.type === "linear" ? { ...p, from: { x: 0.5 - dx, y: 0.5 - dy }, to: { x: 0.5 + dx, y: 0.5 + dy } } : p)));
  };

  const [cuttingFill, setCuttingFill] = useState<string | null>(null);
  /** The picture in an image fill, for Cut out: a tiled one has no one place on the page. */
  const pictureOf = (id: string): CutoutFill | null => {
    const paint = fillsOf(primary as string)[indexOf(id)];
    if (paint?.type !== "image" || !paint.src || paint.mode === "tile") return null;
    return { src: paint.src, fit: paint.mode === "fill" ? "cover" : paint.mode === "fit" ? "contain" : paint.crop };
  };

  /** Puts a chosen file into an image fill. */
  const pickImage = async (id: string, file: File | undefined) => {
    if (!file) return;
    const [outcome] = await importFiles([file]);
    if (!outcome?.entry) return;
    const entry = outcome.entry;
    writeEngine(updatePaint(fillsOf(primary as string), indexOf(id), (p) => (p.type === "image" ? { ...p, src: assetSrc(entry.id), natural: entry.width && entry.height ? { w: entry.width, h: entry.height } : undefined } : p)));
  };

  const handleMove = (id: string, direction: -1 | 1) => {
    if (engine) writeEngine(movePaint(enginePaints, indexOf(id), direction));
    else {
      const i = indexOf(id);
      const to = i + direction;
      if (to >= 0 && to < localFills.length) {
        const next = [...localFills];
        [next[i], next[to]] = [next[to], next[i]];
        setFills(next.map((f, k) => ({ ...f, id: `fill-${k}` })));
      }
    }
  };

  /** Drag a grip up or down: `steps` rows (negative is up), as one change. */
  const reorderBy = (id: string, steps: number) => {
    if (steps === 0) return;
    const dir: -1 | 1 = steps > 0 ? 1 : -1;
    if (engine) {
      let next = enginePaints;
      let at = indexOf(id);
      for (let k = 0; k < Math.abs(steps); k++) {
        next = movePaint(next, at, dir);
        at += dir;
      }
      writeEngine(next);
    } else {
      const to = Math.max(0, Math.min(localFills.length - 1, indexOf(id) + steps));
      const next = [...localFills];
      const [moved] = next.splice(indexOf(id), 1);
      next.splice(to, 0, moved);
      setFills(next.map((f, k) => ({ ...f, id: `fill-${k}` })));
    }
  };

  const handleToggleHide = (id: string) => {
    if (engine) {
      const p = enginePaints[indexOf(id)];
      if (p) writeEngine(updatePaint(enginePaints, indexOf(id), (q) => ({ ...q, visible: !p.visible })));
      return;
    }
    const next = fills.map((f) => (f.id === id ? { ...f, hidden: !f.hidden } : f));
    setFills(next);
    syncPrimaryToStore(next);
  };

  if (fills.length === 0) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-0.5 ll:-mx-1 ${className}`}>
      {fills.map((fill, index) => {
        const isDim = Boolean(fill.hidden);
        const isOpen = activePopoverId === fill.id;
        const fillNum = index + 1;
        return (
          <div
            key={fill.id}
            data-k="fill"
            className={`ll-dr ll-rr ll:group ll:flex ll:items-center ll:gap-1 ll:h-8 ll:py-0.5 ll:px-1 ll:rounded-sm ${
              isOpen ? "ll:bg-surface-raised ll:text-primary" : ""
            } ${isDim ? "ll-rdim ll:opacity-50" : ""}`}
          >
            {/* Grip handle, shown on row hover */}
            <button
              type="button"
              data-grip
              onPointerDown={(e) => {
                // Drag the grip: each 32px up or down moves the row one place; it lands when the pointer is released.
                e.preventDefault();
                const startY = e.clientY;
                const target = e.currentTarget;
                target.setPointerCapture(e.pointerId);
                const up = (ev: PointerEvent) => {
                  target.releasePointerCapture(e.pointerId);
                  target.removeEventListener("pointerup", up);
                  reorderBy(fill.id, Math.round((ev.clientY - startY) / 32));
                };
                target.addEventListener("pointerup", up);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  handleMove(fill.id, e.key === "ArrowUp" ? -1 : 1);
                }
              }}
              aria-label={`Reorder fill ${fillNum}`}
              title={`Reorder fill ${fillNum}`}
              className="ll-ib ll-grip ll:-ml-4 ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:cursor-grab ll:opacity-0 ll:group-hover:opacity-100 ll:group-focus-within:opacity-100 ll:transition-opacity ll:duration-100 ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={GripVertical} size={12} />
            </button>

            {/* Lead swatch button: opens ColorPicker */}
            <button
              type="button"
              data-lead
              aria-label={`Fill ${fillNum} color`}
              aria-haspopup="dialog"
              aria-expanded={activeColorPickerId === fill.id || isOpen}
              title={`Fill ${fillNum} color`}
              onClick={(e) => {
                const isClosing = activeColorPickerId === fill.id;
                setActiveColorPickerId(isClosing ? null : fill.id);
                setActiveColorPickerEl(e.currentTarget);
              }}
              className="ll-lead ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:shrink-0 ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:hover:bg-surface-hover ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
            >
              <span
                className="ll-dsw ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                style={{ backgroundColor: `#${fill.hex}` }}
              />
            </button>

            {/* Hex and Opacity Fields */}
            <div className="ll-sum ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0">
              <div
                className="ll-dfield ll:flex ll:items-center ll:flex-1 ll:min-w-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm ll:cursor-pointer"
                onClick={(e) => {
                  setActiveColorPickerId(fill.id);
                  setActiveColorPickerEl(e.currentTarget);
                }}
              >
                <input
                  type="text"
                  maxLength={6}
                  aria-label="Fill hex"
                  value={hexDraft?.id === fill.id ? hexDraft.value : fill.hex}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveColorPickerId(fill.id);
                    setActiveColorPickerEl(e.currentTarget);
                  }}
                  onBlur={() => setHexDraft(null)}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6).toUpperCase();
                    setHexDraft({ id: fill.id, value: clean });
                    if (clean.length === 6) {
                      handleUpdateFill(fill.id, { hex: clean });
                      setHexDraft(null);
                    }
                  }}
                  className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                />
              </div>

              <div className="ll-dfield ll:flex ll:items-center ll:gap-1.5 ll:w-14.5 ll:shrink-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Fill opacity"
                  value={fill.opacity}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    handleUpdateFill(fill.id, {
                      opacity: isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed)),
                    });
                  }}
                  className="ll:field-sizing-content ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                />
                <span className="ll-sf ll:font-mono ll:text-micro ll:text-muted ll:shrink-0 ll:select-none">
                  %
                </span>
              </div>
            </div>

            {/* Row Settings Trigger: opens RowSettingsPopover */}
            <IconButton
              size="sm"
              variant="ghost"
              pressed={isOpen}
              aria-label={`Fill ${fillNum} settings`}
              tooltip={`Fill ${fillNum} settings`}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              icon={<Icon icon={Sliders} size={14} />}
              onClick={() => setActivePopoverId(isOpen ? null : fill.id)}
              className="ll-ib"
            />

            {/* Visibility Toggle */}
            <IconButton
              size="sm"
              variant="ghost"
              data-eye
              aria-label={fill.hidden ? `Show fill ${fillNum}` : `Hide fill ${fillNum}`}
              tooltip={fill.hidden ? `Show fill ${fillNum}` : `Hide fill ${fillNum}`}
              icon={<Icon icon={fill.hidden ? EyeOff : Eye} size={14} />}
              onClick={() => handleToggleHide(fill.id)}
              className="ll-ib"
            />

            {/* Remove Button */}
            <IconButton
              size="sm"
              variant="ghost"
              data-rm
              aria-label={`Remove fill ${fillNum}`}
              tooltip={`Remove fill ${fillNum}`}
              icon={<Icon icon={Minus} size={14} />}
              onClick={() => handleRemoveFill(fill.id)}
              className="ll-ib"
            />

            {/* Settings Popover */}
            <RowSettingsPopover isOpen={isOpen} title="Fill" onClose={() => setActivePopoverId((cur) => (cur === fill.id ? null : cur))}>
              <OptionGroup>
                <OptionRow label="Type">
                  <Select
                    aria-label="Paint type"
                    options={PAINT_OPTIONS}
                    value={fill.type}
                    width="100%"
                    size="sm"
                    disabled={!engine}
                    title={engine ? undefined : "This kind of layer takes one plain colour."}
                    onChange={(value) => handleUpdateFill(fill.id, { type: value as FillItem["type"] })}
                  />
                </OptionRow>
                {fill.type === "solid" && (
                  <OptionRow label="Colour">
                    <RowColorField hex={fill.hex} label="Fill colour picker" hexLabel="Fill hex" onChange={(hex) => handleUpdateFill(fill.id, { hex })} />
                  </OptionRow>
                )}
                {engine && fill.type === "linear" && (
                  <OptionRow label="Angle">
                    <NumberField size="sm" aria-label="Gradient angle" title="The gradient's direction: 0 runs up, 90 to the right, 180 down." suffix="°" value={linearAngle(enginePaints[index])} step={1} onChange={(v) => setAngle(fill.id, v)} />
                  </OptionRow>
                )}
                <OptionRow label="Opacity">
                  <NumberField
                    size="sm"
                    aria-label="Fill opacity in popover"
                    unit="%"
                    value={fill.opacity}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => handleUpdateFill(fill.id, { opacity: Math.max(0, Math.min(100, Math.round(v))) })}
                  />
                </OptionRow>
                {engine && enginePaints[index] && (
                  <OptionRow label="Blend">
                    <Select aria-label="Fill blend mode" options={FILL_BLEND_OPTIONS} value={enginePaints[index].blend ?? "normal"} width="100%" size="sm" onChange={(v) => writeEngine(updatePaint(enginePaints, index, (p) => (v === "normal" ? (({ blend: _b, ...rest }) => (void _b, rest as Paint))(p) : { ...p, blend: v as BlendMode })))} />
                  </OptionRow>
                )}
              </OptionGroup>
              {engine && enginePaints[index] && (enginePaints[index].type === "noise" || enginePaints[index].type === "pattern") && (
                <ProceduralControls paint={enginePaints[index]} layers={allLayers} layerOptions={Object.values(allLayers).filter((l) => l.parentId && l.id !== primary).map((l) => ({ value: l.id, label: l.name || l.id }))} onChange={(next) => writeEngine(updatePaint(enginePaints, index, () => next))} />
              )}
              {engine && enginePaints[index] && <FillMaskControls mask={enginePaints[index].mask} siblings={siblingOptions} onSet={(kind, patch) => setMask(index, kind, patch)} />}
              {engine && fill.stops && fill.stops.length >= 2 && (
                <OptionGroup>
                  <div className="ll:flex ll:items-center ll:justify-between ll:min-h-7">
                    <span className="ll-dlbl ll:text-small ll:text-muted">Stops</span>
                    <IconButton size="sm" variant="ghost" aria-label="Add stop" tooltip="Add stop" icon={<Icon icon={Plus} size={14} />} onClick={() => setStops(fill.id, [...fill.stops!, { hex: "FFFFFF", position: 50 }])} />
                  </div>
                  {fill.stops.map((stop, k) => (
                    <div key={stop.id} className="ll:flex ll:items-center ll:gap-2 ll:w-full">
                      <div className="ll:flex-1 ll:min-w-0">
                        <RowColorField hex={stop.hex} label={`Stop ${k + 1} colour picker`} hexLabel={`Stop ${k + 1} hex`} onChange={(hex) => setStops(fill.id, fill.stops!.map((x, j) => (j === k ? { ...x, hex } : x)))} />
                      </div>
                      <div className="ll:w-18 ll:shrink-0">
                        <NumberField size="sm" aria-label={`Stop ${k + 1} position`} unit="%" value={stop.position} min={0} max={100} step={1} onChange={(v) => setStops(fill.id, fill.stops!.map((x, j) => (j === k ? { ...x, position: Math.max(0, Math.min(100, Math.round(v))) } : x)))} />
                      </div>
                      {fill.stops!.length > 2 ? (
                        <IconButton size="sm" variant="ghost" aria-label={`Remove stop ${k + 1}`} tooltip="Remove stop" icon={<Icon icon={Minus} size={14} />} onClick={() => setStops(fill.id, fill.stops!.filter((_, j) => j !== k))} />
                      ) : (
                        <span aria-hidden="true" className="ll:w-6 ll:shrink-0" />
                      )}
                    </div>
                  ))}
                </OptionGroup>
              )}
              {engine && fill.type === "image" && (
                <OptionGroup>
                  <OptionRow label="Fit">
                    <Select
                      aria-label="Image fit"
                      options={IMAGE_FIT_OPTIONS}
                      value={fill.imageFit ?? "tile"}
                      width="100%"
                      size="sm"
                      onChange={(value) => handleUpdateFill(fill.id, { imageFit: value as FillItem["imageFit"] })}
                    />
                  </OptionRow>
                  <OptionRow label="Picture">
                    <label className="ll:flex ll:items-center ll:justify-center ll:w-full ll:h-7 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:font-sans ll:text-small ll:text-primary ll:cursor-pointer">
                      Choose a picture
                      <input type="file" accept="image/*" hidden aria-label="Fill picture" onChange={(e) => { void pickImage(fill.id, e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                  </OptionRow>
                  {pictureOf(fill.id) && (
                    <OptionRow label="Cut out">
                      <button
                        type="button"
                        title="Cut part of this picture into its own layer on top: put a layer between the two and it goes behind that part."
                        onClick={() => setCuttingFill(fill.id)}
                        className="ll:w-full ll:h-7 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:font-sans ll:text-small ll:text-primary ll:cursor-pointer"
                      >
                        Cut out
                      </button>
                    </OptionRow>
                  )}
                  {cuttingFill === fill.id && pictureOf(fill.id) && primary && (
                    <CutoutDialog layerId={primary as string} fill={pictureOf(fill.id)!} onClose={() => setCuttingFill(null)} />
                  )}
                </OptionGroup>
              )}
            </RowSettingsPopover>
          </div>
        );
      })}

      {(() => {
        const activeFill = fills.find((f) => f.id === shownPickerId);
        if (!activeFill) return null;
        return (
          <ColorPicker
            open={Boolean(activeColorPickerId)}
            value={`#${activeFill.hex}`}
            opacity={activeFill.opacity}
            onChangeOpacity={(opacity) => handleUpdateFill(activeFill.id, { opacity })}
            anchorEl={activeColorPickerEl}
            onChange={(hex) =>
              handleUpdateFill(activeFill.id, {
                hex: hex.replace(/^#/, "").toUpperCase(),
              })
            }
            onClose={() => {
              setActiveColorPickerId(null);
            }}
          />
        );
      })()}
    </div>
  );
};

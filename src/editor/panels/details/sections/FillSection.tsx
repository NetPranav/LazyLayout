"use client";

import React, { useState, useEffect } from "react";
import { GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { importFiles } from "@/core/assets/assetImport";
import { assetSrc } from "@/core/assets/useAssetUrl";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import { ColorSwatch } from "../controls/ColorSwatch";
import type { InspectorSectionProps, FillItem } from "../types";
import { useLayers } from "@/core/store/useDocumentStore";
import { fillsOf, hasFills, setFills as setEngineFills } from "@/core/paint/paintOps";
import { addPaint, changeType, movePaint, paintColor, removePaint, updatePaint } from "@/core/paint/paintEdits";
import { parseCss, toHex, fromHex, toCss } from "@/core/paint/color";
import type { Paint, PaintType } from "@/core/paint/paints";

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
  // Read existing background color or fills from layer
  const initialHex =
    (getValue?.("appearance.background.color") as string) ||
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

  const [localFills, setFills] = useState<FillItem[]>([
    {
      ...DEFAULT_FILL,
      hex: cleanHex || "FFFFFF",
      opacity: initialFo,
    },
  ]);

  const fills: FillItem[] = engine ? enginePaints.map(itemOf) : localFills;
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
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

  /** The first or last colour of a gradient. */
  const setStop = (id: string, which: "start" | "end", hex: string) => {
    writeEngine(
      updatePaint(enginePaints, indexOf(id), (p) => {
        if (!("stops" in p)) return p;
        const at = which === "start" ? 0 : p.stops.length - 1;
        return { ...p, stops: p.stops.map((st, k) => (k === at ? { ...st, color: cssOfHex(hex, st.color) } : st)) } as Paint;
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

            {/* Lead swatch button */}
            <button
              type="button"
              data-lead
              aria-label={`Fill ${fillNum} settings`}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              title={`Fill ${fillNum} settings`}
              onClick={() => setActivePopoverId(isOpen ? null : fill.id)}
              className="ll-lead ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:shrink-0 ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:hover:bg-surface-hover ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
            >
              <span
                className="ll-dsw ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                style={{ backgroundColor: `#${fill.hex}` }}
              />
            </button>

            {/* Hex and Opacity Fields */}
            <div className="ll-sum ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0">
              <div className="ll-dfield ll:flex ll:items-center ll:flex-1 ll:min-w-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
                <input
                  type="text"
                  maxLength={6}
                  aria-label="Fill hex"
                  value={fill.hex}
                  onChange={(e) =>
                    handleUpdateFill(fill.id, {
                      hex: e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase(),
                    })
                  }
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

            {/* Visibility Toggle */}
            <button
              type="button"
              data-eye
              aria-label={fill.hidden ? `Show fill ${fillNum}` : `Hide fill ${fillNum}`}
              title={fill.hidden ? `Show fill ${fillNum}` : `Hide fill ${fillNum}`}
              onClick={() => handleToggleHide(fill.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={fill.hidden ? EyeOff : Eye} size={14} />
            </button>

            {/* Remove Button */}
            <button
              type="button"
              data-rm
              aria-label={`Remove fill ${fillNum}`}
              title={`Remove fill ${fillNum}`}
              onClick={() => handleRemoveFill(fill.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={Minus} size={14} />
            </button>

            {/* Settings Popover */}
            <RowSettingsPopover isOpen={isOpen} title="Fill" onClose={() => setActivePopoverId(null)}>
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
              {engine && fill.stops && fill.stops.length >= 2 && (
                <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:items-center">
                  <div className="ll:flex ll:items-center ll:gap-1 ll:min-w-0">
                    <ColorSwatch label="Gradient start colour" hex={fill.stops[0].hex} onChange={(h) => setStop(fill.id, "start", h)} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
                    <span className="ll:font-sans ll:text-micro ll:text-muted">Start</span>
                  </div>
                  <div className="ll:flex ll:items-center ll:gap-1 ll:min-w-0">
                    <ColorSwatch label="Gradient end colour" hex={fill.stops[fill.stops.length - 1].hex} onChange={(h) => setStop(fill.id, "end", h)} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
                    <span className="ll:font-sans ll:text-micro ll:text-muted">End</span>
                  </div>
                </div>
              )}
              {engine && fill.type === "linear" && (
                <NumberField size="sm" label="Angle" aria-label="Gradient angle" title="The gradient's direction: 0 runs up, 90 to the right, 180 down." suffix="°" value={linearAngle(enginePaints[index])} step={1} onChange={(v) => setAngle(fill.id, v)} />
              )}
              {engine && fill.type === "image" && (
                <label className="ll:flex ll:items-center ll:justify-center ll:h-7 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:font-sans ll:text-small ll:text-primary ll:cursor-pointer">
                  Choose a picture
                  <input type="file" accept="image/*" hidden aria-label="Fill picture" onChange={(e) => { void pickImage(fill.id, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              )}
              <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:items-center">
                <div className="ll:flex ll:items-center ll:gap-1 ll:min-w-0">
                  <ColorSwatch label="Fill colour picker" hex={fill.hex} onChange={(h) => handleUpdateFill(fill.id, { hex: h })} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
                  <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:rounded-sm">
                    <span className="ll:font-mono ll:text-micro ll:text-muted">#</span>
                    <input
                      type="text"
                      maxLength={6}
                      aria-label="Fill hex"
                      value={fill.hex}
                      onChange={(e) =>
                        handleUpdateFill(fill.id, {
                          hex: e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase(),
                        })
                      }
                      className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                    />
                  </div>
                </div>
                <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:rounded-sm">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Fill opacity in popover"
                    value={fill.opacity}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      handleUpdateFill(fill.id, {
                        opacity: isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed)),
                      });
                    }}
                    className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                  />
                  <span className="ll:font-mono ll:text-micro ll:text-muted ll:shrink-0 ll:select-none">%</span>
                </div>
              </div>
            </RowSettingsPopover>
          </div>
        );
      })}
    </div>
  );
};

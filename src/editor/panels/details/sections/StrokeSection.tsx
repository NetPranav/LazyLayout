"use client";

import React, { useState, useEffect } from "react";
import { GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { ColorPicker } from "@/editor/components/ColorPicker";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import type { InspectorSectionProps, StrokeItem } from "../types";

export interface StrokeSectionProps extends InspectorSectionProps {
  onAddStrokeRef?: { current?: () => void };
}

const STYLE_OPTIONS = ["solid", "dashed", "dotted"] as const;
const SIDE_OPTIONS = ["all", "top", "right", "bottom", "left"] as const;

const segClass = (active: boolean) =>
  `ll:flex-1 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-micro ll:capitalize ll:cursor-pointer ll:border-0 ll:p-0 ll:outline-none ${
    active ? "ll:bg-surface-panel ll:text-primary" : "ll:bg-transparent ll:text-muted ll:hover:text-primary"
  }`;

export const StrokeSection: React.FC<StrokeSectionProps> = ({
  onUpdateProp,
  onAddStrokeRef,
  className = "",
}) => {
  const [strokes, setStrokes] = useState<StrokeItem[]>([]);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const [activeColorPickerEl, setActiveColorPickerEl] = useState<HTMLElement | null>(null);

  const syncPrimaryToStore = (updatedStrokes: StrokeItem[]) => {
    const visible = updatedStrokes.find((s) => !s.hidden);
    if (visible) {
      onUpdateProp?.("appearance.border.color", `#${visible.hex}`);
      onUpdateProp?.("appearance.border.width", visible.width);
      onUpdateProp?.("appearance.border.style", visible.style);
    } else {
      onUpdateProp?.("appearance.border.width", 0);
    }
  };

  const handleAddStroke = () => {
    const newId = `stroke-${Date.now()}`;
    const newStroke: StrokeItem = {
      id: newId,
      hex: "444444",
      width: 1,
      style: "solid",
      sides: "all",
    };
    const next = [...strokes, newStroke];
    setStrokes(next);
    syncPrimaryToStore(next);
  };

  useEffect(() => {
    if (onAddStrokeRef) {
      onAddStrokeRef.current = handleAddStroke;
    }
  });

  const handleUpdateStroke = (id: string, patch: Partial<StrokeItem>) => {
    const next = strokes.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setStrokes(next);
    syncPrimaryToStore(next);
  };

  const handleRemoveStroke = (id: string) => {
    const next = strokes.filter((s) => s.id !== id);
    setStrokes(next);
    if (activePopoverId === id) setActivePopoverId(null);
    syncPrimaryToStore(next);
  };

  const handleToggleHide = (id: string) => {
    const next = strokes.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s));
    setStrokes(next);
    syncPrimaryToStore(next);
  };

  if (strokes.length === 0) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-0.5 ll:-mx-1 ${className}`}>
      {strokes.map((stroke, index) => {
        const isDim = Boolean(stroke.hidden);
        const isOpen = activePopoverId === stroke.id;
        const strokeNum = index + 1;
        return (
          <div
            key={stroke.id}
            data-k="stroke"
            className={`ll-dr ll-rr ll:group ll:flex ll:items-center ll:gap-1 ll:h-8 ll:py-0.5 ll:px-1 ll:rounded-sm ${
              isOpen ? "ll:bg-surface-raised ll:text-primary" : ""
            } ${isDim ? "ll-rdim ll:opacity-50" : ""}`}
          >
            {/* Grip handle, shown on row hover */}
            <button
              type="button"
              data-grip
              aria-label={`Reorder stroke ${strokeNum}`}
              title={`Reorder stroke ${strokeNum}`}
              className="ll-ib ll-grip ll:-ml-4 ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:cursor-grab ll:opacity-0 ll:group-hover:opacity-100 ll:group-focus-within:opacity-100 ll:transition-opacity ll:duration-100 ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={GripVertical} size={12} />
            </button>

            {/* Lead swatch */}
            <button
              type="button"
              data-lead
              aria-label={`Stroke ${strokeNum} color`}
              aria-haspopup="dialog"
              aria-expanded={activeColorPickerId === stroke.id || isOpen}
              title={`Stroke ${strokeNum} color`}
              onClick={(e) => {
                const isClosing = activeColorPickerId === stroke.id;
                setActiveColorPickerId(isClosing ? null : stroke.id);
                setActiveColorPickerEl(isClosing ? null : e.currentTarget);
              }}
              className="ll-lead ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:shrink-0 ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:hover:bg-surface-hover ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
            >
              <span
                className="ll-dsw ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                style={{ backgroundColor: `#${stroke.hex}` }}
              />
            </button>

            {/* Hex and Width fields */}
            <div className="ll-sum ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0">
              <div
                className="ll-dfield ll:flex ll:items-center ll:flex-1 ll:min-w-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm ll:cursor-pointer"
                onClick={(e) => {
                  setActiveColorPickerId(stroke.id);
                  setActiveColorPickerEl(e.currentTarget);
                }}
              >
                <input
                  type="text"
                  maxLength={6}
                  aria-label="Stroke hex"
                  value={stroke.hex}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveColorPickerId(stroke.id);
                    setActiveColorPickerEl(e.currentTarget);
                  }}
                  onChange={(e) =>
                    handleUpdateStroke(stroke.id, {
                      hex: e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase(),
                    })
                  }
                  className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                />
              </div>

              <div className="ll-dfield ll:flex ll:items-center ll:w-14.5 ll:shrink-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Stroke width"
                  value={stroke.width}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) handleUpdateStroke(stroke.id, { width: Math.max(0, val) });
                  }}
                  className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                />
              </div>

              {/* Style glyph slot of the design, hidden in the summary */}
              <span aria-hidden="true" className="ll:w-3.5 ll:h-3.5 ll:shrink-0 ll:invisible" />
            </div>

            {/* Visibility Toggle */}
            <button
              type="button"
              data-eye
              aria-label={stroke.hidden ? `Show stroke ${strokeNum}` : `Hide stroke ${strokeNum}`}
              title={stroke.hidden ? `Show stroke ${strokeNum}` : `Hide stroke ${strokeNum}`}
              onClick={() => handleToggleHide(stroke.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={stroke.hidden ? EyeOff : Eye} size={14} />
            </button>

            {/* Remove Button */}
            <button
              type="button"
              data-rm
              aria-label={`Remove stroke ${strokeNum}`}
              title={`Remove stroke ${strokeNum}`}
              onClick={() => handleRemoveStroke(stroke.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={Minus} size={14} />
            </button>

            {/* Settings Popover */}
            <RowSettingsPopover isOpen={isOpen} title="Stroke" onClose={() => setActivePopoverId(null)}>
              <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:items-center">
                <div className="ll:flex ll:items-center ll:gap-1 ll:min-w-0">
                  <span
                    className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                    style={{ backgroundColor: `#${stroke.hex}` }}
                  />
                  <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:rounded-sm">
                    <span className="ll:font-mono ll:text-micro ll:text-muted">#</span>
                    <input
                      type="text"
                      maxLength={6}
                      aria-label="Stroke hex"
                      value={stroke.hex}
                      onChange={(e) =>
                        handleUpdateStroke(stroke.id, {
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
                    inputMode="numeric"
                    aria-label="Stroke width"
                    value={stroke.width}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val)) handleUpdateStroke(stroke.id, { width: Math.max(0, val) });
                    }}
                    className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                  />
                </div>
              </div>

              <span className="ll:text-micro ll:text-muted">Style</span>
              <div role="radiogroup" aria-label="Stroke style" className="ll:flex ll:gap-0.5 ll:p-0.5 ll:bg-surface-bar ll:rounded-sm">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={stroke.style === opt}
                    onClick={() => handleUpdateStroke(stroke.id, { style: opt })}
                    className={segClass(stroke.style === opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <span className="ll:text-micro ll:text-muted">Sides</span>
              <div role="radiogroup" aria-label="Stroke sides" className="ll:flex ll:gap-0.5 ll:p-0.5 ll:bg-surface-bar ll:rounded-sm">
                {SIDE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={stroke.sides === opt}
                    onClick={() => handleUpdateStroke(stroke.id, { sides: opt })}
                    className={segClass(stroke.sides === opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </RowSettingsPopover>
          </div>
        );
      })}

      {(() => {
        const activeStroke = strokes.find((s) => s.id === activeColorPickerId);
        if (!activeStroke) return null;
        return (
          <ColorPicker
            open={Boolean(activeColorPickerId)}
            value={`#${activeStroke.hex}`}
            anchorEl={activeColorPickerEl}
            onChange={(hex) =>
              handleUpdateStroke(activeStroke.id, {
                hex: hex.replace(/^#/, "").toUpperCase(),
              })
            }
            onClose={() => {
              setActiveColorPickerId(null);
              setActiveColorPickerEl(null);
            }}
          />
        );
      })()}
    </div>
  );
};

"use client";

import React, { useState, useEffect, useRef } from "react";
import { GripVertical, Eye, EyeOff, Minus, Sliders } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { ColorPicker } from "@/editor/components/ColorPicker";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import type { InspectorSectionProps, FillItem } from "../types";

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
  const cleanHex = initialHex.replace(/^#/, "").toUpperCase();
  const rawFo = getValue?.("fill.opacity");
  const initialFo = typeof rawFo === "number" ? rawFo : 100;

  const [fills, setFills] = useState<FillItem[]>([
    {
      ...DEFAULT_FILL,
      hex: cleanHex || "FFFFFF",
      opacity: initialFo,
    },
  ]);

  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const swatchBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const syncPrimaryToStore = (updatedFills: FillItem[]) => {
    const visibleFill = updatedFills.find((f) => !f.hidden);
    if (visibleFill && visibleFill.type === "solid") {
      onUpdateProp?.("appearance.background.color", `#${visibleFill.hex}`);
      onUpdateProp?.("backgroundColor", `#${visibleFill.hex}`);
      onUpdateProp?.("fill.opacity", visibleFill.opacity);
    }
  };

  const handleAddFill = () => {
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
    const next = fills.map((f) => (f.id === id ? { ...f, ...patch } : f));
    setFills(next);
    syncPrimaryToStore(next);
  };

  const handleRemoveFill = (id: string) => {
    const next = fills.filter((f) => f.id !== id);
    setFills(next);
    if (activePopoverId === id) setActivePopoverId(null);
    syncPrimaryToStore(next);
  };

  const handleToggleHide = (id: string) => {
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
              aria-label={`Reorder fill ${fillNum}`}
              title={`Reorder fill ${fillNum}`}
              className="ll-ib ll-grip ll:-ml-4 ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:cursor-grab ll:opacity-0 ll:group-hover:opacity-100 ll:group-focus-within:opacity-100 ll:transition-opacity ll:duration-100 ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={GripVertical} size={12} />
            </button>

            {/* Lead swatch button: opens ColorPicker */}
            <button
              ref={(el) => {
                swatchBtnRefs.current[fill.id] = el;
              }}
              type="button"
              data-lead
              aria-label={`Fill ${fillNum} settings`}
              aria-haspopup="dialog"
              aria-expanded={activeColorPickerId === fill.id || isOpen}
              title={`Fill ${fillNum} color`}
              onClick={() =>
                setActiveColorPickerId(
                  activeColorPickerId === fill.id ? null : fill.id
                )
              }
              className="ll-lead ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:shrink-0 ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:hover:bg-surface-hover ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
            >
              <span
                className="ll-dsw ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                style={{ backgroundColor: `#${fill.hex}` }}
              />
            </button>
            <ColorPicker
              open={activeColorPickerId === fill.id}
              value={`#${fill.hex}`}
              anchorRef={{ current: swatchBtnRefs.current[fill.id] }}
              onChange={(hex) =>
                handleUpdateFill(fill.id, {
                  hex: hex.replace(/^#/, "").toUpperCase(),
                })
              }
              onClose={() => setActiveColorPickerId(null)}
            />

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

            {/* Row Settings Trigger: opens RowSettingsPopover */}
            <button
              type="button"
              aria-label={`Fill ${fillNum} settings`}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              title={`Fill ${fillNum} settings`}
              onClick={() => setActivePopoverId(isOpen ? null : fill.id)}
              className={`ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none ${
                isOpen ? "ll:bg-control-secondary-bg ll:text-primary" : ""
              }`}
            >
              <Icon icon={Sliders} size={14} />
            </button>

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
                onChange={(value) => handleUpdateFill(fill.id, { type: value as FillItem["type"] })}
              />
              <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:items-center">
                <div className="ll:flex ll:items-center ll:gap-1 ll:min-w-0">
                  <span
                    className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                    style={{ backgroundColor: `#${fill.hex}` }}
                  />
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

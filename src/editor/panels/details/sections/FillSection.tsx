"use client";

import React, { useState } from "react";
import { GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
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
  if (onAddFillRef) {
    onAddFillRef.current = handleAddFill;
  }

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
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:w-full ${className}`}>
      {fills.map((fill) => {
        const isDim = Boolean(fill.hidden);
        return (
          <div
            key={fill.id}
            data-k="fill"
            className={`ll-dr ll-rr ll:flex ll:items-center ll:gap-1.5 ll:h-8 ll:px-1 ll:rounded-sm ll:hover:bg-surface-bar ll:transition-colors ${
              isDim ? "ll-rdim ll:opacity-50" : ""
            }`}
          >
            {/* Grip handle */}
            <button
              type="button"
              aria-label="Reorder"
              title="Reorder"
              className="ll-grip ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:cursor-grab ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={GripVertical} size={12} />
            </button>

            {/* Lead swatch button */}
            <button
              type="button"
              aria-label="Settings"
              title="Settings"
              onClick={() =>
                setActivePopoverId(activePopoverId === fill.id ? null : fill.id)
              }
              className="ll-lead ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
            >
              <span
                className="ll-dsw ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                style={{ backgroundColor: `#${fill.hex}` }}
              />
            </button>

            {/* Hex and Opacity Fields */}
            <div className="ll-sum ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
              <div className="ll-dfield ll:flex ll:items-center ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
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
                  className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-small ll:text-primary ll:outline-none"
                />
              </div>

              <div className="ll-dfield ll:flex ll:items-center ll:w-16 ll:shrink-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
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
                  className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-small ll:text-primary ll:outline-none"
                />
                <span className="ll-sf ll:font-mono ll:text-micro ll:text-muted ll:shrink-0 ll:select-none">
                  %
                </span>
              </div>
            </div>

            {/* Visibility Toggle */}
            <button
              type="button"
              aria-label={fill.hidden ? "Show" : "Hide"}
              title={fill.hidden ? "Show" : "Hide"}
              onClick={() => handleToggleHide(fill.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={fill.hidden ? EyeOff : Eye} size={14} />
            </button>

            {/* Remove Button */}
            <button
              type="button"
              aria-label="Remove"
              title="Remove"
              onClick={() => handleRemoveFill(fill.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={Minus} size={14} />
            </button>

            {/* Settings Popover */}
            {activePopoverId === fill.id && (
              <RowSettingsPopover
                isOpen={true}
                title="Fill Settings"
                onClose={() => setActivePopoverId(null)}
              >
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <span className="ll:text-nano ll:font-mono ll:text-muted">
                    Solid Color: #{fill.hex} ({fill.opacity}%)
                  </span>
                </div>
              </RowSettingsPopover>
            )}
          </div>
        );
      })}
    </div>
  );
};

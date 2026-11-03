"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { RepeatableRow } from "../controls/RepeatableRow";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import { INSPECTOR_CONSTANTS } from "../constants";
import type { InspectorSectionProps, StrokeItem } from "../types";

const DEFAULT_STROKE: StrokeItem = {
  id: "stroke-default",
  hex: "444444",
  width: 1,
  style: "solid",
  sides: "all",
};

export const StrokeSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const initialHex = (getValue?.("appearance.border.color") as string) || (getValue?.("borderColor") as string) || "444444";
  const initialWidth = (getValue?.("appearance.border.width") as number) ?? (getValue?.("borderWidth") as number) ?? 1;

  const [strokes, setStrokes] = useState<StrokeItem[]>([
    {
      ...DEFAULT_STROKE,
      hex: initialHex.replace(/^#/, "").toUpperCase(),
      width: initialWidth,
    },
  ]);

  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

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
    setActivePopoverId(newId);
    syncPrimaryToStore(next);
  };

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

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Header Add Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pb-1">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Borders &amp; Outlines
        </span>
        <IconButton
          size="sm"
          aria-label="Add stroke"
          tooltip="Add stroke"
          onClick={handleAddStroke}
          icon={<Icon icon={Plus} size={14} />}
        />
      </div>

      {/* Repeatable Strokes List */}
      <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
        {strokes.map((stroke) => {
          const isOpen = activePopoverId === stroke.id;
          const displayHex = stroke.hex.replace(/^#/, "").toUpperCase();

          const leadNode = (
            <span
              aria-hidden="true"
              style={{ backgroundColor: `#${displayHex}` }}
              className="ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-swatch-line ll:shadow-soft"
            />
          );

          const summaryNode = (
            <div className="ll:flex ll:items-center ll:gap-1.5 ll:w-full">
              <input
                type="text"
                maxLength={6}
                aria-label="Stroke hex"
                value={displayHex}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
                  handleUpdateStroke(stroke.id, { hex: clean });
                }}
                className="ll:w-20 ll:h-7 ll:px-2 ll:box-border ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:focus:border-primary ll:outline-none ll:rounded-sm ll:font-mono ll:text-small ll:text-primary ll:transition-colors"
              />
              <NumberField
                size="sm"
                label="W"
                aria-label="Stroke width"
                value={stroke.width}
                min={0}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => handleUpdateStroke(stroke.id, { width: v })}
              />
            </div>
          );

          return (
            <React.Fragment key={stroke.id}>
              <RepeatableRow
                id={stroke.id}
                isOpen={isOpen}
                isHidden={stroke.hidden}
                leadContent={leadNode}
                leadTitle="Stroke settings"
                summaryContent={summaryNode}
                onOpenSettings={() =>
                  setActivePopoverId((prev) => (prev === stroke.id ? null : stroke.id))
                }
                onToggleHide={() => handleToggleHide(stroke.id)}
                onRemove={() => handleRemoveStroke(stroke.id)}
              />

              {/* Popover Settings */}
              {isOpen && (
                <RowSettingsPopover
                  title="Stroke Settings"
                  isOpen={isOpen}
                  onClose={() => setActivePopoverId(null)}
                >
                  <ColorSwatchField
                    size="sm"
                    hex={stroke.hex}
                    onChangeHex={(hex) => handleUpdateStroke(stroke.id, { hex })}
                  />

                  <NumberField
                    size="sm"
                    label="Width"
                    aria-label="Stroke width"
                    value={stroke.width}
                    min={0}
                    step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                    onChange={(width) => handleUpdateStroke(stroke.id, { width })}
                  />

                  {/* Style: Solid, Dashed, Dotted */}
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
                      Style
                    </span>
                    <SegmentedControl
                      size="sm"
                      ariaLabel="Stroke style"
                      value={stroke.style}
                      onChange={(val) =>
                        handleUpdateStroke(stroke.id, {
                          style: val as StrokeItem["style"],
                        })
                      }
                      options={[
                        { value: "solid", label: "Solid" },
                        { value: "dashed", label: "Dashed" },
                        { value: "dotted", label: "Dotted" },
                      ]}
                    />
                  </div>

                  {/* Sides: All, Top, Right, Bottom, Left */}
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
                      Sides
                    </span>
                    <SegmentedControl
                      size="sm"
                      ariaLabel="Stroke sides"
                      value={stroke.sides}
                      onChange={(val) =>
                        handleUpdateStroke(stroke.id, {
                          sides: val as StrokeItem["sides"],
                        })
                      }
                      options={[
                        { value: "all", label: "All" },
                        { value: "top", label: "Top" },
                        { value: "right", label: "Right" },
                        { value: "bottom", label: "Bottom" },
                        { value: "left", label: "Left" },
                      ]}
                    />
                  </div>
                </RowSettingsPopover>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

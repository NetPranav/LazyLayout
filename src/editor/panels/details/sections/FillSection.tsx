"use client";

import React, { useState } from "react";
import { Plus, Image as ImageIcon } from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { RepeatableRow } from "../controls/RepeatableRow";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import {
  INSPECTOR_CONSTANTS,
  PAINT_TYPE_OPTIONS,
} from "../constants";
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

export const FillSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  // Read existing background color or fills from layer
  const initialHex = (getValue?.("appearance.background.color") as string) || (getValue?.("backgroundColor") as string) || "FFFFFF";
  const cleanHex = initialHex.replace(/^#/, "").toUpperCase();

  const [fills, setFills] = useState<FillItem[]>([
    {
      ...DEFAULT_FILL,
      hex: cleanHex || "FFFFFF",
    },
  ]);

  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const syncPrimaryToStore = (updatedFills: FillItem[]) => {
    const visibleFill = updatedFills.find((f) => !f.hidden);
    if (visibleFill && visibleFill.type === "solid") {
      onUpdateProp?.("appearance.background.color", `#${visibleFill.hex}`);
      onUpdateProp?.("backgroundColor", `#${visibleFill.hex}`);
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
    setActivePopoverId(newId);
    syncPrimaryToStore(next);
  };

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

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Add Fill Header Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pb-1">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Paints
        </span>
        <IconButton
          size="sm"
          aria-label="Add fill"
          tooltip="Add fill"
          onClick={handleAddFill}
          icon={<Icon icon={Plus} size={14} />}
        />
      </div>

      {/* Repeatable Fills List */}
      <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
        {fills.map((fill) => {
          const isOpen = activePopoverId === fill.id;
          const displayHex = fill.hex.replace(/^#/, "").toUpperCase();

          // Lead preview content
          const leadNode =
            fill.type === "solid" ? (
              <span
                aria-hidden="true"
                style={{ backgroundColor: `#${displayHex}` }}
                className="ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-swatch-line ll:shadow-soft"
              />
            ) : fill.type === "image" ? (
              <span className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:bg-surface-bar ll:text-muted">
                <Icon icon={ImageIcon} size={12} />
              </span>
            ) : (
              <span
                aria-hidden="true"
                style={{
                  background:
                    fill.stops && fill.stops.length >= 2
                      ? `linear-gradient(90deg, #${fill.stops[0].hex}, #${fill.stops[1].hex})`
                      : "var(--ll-border-color)",
                }}
                className="ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-swatch-line ll:shadow-soft"
              />
            );

          // Summary content
          const summaryNode =
            fill.type === "solid" ? (
              <div className="ll:flex ll:items-center ll:gap-1.5 ll:w-full">
                <input
                  type="text"
                  maxLength={6}
                  aria-label="Fill hex"
                  value={displayHex}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
                    handleUpdateFill(fill.id, { hex: clean });
                  }}
                  className="ll:w-20 ll:h-7 ll:px-2 ll:box-border ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:focus:border-primary ll:outline-none ll:rounded-sm ll:font-mono ll:text-small ll:text-primary ll:transition-colors"
                />
                <NumberField
                  size="sm"
                  label=""
                  aria-label="Fill opacity"
                  suffix="%"
                  value={fill.opacity}
                  min={0}
                  max={100}
                  onChange={(v) => handleUpdateFill(fill.id, { opacity: v })}
                />
              </div>
            ) : (
              <div className="ll:flex ll:items-center ll:justify-between ll:w-full ll:gap-1.5">
                <span className="ll:text-small ll:font-mono ll:text-primary ll:capitalize">
                  {fill.type}
                </span>
                <NumberField
                  size="sm"
                  label=""
                  aria-label="Fill opacity"
                  suffix="%"
                  value={fill.opacity}
                  min={0}
                  max={100}
                  onChange={(v) => handleUpdateFill(fill.id, { opacity: v })}
                />
              </div>
            );

          return (
            <React.Fragment key={fill.id}>
              <RepeatableRow
                id={fill.id}
                isOpen={isOpen}
                isHidden={fill.hidden}
                leadContent={leadNode}
                leadTitle={`${fill.type} settings`}
                summaryContent={summaryNode}
                onOpenSettings={() =>
                  setActivePopoverId((prev) => (prev === fill.id ? null : fill.id))
                }
                onToggleHide={() => handleToggleHide(fill.id)}
                onRemove={() => handleRemoveFill(fill.id)}
              />

              {/* Popover Settings */}
              {isOpen && (
                <RowSettingsPopover
                  title="Fill Settings"
                  isOpen={isOpen}
                  onClose={() => setActivePopoverId(null)}
                >
                  {/* Paint Type Select */}
                  <Select
                    size="sm"
                    label="Type"
                    aria-label="Paint type"
                    value={fill.type}
                    options={PAINT_TYPE_OPTIONS}
                    onChange={(val) =>
                      handleUpdateFill(fill.id, {
                        type: val as FillItem["type"],
                      })
                    }
                  />

                  {/* Solid Type Settings */}
                  {fill.type === "solid" && (
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <ColorSwatchField
                        size="sm"
                        hex={fill.hex}
                        opacity={fill.opacity}
                        onChangeHex={(hex) => handleUpdateFill(fill.id, { hex })}
                        onChangeOpacity={(opacity) =>
                          handleUpdateFill(fill.id, { opacity })
                        }
                      />
                    </div>
                  )}

                  {/* Gradient Settings */}
                  {(fill.type === "linear" ||
                    fill.type === "radial" ||
                    fill.type === "conic") && (
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      {/* Gradient angle */}
                      {fill.type !== "radial" && (
                        <NumberField
                          size="sm"
                          label="Angle"
                          suffix="°"
                          value={fill.angle ?? 180}
                          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                          onChange={(v) => handleUpdateFill(fill.id, { angle: v })}
                        />
                      )}

                      {/* Stops list */}
                      <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
                        Stops
                      </span>
                      {fill.stops?.map((stop, sIdx) => (
                        <div
                          key={stop.id}
                          className="ll:flex ll:items-center ll:gap-1.5"
                        >
                          <span
                            style={{ backgroundColor: `#${stop.hex}` }}
                            className="ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-swatch-line ll:shrink-0"
                          />
                          <input
                            type="text"
                            maxLength={6}
                            aria-label={`Stop ${sIdx + 1} hex`}
                            value={stop.hex}
                            onChange={(e) => {
                              const clean = e.target.value
                                .replace(/[^0-9A-Fa-f]/g, "")
                                .toUpperCase();
                              const nextStops = fill.stops?.map((st, i) =>
                                i === sIdx ? { ...st, hex: clean } : st
                              );
                              handleUpdateFill(fill.id, { stops: nextStops });
                            }}
                            className="ll:w-16 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-small ll:text-primary ll:outline-none"
                          />
                          <NumberField
                            size="sm"
                            label=""
                            suffix="%"
                            value={stop.position}
                            min={0}
                            max={100}
                            onChange={(v) => {
                              const nextStops = fill.stops?.map((st, i) =>
                                i === sIdx ? { ...st, position: v } : st
                              );
                              handleUpdateFill(fill.id, { stops: nextStops });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Image Settings */}
                  {fill.type === "image" && (
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                        <span className="ll:text-small ll:font-mono ll:text-primary">
                          {fill.imageName || "asset-hero.jpg"}
                        </span>
                        <Button size="sm" variant="secondary">
                          Replace
                        </Button>
                      </div>
                      <Select
                        size="sm"
                        label="Fit"
                        aria-label="Image fit"
                        value={fill.imageFit || "fill"}
                        options={[
                          { value: "fill", label: "Fill" },
                          { value: "fit", label: "Fit" },
                          { value: "crop", label: "Crop" },
                        ]}
                        onChange={(val) =>
                          handleUpdateFill(fill.id, {
                            imageFit: val as FillItem["imageFit"],
                          })
                        }
                      />
                    </div>
                  )}
                </RowSettingsPopover>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

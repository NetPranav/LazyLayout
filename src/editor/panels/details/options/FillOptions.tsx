"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { OptionGroup, OptionRow } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export interface GradientStopItem {
  id: string;
  hex: string;
  position: number;
}

export interface FillOptionsProps extends InspectorSectionProps {
  paintType?: "Solid" | "Linear" | "Radial" | "Conic" | "Image";
  opacity?: number;
  blend?: string;
  angle?: number;
  stops?: GradientStopItem[];
  imageFit?: "Fill" | "Fit" | "Crop" | "Tile";
  onChangePaintType?: (t: "Solid" | "Linear" | "Radial" | "Conic" | "Image") => void;
  onChangeOpacity?: (op: number) => void;
  onChangeBlend?: (bl: string) => void;
  onChangeAngle?: (ang: number) => void;
  onChangeStops?: (stops: GradientStopItem[]) => void;
  onChangeImageFit?: (fit: "Fill" | "Fit" | "Crop" | "Tile") => void;
}

const PAINT_TYPE_OPTIONS = [
  { value: "Solid", label: "Solid" },
  { value: "Linear", label: "Linear" },
  { value: "Radial", label: "Radial" },
  { value: "Conic", label: "Conic" },
  { value: "Image", label: "Image" },
] as const;

const BLEND_OPTIONS = [
  { value: "Normal", label: "Normal" },
  { value: "Multiply", label: "Multiply" },
  { value: "Screen", label: "Screen" },
  { value: "Overlay", label: "Overlay" },
  { value: "Darken", label: "Darken" },
  { value: "Lighten", label: "Lighten" },
] as const;

const IMAGE_FIT_OPTIONS = [
  { value: "Fill", label: "Fill" },
  { value: "Fit", label: "Fit" },
  { value: "Crop", label: "Crop" },
  { value: "Tile", label: "Tile" },
] as const;

export const FillOptions: React.FC<FillOptionsProps> = ({
  paintType: propPaintType = "Solid",
  opacity: propOpacity = 100,
  blend: propBlend = "Normal",
  angle: propAngle = 180,
  stops: propStops = [
    { id: "s1", hex: "6C5CE7", position: 0 },
    { id: "s2", hex: "F0A8C8", position: 100 },
  ],
  imageFit: propImageFit = "Fill",
  onChangePaintType,
  onChangeOpacity,
  onChangeBlend,
  onChangeAngle,
  onChangeStops,
  onChangeImageFit,
}) => {
  const [paintType, setPaintType] = useState(propPaintType);
  const [opacity, setOpacity] = useState(propOpacity);
  const [blend, setBlend] = useState(propBlend);
  const [angle, setAngle] = useState(propAngle);
  const [stops, setStops] = useState<GradientStopItem[]>(propStops);
  const [imageFit, setImageFit] = useState(propImageFit);

  const isGradient = paintType === "Linear" || paintType === "Radial" || paintType === "Conic";
  const isImage = paintType === "Image";

  const handleAddStop = () => {
    const next: GradientStopItem[] = [
      ...stops,
      { id: `st-${Date.now()}`, hex: "FFFFFF", position: 50 },
    ];
    setStops(next);
    onChangeStops?.(next);
  };

  const handleRemoveStop = (id: string) => {
    if (stops.length <= 2) return;
    const next = stops.filter((s) => s.id !== id);
    setStops(next);
    onChangeStops?.(next);
  };

  const handleUpdateStop = (id: string, patch: Partial<GradientStopItem>) => {
    const next = stops.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setStops(next);
    onChangeStops?.(next);
  };

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Paint Type, Opacity, Blend */}
      <OptionGroup>
        <OptionRow label="Paint type">
          <Select
            size="sm"
            aria-label="Paint type"
            value={paintType}
            options={PAINT_TYPE_OPTIONS}
            onChange={(v) => {
              const next = v as typeof paintType;
              setPaintType(next);
              onChangePaintType?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Opacity">
          <NumberField
            size="sm"
            aria-label="Fill opacity"
            value={opacity}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(op) => {
              setOpacity(op);
              onChangeOpacity?.(op);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Blend">
          <Select
            size="sm"
            aria-label="Blend mode"
            value={blend}
            options={BLEND_OPTIONS}
            onChange={(b) => {
              setBlend(b);
              onChangeBlend?.(b);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 2: Gradient Angle & Stops (if gradient) */}
      {isGradient && (
        <OptionGroup>
          {paintType !== "Radial" && (
            <OptionRow label="Angle">
              <NumberField
                size="sm"
                aria-label="Gradient angle"
                value={angle}
                min={0}
                max={360}
                step={1}
                unit="°"
                onChange={(a) => {
                  setAngle(a);
                  onChangeAngle?.(a);
                }}
                className="ll:w-full"
              />
            </OptionRow>
          )}

          <div className="ll:flex ll:items-center ll:justify-between ll:min-h-7">
            <span className="dlbl ll-dlbl ll:text-small ll:font-normal ll:text-muted">
              Stops
            </span>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Add stop"
              tooltip="Add stop"
              onClick={handleAddStop}
              icon={<Icon icon={Plus} size={14} />}
            />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
            {stops.map((stop, idx) => (
              <div
                key={stop.id}
                className="ll:flex ll:items-center ll:gap-2 ll:h-7 ll:w-full"
              >
                {/* Swatch */}
                <span
                  className="dsw ll-dsw ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-swatch-line ll:shrink-0 ll:cursor-pointer"
                  style={{ backgroundColor: `#${stop.hex}` }}
                />

                {/* Hex Field */}
                <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:flex-1 ll:min-w-0 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm">
                  <span className="pf ll:text-micro ll:font-mono ll:text-muted ll:mr-1">#</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={stop.hex}
                    aria-label={`Stop ${idx + 1} hex`}
                    onChange={(e) =>
                      handleUpdateStop(stop.id, {
                        hex: e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase(),
                      })
                    }
                    className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                  />
                </div>

                {/* Position Field */}
                <div className="ll:w-18 ll:shrink-0">
                  <NumberField
                    size="sm"
                    aria-label={`Stop ${idx + 1} position`}
                    value={stop.position}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(pos) => handleUpdateStop(stop.id, { position: pos })}
                  />
                </div>

                {stops.length > 2 && (
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove stop ${idx + 1}`}
                    tooltip="Remove"
                    onClick={() => handleRemoveStop(stop.id)}
                    icon={<Icon icon={Minus} size={14} />}
                  />
                )}
              </div>
            ))}
          </div>
        </OptionGroup>
      )}

      {/* Group 3: Image Fit (if image) */}
      {isImage && (
        <OptionGroup>
          <OptionRow label="Image fit">
            <Select
              size="sm"
              aria-label="Image fit"
              value={imageFit}
              options={IMAGE_FIT_OPTIONS}
              onChange={(fit) => {
                const next = fit as typeof imageFit;
                setImageFit(next);
                onChangeImageFit?.(next);
              }}
              className="ll:w-full"
            />
          </OptionRow>

          <OptionRow label="Source">
            <button
              type="button"
              className="dtxt ll:h-7 ll:px-3 ll:rounded-sm ll:bg-surface-bar ll:hover:bg-surface-seg ll:border ll:border-border ll:text-primary ll:text-small ll:transition-colors ll:w-full"
            >
              Replace image
            </button>
          </OptionRow>
        </OptionGroup>
      )}
    </div>
  );
};

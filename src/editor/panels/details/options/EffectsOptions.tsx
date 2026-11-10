"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { OptionGroup, OptionRow } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export interface ShadowItem {
  id: string;
  type: "drop" | "inner";
  hex: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
}

export interface EffectsOptionsProps extends InspectorSectionProps {
  shadows?: ShadowItem[];
  blur?: number;
  backgroundBlur?: number;
  blend?: string;
  onChangeShadows?: (shadows: ShadowItem[]) => void;
  onChangeBlur?: (blur: number) => void;
  onChangeBackgroundBlur?: (bgBlur: number) => void;
  onChangeBlend?: (blend: string) => void;
}

const BLEND_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
] as const;

const SHADOW_TYPE_OPTIONS = [
  { value: "drop", label: "Drop shadow" },
  { value: "inner", label: "Inner shadow" },
] as const;

export const EffectsOptions: React.FC<EffectsOptionsProps> = ({
  shadows: propShadows = [
    { id: "s1", type: "drop", hex: "000000", x: 0, y: 4, blur: 16, spread: 0 },
  ],
  blur: propBlur = 0,
  backgroundBlur: propBgBlur = 0,
  blend: propBlend = "normal",
  onChangeShadows,
  onChangeBlur,
  onChangeBackgroundBlur,
  onChangeBlend,
}) => {
  const [shadows, setShadows] = useState<ShadowItem[]>(propShadows);
  const [blur, setBlur] = useState(propBlur);
  const [bgBlur, setBgBlur] = useState(propBgBlur);
  const [blend, setBlend] = useState(propBlend);

  const handleAddShadow = () => {
    const next: ShadowItem[] = [
      ...shadows,
      {
        id: `s-${Date.now()}`,
        type: "drop",
        hex: "000000",
        x: 0,
        y: 8,
        blur: 24,
        spread: 0,
      },
    ];
    setShadows(next);
    onChangeShadows?.(next);
  };

  const handleRemoveShadow = (id: string) => {
    const next = shadows.filter((s) => s.id !== id);
    setShadows(next);
    onChangeShadows?.(next);
  };

  const handleUpdateShadow = (id: string, patch: Partial<ShadowItem>) => {
    const next = shadows.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setShadows(next);
    onChangeShadows?.(next);
  };

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Shadows List */}
      <OptionGroup>
        <div className="ll:flex ll:items-center ll:justify-between ll:min-h-7">
          <span className="dlbl ll-dlbl ll:text-small ll:font-normal ll:text-muted">
            Shadows
          </span>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Add shadow"
            tooltip="Add shadow"
            onClick={handleAddShadow}
            icon={<Icon icon={Plus} size={14} />}
          />
        </div>

        {shadows.map((sh, idx) => (
          <div
            key={sh.id}
            className="ll:flex ll:flex-col ll:gap-1.5 ll:p-2 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:relative"
          >
            <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
              <Select
                size="sm"
                aria-label={`Shadow ${idx + 1} type`}
                value={sh.type}
                options={SHADOW_TYPE_OPTIONS}
                onChange={(t) =>
                  handleUpdateShadow(sh.id, { type: t as "drop" | "inner" })
                }
                className="ll:flex-1 ll:min-w-0"
              />

              {/* Swatch + Hex */}
              <div className="dpair ll-dpair ll:flex ll:items-center ll:gap-1">
                <span
                  className="dsw ll-dsw ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-swatch-line ll:shrink-0 ll:cursor-pointer"
                  style={{ backgroundColor: `#${sh.hex}` }}
                />
                <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:w-20 ll:px-1.5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm">
                  <span className="pf ll:text-micro ll:font-mono ll:text-muted ll:mr-1">#</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={sh.hex}
                    aria-label={`Shadow ${idx + 1} hex`}
                    onChange={(e) =>
                      handleUpdateShadow(sh.id, {
                        hex: e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase(),
                      })
                    }
                    className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                  />
                </div>
              </div>

              {shadows.length > 1 && (
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove shadow ${idx + 1}`}
                  tooltip="Remove"
                  onClick={() => handleRemoveShadow(sh.id)}
                  icon={<Icon icon={Minus} size={14} />}
                />
              )}
            </div>

            {/* X, Y, Blur, Spread */}
            <div className="dgrid4 ll-dgrid4 ll:grid ll:grid-cols-4 ll:gap-1.5 ll:w-full">
              <NumberField
                size="sm"
                label="X"
                value={sh.x}
                onChange={(v) => handleUpdateShadow(sh.id, { x: v })}
                aria-label={`Shadow ${idx + 1} X`}
              />
              <NumberField
                size="sm"
                label="Y"
                value={sh.y}
                onChange={(v) => handleUpdateShadow(sh.id, { y: v })}
                aria-label={`Shadow ${idx + 1} Y`}
              />
              <NumberField
                size="sm"
                label="B"
                value={sh.blur}
                min={0}
                onChange={(v) => handleUpdateShadow(sh.id, { blur: Math.max(0, v) })}
                aria-label={`Shadow ${idx + 1} blur`}
              />
              <NumberField
                size="sm"
                label="S"
                value={sh.spread}
                onChange={(v) => handleUpdateShadow(sh.id, { spread: v })}
                aria-label={`Shadow ${idx + 1} spread`}
              />
            </div>
          </div>
        ))}
      </OptionGroup>

      {/* Group 2: Blur & Background Blur */}
      <OptionGroup>
        <OptionRow label="Blur">
          <NumberField
            size="sm"
            aria-label="Blur amount"
            value={blur}
            min={0}
            onChange={(b) => {
              setBlur(b);
              onChangeBlur?.(b);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Bg blur">
          <NumberField
            size="sm"
            aria-label="Background blur amount"
            value={bgBlur}
            min={0}
            onChange={(bb) => {
              setBgBlur(bb);
              onChangeBackgroundBlur?.(bb);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 3: Blend Mode */}
      <OptionGroup>
        <OptionRow label="Blend">
          <Select
            size="sm"
            aria-label="Blend mode"
            value={blend}
            options={BLEND_OPTIONS}
            onChange={(bl) => {
              setBlend(bl);
              onChangeBlend?.(bl);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

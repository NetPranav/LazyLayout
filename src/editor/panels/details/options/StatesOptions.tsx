"use client";

import React, { useState } from "react";
import { OptionGroup, OptionRow } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export interface StatesOptionsProps extends InspectorSectionProps {
  size?: "Small" | "Medium" | "Large";
  type?: "Button" | "Submit" | "Reset";
  focusRingHex?: string;
  ringWidth?: number;
  disabledOpacity?: number;
  loadingLabel?: string;
  spinner?: "Circle" | "Dots";
  ripple?: boolean;
  rippleDuration?: number;
}

const SIZE_OPTIONS = [
  { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" },
  { value: "Large", label: "Large" },
] as const;

const TYPE_OPTIONS = [
  { value: "Button", label: "Button" },
  { value: "Submit", label: "Submit" },
  { value: "Reset", label: "Reset" },
] as const;

const SPINNER_OPTIONS = [
  { value: "Circle", label: "Circle" },
  { value: "Dots", label: "Dots" },
] as const;

export const StatesOptions: React.FC<StatesOptionsProps> = ({
  size: propSz = "Medium",
  type: propTy = "Button",
  focusRingHex: propFr = "7C9CFF",
  ringWidth: propRw = 2,
  disabledOpacity: propDo = 50,
  loadingLabel: propLl = "Loading",
  spinner: propSp = "Circle",
  ripple: propRp = true,
  rippleDuration: propRd = 0.4,
}) => {
  const [size, setSize] = useState(propSz);
  const [type, setType] = useState(propTy);
  const [focusRingHex, setFocusRingHex] = useState(propFr);
  const [ringWidth, setRingWidth] = useState(propRw);
  const [disabledOpacity, setDisabledOpacity] = useState(propDo);
  const [loadingLabel, setLoadingLabel] = useState(propLl);
  const [spinner, setSpinner] = useState(propSp);
  const [ripple, setRipple] = useState(propRp);
  const [rippleDuration, setRippleDuration] = useState(propRd);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Size & Type */}
      <OptionGroup>
        <OptionRow label="Size">
          <Select
            size="sm"
            aria-label="Button size"
            value={size}
            options={SIZE_OPTIONS}
            onChange={(s) => setSize(s as typeof size)}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Type">
          <Select
            size="sm"
            aria-label="Button type"
            value={type}
            options={TYPE_OPTIONS}
            onChange={(t) => setType(t as typeof type)}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 2: Focus Ring & Disabled */}
      <OptionGroup>
        <OptionRow label="Focus ring">
          <div className="dpair ll-dpair ll:flex ll:items-center ll:gap-1.5 ll:w-full">
            <span
              className="dsw ll-dsw ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-swatch-line ll:shrink-0 ll:cursor-pointer"
              style={{ backgroundColor: `#${focusRingHex}` }}
            />
            <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:flex-1 ll:min-w-0 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm">
              <span className="pf ll:text-micro ll:font-mono ll:text-muted ll:mr-1">#</span>
              <input
                type="text"
                maxLength={6}
                value={focusRingHex}
                aria-label="Focus ring hex"
                onChange={(e) => setFocusRingHex(e.target.value.toUpperCase())}
                className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
              />
            </div>
          </div>
        </OptionRow>

        <OptionRow label="Ring width">
          <NumberField
            size="sm"
            value={ringWidth}
            min={0}
            onChange={setRingWidth}
            aria-label="Ring width"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Disabled">
          <NumberField
            size="sm"
            unit="%"
            value={disabledOpacity}
            min={0}
            max={100}
            onChange={setDisabledOpacity}
            aria-label="Disabled opacity"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 3: Loading & Spinner */}
      <OptionGroup>
        <OptionRow label="Loading">
          <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:w-full">
            <input
              type="text"
              value={loadingLabel}
              aria-label="Loading label"
              onChange={(e) => setLoadingLabel(e.target.value)}
              className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </OptionRow>

        <OptionRow label="Spinner">
          <Select
            size="sm"
            aria-label="Spinner"
            value={spinner}
            options={SPINNER_OPTIONS}
            onChange={(s) => setSpinner(s as typeof spinner)}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 4: Ripple */}
      <OptionGroup>
        <OptionRow label="Ripple">
          <label className="ll:flex ll:items-center ll:gap-2 ll:cursor-pointer">
            <input
              type="checkbox"
              checked={ripple}
              aria-label="Enable ripple effect"
              onChange={(e) => setRipple(e.target.checked)}
              className="ll:rounded-xs ll:border-border ll:text-primary ll:focus:ring-primary"
            />
            <span className="ll:text-small ll:text-muted">Enabled</span>
          </label>
        </OptionRow>

        <OptionRow label="Duration">
          <NumberField
            size="sm"
            unit="s"
            step={0.1}
            value={rippleDuration}
            min={0.1}
            onChange={setRippleDuration}
            aria-label="Ripple duration"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

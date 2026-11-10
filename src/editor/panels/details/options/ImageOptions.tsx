"use client";

import React, { useState } from "react";
import { OptionGroup, OptionRow, OptionTwo } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export interface ImageOptionsProps extends InspectorSectionProps {
  focalX?: number;
  focalY?: number;
  aspectRatio?: string;
  loading?: "Lazy" | "Eager";
  brightness?: number;
  contrast?: number;
  saturation?: number;
  grayscale?: number;
  blur?: number;
  overlayHex?: string;
  overlayOpacity?: number;
  overlayBlend?: string;
}

const RATIO_OPTIONS = [
  { value: "Auto", label: "Auto" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "16:9", label: "16:9" },
] as const;

const LOADING_OPTIONS = [
  { value: "Lazy", label: "Lazy" },
  { value: "Eager", label: "Eager" },
] as const;

const BLEND_OPTIONS = [
  { value: "Normal", label: "Normal" },
  { value: "Multiply", label: "Multiply" },
  { value: "Screen", label: "Screen" },
  { value: "Overlay", label: "Overlay" },
] as const;

export const ImageOptions: React.FC<ImageOptionsProps> = ({
  focalX: propFx = 50,
  focalY: propFy = 50,
  aspectRatio: propAr = "Auto",
  loading: propLd = "Lazy",
  brightness: propBr = 100,
  contrast: propCt = 100,
  saturation: propSt = 100,
  grayscale: propGs = 0,
  blur: propBl = 0,
  overlayHex: propOh = "000000",
  overlayOpacity: propOo = 0,
  overlayBlend: propOb = "Normal",
}) => {
  const [focalX, setFocalX] = useState(propFx);
  const [focalY, setFocalY] = useState(propFy);
  const [aspectRatio, setAspectRatio] = useState(propAr);
  const [loading, setLoading] = useState(propLd);
  const [brightness, setBrightness] = useState(propBr);
  const [contrast, setContrast] = useState(propCt);
  const [saturation, setSaturation] = useState(propSt);
  const [grayscale, setGrayscale] = useState(propGs);
  const [blur, setBlur] = useState(propBl);
  const [overlayHex, setOverlayHex] = useState(propOh);
  const [overlayOpacity, setOverlayOpacity] = useState(propOo);
  const [overlayBlend, setOverlayBlend] = useState(propOb);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Focal & Ratio */}
      <OptionGroup>
        <OptionRow label="Focal">
          <OptionTwo>
            <NumberField
              size="sm"
              label="X"
              unit="%"
              value={focalX}
              onChange={setFocalX}
              aria-label="Focal X"
            />
            <NumberField
              size="sm"
              label="Y"
              unit="%"
              value={focalY}
              onChange={setFocalY}
              aria-label="Focal Y"
            />
          </OptionTwo>
        </OptionRow>

        <OptionRow label="Ratio">
          <Select
            size="sm"
            aria-label="Aspect ratio"
            value={aspectRatio}
            options={RATIO_OPTIONS}
            onChange={setAspectRatio}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 2: Loading */}
      <OptionGroup>
        <OptionRow label="Loading">
          <Select
            size="sm"
            aria-label="Loading strategy"
            value={loading}
            options={LOADING_OPTIONS}
            onChange={(v) => setLoading(v as "Lazy" | "Eager")}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 3: Filters */}
      <OptionGroup>
        <OptionRow label="Brightness">
          <NumberField
            size="sm"
            unit="%"
            value={brightness}
            onChange={setBrightness}
            aria-label="Brightness"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Contrast">
          <NumberField
            size="sm"
            unit="%"
            value={contrast}
            onChange={setContrast}
            aria-label="Contrast"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Saturation">
          <NumberField
            size="sm"
            unit="%"
            value={saturation}
            onChange={setSaturation}
            aria-label="Saturation"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Grayscale">
          <NumberField
            size="sm"
            unit="%"
            value={grayscale}
            onChange={setGrayscale}
            aria-label="Grayscale"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Blur">
          <NumberField
            size="sm"
            value={blur}
            min={0}
            onChange={setBlur}
            aria-label="Blur"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 4: Overlay */}
      <OptionGroup>
        <OptionRow label="Overlay">
          <div className="dpair ll-dpair ll:flex ll:items-center ll:gap-1.5 ll:w-full">
            <span
              className="dsw ll-dsw ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-swatch-line ll:shrink-0 ll:cursor-pointer"
              style={{ backgroundColor: `#${overlayHex}` }}
            />
            <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:flex-1 ll:min-w-0 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm">
              <span className="pf ll:text-micro ll:font-mono ll:text-muted ll:mr-1">#</span>
              <input
                type="text"
                maxLength={6}
                value={overlayHex}
                aria-label="Overlay hex"
                onChange={(e) => setOverlayHex(e.target.value.toUpperCase())}
                className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
              />
            </div>
          </div>
        </OptionRow>

        <OptionRow label="Opacity">
          <NumberField
            size="sm"
            unit="%"
            value={overlayOpacity}
            min={0}
            max={100}
            onChange={setOverlayOpacity}
            aria-label="Overlay opacity"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Blend">
          <Select
            size="sm"
            aria-label="Overlay blend"
            value={overlayBlend}
            options={BLEND_OPTIONS}
            onChange={setOverlayBlend}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

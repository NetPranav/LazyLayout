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
  getValue,
  onUpdateProp,
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
  const currentFx = typeof getValue?.("media.focalPoint.x") === "number" ? (getValue?.("media.focalPoint.x") as number) : propFx;
  const currentFy = typeof getValue?.("media.focalPoint.y") === "number" ? (getValue?.("media.focalPoint.y") as number) : propFy;
  const currentAr = (getValue?.("media.aspectRatio") as string) || propAr;
  const rawLd = (getValue?.("media.loadingMode") as string) || "lazy";
  const currentLd = rawLd === "eager" ? "Eager" : "Lazy";
  const currentBr = typeof getValue?.("media.filter.brightness") === "number" ? Math.round((getValue?.("media.filter.brightness") as number) * 100) : propBr;
  const currentCt = typeof getValue?.("media.filter.contrast") === "number" ? Math.round((getValue?.("media.filter.contrast") as number) * 100) : propCt;
  const currentSt = typeof getValue?.("media.filter.saturate") === "number" ? Math.round((getValue?.("media.filter.saturate") as number) * 100) : propSt;
  const currentGs = typeof getValue?.("media.filter.grayscale") === "number" ? Math.round((getValue?.("media.filter.grayscale") as number) * 100) : propGs;
  const currentBl = typeof getValue?.("media.filter.blur") === "number" ? (getValue?.("media.filter.blur") as number) : propBl;
  const rawOverlayHex = (getValue?.("media.overlay.color") as string) || propOh;
  const currentOh = rawOverlayHex.replace(/^#/, "");
  const currentOo = typeof getValue?.("media.overlay.opacity") === "number" ? Math.round((getValue?.("media.overlay.opacity") as number) * 100) : propOo;
  const currentOb = (getValue?.("media.overlay.blendMode") as string) || propOb;

  const [focalX, setFocalX] = useState(currentFx);
  const [focalY, setFocalY] = useState(currentFy);
  const [aspectRatio, setAspectRatio] = useState(currentAr);
  const [loading, setLoading] = useState<"Lazy" | "Eager">(currentLd);
  const [brightness, setBrightness] = useState(currentBr);
  const [contrast, setContrast] = useState(currentCt);
  const [saturation, setSaturation] = useState(currentSt);
  const [grayscale, setGrayscale] = useState(currentGs);
  const [blur, setBlur] = useState(currentBl);
  const [overlayHex, setOverlayHex] = useState(currentOh);
  const [overlayOpacity, setOverlayOpacity] = useState(currentOo);
  const [overlayBlend, setOverlayBlend] = useState(currentOb);

  React.useEffect(() => {
    setFocalX(currentFx);
    setFocalY(currentFy);
    setAspectRatio(currentAr);
    setLoading(currentLd);
    setBrightness(currentBr);
    setContrast(currentCt);
    setSaturation(currentSt);
    setGrayscale(currentGs);
    setBlur(currentBl);
    setOverlayHex(currentOh);
    setOverlayOpacity(currentOo);
    setOverlayBlend(currentOb);
  }, [currentFx, currentFy, currentAr, currentLd, currentBr, currentCt, currentSt, currentGs, currentBl, currentOh, currentOo, currentOb]);

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
              onChange={(x) => {
                setFocalX(x);
                onUpdateProp?.("media.focalPoint.x", x);
              }}
              aria-label="Focal X"
            />
            <NumberField
              size="sm"
              label="Y"
              unit="%"
              value={focalY}
              onChange={(y) => {
                setFocalY(y);
                onUpdateProp?.("media.focalPoint.y", y);
              }}
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
            onChange={(ar) => {
              setAspectRatio(ar);
              onUpdateProp?.("media.aspectRatio", ar);
            }}
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
            onChange={(v) => {
              const next = v as "Lazy" | "Eager";
              setLoading(next);
              onUpdateProp?.("media.loadingMode", next.toLowerCase());
            }}
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
            onChange={(b) => {
              setBrightness(b);
              onUpdateProp?.("media.filter.brightness", b / 100);
            }}
            aria-label="Brightness"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Contrast">
          <NumberField
            size="sm"
            unit="%"
            value={contrast}
            onChange={(c) => {
              setContrast(c);
              onUpdateProp?.("media.filter.contrast", c / 100);
            }}
            aria-label="Contrast"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Saturation">
          <NumberField
            size="sm"
            unit="%"
            value={saturation}
            onChange={(s) => {
              setSaturation(s);
              onUpdateProp?.("media.filter.saturate", s / 100);
            }}
            aria-label="Saturation"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Grayscale">
          <NumberField
            size="sm"
            unit="%"
            value={grayscale}
            onChange={(g) => {
              setGrayscale(g);
              onUpdateProp?.("media.filter.grayscale", g / 100);
            }}
            aria-label="Grayscale"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Blur">
          <NumberField
            size="sm"
            value={blur}
            min={0}
            onChange={(bl) => {
              setBlur(bl);
              onUpdateProp?.("media.filter.blur", bl);
            }}
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
                onChange={(e) => {
                  const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
                  setOverlayHex(hex);
                  if (hex.length === 6) {
                    onUpdateProp?.("media.overlay.color", `#${hex}`);
                  }
                }}
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
            onChange={(op) => {
              setOverlayOpacity(op);
              onUpdateProp?.("media.overlay.opacity", op / 100);
            }}
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
            onChange={(bl) => {
              setOverlayBlend(bl);
              onUpdateProp?.("media.overlay.blendMode", bl.toLowerCase());
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

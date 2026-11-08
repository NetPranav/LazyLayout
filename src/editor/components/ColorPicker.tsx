"use client";

import React, { useRef, useEffect, useState, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { Pipette, Plus, LinkIcon, Check, ChevronDown } from "./ColorPickerIcons";
import { Icon } from "./Icon";
import { SegmentedControl } from "./SegmentedControl";
import { IconButton } from "./IconButton";
import { Select } from "./Select";
import { useMounted } from "./useMounted";
import { useSlidingIndicator } from "./useSlidingIndicator";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { springEase } from "../motion/ease";
import {
  MORPH_EXPANDED_CLIP,
  buildTriggerMorphClip,
  REDUCED_DURATION,
  CLOSE_DURATION,
  gradientStopLeftCalc,
  IMAGE_TILE_SIZE,
  OPACITY_SLIDER_BG_SIZE,
} from "./ColorPickerMotion";
import {
  COLOR_TOKENS,
  clamp,
  hsv2rgb,
  rgb2hsv,
  rgb2hex,
  hex2rgb,
  rgb2hsl,
  hsl2rgb,
  rgb2ok,
  ok2rgb,
  parseCssColor,
  formatCssString,
  type ColorMode,
  type ColorModel,
  type ImageFit,
  type ColorStop,
} from "./ColorPickerMath";

export interface ColorPickerProps {
  open?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  opacity?: number;
  onChangeOpacity?: (opacity: number) => void;
  onClose?: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  triggerRef?: React.RefObject<HTMLElement | null>;
  anchorEl?: HTMLElement | null;
  className?: string;
  "aria-label"?: string;
  [key: string]: unknown;
}

const PICKER_WIDTH = 274;
const PICKER_GAP = 8;
const MODES: readonly ColorMode[] = ["Solid", "Linear", "Radial", "Conic", "Image"];
const MODELS: readonly ColorModel[] = ["Hex", "RGB", "HSL", "OKLCH"];
const FITS: readonly ImageFit[] = ["Fill", "Fit", "Crop", "Tile"];

export function ColorPicker({
  open = true,
  value = "#CEB4F5",
  onChange,
  opacity: externalOpacity = 100,
  onChangeOpacity,
  onClose,
  anchorRef,
  triggerRef,
  anchorEl,
  className = "",
  "aria-label": ariaLabel,
}: ColorPickerProps) {
  const mounted = useMounted();
  const pickerRef = useRef<HTMLDivElement>(null);
  const sbRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const opacitySliderRef = useRef<HTMLDivElement>(null);
  const stopsBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerId = useId();

  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }

  // Parse incoming value into HSV
  const initRgb = parseCssColor(value)?.rgb ?? hex2rgb(value);
  const initHsv = rgb2hsv(initRgb[0], initRgb[1], initRgb[2]);

  const [mode, setMode] = useState<ColorMode>("Solid");
  const [model, setModel] = useState<ColorModel>("Hex");
  const [hsv, setHsv] = useState(initHsv);
  const [alpha, setAlpha] = useState(externalOpacity / 100);
  const [linkedToken, setLinkedToken] = useState<string | null>(null);
  const [imageFit, setImageFit] = useState<ImageFit>("Fill");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Gradient stops
  const [stops, setStops] = useState<ColorStop[]>([
    { id: "s1", p: 0, h: initHsv.h, s: initHsv.s, v: initHsv.v, a: 1 },
    { id: "s2", p: 1, h: (initHsv.h + 40) % 360, s: initHsv.s, v: initHsv.v, a: 1 },
  ]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);

  // Saved document colors
  const [savedColors, setSavedColors] = useState<string[]>([
    "CEB4F5",
    "22231E",
    "FFFFFF",
    "000000",
    "89A2B3",
    "94B18B",
    "C5A677",
  ]);

  // Current RGB and Hex
  const rgb = hsv2rgb(hsv.h, hsv.s, hsv.v);
  const hex = rgb2hex(rgb);

  // Sync external changes
  useEffect(() => {
    const parsed = parseCssColor(value);
    if (parsed) {
      const nextHsv = rgb2hsv(parsed.rgb[0], parsed.rgb[1], parsed.rgb[2]);
      setHsv(nextHsv);
    }
  }, [value]);

  // Positioning
  const updatePosition = useCallback(() => {
    const el = pickerRef.current;
    if (!el) return;

    const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
    const rightZone = document.querySelector(".zone.right");
    const rightRect = rightZone
      ? rightZone.getBoundingClientRect()
      : anchor
      ? anchor.getBoundingClientRect()
      : null;

    let left = window.innerWidth - PICKER_WIDTH - PICKER_GAP;
    let top = PICKER_GAP;
    const maxHeight = Math.max(120, window.innerHeight - 2 * PICKER_GAP);

    if (anchor && rightRect) {
      const s = anchor.getBoundingClientRect();
      left = rightRect.left - PICKER_WIDTH - PICKER_GAP;
      if (left < PICKER_GAP) {
        left = Math.max(
          PICKER_GAP,
          Math.min(s.left - PICKER_WIDTH - PICKER_GAP, window.innerWidth - PICKER_WIDTH - PICKER_GAP)
        );
      }
      top = s.top - 12;
    }

    const pickerH = el.offsetHeight || 420;
    const fittedTop = Math.max(
      PICKER_GAP,
      Math.min(top, window.innerHeight - PICKER_GAP - pickerH)
    );

    el.style.left = `${left}px`;
    el.style.top = `${fittedTop}px`;
    el.style.maxHeight = `${maxHeight}px`;
  }, [anchorRef, anchorEl]);

  // Open & Close animations
  useEffect(() => {
    if (!isRendered) return;
    const el = pickerRef.current;
    if (!el) return;

    updatePosition();

    const reduced = prefersReducedMotion();
    const preset = getActivePreset();
    const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;

    if (open) {
      if (reduced) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "backwards",
        });
      } else if (anchor) {
        const s = anchor.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const originX = s.left + s.width / 2 - r.left;
        const originY = s.top + s.height / 2 - r.top;
        el.style.transformOrigin = `${originX}px ${originY}px`;

        const morphFrom = buildTriggerMorphClip(s, r);
        const morphTo = MORPH_EXPANDED_CLIP;

        const se = springEase(preset.shape[0], preset.shape[1]);
        el.animate(
          [
            { clipPath: morphFrom, transform: "scale(0.8)" },
            { clipPath: morphTo, transform: "scale(1)" },
          ],
          {
            duration: se.duration,
            easing: se.easing,
            fill: "backwards",
          }
        );
      }
    } else {
      let anim: Animation;
      if (reduced || !anchor) {
        anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "forwards",
        });
      } else {
        const s = anchor.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const originX = s.left + s.width / 2 - r.left;
        const originY = s.top + s.height / 2 - r.top;
        el.style.transformOrigin = `${originX}px ${originY}px`;

        const morphTarget = buildTriggerMorphClip(s, r);
        anim = el.animate(
          [
            { clipPath: MORPH_EXPANDED_CLIP, transform: "scale(1)", opacity: 1 },
            { clipPath: morphTarget, transform: "scale(0.86)", opacity: 0 },
          ],
          {
            duration: CLOSE_DURATION,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "forwards",
          }
        );
      }
      anim.onfinish = () => {
        setIsRendered(false);
      };
    }
  }, [open, isRendered, anchorRef, anchorEl, updatePosition]);

  // Outside pointerdown and Escape
  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: PointerEvent) => {
      const el = pickerRef.current;
      const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
      const target = e.target as Node | null;

      if (el && target && !el.contains(target)) {
        if (anchor && anchor.contains(target)) return;
        onClose?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
        anchor?.focus();
      }
    };

    const handleResize = () => {
      updatePosition();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, isRendered, onClose, anchorRef, anchorEl, updatePosition]);

  // Emit color change
  const emitColorChange = useCallback(
    (newHex: string, newAlpha: number) => {
      setLinkedToken(null);
      const cleanHex = newHex.startsWith("#") ? newHex : `#${newHex}`;
      onChange?.(cleanHex);
      onChangeOpacity?.(Math.round(newAlpha * 100));
    },
    [onChange, onChangeOpacity]
  );

  // Saturation & Brightness Dragging
  const handleSbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const sb = sbRef.current;
    if (!sb || e.button !== 0) return;

    sb.setPointerCapture(e.pointerId);
    const rect = sb.getBoundingClientRect();

    const updateFromPointer = (clientX: number, clientY: number) => {
      const s = clamp((clientX - rect.left) / rect.width, 0, 1);
      const v = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
      const nextHsv = { ...hsv, s, v };
      setHsv(nextHsv);
      const nextRgb = hsv2rgb(nextHsv.h, nextHsv.s, nextHsv.v);
      const nextHex = rgb2hex(nextRgb);
      emitColorChange(nextHex, alpha);

      // If in gradient mode, update active stop
      if (mode !== "Solid" && mode !== "Image") {
        setStops((prev) =>
          prev.map((stop, i) =>
            i === activeStopIndex ? { ...stop, s, v } : stop
          )
        );
      }
    };

    updateFromPointer(e.clientX, e.clientY);

    const onPointerMove = (ev: PointerEvent) => {
      updateFromPointer(ev.clientX, ev.clientY);
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        sb.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      sb.removeEventListener("pointermove", onPointerMove);
      sb.removeEventListener("pointerup", onPointerUp);
    };

    sb.addEventListener("pointermove", onPointerMove);
    sb.addEventListener("pointerup", onPointerUp);
  };

  // Hue Slider Dragging
  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const slider = hueSliderRef.current;
    if (!slider || e.button !== 0) return;

    slider.setPointerCapture(e.pointerId);
    const rect = slider.getBoundingClientRect();

    const updateHue = (clientX: number) => {
      const h = clamp((clientX - rect.left) / rect.width, 0, 1) * 360;
      const nextHsv = { ...hsv, h };
      setHsv(nextHsv);
      const nextRgb = hsv2rgb(nextHsv.h, nextHsv.s, nextHsv.v);
      const nextHex = rgb2hex(nextRgb);
      emitColorChange(nextHex, alpha);

      if (mode !== "Solid" && mode !== "Image") {
        setStops((prev) =>
          prev.map((stop, i) =>
            i === activeStopIndex ? { ...stop, h } : stop
          )
        );
      }
    };

    updateHue(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      updateHue(ev.clientX);
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        slider.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      slider.removeEventListener("pointermove", onPointerMove);
      slider.removeEventListener("pointerup", onPointerUp);
    };

    slider.addEventListener("pointermove", onPointerMove);
    slider.addEventListener("pointerup", onPointerUp);
  };

  // Opacity Slider Dragging
  const handleOpacityPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const slider = opacitySliderRef.current;
    if (!slider || e.button !== 0) return;

    slider.setPointerCapture(e.pointerId);
    const rect = slider.getBoundingClientRect();

    const updateOpacity = (clientX: number) => {
      const a = clamp((clientX - rect.left) / rect.width, 0, 1);
      setAlpha(a);
      emitColorChange(hex, a);

      if (mode !== "Solid" && mode !== "Image") {
        setStops((prev) =>
          prev.map((stop, i) =>
            i === activeStopIndex ? { ...stop, a } : stop
          )
        );
      }
    };

    updateOpacity(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      updateOpacity(ev.clientX);
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        slider.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      slider.removeEventListener("pointermove", onPointerMove);
      slider.removeEventListener("pointerup", onPointerUp);
    };

    slider.addEventListener("pointermove", onPointerMove);
    slider.addEventListener("pointerup", onPointerUp);
  };

  // Eyedropper
  const handleEyedropper = async () => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const pickedRgb = hex2rgb(result.sRGBHex);
          const nextHsv = rgb2hsv(pickedRgb[0], pickedRgb[1], pickedRgb[2]);
          setHsv(nextHsv);
          emitColorChange(result.sRGBHex, alpha);
        }
      } catch {
        // user cancelled or unsupported
      }
    }
  };

  // Copy CSS string
  const cssString = formatCssString(model, rgb, alpha, linkedToken);
  const handleCopyCss = () => {
    try {
      navigator.clipboard.writeText(cssString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  // Gradient Stops Bar click to add stop
  const handleStopsBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = stopsBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const p = clamp((e.clientX - rect.left) / rect.width, 0, 1);

    const newStop: ColorStop = {
      id: `s-${Date.now()}`,
      p,
      h: hsv.h,
      s: hsv.s,
      v: hsv.v,
      a: alpha,
    };

    const nextStops = [...stops, newStop].sort((a, b) => a.p - b.p);
    setStops(nextStops);
    setActiveStopIndex(nextStops.indexOf(newStop));
  };

  // Stop Marker Drag
  const handleStopMarkerPointerDown = (
    index: number,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    setActiveStopIndex(index);
    const stop = stops[index];
    setHsv({ h: stop.h, s: stop.s, v: stop.v });
    setAlpha(stop.a);

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const bar = stopsBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const startY = e.clientY;

    const onPointerMove = (ev: PointerEvent) => {
      const p = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      // Remove stop if dragged off vertically by > 30px
      const verticalDist = Math.abs(ev.clientY - startY);
      if (stops.length > 2 && verticalDist > 30) {
        setStops((prev) => prev.filter((_, i) => i !== index));
        return;
      }
      setStops((prev) =>
        prev.map((s, i) => (i === index ? { ...s, p } : s))
      );
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerup", onPointerUp);
    };

    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", onPointerUp);
  };

  // Token swatch selection
  const handleTokenSelect = (token: string) => {
    setLinkedToken(token);
    // Find computed color of token if available
    const tokenVal = `var(--ll-${token})`;
    onChange?.(tokenVal);
  };

  // Image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!mounted || !isRendered) return null;

  return createPortal(
    <div
      ref={pickerRef}
      role="dialog"
      aria-label={ariaLabel || "Colour picker"}
      aria-labelledby={pickerId}
      tabIndex={-1}
      className={`cp ll-cp ll:fixed ll:z-60 ll:w-color-picker ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:text-primary ll:flex ll:flex-col ll:overflow-y-auto ll:overscroll-contain ll:scrollbar-none ll:outline-none ${className}`}
    >
      <div className="cp-in ll:p-3 ll:flex ll:flex-col ll:gap-2.5">
        {/* Mode Tabs (Solid, Linear, Radial, Conic, Image) - Segmented Control with sliding highlight */}
        <SegmentedControl<ColorMode>
          size="compact"
          options={MODES.map((m) => ({ value: m, label: m }))}
          value={mode}
          onChange={(m) => setMode(m)}
          ariaLabel="Fill type"
          className="cp-tabs"
        />

        {/* Gradient Stops Bar (shown for Linear, Radial, Conic) */}
        {(mode === "Linear" || mode === "Radial" || mode === "Conic") && (
          <div
            ref={stopsBarRef}
            onClick={handleStopsBarClick}
            aria-label="Gradient stops. Click to add, drag off to remove."
            className="cp-stops ll:relative ll:h-8.5 ll:cursor-copy ll:select-none ll:shrink-0"
          >
            {/* Checkerboard background + gradient fill */}
            <div
              style={{
                background: `linear-gradient(90deg, ${stops
                  .map((s) => {
                    const cRgb = hsv2rgb(s.h, s.s, s.v);
                    return `rgba(${cRgb.join(",")}, ${s.a}) ${Math.round(s.p * 100)}%`;
                  })
                  .join(", ")})`,
              }}
              className="cp-bar ll:absolute ll:left-0 ll:right-0 ll:top-0 ll:h-4 ll:rounded-sm ll:border ll:border-border"
            />
            {/* Draggable Stop Markers */}
            {stops.map((stop, i) => {
              const stopRgb = hsv2rgb(stop.h, stop.s, stop.v);
              const isSelected = i === activeStopIndex;
              return (
                <button
                  key={stop.id || i}
                  type="button"
                  onPointerDown={(e) => handleStopMarkerPointerDown(i, e)}
                  aria-pressed={isSelected}
                  aria-label={`Stop ${i + 1} at ${Math.round(stop.p * 100)}%`}
                  style={{
                    left: gradientStopLeftCalc(stop.p),
                    boxShadow: isSelected
                      ? "0 0 0 2px var(--ll-surface-panel), 0 0 0 4px var(--ll-text-primary)"
                      : "0 0 0 1px var(--ll-text-secondary), 0 1px 3px rgba(0,0,0,0.25)",
                  }}
                  className={`cp-mk ll:absolute ll:top-2.5 ll:w-3 ll:h-5.5 ll:p-0 ll:rounded-xs ll:border-0 ll:cursor-grab ll:transition-transform ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
                    isSelected ? "ll:z-10" : "ll:z-1"
                  }`}
                >
                  <i
                    style={{
                      backgroundColor: `rgba(${stopRgb.join(",")}, ${stop.a})`,
                    }}
                    className="ll:absolute ll:inset-0.75 ll:rounded-xs ll:block ll:border ll:border-border"
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Image Mode Panel */}
        {mode === "Image" ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && /^image\//.test(file.type)) {
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") {
                    setImageSrc(reader.result);
                  }
                };
                reader.readAsDataURL(file);
              }
            }}
            style={{
              backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
              backgroundSize:
                imageFit === "Fit"
                  ? "contain"
                  : imageFit === "Tile"
                  ? IMAGE_TILE_SIZE
                  : "cover",
            }}
            className="cp-img ll:relative ll:h-sb-square ll:border ll:border-dashed ll:border-muted ll:rounded-sm ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-2.5 ll:text-muted ll:bg-center ll:bg-no-repeat ll:p-3"
          >
            {!imageSrc && (
              <>
                <p className="ll:text-small ll:text-muted">Drop an image here</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="dtxt ll:h-7 ll:px-3.5 ll:rounded-sm ll:bg-surface-bar ll:hover:bg-surface-seg ll:text-primary ll:text-small ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
                >
                  Upload
                </button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              hidden
              aria-label="Upload image"
            />

            {/* Image fit select */}
            <div className="cp-fit ll:absolute ll:left-2 ll:right-2 ll:bottom-2">
              <Select
                size="sm"
                variant="floating"
                value={imageFit}
                onChange={(v) => setImageFit(v as ImageFit)}
                aria-label="Image fit"
                options={FITS.map((fit) => ({ value: fit, label: fit }))}
                className="ll:w-full"
              />
            </div>
          </div>
        ) : (
          <>
            {/* Saturation & Brightness (SB) Square (180px) */}
            <div
              ref={sbRef}
              tabIndex={0}
              role="slider"
              aria-label="Saturation and brightness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hsv.s * 100)}
              onPointerDown={handleSbPointerDown}
              style={{
                backgroundColor: `hsl(${hsv.h} 100% 50%)`,
                backgroundImage:
                  "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
              }}
              className="cp-sb ll:relative ll:w-full ll:h-sb-square ll:rounded-sm ll:border ll:border-border ll:cursor-crosshair ll:touch-none ll:select-none ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary"
            >
              {/* Circular SB Thumb matching prototype line 1489 */}
              <i
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.45)",
                }}
                className="cp-th ll:absolute ll:w-3.5 ll:h-3.5 ll:-ml-1.75 ll:-mt-1.75 ll:rounded-full ll:border-2 ll:border-board-bg ll:pointer-events-none"
              />
            </div>

            {/* Eyedropper + Sliders (Hue + Opacity) */}
            <div className="cp-r1 ll:flex ll:items-center ll:gap-2">
              <IconButton
                size="md"
                variant="ghost"
                aria-label="Pick colour from screen"
                tooltip="Eyedropper"
                icon={<Icon icon={Pipette} size={14} />}
                onClick={handleEyedropper}
                className="cp-eye"
              />

              <div className="cp-sls ll:flex ll:flex-col ll:gap-1.5 ll:flex-1 ll:min-w-0">
                {/* Hue Slider (12px) */}
                <div
                  ref={hueSliderRef}
                  tabIndex={0}
                  role="slider"
                  aria-label="Hue"
                  aria-valuemin={0}
                  aria-valuemax={360}
                  aria-valuenow={Math.round(hsv.h)}
                  onPointerDown={handleHuePointerDown}
                  style={{
                    background:
                      "linear-gradient(90deg, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)",
                  }}
                  className="cp-s h ll:relative ll:h-3 ll:rounded-sm ll:border ll:border-border ll:cursor-pointer ll:touch-none ll:select-none ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary"
                >
                  <i
                    style={{
                      left: `${(hsv.h / 360) * 100}%`,
                      boxShadow: "0 0 0 2px var(--ll-surface-panel)",
                    }}
                    className="cp-sh ll:absolute ll:-top-0.75 ll:w-1.5 ll:h-4.5 ll:-ml-0.75 ll:rounded-xs ll:bg-primary ll:pointer-events-none"
                  />
                </div>

                {/* Opacity Slider (12px) */}
                <div
                  ref={opacitySliderRef}
                  tabIndex={0}
                  role="slider"
                  aria-label="Opacity"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(alpha * 100)}
                  onPointerDown={handleOpacityPointerDown}
                  style={{
                    backgroundColor: "var(--ll-surface-panel)",
                    backgroundImage: `linear-gradient(90deg, transparent, #${hex}), conic-gradient(var(--ll-border-color) 25%, var(--ll-surface-panel) 0 50%, var(--ll-border-color) 0 75%, var(--ll-surface-panel) 0)`,
                    backgroundSize: OPACITY_SLIDER_BG_SIZE,
                  }}
                  className="cp-s a ll:relative ll:h-3 ll:rounded-sm ll:border ll:border-border ll:cursor-pointer ll:touch-none ll:select-none ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary"
                >
                  <i
                    style={{
                      left: `${alpha * 100}%`,
                      boxShadow: "0 0 0 2px var(--ll-surface-panel)",
                    }}
                    className="cp-sh ll:absolute ll:-top-0.75 ll:w-1.5 ll:h-4.5 ll:-ml-0.75 ll:rounded-xs ll:bg-primary ll:pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* Model & Input Fields Row (cp-r2) */}
            <div className="cp-r2 ll:flex ll:items-center ll:gap-1.5">
              {/* Model Dropdown (Select) */}
              <div className="dd ll:w-21 ll:shrink-0">
                <Select
                  size="sm"
                  variant="floating"
                  aria-label="Colour model"
                  value={model}
                  options={MODELS.map((m) => ({ value: m, label: m }))}
                  onChange={(m) => setModel(m as ColorModel)}
                  className="ll:w-full"
                />
              </div>

              {/* Hex Mode: Hex input + Opacity input (cp-hexv) */}
              {model === "Hex" ? (
                <div className="cp-hexv ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
                  {/* Hex input */}
                  <div className="dfield ll-dfield ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:hover:border-muted ll:focus-within:border-primary">
                    <span className="pf ll:text-micro ll:font-mono ll:font-medium ll:text-muted ll:select-none">
                      #
                    </span>
                    <input
                      type="text"
                      maxLength={6}
                      value={hex}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
                        if (clean.length === 6) {
                          const newRgb = hex2rgb(clean);
                          const nextHsv = rgb2hsv(newRgb[0], newRgb[1], newRgb[2]);
                          setHsv(nextHsv);
                          emitColorChange(clean, alpha);
                        }
                      }}
                      aria-label="Hex colour"
                      className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:text-primary"
                    />
                  </div>

                  {/* Opacity input (64px) */}
                  <div className="dfield ll-dfield ll:flex ll:items-center ll:gap-1 ll:w-16 ll:h-7 ll:px-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:hover:border-muted ll:focus-within:border-primary ll:shrink-0">
                    <span className="pf ll:text-micro ll:font-mono ll:font-medium ll:text-muted ll:select-none">
                      A
                    </span>
                    <input
                      type="text"
                      value={Math.round(alpha * 100)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace(/\D/g, ""), 10);
                        if (!isNaN(val)) {
                          const a = clamp(val, 0, 100) / 100;
                          setAlpha(a);
                          emitColorChange(hex, a);
                        }
                      }}
                      aria-label="Opacity"
                      className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:text-right ll:text-primary"
                    />
                    <span className="sf ll:text-micro ll:font-mono ll:text-muted ll:select-none">
                      %
                    </span>
                  </div>
                </div>
              ) : (
                /* Non-hex modes: Copy CSS button in Row 2, 4-input row in Row 3 */
                <button
                  type="button"
                  onClick={handleCopyCss}
                  title="Copy value"
                  aria-label="Copy colour value"
                  className="cp-css ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:flex ll:items-center ll:justify-between ll:rounded-sm ll:border ll:border-border ll:hover:border-muted ll:bg-surface-bar ll:font-mono ll:text-micro ll:text-muted ll:hover:text-primary ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
                >
                  <span className="ll:truncate">{cssString}</span>
                  {copied && (
                    <Icon
                      icon={Check}
                      size={12}
                      className="ll:text-primary ll:shrink-0 ll:ml-1"
                    />
                  )}
                </button>
              )}
            </div>

            {/* Row 3: 4-Channel Grid for RGB, HSL, OKLCH */}
            {model !== "Hex" && (
              <div className="cp-r3 ll:grid ll:grid-cols-4 ll:gap-1.5 ll:w-full">
                {renderModelInputs()}
              </div>
            )}

            {/* Swatches Section (Document + Tokens) */}
            <div className="cp-sw ll:flex ll:flex-col ll:gap-2 ll:pt-2.5 ll:border-t ll:border-border">
              {/* Document Swatches */}
              <div className="ll:flex ll:flex-col ll:gap-1.5">
                <h4 className="ll:font-mono ll:text-micro ll:font-medium ll:uppercase ll:tracking-wider ll:text-muted ll:m-0">
                  Document
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(10, 20px)",
                    justifyContent: "space-between",
                    rowGap: "5px",
                  }}
                >
                  {savedColors.slice(0, 9).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        const parsed = hex2rgb(c);
                        const nextHsv = rgb2hsv(parsed[0], parsed[1], parsed[2]);
                        setHsv(nextHsv);
                        emitColorChange(c, alpha);
                      }}
                      style={{
                        backgroundColor: `#${c}`,
                        borderColor: "var(--ll-swatch-line)",
                      }}
                      title={`#${c}`}
                      aria-label={`Document colour #${c}`}
                      className="cp-c ll:w-5 ll:h-5 ll:p-0 ll:rounded-sm ll:border ll:hover:scale-105 ll:active:scale-90 ll:transition-transform ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:cursor-pointer"
                    />
                  ))}
                  {/* Plus button to save current color */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!savedColors.includes(hex)) {
                        setSavedColors((prev) => [hex, ...prev.slice(0, 8)]);
                      }
                    }}
                    title="Save current colour"
                    aria-label="Save current colour"
                    className="cp-add ll:w-5 ll:h-5 ll:p-0 ll:rounded-sm ll:border ll:border-dashed ll:border-muted ll:text-muted ll:hover:text-primary ll:hover:border-primary ll:flex ll:items-center ll:justify-center ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:bg-transparent ll:cursor-pointer"
                  >
                    <Icon icon={Plus} size={12} />
                  </button>
                </div>
              </div>

              {/* Token Swatches */}
              <div className="ll:flex ll:flex-col ll:gap-1.5">
                <h4 className="ll:font-mono ll:text-micro ll:font-medium ll:uppercase ll:tracking-wider ll:text-muted ll:m-0">
                  Tokens
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(10, 20px)",
                    justifyContent: "space-between",
                    rowGap: "5px",
                  }}
                >
                  {COLOR_TOKENS.map((t) => {
                    const isLinked = linkedToken === t.token;
                    return (
                      <button
                        key={t.token}
                        type="button"
                        onClick={() => handleTokenSelect(t.token)}
                        style={{
                          backgroundColor: `var(--ll-${t.token})`,
                          borderColor: "var(--ll-swatch-line)",
                        }}
                        title={`${t.name} (--ll-${t.token})`}
                        aria-label={`Token ${t.name}`}
                        className="cp-c ll:relative ll:w-5 ll:h-5 ll:p-0 ll:rounded-sm ll:border ll:hover:scale-105 ll:active:scale-90 ll:transition-transform ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:cursor-pointer"
                      >
                        {isLinked && (
                          <span
                            style={{
                              backgroundColor: "var(--ll-control-primary-bg)",
                              color: "var(--ll-control-primary-fg)",
                            }}
                            className="cp-link ll:absolute ll:-right-1 ll:-bottom-1 ll:w-3 ll:h-3 ll:p-0.5 ll:rounded-xs ll:flex ll:items-center ll:justify-center"
                          >
                            <Icon icon={LinkIcon} size={8} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );

  function renderModelInputs() {
    if (model === "RGB") {
      return (
        <>
          {renderChannel("R", rgb[0], (v) => {
            const nextRgb: [number, number, number] = [clamp(v, 0, 255), rgb[1], rgb[2]];
            setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
            emitColorChange(rgb2hex(nextRgb), alpha);
          })}
          {renderChannel("G", rgb[1], (v) => {
            const nextRgb: [number, number, number] = [rgb[0], clamp(v, 0, 255), rgb[2]];
            setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
            emitColorChange(rgb2hex(nextRgb), alpha);
          })}
          {renderChannel("B", rgb[2], (v) => {
            const nextRgb: [number, number, number] = [rgb[0], rgb[1], clamp(v, 0, 255)];
            setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
            emitColorChange(rgb2hex(nextRgb), alpha);
          })}
          {renderChannel("A", Math.round(alpha * 100), (v) => {
            const nextA = clamp(v, 0, 100) / 100;
            setAlpha(nextA);
            emitColorChange(hex, nextA);
          })}
        </>
      );
    }

    if (model === "HSL") {
      const hsl = rgb2hsl(rgb);
      return (
        <>
          {renderChannel("H", Math.round(hsl[0]), (v) => {
            const nextRgb = hsl2rgb(clamp(v, 0, 360), hsl[1], hsl[2]);
            setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
            emitColorChange(rgb2hex(nextRgb), alpha);
          })}
          {renderChannel("S", Math.round(hsl[1]), (v) => {
            const nextRgb = hsl2rgb(hsl[0], clamp(v, 0, 100), hsl[2]);
            setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
            emitColorChange(rgb2hex(nextRgb), alpha);
          })}
          {renderChannel("L", Math.round(hsl[2]), (v) => {
            const nextRgb = hsl2rgb(hsl[0], hsl[1], clamp(v, 0, 100));
            setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
            emitColorChange(rgb2hex(nextRgb), alpha);
          })}
          {renderChannel("A", Math.round(alpha * 100), (v) => {
            const nextA = clamp(v, 0, 100) / 100;
            setAlpha(nextA);
            emitColorChange(hex, nextA);
          })}
        </>
      );
    }

    // OKLCH
    const ok = rgb2ok(rgb);
    return (
      <>
        {renderChannel("L", ok[0].toFixed(1), (v) => {
          const nextRgb = ok2rgb(clamp(v, 0, 100), ok[1], ok[2]);
          setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
          emitColorChange(rgb2hex(nextRgb), alpha);
        })}
        {renderChannel("C", ok[1].toFixed(2), (v) => {
          const nextRgb = ok2rgb(ok[0], clamp(v, 0, 0.4), ok[2]);
          setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
          emitColorChange(rgb2hex(nextRgb), alpha);
        })}
        {renderChannel("H", Math.round(ok[2]), (v) => {
          const nextRgb = ok2rgb(ok[0], ok[1], clamp(v, 0, 360));
          setHsv(rgb2hsv(nextRgb[0], nextRgb[1], nextRgb[2]));
          emitColorChange(rgb2hex(nextRgb), alpha);
        })}
        {renderChannel("A", Math.round(alpha * 100), (v) => {
          const nextA = clamp(v, 0, 100) / 100;
          setAlpha(nextA);
          emitColorChange(hex, nextA);
        })}
      </>
    );
  }

  function renderChannel(
    prefix: string,
    val: string | number,
    onValueChange: (v: number) => void
  ) {
    return (
      <div
        key={prefix}
        className="dfield ll-dfield ll:flex ll:items-center ll:gap-1 ll:h-7 ll:px-1.5 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:hover:border-muted ll:focus-within:border-primary"
      >
        <span
          data-scrub
          className="pf ll:text-micro ll:font-mono ll:font-medium ll:text-muted ll:select-none ll:cursor-ew-resize"
        >
          {prefix}
        </span>
        <input
          type="text"
          value={val}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!isNaN(parsed)) onValueChange(parsed);
          }}
          className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:text-right ll:text-primary"
        />
      </div>
    );
  }
}

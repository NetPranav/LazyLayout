"use client";

import React, { useState, useCallback, useRef } from "react";
import { NumberField } from "./NumberField";
import { ColorPicker } from "./ColorPicker";

export interface ColorSwatchFieldProps {
  hex: string;
  opacity?: number;
  onChangeHex: (hex: string) => void;
  onChangeOpacity?: (opacity: number) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** Callback invoked when the swatch button is clicked, passing the anchor element for positioning ColorPicker */
  onOpenPicker?: (anchorEl: HTMLElement) => void;
  /** When true, automatically manages opening and anchoring an embedded ColorPicker */
  withPicker?: boolean;
}

export const ColorSwatchField: React.FC<ColorSwatchFieldProps> = ({
  hex,
  opacity = 100,
  onChangeHex,
  onChangeOpacity,
  label,
  disabled = false,
  size: _size = "md",
  className = "",
  onOpenPicker,
  withPicker = false,
}) => {
  const [draftHex, setDraftHex] = useState(hex.replace(/^#/, ""));
  const [prevHex, setPrevHex] = useState(hex);
  const [isInternalPickerOpen, setIsInternalPickerOpen] = useState(false);
  const internalSwatchRef = useRef<HTMLButtonElement | null>(null);

  // Sync draft state with prop during render without useEffect
  if (hex !== prevHex) {
    setPrevHex(hex);
    setDraftHex(hex.replace(/^#/, ""));
  }

  const handleHexBlur = useCallback(() => {
    let clean = draftHex.replace(/[^0-9A-Fa-f]/g, "");
    if (clean.length === 3) {
      clean = clean.split("").map((c) => c + c).join("");
    }
    if (clean.length === 6) {
      onChangeHex(clean);
    } else {
      setDraftHex(hex.replace(/^#/, ""));
    }
  }, [draftHex, hex, onChangeHex]);

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setDraftHex(hex.replace(/^#/, ""));
      e.currentTarget.blur();
    }
  };

  const handleSwatchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (onOpenPicker) {
      onOpenPicker(e.currentTarget);
    }
    if (withPicker) {
      setIsInternalPickerOpen((prev) => !prev);
    }
  };

  const heightStyles = "ll:h-7";
  const swatchSize = "ll:w-7 ll:h-7 ll:min-w-7";
  const cleanHex = hex.startsWith("#") ? hex : `#${hex}`;

  return (
    <div className={`ll:flex ll:items-center ll:gap-2 ll:w-full ${className}`}>
      {/* Color Swatch: 28px, border only, interactive click anchor for ColorPicker */}
      <button
        ref={internalSwatchRef}
        type="button"
        disabled={disabled}
        onClick={handleSwatchClick}
        aria-label={label ? `${label} color swatch: ${cleanHex}` : `Color swatch: ${cleanHex}`}
        title={label ? `${label}: ${cleanHex}` : cleanHex}
        style={{ backgroundColor: cleanHex }}
        className={`${swatchSize} ll:rounded-sm ll:border ll:border-swatch-line ll:shrink-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
          disabled ? "ll:opacity-40 ll:cursor-not-allowed" : "ll:hover:ring-1 ll:hover:ring-border-active"
        }`}
      />

      {/* Hex Input */}
      <div
        className={`ll:relative ll:inline-flex ll:items-center ll:box-border ll:flex-1 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:px-2 ll:gap-1 ll:transition-colors ll:duration-100 ll:hover:border-muted ll:focus-within:border-primary ${heightStyles} ${
          disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className="ll:text-micro ll:font-mono ll:text-muted ll:select-none ll:shrink-0"
        >
          #
        </span>
        <input
          type="text"
          maxLength={6}
          disabled={disabled}
          aria-label={label ? `${label} hex color` : "Hex color"}
          value={draftHex}
          onChange={(e) => setDraftHex(e.target.value)}
          onBlur={handleHexBlur}
          onKeyDown={handleHexKeyDown}
          className="ll:w-full ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:tracking-normal ll:font-normal ll:text-primary"
        />
      </div>

      {/* Opacity Number Field with scrub */}
      {onChangeOpacity && (
        <div className="ll:w-18 ll:shrink-0">
          <NumberField
            label=""
            value={opacity}
            onChange={(v) => onChangeOpacity(v ?? 100)}
            min={0}
            max={100}
            step={1}
            suffix="%"
            disabled={disabled}
            size="sm"
            aria-label={label ? `${label} opacity` : "Opacity"}
          />
        </div>
      )}

      {/* Optional embedded ColorPicker */}
      {withPicker && isInternalPickerOpen && (
        <ColorPicker
          open={isInternalPickerOpen}
          value={cleanHex}
          opacity={opacity}
          anchorRef={internalSwatchRef}
          onChange={(newVal: string) => {
            onChangeHex(newVal.replace(/^#/, ""));
          }}
          onChangeOpacity={onChangeOpacity}
          onClose={() => setIsInternalPickerOpen(false)}
        />
      )}
    </div>
  );
};

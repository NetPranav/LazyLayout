"use client";
import React from "react";

/**
 * The colour swatch of a popover row, now a colour picker too: the swatch looks the same and clicking it opens the
 * browser's own picker. `hex` is six digits without the "#".
 */
export const ColorSwatch: React.FC<{ hex: string; onChange: (hex: string) => void; label: string; className: string }> = ({ hex, onChange, label, className }) => {
  const six = /^[0-9a-fA-F]{6}$/.test(hex) ? hex : "000000";
  return (
    <label className={`${className} ll:relative ll:overflow-hidden ll:cursor-pointer`} style={{ backgroundColor: `#${six}` }}>
      <input
        type="color"
        aria-label={label}
        value={`#${six.toLowerCase()}`}
        onChange={(e) => onChange(e.target.value.replace(/^#/, "").toUpperCase())}
        className="ll:absolute ll:inset-0 ll:w-full ll:h-full ll:opacity-0 ll:cursor-pointer ll:border-0 ll:p-0"
      />
    </label>
  );
};

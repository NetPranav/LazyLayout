"use client";
import React, { useCallback, useRef, useState } from "react";
import { ColorPicker } from "@/editor/components/ColorPicker";

/**
 * The colour swatch of a popover row. Clicking it opens the editor's colour picker (the same one the Fill and Stroke rows
 * use), beside the popover it was opened from. `hex` is six digits without the "#".
 */
export const ColorSwatch: React.FC<{ hex: string; onChange: (hex: string) => void; label: string; className: string }> = ({ hex, onChange, label, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const six = /^[0-9a-fA-F]{6}$/.test(hex) ? hex : "000000";
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Pick a colour"
        className={`${className} ll:cursor-pointer ll:p-0`}
        style={{ backgroundColor: `#${six}` }}
        onClick={() => setOpen((o) => !o)}
      />
      <ColorPicker
        open={open}
        value={`#${six}`}
        anchorRef={ref}
        aria-label={label}
        onChange={(v) => onChange(v.replace(/^#/, "").toUpperCase())}
        onClose={close}
      />
    </>
  );
};

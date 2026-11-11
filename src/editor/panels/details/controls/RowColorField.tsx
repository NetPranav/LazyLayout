"use client";
import React, { useState } from "react";
import { ColorSwatch } from "./ColorSwatch";

/**
 * Colour control of a row popover: swatch (opens the colour picker) and a six-digit hex field. The field keeps what is typed
 * until it has six digits; only then does it write the colour. `hex` is six digits without the "#".
 */
export const RowColorField: React.FC<{ hex: string; onChange: (hex: string) => void; label: string; hexLabel: string }> = ({ hex, onChange, label, hexLabel }) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="ll-dpair ll:flex ll:items-center ll:gap-1 ll:min-w-0 ll:w-full">
      <ColorSwatch label={label} hex={hex} onChange={onChange} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
      <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm">
        <span className="ll:font-mono ll:text-micro ll:text-muted">#</span>
        <input
          type="text"
          maxLength={6}
          aria-label={hexLabel}
          value={draft ?? hex}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6).toUpperCase();
            setDraft(clean);
            if (clean.length === 6) {
              onChange(clean);
              setDraft(null);
            }
          }}
          className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
        />
      </div>
    </div>
  );
};

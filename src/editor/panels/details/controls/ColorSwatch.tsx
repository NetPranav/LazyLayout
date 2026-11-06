"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { colorToHsb, fromHex, hsbToColor, toHex, type Hsb } from "@/core/paint/color";

/**
 * The colour swatch of a popover row. Clicking it opens the editor's own colour picker: drag across the square for
 * saturation (sideways) and brightness (up and down), drag the bar below it for the hue, or type a hex. `hex` is six digits
 * without the "#".
 */
const W = 208;
const SV_H = 148;

const hexOfHsb = (v: Hsb): string => toHex(hsbToColor(v)).replace(/^#/, "").slice(0, 6).toUpperCase();
const hsbOfHex = (hex: string, keepHue?: number): Hsb => {
  const c = fromHex(`#${/^[0-9a-fA-F]{6}$/.test(hex) ? hex : "000000"}`) ?? { r: 0, g: 0, b: 0, a: 1 };
  const v = colorToHsb(c);
  // grey and black have no hue of their own: keep the one the designer was on, so the bar does not jump
  return keepHue !== undefined && (v.s === 0 || v.b === 0) ? { ...v, h: keepHue } : v;
};

/** A pointer drag over an element, reported as 0 to 1 across and down it. */
function useDrag(onMove: (x: number, y: number) => void) {
  return useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const at = (ev: { clientX: number; clientY: number }) => {
        const r = el.getBoundingClientRect();
        onMove(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
      };
      at(e);
      const move = (ev: PointerEvent) => at(ev);
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    },
    [onMove],
  );
}

const Picker: React.FC<{ hex: string; anchor: DOMRect; label: string; onChange: (hex: string) => void; onClose: () => void }> = ({ hex, anchor, label, onChange, onClose }) => {
  const [hsb, setHsb] = useState<Hsb>(() => hsbOfHex(hex));
  const [typed, setTyped] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const push = (next: Hsb) => {
    setHsb(next);
    setTyped(null);
    onChange(hexOfHsb(next));
  };
  const dragSv = useDrag((x, y) => push({ h: hsb.h, s: x, b: 1 - y }));
  const dragHue = useDrag((x) => push({ ...hsb, h: x * 360 }));

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("pointerdown", down, true);
    ref.current?.focus(); // Escape is handled on the picker itself, so it needs focus
    return () => document.removeEventListener("pointerdown", down, true);
  }, [onClose]);

  const left = Math.max(8, Math.min(window.innerWidth - W - 24, anchor.left - W - 16));
  const top = Math.max(8, Math.min(window.innerHeight - SV_H - 120, anchor.top - 40));
  const pure = hexOfHsb({ h: hsb.h, s: 1, b: 1 });

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-color-picker=""
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-lg ll:p-2 ll:flex ll:flex-col ll:gap-2"
      style={{ position: "fixed", left, top, width: W + 16, zIndex: 1100, outline: "none" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onPointerDown={dragSv}
        data-testid="color-sv"
        aria-label="Saturation and brightness: drag"
        style={{
          position: "relative",
          width: W,
          height: SV_H,
          borderRadius: 4,
          cursor: "crosshair",
          touchAction: "none",
          background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)), #${pure}`,
        }}
      >
        <span
          style={{ position: "absolute", left: hsb.s * W - 6, top: (1 - hsb.b) * SV_H - 6, width: 12, height: 12, borderRadius: 6, border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.5)", pointerEvents: "none" }}
        />
      </div>
      <div
        onPointerDown={dragHue}
        data-testid="color-hue"
        aria-label="Hue: drag"
        style={{
          position: "relative",
          width: W,
          height: 12,
          borderRadius: 6,
          cursor: "ew-resize",
          touchAction: "none",
          background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      >
        <span style={{ position: "absolute", left: (hsb.h / 360) * W - 6, top: -2, width: 12, height: 16, borderRadius: 6, border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.5)", pointerEvents: "none" }} />
      </div>
      <div className="ll:flex ll:items-center ll:gap-2">
        <span className="ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-border ll:shrink-0" style={{ backgroundColor: `#${hexOfHsb(hsb)}` }} />
        <span className="ll:font-mono ll:text-micro ll:text-muted">#</span>
        <input
          type="text"
          maxLength={6}
          aria-label={`${label} hex`}
          value={typed ?? hexOfHsb(hsb)}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
            setTyped(v);
            if (v.length === 6) {
              setHsb(hsbOfHex(v, hsb.h));
              onChange(v);
            }
          }}
          className="ll:flex-1 ll:min-w-0 ll:bg-surface-bar ll:border-0 ll:rounded-sm ll:px-2 ll:h-6 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
        />
      </div>
      <span className="ll:font-sans ll:text-micro ll:text-muted">Drag the square for colour strength and brightness, the bar for the hue.</span>
    </div>,
    document.body,
  );
};

export const ColorSwatch: React.FC<{ hex: string; onChange: (hex: string) => void; label: string; className: string }> = ({ hex, onChange, label, className }) => {
  const [open, setOpen] = useState<DOMRect | null>(null);
  const six = /^[0-9a-fA-F]{6}$/.test(hex) ? hex : "000000";
  const close = useCallback(() => setOpen(null), []);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        title="Pick a colour"
        className={`${className} ll:cursor-pointer ll:p-0`}
        style={{ backgroundColor: `#${six}` }}
        onClick={(e) => (open ? close() : setOpen(e.currentTarget.getBoundingClientRect()))}
      />
      {open && <Picker hex={six} anchor={open} label={label} onChange={onChange} onClose={close} />}
    </>
  );
};

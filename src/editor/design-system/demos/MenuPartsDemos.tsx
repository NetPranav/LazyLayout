"use client";

import React, { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Menu, MenuItem, MenuHeading, ThemeSwatch } from "../../components/Menu";

const LIGHT_THEMES = [
  { id: "paper", label: "Paper" },
  { id: "white", label: "White" },
  { id: "warm", label: "Warm" },
  { id: "lilac", label: "Lilac" },
] as const;

const DARK_THEMES = [
  { id: "noir", label: "Noir" },
  { id: "dark", label: "Dark" },
  { id: "graphite", label: "Graphite" },
  { id: "darkroom", label: "Darkroom" },
] as const;

/** MenuHeading in a menu, with ThemeSwatch chips as item icons: the theme picker pattern. */
export function MenuHeadingDemo() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState("paper");
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">MenuHeading</h2>
        <p className="ll:text-small ll:text-muted">
          Muted section heading inside a menu. Used to group the Light and Dark themes.
        </p>
      </div>
      <div className="ll:flex ll:flex-col ll:gap-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-6">
        <div className="ll:flex ll:items-center ll:gap-4">
          <Button ref={anchorRef} onClick={() => setOpen((v) => !v)}>
            Theme: {picked} (Click to open menu)
          </Button>
          <span className="ll:text-small ll:text-secondary">Click button to open interactive popup menu</span>
        </div>
        <div className="ll:pt-4 ll:border-t ll:border-border ll:flex ll:flex-col ll:gap-2">
          <div className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
            Static Preview
          </div>
          <div className="ll:w-60 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:p-1 ll:shadow-soft">
            <MenuHeading>Light</MenuHeading>
            <div className="ll:flex ll:h-8 ll:items-center ll:gap-2 ll:rounded-sm ll:px-3 ll:text-small ll:text-primary">
              <ThemeSwatch theme="paper" />
              <span>Paper</span>
            </div>
            <div className="ll:flex ll:h-8 ll:items-center ll:gap-2 ll:rounded-sm ll:px-3 ll:text-small ll:text-primary">
              <ThemeSwatch theme="lilac" />
              <span>Lilac</span>
            </div>
            <MenuHeading>Dark</MenuHeading>
            <div className="ll:flex ll:h-8 ll:items-center ll:gap-2 ll:rounded-sm ll:px-3 ll:text-small ll:text-primary">
              <ThemeSwatch theme="noir" />
              <span>Noir</span>
            </div>
            <div className="ll:flex ll:h-8 ll:items-center ll:gap-2 ll:rounded-sm ll:px-3 ll:text-small ll:text-primary">
              <ThemeSwatch theme="darkroom" />
              <span>Darkroom</span>
            </div>
          </div>
        </div>
      </div>
      <Menu open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} aria-label="Theme groups">
        <MenuHeading>Light</MenuHeading>
        {LIGHT_THEMES.map((t) => (
          <MenuItem key={t.id} icon={<ThemeSwatch theme={t.id} />} onClick={() => { setPicked(t.id); setOpen(false); }}>
            {t.label}
          </MenuItem>
        ))}
        <MenuHeading>Dark</MenuHeading>
        {DARK_THEMES.map((t) => (
          <MenuItem key={t.id} icon={<ThemeSwatch theme={t.id} />} onClick={() => { setPicked(t.id); setOpen(false); }}>
            {t.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

/** ThemeSwatch alone: the 28x18 preview chip for all eight themes. */
export function ThemeSwatchDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ThemeSwatch</h2>
        <p className="ll:text-small ll:text-muted">
          28x18 chip scoped to the theme it previews, so it always shows the canvas of that theme and primary control.
        </p>
      </div>
      <div className="ll:grid ll:grid-cols-4 ll:gap-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-6">
        {[...LIGHT_THEMES, ...DARK_THEMES].map((t) => (
          <div key={t.id} className="ll:flex ll:items-center ll:gap-2">
            <ThemeSwatch theme={t.id} />
            <span className="ll:text-small ll:text-secondary">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

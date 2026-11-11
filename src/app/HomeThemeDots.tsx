"use client";

import { THEMES, useTheme } from "@/editor/components/ThemeToggle";

/**
 * Row of round theme swatches for the home page. Each circle carries its own `data-theme`, so it paints with that
 * theme's real tokens (canvas + primary control colour). Clicking applies and remembers the theme (same store as the editor).
 */
export function HomeThemeDots() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="home-dots" role="radiogroup" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          aria-label={t.label}
          title={t.label}
          data-theme={t.id}
          className="home-dot"
          onClick={() => setTheme(t.id)}
        />
      ))}
    </div>
  );
}

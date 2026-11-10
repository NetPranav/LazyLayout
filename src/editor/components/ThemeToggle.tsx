"use client";

import React, { useState, useCallback, useRef, useSyncExternalStore } from "react";
import { Palette } from "lucide-react";
import { isMotionOff } from "../motion/reducedMotion";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";
import { Menu, MenuItem, MenuHeading, ThemeSwatch } from "./Menu";

export type Theme =
  | "paper"
  | "white"
  | "warm"
  | "lilac"
  | "noir"
  | "dark"
  | "graphite"
  | "darkroom";

export interface ThemeOption {
  id: Theme;
  label: string;
}

export const LIGHT_THEMES: readonly ThemeOption[] = [
  { id: "warm", label: "Warm (Default)" },
  { id: "paper", label: "Paper" },
  { id: "white", label: "White" },
  { id: "lilac", label: "Lilac" },
];

export const DARK_THEMES: readonly ThemeOption[] = [
  { id: "darkroom", label: "Darkroom" },
  { id: "dark", label: "Dark" },
  { id: "graphite", label: "Graphite (Default)" },
  { id: "noir", label: "Noir" },
];

export const THEMES: readonly ThemeOption[] = [
  ...LIGHT_THEMES,
  ...DARK_THEMES,
];

const VALID_THEMES = new Set<string>([
  "paper",
  "white",
  "warm",
  "lilac",
  "noir",
  "dark",
  "graphite",
  "darkroom",
]);

const themeListeners = new Set<() => void>();

function notifyThemeListeners(): void {
  themeListeners.forEach((fn) => fn());
}

/** Subscribe to theme changes for useSyncExternalStore. */
export function subscribeTheme(callback: () => void): () => void {
  themeListeners.add(callback);
  return () => {
    themeListeners.delete(callback);
  };
}

let cachedTheme: Theme = "warm";

/** Get active theme on client. */
export function getClientTheme(): Theme {
  if (typeof document !== "undefined") {
    let attr = document.documentElement.getAttribute("data-theme");
    if (attr === "plum") {
      document.documentElement.setAttribute("data-theme", "graphite");
      attr = "graphite";
      try {
        localStorage.setItem("lazy-layout-theme", "graphite");
      } catch {
        // ignore
      }
    }
    if (attr && VALID_THEMES.has(attr)) {
      cachedTheme = attr as Theme;
      return cachedTheme;
    }
    try {
      let stored = localStorage.getItem("lazy-layout-theme");
      if (stored === "plum") {
        stored = "graphite";
        localStorage.setItem("lazy-layout-theme", "graphite");
      }
      if (stored && VALID_THEMES.has(stored)) {
        cachedTheme = stored as Theme;
        document.documentElement.setAttribute("data-theme", cachedTheme);
        return cachedTheme;
      }
    } catch {
      // ignore
    }
  }
  return cachedTheme;
}

/** Server snapshot for theme (defaults to 'warm' on server). */
export function getServerTheme(): Theme {
  return "warm";
}

/** Toggle between default light (Warm) and default dark (Graphite). */
export function toggleTheme(): void {
  const current = getClientTheme();
  const isDark = current === "dark" || current === "graphite" || current === "darkroom" || current === "noir";
  applyTheme(isDark ? "warm" : "graphite");
}

/** Set and persist active theme across DOM, localStorage, and listeners. */
export function applyTheme(nextTheme: Theme): void {
  if ((nextTheme as string) === "plum") {
    nextTheme = "graphite";
  }
  if (!VALID_THEMES.has(nextTheme)) {
    nextTheme = "warm";
  }
  cachedTheme = nextTheme;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    const commit = () => root.setAttribute("data-theme", nextTheme);
    const reduced = isMotionOff();
    const withTransition = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
    if (withTransition && !reduced && root.getAttribute("data-theme") !== nextTheme) {
      // The whole screen cross-fades from the old theme to the new one (styled in tokens.css).
      withTransition.call(document, commit);
    } else {
      commit();
    }
  }
  try {
    localStorage.setItem("lazy-layout-theme", nextTheme);
  } catch {
    // ignore storage errors
  }
  notifyThemeListeners();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<Theme>("ll-theme-change", { detail: nextTheme }));
  }
}

export const setTheme = applyTheme;

if (typeof window !== "undefined") {
  window.addEventListener("ll-theme-change", (e: Event) => {
    const customEvent = e as CustomEvent<Theme>;
    if (customEvent.detail && customEvent.detail !== cachedTheme) {
      cachedTheme = customEvent.detail;
      notifyThemeListeners();
    }
  });

  try {
    const observer = new MutationObserver(() => {
      let attr = document.documentElement.getAttribute("data-theme");
      if (attr === "plum") {
        attr = "dark";
        document.documentElement.setAttribute("data-theme", "dark");
      }
      if (attr && VALID_THEMES.has(attr)) {
        if (attr !== cachedTheme) {
          cachedTheme = attr as Theme;
          notifyThemeListeners();
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  } catch {
    // ignore observer errors in non-standard environments
  }
}

/** React hook for theme with useSyncExternalStore and server snapshot ('warm'). */
export function useTheme(): [Theme, (nextTheme: Theme) => void] {
  const theme = useSyncExternalStore(subscribeTheme, getClientTheme, getServerTheme);
  return [theme, applyTheme];
}

export interface ThemeToggleProps {
  size?: "sm" | "md";
  className?: string;
  mode?: "menu" | "cycle";
}

export function ThemeToggle({ size = "md", className = "", mode = "menu" }: ThemeToggleProps) {
  const [theme, selectTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleSelect = useCallback(
    (nextTheme: Theme) => {
      selectTheme(nextTheme);
      setMenuOpen(false);
      triggerRef.current?.focus();
    },
    [selectTheme]
  );

  const cycleTheme = useCallback(() => {
    const isDark = theme === "dark" || theme === "graphite" || theme === "darkroom" || theme === "noir";
    selectTheme(isDark ? "warm" : "darkroom");
  }, [theme, selectTheme]);

  const handleClick = useCallback(() => {
    if (mode === "cycle") {
      cycleTheme();
    } else {
      setMenuOpen((prev) => !prev);
    }
  }, [mode, cycleTheme]);

  const iconSize = size === "sm" ? 14 : 16;
  const currentLabel = THEMES.find((t) => t.id === theme)?.label ?? "Warm (Default)";

  return (
    <div className="ll:relative ll:inline-flex">
      <Tooltip content={`Theme: ${currentLabel}`}>
        <Button
          ref={triggerRef}
          variant="ghost"
          size={size}
          iconOnly
          onClick={handleClick}
          aria-label={`Current theme: ${currentLabel}. Click to switch theme`}
          aria-haspopup={mode === "menu" ? "menu" : undefined}
          aria-expanded={mode === "menu" ? menuOpen : undefined}
          className={className}
        >
          <Icon icon={Palette} size={iconSize} />
        </Button>
      </Tooltip>

      {mode === "menu" && (
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorRef={triggerRef}
          width={200}
          aria-label="Select theme"
        >
          <MenuHeading>Light</MenuHeading>
          {LIGHT_THEMES.map((t) => {
            const isSelected = theme === t.id;
            return (
              <MenuItem
                key={t.id}
                role="menuitemradio"
                checked={isSelected}
                onClick={() => handleSelect(t.id)}
                icon={<ThemeSwatch theme={t.id} />}
              >
                {t.label}
              </MenuItem>
            );
          })}
          <MenuHeading>Dark</MenuHeading>
          {DARK_THEMES.map((t) => {
            const isSelected = theme === t.id;
            return (
              <MenuItem
                key={t.id}
                role="menuitemradio"
                checked={isSelected}
                onClick={() => handleSelect(t.id)}
                icon={<ThemeSwatch theme={t.id} />}
              >
                {t.label}
              </MenuItem>
            );
          })}
        </Menu>
      )}
    </div>
  );
}

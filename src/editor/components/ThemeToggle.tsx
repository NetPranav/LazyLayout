"use client";

import React, { useState, useCallback, useRef, useSyncExternalStore } from "react";
import { Palette } from "lucide-react";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";
import { Menu, MenuItem } from "./Menu";

export type Theme = "paper" | "dark" | "white" | "warm" | "lilac";

export interface ThemeOption {
  id: Theme;
  label: string;
}

export const THEMES: readonly ThemeOption[] = [
  { id: "paper", label: "Paper (Default)" },
  { id: "dark", label: "Dark" },
  { id: "white", label: "White" },
  { id: "warm", label: "Warm" },
  { id: "lilac", label: "Lilac" },
];

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

let cachedTheme: Theme = "paper";

/** Get active theme on client. */
export function getClientTheme(): Theme {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (attr === "paper" || attr === "dark" || attr === "white" || attr === "warm" || attr === "lilac") {
      cachedTheme = attr;
      return cachedTheme;
    }
  }
  return cachedTheme;
}

/** Server snapshot for theme (defaults to 'paper' on server). */
export function getServerTheme(): Theme {
  return "paper";
}

/** Set and persist active theme across DOM, localStorage, and listeners. */
export function applyTheme(nextTheme: Theme): void {
  if (
    nextTheme !== "paper" &&
    nextTheme !== "dark" &&
    nextTheme !== "white" &&
    nextTheme !== "warm" &&
    nextTheme !== "lilac"
  ) {
    nextTheme = "paper";
  }
  cachedTheme = nextTheme;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", nextTheme);
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
      const attr = document.documentElement.getAttribute("data-theme") as Theme | null;
      if (attr && (attr === "paper" || attr === "dark" || attr === "white" || attr === "warm" || attr === "lilac")) {
        if (attr !== cachedTheme) {
          cachedTheme = attr;
          notifyThemeListeners();
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  } catch {
    // ignore observer errors in non-standard environments
  }
}

/** React hook for theme with useSyncExternalStore and server snapshot ('paper'). */
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
    const currentIndex = THEMES.findIndex((t) => t.id === theme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    selectTheme(THEMES[nextIndex].id);
  }, [theme, selectTheme]);

  const handleClick = useCallback(() => {
    if (mode === "cycle") {
      cycleTheme();
    } else {
      setMenuOpen((prev) => !prev);
    }
  }, [mode, cycleTheme]);

  const iconSize = size === "sm" ? 14 : 16;
  const currentLabel = THEMES.find((t) => t.id === theme)?.label ?? "Paper (Default)";

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
          {THEMES.map((t) => {
            const isSelected = theme === t.id;
            return (
              <MenuItem
                key={t.id}
                role="menuitemradio"
                checked={isSelected}
                onClick={() => handleSelect(t.id)}
                icon={
                  <span
                    data-theme={t.id}
                    className="ll:w-3.5 ll:h-3.5 ll:rounded-sm ll:border ll:border-swatch-line ll:bg-surface-panel ll:shrink-0"
                    aria-hidden="true"
                  />
                }
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

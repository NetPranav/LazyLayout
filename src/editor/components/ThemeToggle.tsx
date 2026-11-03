"use client";

import React, { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleSelect = useCallback(
    (nextTheme: Theme) => {
      selectTheme(nextTheme);
      setMenuOpen(false);
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
    <div ref={containerRef} className="ll:relative ll:inline-flex">
      <Tooltip content={`Theme: ${currentLabel}`}>
        <Button
          variant="ghost"
          size={size}
          iconOnly
          onClick={handleClick}
          aria-label={`Current theme: ${currentLabel}. Click to switch theme`}
          aria-haspopup={mode === "menu" ? "menu" : undefined}
          aria-expanded={mode === "menu" ? menuOpen : undefined}
          className={className}
        >
          <Palette size={iconSize} strokeWidth={1.5} />
        </Button>
      </Tooltip>

      {mode === "menu" && menuOpen && (
        <div
          role="menu"
          aria-label="Select theme"
          className="ll:absolute ll:right-0 ll:top-full ll:mt-1 ll:z-50 ll:w-48 ll:py-1 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft"
        >
          {THEMES.map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                role="menuitem"
                type="button"
                onClick={() => handleSelect(t.id)}
                className={`ll:flex ll:items-center ll:gap-2.5 ll:w-full ll:h-8 ll:px-3 ll:text-body ll:text-left ll:transition-none ll:select-none ${
                  isSelected
                    ? "ll:bg-surface-hover ll:text-primary ll:font-medium"
                    : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
                }`}
              >
                <span
                  data-theme={t.id}
                  className="ll:w-3.5 ll:h-3.5 ll:rounded-sm ll:border ll:border-swatch-line ll:bg-surface-panel ll:shrink-0"
                  aria-hidden="true"
                />
                <span className="ll:flex-1 ll:truncate">{t.label}</span>
                {isSelected && (
                  <Check size={14} strokeWidth={2} className="ll:text-primary ll:shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

export type Theme = "dark" | "light";

export interface ThemeToggleProps {
  size?: "sm" | "md";
  className?: string;
}

export function ThemeToggle({ size = "md", className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentTheme =
      (typeof document !== "undefined" &&
        (document.documentElement.getAttribute("data-theme") as Theme)) ||
      "dark";
    setTheme(currentTheme);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>;
      if (customEvent.detail) {
        setTheme(customEvent.detail);
      }
    };

    window.addEventListener("ll-theme-change", handleThemeChange);
    return () => {
      window.removeEventListener("ll-theme-change", handleThemeChange);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
    try {
      localStorage.setItem("lazy-layout-theme", nextTheme);
    } catch {
      // ignore storage errors
    }
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<Theme>("ll-theme-change", { detail: nextTheme })
      );
    }
  }, [theme]);

  const iconSize = size === "sm" ? 14 : 16;
  const isDark = mounted ? theme === "dark" : true;

  return (
    <Tooltip content="Switch theme">
      <Button
        variant="ghost"
        size={size}
        iconOnly
        onClick={toggleTheme}
        aria-label="Switch theme"
        className={className}
      >
        {isDark ? (
          <Sun size={iconSize} strokeWidth={1.5} />
        ) : (
          <Moon size={iconSize} strokeWidth={1.5} />
        )}
      </Button>
    </Tooltip>
  );
}

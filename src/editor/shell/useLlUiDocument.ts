"use client";

import { useLayoutEffect } from "react";

let mounted = 0;

/**
 * Marks the page as showing the new UI: `ll-ui` on <html> while at least one editor root (the editor, the design
 * system page, a lab) is mounted. The page-wide base rules in styles/globals.css (hidden scrollbars, control resets,
 * including for menus portaled to <body>) key off it. It replaces `html:has(.ll-editor-root)`, which made every DOM
 * insertion restyle the whole document (performance, 2026-11-18).
 */
export function useLlUiDocument(): void {
  useLayoutEffect(() => {
    const html = document.documentElement;
    mounted += 1;
    html.classList.add("ll-ui");
    return () => {
      mounted -= 1;
      if (mounted === 0) html.classList.remove("ll-ui");
    };
  }, []);
}

"use client";

import React, { useEffect } from "react";
import { onCommandRun } from "@/core/commands";
import { useToolStore } from "@/core/store/useToolStore";
import { useScreencastStore, SCREENCAST_HOLD_MS, type ScreencastEntry } from "@/editor/diagnostics/screencastStore";

/**
 * Show keystrokes, the overlay: the keys pressed, the mouse buttons used (click, drag, double click, scroll, each with the
 * modifiers held) and the command that ran, stacked at the bottom left of the canvas like Blender's Screencast Keys.
 * It only listens: it never handles, stops or changes an event, and it takes no pointer (pointer-events: none).
 * Turned on from View > Show keystrokes. Typing in a field shows as one "Typing" entry, not the letters.
 */

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Fn"]);

const KEY_NAMES: Record<string, string> = {
  " ": "Space",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
  Backspace: "Backspace",
  Delete: "Delete",
  Enter: "Enter",
  Tab: "Tab",
  PageUp: "Page Up",
  PageDown: "Page Down",
};

function modifiers(e: KeyboardEvent | PointerEvent | MouseEvent | WheelEvent): string[] {
  const out: string[] = [];
  if (e.ctrlKey) out.push("Ctrl");
  if (e.metaKey) out.push(IS_MAC ? "⌘" : "Win");
  if (e.altKey) out.push(IS_MAC ? "⌥" : "Alt");
  if (e.shiftKey) out.push("Shift");
  return out;
}

function keyName(e: KeyboardEvent): string {
  if (KEY_NAMES[e.key]) return KEY_NAMES[e.key];
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

const BUTTONS = ["Left", "Middle", "Right"];

function isTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["checkbox", "radio", "button", "range"].includes((el as HTMLInputElement).type));
}

/** Installs the listeners while the overlay is on. */
function useScreencastInput(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const store = useScreencastStore.getState;
    let press: { x: number; y: number; button: number; dragged: boolean } | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || MODIFIER_KEYS.has(e.key)) return;
      if (isTextField(e.target) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        store().push(["Typing"]);
        return;
      }
      store().push([...modifiers(e), keyName(e)]);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      press = { x: e.clientX, y: e.clientY, button: e.button, dragged: false };
      store().push([...modifiers(e), `${BUTTONS[e.button] ?? "Mouse"} click`]);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!press || press.dragged) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
      press.dragged = true;
      // the click becomes a drag
      useScreencastStore.setState((s) => {
        const last = s.entries[s.entries.length - 1];
        if (!last || last.note) return s;
        const keys = last.keys.map((k) => (k.endsWith(" click") ? k.replace(" click", " drag") : k));
        return { entries: [...s.entries.slice(0, -1), { ...last, keys, count: 1, at: performance.now() }] };
      });
    };
    const onPointerUp = () => {
      press = null;
    };
    const onDoubleClick = (e: MouseEvent) => {
      // the second click of a double click becomes "Double click"
      useScreencastStore.setState((s) => {
        const last = s.entries[s.entries.length - 1];
        if (!last || last.note || !last.keys.some((k) => k.endsWith(" click"))) return s;
        return { entries: [...s.entries.slice(0, -1), { ...last, keys: [...modifiers(e), "Double click"], count: 1, at: performance.now() }] };
      });
    };
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - lastWheel < 120) return;
      lastWheel = now;
      store().push([...modifiers(e), e.deltaY < 0 ? "Scroll up" : "Scroll down"]);
    };
    const stopNaming = onCommandRun(({ title }) => store().nameLast(title));
    // tool keys (R, T, P, V …) choose a tool rather than run a command: name the tool
    const stopTools = useToolStore.subscribe((s, prev) => {
      if (s.active !== prev.active) store().nameLast(`${s.active.charAt(0).toUpperCase()}${s.active.slice(1)} tool`);
    });
    // the demo runs narrate with notes (test builds only)
    const w = window as unknown as { __LL_TEST__?: boolean; __LL_SCREENCAST__?: { note: (text: string) => void } };
    if (w.__LL_TEST__) w.__LL_SCREENCAST__ = { note: (text) => store().push([text], { note: true }) };

    const opts = { capture: true, passive: true } as const;
    document.addEventListener("keydown", onKeyDown, opts);
    document.addEventListener("pointerdown", onPointerDown, opts);
    document.addEventListener("pointermove", onPointerMove, opts);
    document.addEventListener("pointerup", onPointerUp, opts);
    document.addEventListener("dblclick", onDoubleClick, opts);
    document.addEventListener("wheel", onWheel, opts);
    const prune = window.setInterval(() => store().prune(performance.now()), 200);
    return () => {
      document.removeEventListener("keydown", onKeyDown, opts);
      document.removeEventListener("pointerdown", onPointerDown, opts);
      document.removeEventListener("pointermove", onPointerMove, opts);
      document.removeEventListener("pointerup", onPointerUp, opts);
      document.removeEventListener("dblclick", onDoubleClick, opts);
      document.removeEventListener("wheel", onWheel, opts);
      window.clearInterval(prune);
      stopNaming();
      stopTools();
      if (w.__LL_SCREENCAST__) delete w.__LL_SCREENCAST__;
    };
  }, [enabled]);
}

/** A small mouse with the used button lit. */
const MouseGlyph: React.FC<{ button: "Left" | "Middle" | "Right" | null }> = ({ button }) => (
  <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden className="ll:shrink-0">
    <rect x="0.75" y="0.75" width="10.5" height="14.5" rx="5.25" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M6 0.75 V6.5" stroke="currentColor" strokeWidth="1.2" />
    {button === "Left" && <path d="M0.75 6 V6.5 H6 V0.75 A5.25 5.25 0 0 0 0.75 6 Z" fill="currentColor" />}
    {button === "Right" && <path d="M11.25 6 V6.5 H6 V0.75 A5.25 5.25 0 0 1 11.25 6 Z" fill="currentColor" />}
    {button === "Middle" && <rect x="4.9" y="2.4" width="2.2" height="3.4" rx="1.1" fill="currentColor" />}
  </svg>
);

const Keycap: React.FC<{ label: string }> = ({ label }) => {
  const mouse = /^(Left|Middle|Right) (click|drag)$/.exec(label);
  return (
    <span className="ll:inline-flex ll:items-center ll:gap-1 ll:h-6 ll:min-w-6 ll:px-1.5 ll:rounded-sm ll:border ll:border-border ll:bg-surface-raised ll:text-primary ll:font-mono ll:text-small ll:shadow-sm">
      {mouse && <MouseGlyph button={mouse[1] as "Left" | "Middle" | "Right"} />}
      {label}
    </span>
  );
};

const Row: React.FC<{ entry: ScreencastEntry; fade: number }> = ({ entry, fade }) => (
  <div data-screencast-entry={entry.keys.join("+")} className="ll:flex ll:items-center ll:gap-1.5" style={{ opacity: fade }}>
    {entry.note ? (
      <span className="ll:px-2 ll:h-6 ll:inline-flex ll:items-center ll:rounded-sm ll:bg-surface-raised ll:border ll:border-border ll:text-small ll:text-primary ll:font-sans">{entry.keys[0]}</span>
    ) : (
      <>
        {entry.keys.map((k, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="ll:text-muted ll:text-small">+</span>}
            <Keycap label={k} />
          </React.Fragment>
        ))}
        {entry.count > 1 && <span className="ll:text-small ll:text-secondary ll:font-mono">×{entry.count}</span>}
        {entry.command && <span className="ll:text-small ll:text-secondary ll:font-sans ll:whitespace-nowrap">{entry.command}</span>}
      </>
    )}
  </div>
);

/** Mount once inside the canvas area; it positions itself at the bottom left. */
export const ScreencastKeys: React.FC<{ className?: string }> = ({ className = "" }) => {
  const enabled = useScreencastStore((s) => s.enabled);
  const entries = useScreencastStore((s) => s.entries);
  useScreencastInput(enabled);
  if (!enabled) return null;
  const newest = entries.length > 0 ? entries[entries.length - 1].at : 0;
  return (
    <div
      role="log"
      aria-label="Keystrokes"
      aria-live="off"
      data-testid="screencast-keys"
      className={`ll:absolute ll:left-4 ll:bottom-4 ll:z-40 ll:flex ll:flex-col ll:items-start ll:gap-1.5 ll:pointer-events-none ll:select-none ${className}`}
    >
      {entries.map((e) => (
        <Row key={e.id} entry={e} fade={e.note ? 1 : Math.max(0.35, 1 - (newest - e.at) / (SCREENCAST_HOLD_MS * 1.5))} />
      ))}
    </div>
  );
};

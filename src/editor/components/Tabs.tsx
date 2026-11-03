"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Spring } from "../motion/spring";
import { simAdd, simRemove, type Sim } from "../motion/loop";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { useMounted } from "./useMounted";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: readonly TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  variant?: "line" | "boxed";
  size?: "sm" | "md";
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = "",
  variant = "line",
  size = "md",
}: TabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const springRef = useRef<{ x: Spring; w: Spring; sim: Sim } | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    const p = getActivePreset();
    const x = new Spring(0, p.glideH);
    const w = new Spring(0, p.glideW);
    const sim: Sim = {
      sp: [x, w],
      apply: () => {
        if (indicatorRef.current) {
          indicatorRef.current.style.transform = `translate3d(${x.x.toFixed(2)}px, 0, 0)`;
          indicatorRef.current.style.width = `${Math.max(0, w.x).toFixed(2)}px`;
        }
      },
    };
    springRef.current = { x, w, sim };

    return () => {
      if (springRef.current) {
        simRemove(springRef.current.sim);
      }
    };
  }, []);

  const updateIndicator = useCallback((instant = false) => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    const tabEl = tabRefs.current[idx];
    const indEl = indicatorRef.current;
    const sp = springRef.current;

    if (!tabEl || !indEl || !sp) return;

    const targetX = tabEl.offsetLeft;
    const targetW = tabEl.offsetWidth;
    const p = getActivePreset();

    indEl.style.display = "block";

    if (instant || prefersReducedMotion()) {
      sp.x.jump(targetX);
      sp.w.jump(targetW);
      indEl.style.transform = `translate3d(${targetX}px, 0, 0)`;
      indEl.style.width = `${targetW}px`;
      return;
    }

    sp.x.tune(p.glideH);
    sp.w.tune(p.glideW);
    sp.x.to = targetX;
    sp.w.to = targetW;

    simAdd(sp.sim);
  }, [tabs, activeTab]);

  useEffect(() => {
    if (mounted) {
      updateIndicator(false);
    }
  }, [activeTab, mounted, updateIndicator]);

  useEffect(() => {
    if (mounted) {
      updateIndicator(true);
    }
  }, [mounted, updateIndicator]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabled = tabs
      .map((t, idx) => ({ ...t, idx }))
      .filter((t) => !t.disabled);

    if (!enabled.length) return;
    const currentPos = enabled.findIndex((t) => t.idx === index);
    let targetIdx: number | null = null;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      targetIdx = enabled[(currentPos + 1) % enabled.length].idx;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      targetIdx = enabled[(currentPos - 1 + enabled.length) % enabled.length].idx;
    }

    if (targetIdx !== null) {
      onChange(tabs[targetIdx].id);
      tabRefs.current[targetIdx]?.focus();
    }
  };

  const isSm = size === "sm";
  const heightStyles = isSm ? "ll:h-8" : "ll:h-9";

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={`ll:relative ll:flex ll:items-center ll:box-border ll:select-none ${variant === "line"
          ? "ll:border-b ll:border-border ll:gap-1"
          : "ll:bg-surface-bar ll:border ll:border-border ll:rounded-md ll:p-0.5 ll:gap-0.5"
        } ${heightStyles} ${className}`}
    >
      {/* Sliding spring indicator */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        className={`ll:absolute ll:pointer-events-none ll:hidden ${variant === "line"
              ? "ll:bottom-0 ll:left-0 ll:h-0.5 ll:bg-primary"
              : "ll:top-0.5 ll:bottom-0.5 ll:left-0 ll:bg-surface-raised ll:rounded-sm ll:shadow-soft"
          }`}
      />

      {tabs.map((tab, idx) => {
        const isSelected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`ll:relative ll:z-10 ll:inline-flex ll:items-center ll:justify-center ll:gap-2 ll:px-3 ll:h-full ll:font-sans ll:text-small ll:transition-colors ll:duration-75 ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${isSelected
                ? "ll:font-medium ll:text-primary"
                : "ll:font-normal ll:text-secondary ll:hover:text-primary"
              } ${tab.disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

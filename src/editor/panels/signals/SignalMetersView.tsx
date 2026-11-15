"use client";

import React from "react";
import {
  formatSignalValue,
  listSignalsByCategory,
  normalizeMeterFill,
  type SignalCategory,
} from "@/core/signals/catalogue";
import type { Value } from "@/core/bindings/evaluate";

export interface LiveMeterSample {
  id: string;
  value: Value;
}

export interface SignalMetersViewProps {
  values: ReadonlyMap<string, Value> | Record<string, Value>;
  lastPressedKey?: string | null;
  category?: SignalCategory;
}

/**
 * Phase 133 Dev Panel: Live Signal Meters for pointer, scroll, keyboard, and timing channels.
 */
export function SignalMetersView({ values, lastPressedKey = null, category }: SignalMetersViewProps) {
  const entries = listSignalsByCategory(category).filter((e) =>
    ["pointer", "scroll", "keyboard", "time"].includes(e.category)
  );

  const readVal = (id: string, fallback: Value): Value => {
    if (values instanceof Map) return values.get(id) ?? fallback;
    return (values as Record<string, Value>)[id] ?? fallback;
  };

  return (
    <div
      data-testid="signal-meters-view"
      className="ll:flex ll:flex-col ll:gap-1.5 ll:p-2 ll:rounded-md ll:bg-[var(--ll-surface-2)] ll:border ll:border-[var(--ll-border-subtle)] ll:text-xs"
    >
      <div className="ll:flex ll:items-center ll:justify-between ll:text-[var(--ll-text-secondary)] ll:pb-1 ll:border-b ll:border-[var(--ll-border-subtle)]">
        <span className="ll:font-medium ll:text-[var(--ll-text-primary)]">Signal Meters</span>
        {lastPressedKey ? (
          <span className="ll:px-1.5 ll:py-0.5 ll:rounded ll:bg-[var(--ll-surface-3)] ll:text-[10px]">
            Last Key: {lastPressedKey}
          </span>
        ) : null}
      </div>
      <div className="ll:flex ll:flex-col ll:gap-1">
        {entries.map((entry) => {
          const val = readVal(entry.id, entry.defaultValue);
          const pct = Math.round(normalizeMeterFill(val, entry.range) * 100);
          return (
            <div key={entry.id} className="ll:flex ll:flex-col ll:gap-0.5" data-signal-id={entry.id}>
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-[var(--ll-text-primary)] ll:truncate">{entry.label}</span>
                <div className="ll:flex ll:items-center ll:gap-1.5 ll:shrink-0">
                  <span className="ll:text-[10px] ll:px-1 ll:rounded ll:bg-[var(--ll-surface-3)] ll:text-[var(--ll-text-muted)]">
                    {entry.unit}
                  </span>
                  <span className="ll:font-mono ll:text-[11px] ll:text-[var(--ll-text-secondary)]">
                    {formatSignalValue(val, entry.unit)}
                  </span>
                </div>
              </div>
              <div className="ll:h-1 ll:w-full ll:rounded-full ll:bg-[var(--ll-surface-3)] ll:overflow-hidden">
                <div
                  className="ll:h-full ll:bg-[var(--ll-accent-primary)] ll:transition-[width] ll:duration-75"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import {
  detectActiveMentionQuery,
  filterMentionCandidates,
  getLayerMentionCandidates,
  type LayerMentionCandidate,
} from "@/ai/llm/mentions";
import { useDocument } from "@/core/store/useDocumentStore";

export interface UseMentionAutocompleteOptions {
  value: string;
  onChange: (nextValue: string) => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

export function useMentionAutocomplete({
  value,
  onChange,
  inputRef,
}: UseMentionAutocompleteOptions) {
  const doc = useDocument((d) => d);
  const [cursorPos, setCursorPos] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const candidates = useMemo(() => getLayerMentionCandidates(doc), [doc]);
  const activeQuery = useMemo(
    () => (dismissed ? null : detectActiveMentionQuery(value, cursorPos)),
    [value, cursorPos, dismissed],
  );
  const matches = useMemo(
    () => (activeQuery ? filterMentionCandidates(candidates, activeQuery.query, 8) : []),
    [candidates, activeQuery],
  );

  const isOpen = Boolean(activeQuery && matches.length > 0);
  const safeIndex = matches.length > 0 ? Math.min(activeIndex, matches.length - 1) : 0;

  const syncCursor = (nextPos?: number | null) => {
    setDismissed(false);
    if (typeof nextPos === "number") setCursorPos(nextPos);
  };

  const applySelection = (candidate: LayerMentionCandidate) => {
    if (!activeQuery) return;
    const before = value.slice(0, activeQuery.start);
    const after = value.slice(activeQuery.end);
    const inserted = `${candidate.insertText} `;
    const nextValue = `${before}${inserted}${after}`;
    const nextCursor = before.length + inserted.length;
    onChange(nextValue);
    setActiveIndex(0);
    setCursorPos(nextCursor);
    queueMicrotask(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleMentionKeyDown = (e: React.KeyboardEvent): boolean => {
    if (!isOpen) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % matches.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length);
      return true;
    }
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const target = matches[safeIndex];
      if (target) applySelection(target);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDismissed(true);
      return true;
    }
    return false;
  };

  return {
    isOpen,
    matches,
    activeIndex: safeIndex,
    syncCursor,
    applySelection,
    handleMentionKeyDown,
  };
}

export interface MentionPopoverProps {
  open: boolean;
  matches: readonly LayerMentionCandidate[];
  activeIndex: number;
  onSelect: (candidate: LayerMentionCandidate) => void;
  className?: string;
}

export const MentionPopover: React.FC<MentionPopoverProps> = ({
  open,
  matches,
  activeIndex,
  onSelect,
  className = "",
}) => {
  if (!open || matches.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Mention layer"
      className={`ll:max-h-48 ll:overflow-y-auto ll:rounded-sm ll:border ll:border-border ll:bg-surface-panel ll:shadow-md ll:p-1 ll:flex ll:flex-col ll:gap-0.5 ll:z-50 ${className}`}
    >
      <div className="ll:px-2 ll:py-0.5 ll:text-nano ll:text-muted">
        Mention element (@)
      </div>
      {matches.map((item, idx) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={idx === activeIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(item);
          }}
          className={`ll:w-full ll:px-2 ll:py-1 ll:rounded-xs ll:flex ll:items-center ll:justify-between ll:gap-2 ll:text-left ll:text-small ll:cursor-pointer ${
            idx === activeIndex
              ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
              : "ll:text-primary hover:ll:bg-surface-hover"
          }`}
        >
          <span className="ll:truncate ll:font-medium">{item.name}</span>
          <span
            className={`ll:text-nano ll:shrink-0 ${
              idx === activeIndex ? "ll:opacity-80" : "ll:text-muted"
            }`}
          >
            {item.archetype}
          </span>
        </button>
      ))}
    </div>
  );
};

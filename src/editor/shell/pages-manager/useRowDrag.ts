"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { getActivePreset } from "@/editor/motion/feel";
import { springAnim } from "@/editor/motion/ease";

const DRAG_START_PX = 4;

export interface RowDrag {
  /** The row being dragged right now, if the press has moved far enough to count as a drag. */
  dragId: string | null;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  /** True once after a drag ends, so the click that follows the release does not also choose the row. */
  consumeClick: () => boolean;
}

export interface UseRowDragOptions<T extends string> {
  listRef: React.RefObject<HTMLElement | null>;
  /** The thin insertion line, a child of the list, positioned by this hook. */
  lineRef: React.RefObject<HTMLElement | null>;
  rowEls: React.RefObject<Map<string, HTMLElement>>;
  ids: readonly T[];
  enabled: boolean;
  /** `index` is the row's place in the list once it has been taken out of its old place. */
  onDrop: (id: T, index: number) => void;
}

/**
 * Reorders a list of rows by dragging: the pressed row follows the pointer and a thin insertion line shows where it
 * lands, gliding between gaps on the shared spring.
 */
export function useRowDrag<T extends string>({ listRef, lineRef, rowEls, ids, enabled, onDrop }: UseRowDragOptions<T>): RowDrag {
  const [dragId, setDragId] = useState<string | null>(null);
  const swallow = useRef(false);
  const latest = useRef({ ids, enabled, onDrop });
  useEffect(() => {
    latest.current = { ids, enabled, onDrop };
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      const { ids: order, enabled: on } = latest.current;
      if (!on || e.button !== 0 || (e.target instanceof Element && e.target.closest("button,input,textarea"))) return;
      const row = rowEls.current?.get(id);
      const list = listRef.current;
      const from = order.indexOf(id as T);
      if (!row || !list || from < 0) return;
      const startY = e.clientY;
      let active = false;
      let slot = -1;
      let lineTop: number | null = null;

      const move = (ev: PointerEvent) => {
        if (!active) {
          if (Math.abs(ev.clientY - startY) < DRAG_START_PX) return;
          active = true;
          setDragId(id);
        }
        row.style.transform = `translateY(${ev.clientY - startY}px)`;
        const y = ev.clientY - list.getBoundingClientRect().top + list.scrollTop;
        const current = latest.current.ids;
        slot = current.length;
        for (let i = 0; i < current.length; i++) {
          const el = rowEls.current?.get(current[i]);
          if (el && y < el.offsetTop + el.offsetHeight / 2) {
            slot = i;
            break;
          }
        }
        const line = lineRef.current;
        if (!line) return;
        if (slot === from || slot === from + 1) {
          line.style.display = "none";
          lineTop = null;
          return;
        }
        const target = rowEls.current?.get(current[Math.min(slot, current.length - 1)]);
        if (!target) return;
        const top = slot < current.length ? target.offsetTop : target.offsetTop + target.offsetHeight;
        const prev = lineTop;
        line.style.display = "block";
        line.style.top = `${top}px`;
        lineTop = top;
        if (prev !== null && prev !== top) {
          const p = getActivePreset();
          springAnim(line, [{ translate: `0 ${prev - top}px` }, { translate: "0 0" }], p.rows[0], p.rows[1]);
        }
      };

      const finish = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (!active) return;
        row.style.transform = "";
        if (lineRef.current) lineRef.current.style.display = "none";
        setDragId(null);
        swallow.current = true;
        setTimeout(() => {
          swallow.current = false;
        }, 0);
        if (slot >= 0 && slot !== from && slot !== from + 1) latest.current.onDrop(id as T, slot > from ? slot - 1 : slot);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [listRef, lineRef, rowEls],
  );

  const consumeClick = useCallback(() => swallow.current, []);

  return { dragId, onPointerDown, consumeClick };
}

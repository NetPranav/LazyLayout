"use client";

import React, { useMemo } from "react";
import { ChevronRight, Layers, Plus, X as XIcon } from "lucide-react";
import { useStore } from "zustand";
import { Icon } from "@/editor/components/Icon";
import { useDocument } from "@/core/store/useDocumentStore";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { transportStore } from "@/core/time/transport";
import { breadcrumbs, compositionTabs, nestedRows } from "@/core/timeline/tabs";
import { invokeCommand } from "@/core/commands";
import { useMotionModel, X } from "@/editor/motion-model";

/**
 * ROADMAP Phase 65 in the new timeline: the composition tab strip (Main, one tab per interaction composition with its
 * trigger, the precomps that were opened, each with a ×), **+ Precomp**, and the breadcrumb trail when a precomp was
 * opened from a bar. All of it is the engine's (`compositionTabs`, `breadcrumbs`, the `timeline.*Composition` commands);
 * the lanes follow the composition shown (`syncDocumentToMotion`).
 */
export const TimelineCompositionTabs: React.FC = () => {
  const doc = useDocument((d) => d);
  const compositionId = useStore(transportStore, (s) => s.compositionId);
  const trail = useTimelineUiStore((s) => s.trail);
  const openPrecomps = useTimelineUiStore((s) => s.openPrecomps);
  const tabs = useMemo(() => compositionTabs(doc, openPrecomps, compositionId), [doc, openPrecomps, compositionId]);
  const crumbs = useMemo(() => breadcrumbs(doc, trail, compositionId), [doc, trail, compositionId]);

  return (
    <div className="ll:flex ll:flex-col ll:border-b ll:border-border ll:bg-surface-panel">
      <div role="tablist" aria-label="Compositions" className="ll:flex ll:items-center ll:gap-0.5 ll:h-8 ll:px-2 ll:overflow-x-auto">
        {tabs.map((t) => (
          <div
            key={t.id}
            data-composition-tab={t.id}
            className={`ll:flex ll:items-center ll:h-6 ll:rounded-sm ll:shrink-0 ll:transition-colors ${t.active ? "ll:bg-surface-hover ll:text-primary" : "ll:text-secondary ll:hover:text-primary"}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={t.active}
              title={t.trigger || t.name}
              onClick={() => void invokeCommand("timeline.openComposition", { compositionId: t.id })}
              className="ll:flex ll:items-center ll:gap-1.5 ll:px-2 ll:h-6 ll:font-sans ll:text-small ll:whitespace-nowrap"
            >
              <span>{t.name}</span>
              {t.trigger && <span className="ll:text-micro ll:text-muted">{t.trigger}</span>}
            </button>
            {t.closable && (
              <button
                type="button"
                aria-label={`Close ${t.name}`}
                onClick={() => void invokeCommand("timeline.closeComposition", { compositionId: t.id })}
                className="ll:w-5 ll:h-5 ll:mr-0.5 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-segmented"
              >
                <Icon icon={XIcon} size={12} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          title="Make a precomp in this composition"
          onClick={() => void invokeCommand("timeline.addPrecomp", {})}
          className="ll:flex ll:items-center ll:gap-1 ll:h-6 ll:px-2 ll:ml-1 ll:shrink-0 ll:rounded-sm ll:font-sans ll:text-small ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
        >
          <Icon icon={Plus} size={12} />
          <span>Precomp</span>
        </button>
      </div>
      {crumbs.length > 1 && (
        <nav aria-label="Breadcrumbs" className="ll:flex ll:items-center ll:gap-0.5 ll:h-6 ll:px-3 ll:text-small ll:font-sans">
          {crumbs.map((c, i) => (
            <React.Fragment key={c.id}>
              {i > 0 && <Icon icon={ChevronRight} size={12} className="ll:text-muted" />}
              <button
                type="button"
                aria-current={i === crumbs.length - 1 ? "page" : undefined}
                disabled={i === crumbs.length - 1}
                onClick={() => void invokeCommand("timeline.openBreadcrumb", { index: i })}
                className={`ll:px-1 ll:rounded-sm ${i === crumbs.length - 1 ? "ll:text-primary" : "ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover"}`}
              >
                {c.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
      )}
    </div>
  );
};

/** The precomps placed in the composition shown: one row each, a bar with the child's keyframes; double-click or Open opens it. */
export const TimelineNestedRows: React.FC<{ trackWidth: number; pps: number }> = ({ trackWidth, pps }) => {
  const doc = useDocument((d) => d);
  const compositionId = useStore(transportStore, (s) => s.compositionId);
  const fps = useMotionModel((s) => s.fps);
  const t0 = useMotionModel((s) => s.t0);
  const rows = useMemo(() => nestedRows(doc, compositionId), [doc, compositionId]);
  if (rows.length === 0) return null;
  const x = (seconds: number) => X(seconds * fps, pps, t0, 24, fps);

  return (
    <>
      {rows.map((row) => {
        const open = () => void invokeCommand("timeline.openComposition", { compositionId: row.compositionId, fromBar: true });
        const left = x(row.in);
        const width = Math.max(2, x(row.out) - left);
        return (
          <div
            key={row.id}
            data-timeline-nested={row.id}
            style={{ gridTemplateColumns: `var(--hw, ${trackWidth}px) minmax(0, 1fr)` }}
            className="tlrow ll:grid ll:h-8 ll:border-b ll:border-border ll:shrink-0 ll:bg-surface-panel"
          >
            <div className="ll:flex ll:items-center ll:gap-1.5 ll:pl-2 ll:pr-1 ll:border-r ll:border-border ll:min-w-0">
              <Icon icon={Layers} size={12} className="ll:text-secondary" />
              <span className="ll:truncate ll:text-small ll:text-primary" title={row.layers.length > 0 ? `Animates: ${row.layers.join(", ")}` : "Nothing animated yet"}>
                {row.name}
              </span>
              <span className="ll:ml-auto ll:text-micro ll:text-muted ll:whitespace-nowrap">{row.keyTimes.length === 0 ? "empty" : `${row.keyTimes.length} key time${row.keyTimes.length === 1 ? "" : "s"}`}</span>
              <button type="button" aria-label={`Open ${row.name}`} onClick={open} className="ll:px-1.5 ll:h-5 ll:rounded-sm ll:text-micro ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover">
                Open
              </button>
              <button
                type="button"
                aria-label={`Remove ${row.name} from this composition`}
                onClick={() => void invokeCommand("timeline.removeNested", { nestedId: row.id })}
                className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              >
                <Icon icon={XIcon} size={12} />
              </button>
            </div>
            <div className="ll:relative ll:h-full ll:overflow-hidden">
              <div
                data-nested-bar={row.id}
                data-in={row.in}
                data-out={row.out}
                title={`${row.name}: ${row.in.toFixed(3)} s to ${row.out.toFixed(3)} s. Double-click to open.`}
                onDoubleClick={open}
                style={{ left, width }}
                className="ll:absolute ll:top-1 ll:bottom-1 ll:rounded-sm ll:border ll:border-border ll:bg-surface-segmented ll:cursor-pointer"
              >
                <span className="ll:absolute ll:left-2 ll:top-0 ll:bottom-0 ll:flex ll:items-center ll:text-micro ll:text-primary ll:pointer-events-none">{row.name}</span>
                {row.keyTimes.map((t) => (
                  <i key={t} data-nested-key={t} style={{ left: x(t) - left }} className="ll:absolute ll:bottom-0.5 ll:w-1.5 ll:h-1.5 ll:-translate-x-1/2 ll:rotate-45 ll:bg-secondary ll:pointer-events-none" />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

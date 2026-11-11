"use client";

import React, { useMemo } from "react";
import { ChevronRight, Timer } from "lucide-react";
import { useStore } from "zustand";
import { Icon } from "@/editor/components/Icon";
import { useDocument } from "@/core/store/useDocumentStore";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { transportStore } from "@/core/time/transport";
import { buildTimelineItems, type TimelineItem } from "@/core/timeline/model";
import { invokeCommand } from "@/core/commands";

/**
 * ROADMAP Phase 62 in the new timeline: a layer's Properties twirl. It opens into the six groups (Transform,
 * Appearance, Effects, States, Behaviours, Links); Transform and Appearance list their properties in plain words, each
 * with a stopwatch that starts or stops keyframing it (`timeline.setStopwatch`: one keyframe at the playhead holding the
 * current value, one undo step); the other groups list what the layer has. U and UU (core timeline commands) reveal the
 * animated and the modified properties. Everything comes from the engine's `buildTimelineItems`.
 */
export interface TimelineLayerPropertiesProps {
  layerId: string;
  trackWidth: number;
}

const display = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  return String(v);
};

export const TimelineLayerProperties: React.FC<TimelineLayerPropertiesProps> = ({ layerId, trackWidth }) => {
  const doc = useDocument((d) => d);
  const compositionId = useStore(transportStore, (s) => s.compositionId);
  const open = useTimelineUiStore((s) => s.open);
  const reveal = useTimelineUiStore((s) => s.reveal);
  const items = useMemo(() => {
    if (!open.has(layerId) && reveal[layerId] === undefined) return [];
    // the engine lists a layer only under expanded parents: expand this layer's ancestors
    const ancestors = new Set<string>();
    for (let p = doc.layers[layerId]?.parentId; p; p = doc.layers[p]?.parentId) ancestors.add(p);
    return buildTimelineItems(doc, compositionId, ancestors, { open, reveal }).filter((i): i is Exclude<TimelineItem, { kind: "layer" }> => i.kind !== "layer" && i.layerId === layerId);
  }, [doc, compositionId, open, reveal, layerId]);
  if (items.length === 0) return null;

  const row = "ll:grid ll:h-7 ll:border-b ll:border-border ll:bg-surface-panel ll:text-small";
  const cols = { gridTemplateColumns: `var(--hw, ${trackWidth}px) minmax(0, 1fr)` } as React.CSSProperties;

  return (
    <div data-timeline-properties={layerId}>
      {items.map((item) => {
        if (item.kind === "group") {
          const key = `${item.layerId}|${item.group}`;
          return (
            <div key={key} data-timeline-group={key} className={row} style={cols}>
              <button
                type="button"
                aria-expanded={item.open}
                aria-label={`${item.open ? "Close" : "Open"} ${item.label} of ${item.layerName}`}
                onClick={() => useTimelineUiStore.getState().toggleOpen(key)}
                className="ll:flex ll:items-center ll:gap-1 ll:pl-8 ll:pr-2 ll:text-secondary ll:hover:text-primary ll:text-left"
              >
                <Icon icon={ChevronRight} size={12} className={item.open ? "ll:rotate-90" : ""} />
                <span>{item.label}</span>
                {item.count > 0 && <span className="ll:text-micro ll:text-muted">{item.count}</span>}
              </button>
              <div />
            </div>
          );
        }
        if (item.kind === "property") {
          const key = `${item.layerId}|${item.path}`;
          return (
            <div key={key} data-timeline-property={key} data-key-count={item.keys.length} className={row} style={cols}>
              <div className="ll:flex ll:items-center ll:gap-1.5 ll:pl-12 ll:pr-2 ll:min-w-0">
                <button
                  type="button"
                  aria-pressed={item.animated}
                  aria-label={`Animate ${item.label} of ${item.layerName}`}
                  title={item.animated ? "Stop animating (removes its keyframes)" : "Animate from the playhead"}
                  onClick={() => void invokeCommand("timeline.setStopwatch", { layerId: item.layerId, property: item.path, on: !item.animated })}
                  className={`ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${item.animated ? "ll:text-control-active" : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"}`}
                >
                  <Icon icon={Timer} size={12} />
                </button>
                <span className="ll:truncate ll:text-primary">{item.label}</span>
                <span aria-label={`${item.label} value`} className="ll:ml-auto ll:font-mono ll:text-micro ll:text-muted">{display(item.value)}</span>
              </div>
              <div className="ll:flex ll:items-center ll:px-2 ll:text-micro ll:text-muted">{item.keys.length > 0 ? `${item.keys.length} key${item.keys.length === 1 ? "" : "s"}` : ""}</div>
            </div>
          );
        }
        return (
          <div key={`${item.layerId}|${item.group}|${item.label}`} data-timeline-info={`${item.layerId}|${item.group}`} className={row} style={cols}>
            <div className="ll:flex ll:items-center ll:gap-2 ll:pl-12 ll:pr-2 ll:min-w-0">
              <span className="ll:truncate ll:text-primary">{item.label}</span>
              <span className="ll:ml-auto ll:text-micro ll:text-muted">{item.detail}</span>
            </div>
            <div />
          </div>
        );
      })}
    </div>
  );
};

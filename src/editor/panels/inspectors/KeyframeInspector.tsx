"use client";

import React, { useState, useMemo } from "react";
import { Film } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { EasingEditor } from "./EasingEditor";
import { CompositionInspector } from "./CompositionInspector";
import { LayerInspector } from "./LayerInspector";
import {
  useMotionModel,
  motionActions,
  timecode,
  parseTime,
  layerName,
  numStr,
  PROPS,
  type Keyframe,
  type MotionLayer,
  type PropTrack,
  type PropId,
} from "@/editor/motion-model";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import type { KeyframeInspectorProps, CubicBezierCurve } from "./types";

export interface KeyframeActions {
  onDuplicate?: () => void;
  onDelete?: () => void;
  onStretch?: (factor: number) => void;
}

interface TargetKeySelection {
  l: MotionLayer;
  tr: PropTrack;
  k: Keyframe;
}

export const KeyframeInspector: React.FC<KeyframeInspectorProps & KeyframeActions> = ({
  layer: propLayer,
  property: propProperty,
  timecode: propTimecode,
  onTimecodeChange,
  value: propValue,
  onValueChange,
  valueSuffix,
  valuePrefix = "Value",
  duration: propDuration,
  onDurationChange,
  delay: propDelay,
  onDelayChange,
  easing: propEasing,
  onEasingChange,
  bezier: propBezier,
  onBezierChange,
  onDuplicate,
  onDelete,
  onStretch,
  className = "",
  style,
}) => {
  const comp = useMotionModel((s) => s.comp);
  const selectedKeys = useMotionModel((s) => s.selectedKeys);
  const docSelectedId = useSelectionStore((s) => s.selectedId);

  // Find all currently selected keys in the motion model
  const keyTargets = useMemo<TargetKeySelection[]>(() => {
    const list: TargetKeySelection[] = [];
    const selSet = selectedKeys;
    for (const l of comp.layers) {
      for (const tr of l.tr) {
        for (const k of tr.keys) {
          if (selSet[k.id]) {
            list.push({ l, tr, k });
          }
        }
      }
    }
    return list;
  }, [comp, selectedKeys]);

  // Determine active layer (from props, or selection store)
  const activeLayer = useMemo(() => {
    const targetId = propLayer || docSelectedId;
    if (!targetId) return null;
    return comp.layers.find((l) => l.id === targetId || layerName(l.id) === targetId) ?? null;
  }, [comp.layers, propLayer, docSelectedId]);

  // If controlled props like propBezier or propEasing are directly provided without model selection,
  // we treat this as a standalone controlled Keyframe view (e.g. for demos / tests)
  const isDirectControlledKeyframe = Boolean(propBezier || propTimecode || propValue);
  const firstTarget = keyTargets[0];

  // Segment duration between this keyframe and the next
  const segmentDurationSec = useMemo(() => {
    if (!firstTarget) return 1.0;
    const keys = firstTarget.tr.keys;
    const idx = keys.findIndex((k) => k.id === firstTarget.k.id);
    if (idx >= 0 && idx < keys.length - 1) {
      return (keys[idx + 1].t - firstTarget.k.t) / comp.fps;
    }
    return 1.0;
  }, [firstTarget, comp.fps]);

  // If no keys selected and not direct controlled, choose Layer or Composition inspector
  if (!isDirectControlledKeyframe && keyTargets.length === 0) {
    if (activeLayer) {
      return <LayerInspector layer={activeLayer} className={className} />;
    }
    return <CompositionInspector className={className} />;
  }

  // --- Keyframe Inspector View ---
  const isSingleKey = keyTargets.length <= 1;
  const sameLayer = keyTargets.every((s) => s.l.id === firstTarget?.l.id);
  const sameProp = keyTargets.every((s) => s.tr.p === firstTarget?.tr.p);
  const lastOnly =
    keyTargets.length > 0 &&
    keyTargets.every((s) => s.tr.keys[s.tr.keys.length - 1]?.id === s.k.id);

  // Fallback keyframe for direct controlled mode
  const currentKeyframe: Keyframe = firstTarget?.k ?? {
    id: "k0",
    t: 72,
    v: 100,
    ease: "Ease out",
    bz: propBezier ? [propBezier.x1, propBezier.y1, propBezier.x2, propBezier.y2] : undefined,
  };

  const handleKeyframePatch = (patch: Partial<Keyframe>) => {
    if (firstTarget) {
      if (patch.ease) {
        motionActions.setKeyEase(firstTarget.k.id, patch.ease, patch.bz, patch.spring);
      }
      if (patch.v !== undefined) {
        motionActions.setKeyValue(firstTarget.k.id, patch.v);
      }
      if (patch.t !== undefined) {
        motionActions.setKeyTime(firstTarget.k.id, patch.t);
      }
    }
    if (patch.ease && onEasingChange) onEasingChange(patch.ease);
    if (patch.bz && onBezierChange) {
      onBezierChange({
        x1: patch.bz[0],
        y1: patch.bz[1],
        x2: patch.bz[2],
        y2: patch.bz[3],
      });
    }
  };

  // Keyframe Duplicate / Delete / Stretch
  const handleDuplicate = () => {
    if (onDuplicate) {
      onDuplicate();
      return;
    }
    motionActions.duplicateKeys();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      return;
    }
    const ids = keyTargets.map((s) => s.k.id);
    motionActions.deleteKeys(ids);
  };

  const handleStretch = (factor: number) => {
    if (onStretch) {
      onStretch(factor);
      return;
    }
    if (keyTargets.length < 2) return;
    const minT = Math.min(...keyTargets.map((s) => s.k.t));
    for (const s of keyTargets) {
      const nextT = Math.round(minT + (s.k.t - minT) * factor);
      motionActions.setKeyTime(s.k.id, nextT);
    }
  };

  // Header title
  const headerTitle =
    keyTargets.length > 1 ? `${keyTargets.length} keyframes` : "Keyframe";

  // Layer & Property names
  const layerLabel = propLayer ?? (sameLayer && firstTarget ? layerName(firstTarget.l.id) : "Mixed");
  const propSpec = firstTarget ? PROPS[firstTarget.tr.p] : null;
  const propertyLabel = propProperty ?? (sameProp && propSpec ? propSpec.n : "Mixed");

  // Timing At and Value
  const atTimeStr = propTimecode ?? (firstTarget ? timecode(firstTarget.k.t, comp.fps) : "00:01.20");
  const valStr = propValue ?? (firstTarget ? numStr(firstTarget.k.v) : "100");
  const valUnit = valueSuffix ?? (propSpec ? propSpec.u : "%");

  // Clip Delay & Duration
  const clipObj = firstTarget?.l.clips[0] ?? { s: 0, e: comp.dur };
  const clipDelayStr = propDelay ?? timecode(clipObj.s, comp.fps);
  const clipDurStr = propDuration ?? timecode(clipObj.e - clipObj.s, comp.fps);

  // Selection min and max times
  const minTime = keyTargets.length ? Math.min(...keyTargets.map((s) => s.k.t)) : 0;
  const maxTime = keyTargets.length ? Math.max(...keyTargets.map((s) => s.k.t)) : 0;

  return (
    <div
      id="ins-key"
      role="region"
      aria-label="Keyframe Inspector"
      className={`ll-keyframe-inspector ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
      style={style}
    >
      {/* Header: Film icon + "Keyframe" */}
      <div className="ll-rtop ll:flex ll:items-center ll:gap-2 ll:px-4 ll:h-11 ll:border-b ll:border-border ll:shrink-0 ll:min-w-0">
        <Icon icon={Film} size={16} className="ll-rico ll:text-muted ll:shrink-0" />
        <span className="ll-rname ll:text-heading ll:font-semibold ll:text-primary ll:truncate">
          {headerTitle}
        </span>
      </div>

      {/* 1. Easing Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border ll:first:border-t-0">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Easing</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {lastOnly ? (
            <div className="ll:text-micro ll:text-muted ll:py-1">
              The last keyframe has no segment to ease.
            </div>
          ) : (
            <EasingEditor
              keyframe={currentKeyframe}
              onKeyframeChange={handleKeyframePatch}
              segmentDurationSec={segmentDurationSec}
            />
          )}
        </div>
      </section>

      {/* 2. Target Section (read-only) */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Target</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:rounded-sm">
            <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
              Layer
            </span>
            <input
              type="text"
              aria-label="Layer"
              value={layerLabel}
              readOnly
              className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-secondary ll:p-0"
            />
          </div>

          <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:rounded-sm">
            <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
              Property
            </span>
            <input
              type="text"
              aria-label="Property"
              value={propertyLabel}
              readOnly
              className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-secondary ll:p-0"
            />
          </div>
        </div>
      </section>

      {/* 3. Timing Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">
            {isSingleKey ? "Timing" : "Selection"}
          </h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {isSingleKey ? (
            <div className="ll:grid ll:grid-cols-2 ll:gap-2">
              <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm">
                <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                  At
                </span>
                <input
                  type="text"
                  aria-label="Time"
                  defaultValue={atTimeStr}
                  onBlur={(e) => {
                    const f = parseTime(e.target.value, comp.fps);
                    if (!isNaN(f) && firstTarget) {
                      motionActions.setKeyTime(firstTarget.k.id, f);
                    }
                    onTimecodeChange?.(e.target.value);
                  }}
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                />
              </div>

              {sameProp && (
                <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm">
                  <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                    {valuePrefix}
                  </span>
                  <input
                    type="text"
                    aria-label="Value"
                    defaultValue={valStr}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && firstTarget) {
                        motionActions.setKeyValue(firstTarget.k.id, v);
                      }
                      onValueChange?.(e.target.value);
                    }}
                    className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                  />
                  <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                    {valUnit}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="ll:grid ll:grid-cols-2 ll:gap-2">
              <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:rounded-sm">
                <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                  From
                </span>
                <input
                  type="text"
                  aria-label="First keyframe"
                  value={timecode(minTime, comp.fps)}
                  readOnly
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-secondary ll:p-0"
                />
              </div>

              <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:rounded-sm">
                <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                  To
                </span>
                <input
                  type="text"
                  aria-label="Last keyframe"
                  value={timecode(maxTime, comp.fps)}
                  readOnly
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-secondary ll:p-0"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Clip Section (if same layer) */}
      {sameLayer && (
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
          <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
            <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Clip</h3>
          </div>
          <div className="ll-dbody ll:grid ll:grid-cols-2 ll:gap-2">
            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm">
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                Delay
              </span>
              <input
                type="text"
                aria-label="Clip delay"
                defaultValue={clipDelayStr}
                onBlur={(e) => {
                  const f = parseTime(e.target.value, comp.fps);
                  if (!isNaN(f) && firstTarget) {
                    motionActions.moveClip(firstTarget.l.id, 0, f);
                  }
                  onDelayChange?.(e.target.value);
                }}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>

            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm">
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                Duration
              </span>
              <input
                type="text"
                aria-label="Clip duration"
                defaultValue={clipDurStr}
                onBlur={(e) => {
                  const dur = parseTime(e.target.value, comp.fps);
                  if (!isNaN(dur) && dur > 0 && firstTarget) {
                    motionActions.trimClip(firstTarget.l.id, 0, "e", clipObj.s + dur);
                  }
                  onDurationChange?.(e.target.value);
                }}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
          </div>
        </section>
      )}

      {/* 5. Keyframes Section (actions) */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Keyframes</h3>
        </div>
        <div className="ll-dbody ll:grid ll:grid-cols-2 ll:gap-2">
          <button
            type="button"
            onClick={handleDuplicate}
            className="ll:h-7 ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:transition-colors"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="ll:h-7 ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => handleStretch(0.9)}
            disabled={isSingleKey}
            className="ll:h-7 ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:disabled:opacity-45 ll:disabled:cursor-default ll:transition-colors"
          >
            Stretch 0.9×
          </button>
          <button
            type="button"
            onClick={() => handleStretch(1.1)}
            disabled={isSingleKey}
            className="ll:h-7 ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:disabled:opacity-45 ll:disabled:cursor-default ll:transition-colors"
          >
            Stretch 1.1×
          </button>
        </div>
      </section>
    </div>
  );
};

export default KeyframeInspector;

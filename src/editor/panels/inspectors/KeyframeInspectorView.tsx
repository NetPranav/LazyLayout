"use client";

import React from "react";
import { Film } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { RightPanelSection } from "@/editor/shell/right-panel/RightPanelSection";
import { EasingEditor } from "./EasingEditor";
import {
  useMotionModel,
  motionActions,
  PROPS,
  timecode,
  layerName,
} from "@/editor/motion-model";
import type { Keyframe, MotionLayer, PropTrack, EaseName, Bezier, SpringParams } from "@/editor/motion-model";

export interface SelectedKeyframeContext {
  layer: MotionLayer;
  track: PropTrack;
  keyframe: Keyframe;
}

export interface KeyframeInspectorViewProps {
  selectedKeyContexts: SelectedKeyframeContext[];
  className?: string;
}

export const KeyframeInspectorView: React.FC<KeyframeInspectorViewProps> = ({
  selectedKeyContexts,
  className = "",
}) => {
  const fps = useMotionModel((s) => s.fps);
  const compDur = useMotionModel((s) => s.comp.dur);

  if (selectedKeyContexts.length === 0) return null;

  const isSingle = selectedKeyContexts.length === 1;
  const first = selectedKeyContexts[0];
  const sameLayer = selectedKeyContexts.every((s) => s.layer.id === first.layer.id);
  const sameProp = selectedKeyContexts.every((s) => s.track.p === first.track.p);

  const times = selectedKeyContexts.map((s) => s.keyframe.t);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const clip = sameLayer ? first.layer.clips[0] : null;

  const handleDuplicate = () => {
    motionActions.duplicateKeys();
  };

  const handleDelete = () => {
    const ids = selectedKeyContexts.map((s) => s.keyframe.id);
    motionActions.deleteKeys(ids);
  };

  const handleStretch = (factor: number) => {
    if (selectedKeyContexts.length <= 1) return;
    const baseT = minTime;
    for (const ctx of selectedKeyContexts) {
      const nextT = Math.round(baseT + (ctx.keyframe.t - baseT) * factor);
      motionActions.setKeyTime(ctx.keyframe.id, nextT);
    }
  };

  const handleEaseChange = (ease: EaseName, bz?: Bezier, spring?: SpringParams) => {
    for (const ctx of selectedKeyContexts) {
      motionActions.setKeyEase(ctx.keyframe.id, ease, bz, spring);
    }
  };

  return (
    <div className={`ll:flex ll:flex-col ll:w-full ${className}`}>
      {/* Top Header */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <Icon icon={Film} size={18} className="ll:text-primary" />
        <h2 className="ll:text-headline ll:font-semibold ll:text-primary ll:truncate ll:m-0">
          {isSingle ? "Keyframe" : `${selectedKeyContexts.length} keyframes`}
        </h2>
      </div>

      {/* Easing Editor Section */}
      <RightPanelSection title="Easing">
        <EasingEditor
          keyframe={first.keyframe}
          onChangeEase={handleEaseChange}
        />
      </RightPanelSection>

      {/* Target Section */}
      <RightPanelSection title="Target">
        <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:w-16 ll:shrink-0 ll:text-small ll:text-muted ll:font-sans">Layer</span>
            <div className="ll:flex-1 ll:min-w-0 ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm">
              <span className="ll:font-sans ll:text-caption ll:text-secondary ll:truncate">
                {sameLayer ? layerName(first.layer.id) : "Mixed"}
              </span>
            </div>
          </div>

          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:w-16 ll:shrink-0 ll:text-small ll:text-muted ll:font-sans">Property</span>
            <div className="ll:flex-1 ll:min-w-0 ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm">
              <span className="ll:font-sans ll:text-caption ll:text-secondary ll:truncate">
                {sameProp ? PROPS[first.track.p]?.n ?? first.track.p : "Mixed"}
              </span>
            </div>
          </div>
        </div>
      </RightPanelSection>

      {/* Timing or Selection Section */}
      {isSingle ? (
        <RightPanelSection title="Timing">
          <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
            <div className="ll:flex ll:flex-col ll:gap-1">
              <span className="ll:text-caption ll:text-muted">At</span>
              <div className="ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm">
                <input
                  type="text"
                  value={timecode(first.keyframe.t, fps)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = parseInt(raw, 10);
                    if (!isNaN(parsed)) {
                      motionActions.setKeyTime(first.keyframe.id, parsed);
                    }
                  }}
                  className="ll:w-full ll:bg-transparent ll:border-none ll:outline-none ll:font-mono ll:text-caption ll:text-primary"
                />
              </div>
            </div>

            {sameProp && (
              <div className="ll:flex ll:flex-col ll:gap-1">
                <span className="ll:text-caption ll:text-muted">Value</span>
                <div className="ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:gap-1">
                  <input
                    type="number"
                    value={first.keyframe.v}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) {
                        motionActions.setKeyValue(first.keyframe.id, v);
                      }
                    }}
                    className="ll:w-full ll:bg-transparent ll:border-none ll:outline-none ll:font-mono ll:text-caption ll:text-primary"
                  />
                  <span className="ll:font-mono ll:text-caption ll:text-muted">
                    {PROPS[first.track.p]?.u}
                  </span>
                </div>
              </div>
            )}
          </div>
        </RightPanelSection>
      ) : (
        <RightPanelSection title="Selection">
          <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
            <div className="ll:flex ll:flex-col ll:gap-1">
              <span className="ll:text-caption ll:text-muted">From</span>
              <div className="ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm">
                <span className="ll:font-mono ll:text-caption ll:text-primary">
                  {timecode(minTime, fps)}
                </span>
              </div>
            </div>
            <div className="ll:flex ll:flex-col ll:gap-1">
              <span className="ll:text-caption ll:text-muted">To</span>
              <div className="ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm">
                <span className="ll:font-mono ll:text-caption ll:text-primary">
                  {timecode(maxTime, fps)}
                </span>
              </div>
            </div>
          </div>
        </RightPanelSection>
      )}

      {/* Clip Section (if same layer) */}
      {clip && (
        <RightPanelSection title="Clip">
          <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
            <div className="ll:flex ll:flex-col ll:gap-1">
              <span className="ll:text-caption ll:text-muted">Delay</span>
              <div className="ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm">
                <span className="ll:font-mono ll:text-caption ll:text-primary">
                  {timecode(clip.s, fps)}
                </span>
              </div>
            </div>
            <div className="ll:flex ll:flex-col ll:gap-1">
              <span className="ll:text-caption ll:text-muted">Duration</span>
              <div className="ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm">
                <span className="ll:font-mono ll:text-caption ll:text-primary">
                  {timecode(clip.e - clip.s, fps)}
                </span>
              </div>
            </div>
          </div>
        </RightPanelSection>
      )}

      {/* Keyframes Action Buttons */}
      <RightPanelSection title="Keyframes">
        <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
          <button
            type="button"
            onClick={handleDuplicate}
            className="ll:h-7 ll:px-3 ll:border ll:border-border ll:rounded-sm ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-bar ll:font-sans ll:text-small ll:font-medium ll:cursor-pointer"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="ll:h-7 ll:px-3 ll:border ll:border-border ll:rounded-sm ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-bar ll:font-sans ll:text-small ll:font-medium ll:cursor-pointer"
          >
            Delete
          </button>
          <button
            type="button"
            disabled={isSingle}
            onClick={() => handleStretch(0.9)}
            className="ll:h-7 ll:px-3 ll:border ll:border-border ll:rounded-sm ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-bar ll:font-sans ll:text-small ll:font-medium ll:disabled:opacity-30 ll:cursor-pointer"
          >
            Stretch 0.9×
          </button>
          <button
            type="button"
            disabled={isSingle}
            onClick={() => handleStretch(1.1)}
            className="ll:h-7 ll:px-3 ll:border ll:border-border ll:rounded-sm ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-bar ll:font-sans ll:text-small ll:font-medium ll:disabled:opacity-30 ll:cursor-pointer"
          >
            Stretch 1.1×
          </button>
        </div>
      </RightPanelSection>
    </div>
  );
};

export default KeyframeInspectorView;

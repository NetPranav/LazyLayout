"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { TimelinePanelProps, TimelineViewMode } from "./types";
import { useTimelineAnimation } from "./useTimelineAnimation";
import { TimelineTransport } from "./TimelineTransport";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineLane } from "./TimelineLane";
import { TimelinePlayhead } from "./TimelinePlayhead";
import { TimelineCurveGraph } from "./TimelineCurveGraph";
import {
  TIMELINE_MIN_PADDING_RIGHT_PX,
  TIMELINE_ZOOM_MIN_PPS,
  TIMELINE_ZOOM_MAX_PPS,
  TIMELINE_ZOOM_STEP_FACTOR,
} from "./constants";

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  tracks: controlledTracks,
  selectedTrackId: controlledSelectedTrackId,
  onSelectTrack: controlledOnSelectTrack,
  selectedKeyframeId: controlledSelectedKfId,
  onSelectKeyframe: controlledOnSelectKf,
  onAddKeyframe: controlledOnAddKf,
  onUpdateKeyframeTime: controlledOnUpdateKfTime,
  onDeleteKeyframe: controlledOnDeleteKf,
  onSlideClip: controlledOnSlideClip,
  height = "var(--ll-size-bottom-motion-h)",
  className = "",
  style,
  onExport,
  onOpenPresets,
}) => {
  const [viewMode, setViewMode] = useState<TimelineViewMode>("tracks");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  const {
    isPlaying,
    duration,
    isLooping,
    pixelsPerSecond,
    formattedCurrentTime,
    formattedDuration,
    tracks,
    selectedTrackId,
    selectedKeyframeId,
    playheadNeedleRef,
    handleTogglePlay,
    handleStop,
    handleStepBack,
    handleStepForward,
    handleToggleLoop,
    handleSeek,
    handleZoomIn,
    handleZoomOut,
    handleSetZoom,
    handleSelectTrack,
    handleSelectKeyframe,
    handleAddKeyframe,
    handleUpdateKeyframeTime,
    handleDeleteKeyframe: _handleDeleteKeyframe,
    handleDeleteSelected,
    handleSlideClip,
  } = useTimelineAnimation({
    tracks: controlledTracks,
    selectedTrackId: controlledSelectedTrackId,
    onSelectTrack: controlledOnSelectTrack,
    selectedKeyframeId: controlledSelectedKfId,
    onSelectKeyframe: controlledOnSelectKf,
    onAddKeyframe: controlledOnAddKf,
    onUpdateKeyframeTime: controlledOnUpdateKfTime,
    onDeleteKeyframe: controlledOnDeleteKf,
    onSlideClip: controlledOnSlideClip,
    onExport,
    onOpenPresets,
  });

  // Track container width for horizontal scroll canvas sizing
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(el.clientWidth);
    };

    updateWidth();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateWidth)
        : null;
    observer?.observe(el);

    return () => {
      observer?.disconnect();
    };
  }, []);

  // Ctrl + Wheel to zoom horizontally around pointer
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const factor =
        e.deltaY < 0 ? TIMELINE_ZOOM_STEP_FACTOR : 1 / TIMELINE_ZOOM_STEP_FACTOR;
      const nextPps = Math.max(
        TIMELINE_ZOOM_MIN_PPS,
        Math.min(TIMELINE_ZOOM_MAX_PPS, pixelsPerSecond * factor)
      );

      handleSetZoom(nextPps);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [handleSetZoom, pixelsPerSecond]);

  // Keyboard navigation & shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Do not intercept when inside input fields
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === " ") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "Home" || e.key === "0") {
        e.preventDefault();
        handleStop();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleStepBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleStepForward();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        handleDeleteSelected();
      } else if (e.key === "Escape") {
        handleSelectKeyframe(null);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key.toLowerCase() === "k") {
        handleTogglePlay();
      } else if (e.key.toLowerCase() === "j") {
        handleStepBack();
      } else if (e.key.toLowerCase() === "l") {
        handleStepForward();
      }
    },
    [
      handleDeleteSelected,
      handleSelectKeyframe,
      handleStepBack,
      handleStepForward,
      handleStop,
      handleTogglePlay,
      handleZoomIn,
      handleZoomOut,
    ]
  );

  const contentWidth = Math.max(
    containerWidth,
    duration * pixelsPerSecond + TIMELINE_MIN_PADDING_RIGHT_PX
  );

  return (
    <section
      id="bottom"
      role="region"
      aria-label="Timeline workstation"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ height, ...style }}
      className={`ll-timeline ll-bottom ll:flex ll:flex-col ll:border-t ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:select-none ll:min-w-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${className}`}
    >
      {/* 44px Transport Header */}
      <TimelineTransport
        isPlaying={isPlaying}
        isLooping={isLooping}
        currentTimeFormatted={formattedCurrentTime}
        durationFormatted={formattedDuration}
        viewMode={viewMode}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onStepBack={handleStepBack}
        onStepForward={handleStepForward}
        onToggleLoop={handleToggleLoop}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleGraph={() =>
          setViewMode((prev) => (prev === "tracks" ? "graph" : "tracks"))
        }
        onPresets={onOpenPresets}
        onExport={onExport}
        onAddKeyframe={() => handleAddKeyframe(selectedTrackId)}
      />

      {/* Main Body */}
      {viewMode === "graph" ? (
        <TimelineCurveGraph
          onClose={() => setViewMode("tracks")}
          onApplyEase={(_ease) => {
            if (selectedKeyframeId) {
              // Apply easing to selected keyframe
              handleUpdateKeyframeTime(
                selectedTrackId,
                selectedKeyframeId,
                // keep current time
                tracks
                  .find((t) => t.id === selectedTrackId)
                  ?.keyframes.find((k) => k.id === selectedKeyframeId)?.time || 0
              );
            }
          }}
        />
      ) : (
        <div
          ref={scrollContainerRef}
          className="ll-bb ll:flex-1 ll:min-h-0 ll:relative ll:overflow-x-auto ll:overflow-y-hidden"
        >
          {/* Internal scrollable canvas */}
          <div
            style={{ width: `${contentWidth}px` }}
            className="ll:relative ll:min-h-full"
          >
            {/* 24px Time Ruler */}
            <TimelineRuler
              duration={duration}
              pixelsPerSecond={pixelsPerSecond}
              contentWidth={contentWidth}
              onSeek={handleSeek}
            />

            {/* Track Lanes */}
            <div role="rowgroup" className="ll:flex ll:flex-col">
              {tracks.map((track) => (
                <TimelineLane
                  key={track.id}
                  track={track}
                  pixelsPerSecond={pixelsPerSecond}
                  contentWidth={contentWidth}
                  duration={duration}
                  isSelectedTrack={track.id === selectedTrackId}
                  selectedKeyframeId={selectedKeyframeId}
                  onSelectTrack={handleSelectTrack}
                  onSelectKeyframe={handleSelectKeyframe}
                  onUpdateKeyframeTime={handleUpdateKeyframeTime}
                  onAddKeyframe={handleAddKeyframe}
                  onSlideClip={handleSlideClip}
                  onSeek={handleSeek}
                />
              ))}
            </div>

            {/* Playhead Indicator (60fps painted via scheduler without React re-renders) */}
            <TimelinePlayhead
              ref={playheadNeedleRef}
              duration={duration}
              pixelsPerSecond={pixelsPerSecond}
              onSeek={handleSeek}
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default TimelinePanel;

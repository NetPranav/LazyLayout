"use client";

import React, { useRef, useCallback } from "react";
import type { TimelineTrack, TimelineKeyframe } from "./types";
import {
  TIMELINE_ROW_HEIGHT_PX,
  CLIP_HEIGHT_PX,
  CLIP_TOP_PX,
  KEYFRAME_SIZE_PX,
  KEYFRAME_SELECTED_SIZE_PX,
  KEYFRAME_ROTATION_DEG,
  FRAME_SNAP_FPS,
} from "./constants";

export interface TimelineLaneProps {
  track: TimelineTrack;
  pixelsPerSecond: number;
  contentWidth: number;
  duration: number;
  isSelectedTrack: boolean;
  selectedKeyframeId: string | null;
  onSelectTrack: (trackId: string) => void;
  onSelectKeyframe: (kfId: string | null, trackId?: string) => void;
  onUpdateKeyframeTime: (trackId: string, kfId: string, newTime: number) => void;
  onAddKeyframe: (trackId: string, timeSec: number) => void;
  onSlideClip?: (trackId: string, deltaSec: number) => void;
  onSeek: (timeSec: number) => void;
}

export const TimelineLane: React.FC<TimelineLaneProps> = ({
  track,
  pixelsPerSecond,
  contentWidth,
  duration,
  isSelectedTrack,
  selectedKeyframeId,
  onSelectTrack,
  onSelectKeyframe,
  onUpdateKeyframeTime,
  onAddKeyframe,
  onSlideClip,
  onSeek,
}) => {
  const laneRef = useRef<HTMLDivElement | null>(null);

  // Keyframe mouse drag to retime
  const handleKeyframePointerDown = useCallback(
    (e: React.PointerEvent, kf: TimelineKeyframe) => {
      e.stopPropagation();
      e.preventDefault();

      onSelectKeyframe(kf.id, track.id);

      const startClientX = e.clientX;
      const initialTime = kf.time;

      const handlePointerMove = (ev: PointerEvent) => {
        const deltaPx = ev.clientX - startClientX;
        const deltaSec = deltaPx / pixelsPerSecond;
        const rawTime = Math.max(0, Math.min(duration, initialTime + deltaSec));
        const snapped = Math.round(rawTime * FRAME_SNAP_FPS) / FRAME_SNAP_FPS;
        onUpdateKeyframeTime(track.id, kf.id, snapped);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [duration, onSelectKeyframe, onUpdateKeyframeTime, pixelsPerSecond, track.id]
  );

  // Clip drag to slide
  const handleClipPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      onSelectTrack(track.id);

      if (!onSlideClip || !track.clip) return;

      const startClientX = e.clientX;
      let lastDeltaSec = 0;

      const handlePointerMove = (ev: PointerEvent) => {
        const deltaPx = ev.clientX - startClientX;
        const deltaSec = deltaPx / pixelsPerSecond;
        const step = deltaSec - lastDeltaSec;
        lastDeltaSec = deltaSec;
        onSlideClip(track.id, step);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [onSelectTrack, onSlideClip, pixelsPerSecond, track.clip, track.id]
  );

  // Double-click on lane to insert a new keyframe
  const handleLaneDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!laneRef.current) return;
      const rect = laneRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const time = Math.max(0, Math.min(duration, clickX / pixelsPerSecond));
      const snapped = Math.round(time * FRAME_SNAP_FPS) / FRAME_SNAP_FPS;
      onAddKeyframe(track.id, snapped);
    },
    [duration, onAddKeyframe, pixelsPerSecond, track.id]
  );

  // Single click on empty lane: select track and seek playhead
  const handleLanePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !laneRef.current) return;
      onSelectTrack(track.id);
      const rect = laneRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const time = Math.max(0, Math.min(duration, clickX / pixelsPerSecond));
      onSeek(time);
    },
    [duration, onSeek, onSelectTrack, pixelsPerSecond, track.id]
  );

  const clip = track.clip;
  const clipLeft = clip ? clip.start * pixelsPerSecond : 0;
  const clipWidth = clip ? clip.duration * pixelsPerSecond : 0;

  return (
    <div
      ref={laneRef}
      role="row"
      data-track-id={track.id}
      aria-label={`${track.name} lane`}
      onPointerDown={handleLanePointerDown}
      onDoubleClick={handleLaneDoubleClick}
      style={{
        height: `${TIMELINE_ROW_HEIGHT_PX}px`,
        width: `${contentWidth}px`,
      }}
      className={`ll-lane ll:relative ll:h-row ll:border-b ll:border-border/40 ll:select-none ll:cursor-pointer ll:transition-none ${
        isSelectedTrack
          ? "ll:bg-surface-raised/50"
          : "ll:hover:bg-surface-hover/25"
      }`}
    >
      {/* Clip Bar */}
      {clip && (
        <div
          data-clip-id={clip.id}
          onPointerDown={handleClipPointerDown}
          style={{
            left: `${clipLeft}px`,
            width: `${Math.max(16, clipWidth)}px`,
            height: `${CLIP_HEIGHT_PX}px`,
            top: `${CLIP_TOP_PX}px`,
          }}
          title={`${clip.name || track.name}: ${clip.start.toFixed(2)}s - ${(
            clip.start + clip.duration
          ).toFixed(2)}s`}
          className="ll-clip ll:absolute ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:cursor-grab ll:flex ll:items-center ll:px-2 ll:overflow-hidden ll:box-border"
        >
          <span className="ll:text-nano ll:font-medium ll:text-muted ll:truncate ll:pointer-events-none">
            {clip.name || track.name}
          </span>
        </div>
      )}

      {/* Keyframe Diamonds */}
      {track.keyframes.map((kf) => {
        const isSelected = selectedKeyframeId === kf.id;
        const size = isSelected
          ? KEYFRAME_SELECTED_SIZE_PX
          : KEYFRAME_SIZE_PX;
        const offset = size / 2;
        const leftPixel = kf.time * pixelsPerSecond - offset;
        const topPixel = isSelected ? 11 : 12;

        return (
          <button
            key={kf.id}
            type="button"
            role="button"
            data-keyframe-id={kf.id}
            aria-label={`${track.name} keyframe at ${kf.time.toFixed(2)}s`}
            aria-pressed={isSelected}
            title={`${track.name}: ${String(kf.value ?? "value")} @ ${kf.time.toFixed(
              2
            )}s`}
            onPointerDown={(e) => handleKeyframePointerDown(e, kf)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectKeyframe(kf.id, track.id);
            }}
            style={{
              left: `${leftPixel}px`,
              top: `${topPixel}px`,
              width: `${size}px`,
              height: `${size}px`,
              transform: `rotate(${KEYFRAME_ROTATION_DEG}deg)`,
            }}
            className={`ll-kf ll:absolute ll:bg-control-primary ll:cursor-grab ll:transition-none ll:p-0 ll:border-0 ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${
              isSelected
                ? "ll-kf-sel ll:ring-2 ll:ring-primary"
                : "ll:hover:scale-125"
            }`}
          />
        );
      })}
    </div>
  );
};

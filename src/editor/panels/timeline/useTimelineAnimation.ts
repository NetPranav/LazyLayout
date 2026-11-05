"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useStore } from "zustand";
import {
  transportStore,
  transport,
  formatTimecode,
  snapToFrame,
  getTransport,
} from "@/core/time/transport";
import { useTransportTime } from "@/core/time/useTransportTime";
import { frameScheduler } from "@/core/time/scheduler";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import {
  DEFAULT_SAMPLE_TRACKS,
  TIMELINE_DEFAULT_DURATION_SEC,
  TIMELINE_DEFAULT_FPS,
  TIMELINE_DEFAULT_PPS,
  TIMELINE_ZOOM_MIN_PPS,
  TIMELINE_ZOOM_MAX_PPS,
  TIMELINE_ZOOM_STEP_FACTOR,
  FRAME_SNAP_FPS,
} from "./constants";
import type {
  TimelineTrack,
  TimelineKeyframe,
  TimelinePanelProps,
} from "./types";

export function useTimelineAnimation(props: TimelinePanelProps) {
  // Transport playback state
  const isPlaying = useStore(transportStore, (t) => t.playing);
  const duration = useStore(
    transportStore,
    (t) => t.duration || TIMELINE_DEFAULT_DURATION_SEC
  );
  const fps = useStore(transportStore, (t) => t.fps || TIMELINE_DEFAULT_FPS);
  const isLooping = useStore(transportStore, (t) => t.loop !== "off");

  // React throttled time for text readout (10Hz max to prevent re-render load)
  const currentTransportTime = useTransportTime({ maxHz: 10 });

  // Zoom state: synchronised with useTimelineUiStore
  const storePps = useTimelineUiStore((s) => s.pixelsPerSecond);
  const setStoreZoom = useTimelineUiStore((s) => s.setZoom);
  const pixelsPerSecond = storePps || TIMELINE_DEFAULT_PPS;

  // Uncontrolled fallback state for tracks
  const [internalTracks, setInternalTracks] = useState<TimelineTrack[]>(() =>
    DEFAULT_SAMPLE_TRACKS.map((t) => ({
      ...t,
      keyframes: [...t.keyframes],
      clip: t.clip ? { ...t.clip } : undefined,
    }))
  );

  const [internalSelectedTrackId, setInternalSelectedTrackId] = useState<string>(
    DEFAULT_SAMPLE_TRACKS[0]?.id || "headline"
  );
  const [internalSelectedKfId, setInternalSelectedKfId] = useState<
    string | null
  >("kf-2");

  // Active track and keyframe selection
  const activeTracks = props.tracks || internalTracks;
  const activeSelectedTrackId =
    props.selectedTrackId !== undefined
      ? props.selectedTrackId
      : internalSelectedTrackId;
  const activeSelectedKfId =
    props.selectedKeyframeId !== undefined
      ? props.selectedKeyframeId
      : internalSelectedKfId;

  // Playhead DOM ref for 60fps scheduler painting (React never owns this style)
  const playheadNeedleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let lastTime = Number.NaN;
    const paint = () => {
      const cur = getTransport().time;
      if (cur === lastTime) return;
      lastTime = cur;
      const el = playheadNeedleRef.current;
      if (el) {
        const x = Math.min(cur, duration) * pixelsPerSecond;
        el.style.transform = `translateX(${x}px)`;
      }
    };
    paint();
    return frameScheduler.register("render", paint);
  }, [duration, pixelsPerSecond]);

  // Track selection handler
  const handleSelectTrack = useCallback(
    (trackId: string) => {
      if (props.onSelectTrack) {
        props.onSelectTrack(trackId);
      } else {
        setInternalSelectedTrackId(trackId);
      }
    },
    [props]
  );

  // Keyframe selection handler
  const handleSelectKeyframe = useCallback(
    (kfId: string | null, trackId?: string) => {
      if (props.onSelectKeyframe) {
        props.onSelectKeyframe(kfId, trackId);
      } else {
        setInternalSelectedKfId(kfId);
        if (trackId) setInternalSelectedTrackId(trackId);
      }
    },
    [props]
  );

  // Transport actions
  const handleTogglePlay = useCallback(() => {
    transport.togglePlay();
  }, []);

  const handleStop = useCallback(() => {
    transport.stop();
  }, []);

  const handleStepBack = useCallback(() => {
    transport.stepFrame(-1);
  }, []);

  const handleStepForward = useCallback(() => {
    transport.stepFrame(1);
  }, []);

  const handleToggleLoop = useCallback(() => {
    const current = getTransport().loop;
    transport.setLoop(current === "off" ? "loop" : "off");
  }, []);

  const handleSeek = useCallback(
    (timeSec: number) => {
      const clamped = Math.max(0, Math.min(timeSec, duration));
      const snapped = snapToFrame(clamped, fps);
      transport.seek(snapped);
    },
    [duration, fps]
  );

  // Zoom actions
  const handleZoomIn = useCallback(() => {
    const next = Math.min(
      TIMELINE_ZOOM_MAX_PPS,
      pixelsPerSecond * TIMELINE_ZOOM_STEP_FACTOR
    );
    setStoreZoom(next);
  }, [pixelsPerSecond, setStoreZoom]);

  const handleZoomOut = useCallback(() => {
    const next = Math.max(
      TIMELINE_ZOOM_MIN_PPS,
      pixelsPerSecond / TIMELINE_ZOOM_STEP_FACTOR
    );
    setStoreZoom(next);
  }, [pixelsPerSecond, setStoreZoom]);

  const handleSetZoom = useCallback(
    (newPps: number) => {
      const clamped = Math.max(
        TIMELINE_ZOOM_MIN_PPS,
        Math.min(TIMELINE_ZOOM_MAX_PPS, newPps)
      );
      setStoreZoom(clamped);
    },
    [setStoreZoom]
  );

  // Add Keyframe
  const handleAddKeyframe = useCallback(
    (trackId: string, timeSec?: number) => {
      const targetTime =
        timeSec !== undefined
          ? timeSec
          : Math.round(getTransport().time * FRAME_SNAP_FPS) / FRAME_SNAP_FPS;

      if (props.onAddKeyframe) {
        props.onAddKeyframe(trackId, targetTime);
        return;
      }

      const newId = `kf-${Date.now()}`;
      setInternalTracks((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t;
          const newKf: TimelineKeyframe = {
            id: newId,
            time: targetTime,
            value: "default",
            ease: "power2.out",
          };
          const nextKeys = [...t.keyframes, newKf].sort(
            (a, b) => a.time - b.time
          );
          return { ...t, keyframes: nextKeys };
        })
      );
      setInternalSelectedKfId(newId);
    },
    [props]
  );

  // Update Keyframe time (dragged / retimed)
  const handleUpdateKeyframeTime = useCallback(
    (trackId: string, kfId: string, newTime: number) => {
      const snapped = Math.round(newTime * FRAME_SNAP_FPS) / FRAME_SNAP_FPS;
      const clamped = Math.max(0, Math.min(duration, snapped));

      if (props.onUpdateKeyframeTime) {
        props.onUpdateKeyframeTime(trackId, kfId, clamped);
        return;
      }

      setInternalTracks((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t;
          const updated = t.keyframes
            .map((k) => (k.id === kfId ? { ...k, time: clamped } : k))
            .sort((a, b) => a.time - b.time);
          return { ...t, keyframes: updated };
        })
      );
    },
    [duration, props]
  );

  // Delete keyframe
  const handleDeleteKeyframe = useCallback(
    (trackId: string, kfId: string) => {
      if (props.onDeleteKeyframe) {
        props.onDeleteKeyframe(trackId, kfId);
        return;
      }

      setInternalTracks((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t;
          return {
            ...t,
            keyframes: t.keyframes.filter((k) => k.id !== kfId),
          };
        })
      );
      if (internalSelectedKfId === kfId) {
        setInternalSelectedKfId(null);
      }
    },
    [internalSelectedKfId, props]
  );

  // Slide clip
  const handleSlideClip = useCallback(
    (trackId: string, deltaSec: number) => {
      if (props.onSlideClip) {
        props.onSlideClip(trackId, deltaSec);
        return;
      }

      setInternalTracks((prev) =>
        prev.map((t) => {
          if (t.id !== trackId || !t.clip) return t;
          const nextStart = Math.max(
            0,
            Math.min(duration - t.clip.duration, t.clip.start + deltaSec)
          );
          return {
            ...t,
            clip: { ...t.clip, start: nextStart },
          };
        })
      );
    },
    [duration, props]
  );

  // Delete currently selected keyframe
  const handleDeleteSelected = useCallback(() => {
    if (!activeSelectedKfId) return;
    for (const track of activeTracks) {
      if (track.keyframes.some((k) => k.id === activeSelectedKfId)) {
        handleDeleteKeyframe(track.id, activeSelectedKfId);
        break;
      }
    }
  }, [activeSelectedKfId, activeTracks, handleDeleteKeyframe]);

  // Formatted time strings
  const formattedCurrentTime = useMemo(
    () => formatTimecode(currentTransportTime, fps),
    [currentTransportTime, fps]
  );
  const formattedDuration = useMemo(
    () => formatTimecode(duration, fps),
    [duration, fps]
  );

  return {
    isPlaying,
    duration,
    fps,
    isLooping,
    pixelsPerSecond,
    currentTransportTime,
    formattedCurrentTime,
    formattedDuration,
    tracks: activeTracks,
    selectedTrackId: activeSelectedTrackId,
    selectedKeyframeId: activeSelectedKfId,
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
    handleDeleteKeyframe,
    handleDeleteSelected,
    handleSlideClip,
  };
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import { frameScheduler } from "@/core/time/scheduler";
import { Icon } from "@/editor/components/Icon";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  StepBack,
  StepForward,
  Repeat,
  RotateCcw,
  Layers,
  MousePointer2,
  Scissors,
  Maximize2,
  Download,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { useStore } from "zustand";
import {
  transport,
  transportStore,
  getTransport,
} from "@/core/time/transport";
import { useTransportTime } from "@/core/time/useTransportTime";
import {
  useMotionModel,
  motionActions,
  timecode,
} from "@/editor/motion-model";
import { SPEED_OPTIONS } from "./constants";

export interface TimelineTransportProps {
  onExport?: () => void;
  onPresets?: () => void;
  fullWidth?: boolean;
  onToggleFullWidth?: (fw: boolean) => void;
  // Legacy compatibility props
  isPlaying?: boolean;
  isLooping?: boolean;
  currentTimeFormatted?: string;
  durationFormatted?: string;
  viewMode?: "tracks" | "graph" | "timeline";
  onTogglePlay?: () => void;
  onStop?: () => void;
  onStepBack?: () => void;
  onStepForward?: () => void;
  onToggleLoop?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onToggleGraph?: () => void;
  onAddKeyframe?: () => void;
}

export const TimelineTransport: React.FC<TimelineTransportProps> = ({
  onExport,
  fullWidth,
  onToggleFullWidth,
  isPlaying: legacyPlaying,
  currentTimeFormatted: legacyCurrentTime,
  durationFormatted: legacyDuration,
  onTogglePlay: _legacyTogglePlay,
  onStepBack: _legacyStepBack,
  onStepForward: _legacyStepForward,
  onToggleLoop: _legacyToggleLoop,
  onToggleGraph: _legacyToggleGraph,
}) => {
  const currentTransportTime = useTransportTime({ maxHz: 10 });
  const playing = useStore(transportStore, (s) => s.playing);
  const loop = useStore(transportStore, (s) => s.loop);
  const speed = useStore(transportStore, (s) => Math.abs(s.rate) || 1);
  const fps = useStore(transportStore, (s) => s.fps || 60);
  const dur = useStore(transportStore, (s) => s.duration || 5);

  const frames = useMotionModel((s) => s.frames);
  const tool = useMotionModel((s) => s.tool);
  const view = useMotionModel((s) => s.view);
  const storeFullWidth = useMotionModel((s) => s.fullWidth);
  const recordMode = useTimelineUiStore((s) => s.recordMode);
  const onionSkin = useTimelineUiStore((s) => s.onionSkin);

  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [speedAnchor, setSpeedAnchor] = useState<{ x: number; y: number } | null>(null);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<{ x: number; y: number } | null>(null);

  const isFw = fullWidth ?? storeFullWidth;

  const timecodeBtnRef = useRef<HTMLButtonElement | null>(null);
  const framesRef = useRef(frames);
  const fpsRef = useRef(fps);

  useEffect(() => {
    framesRef.current = frames;
    fpsRef.current = fps;
  }, [frames, fps]);

  useEffect(() => {
    return frameScheduler.register("overlay", () => {
      const t = getTransport();
      if (!t.playing || !timecodeBtnRef.current) return;
      const curFps = fpsRef.current || 60;
      const f = Math.round(t.time * curFps);
      const text = framesRef.current ? String(f) : timecode(f, curFps);
      if (timecodeBtnRef.current.textContent !== text) {
        timecodeBtnRef.current.textContent = text;
      }
    });
  }, []);

  const effectivePlaying = legacyPlaying !== undefined ? legacyPlaying : playing;
  const currentFrame = Math.round(currentTransportTime * fps);
  const durFrames = Math.round(dur * fps);
  const formattedTime = legacyCurrentTime ?? (frames ? String(currentFrame) : timecode(currentFrame, fps));
  const formattedTotal = legacyDuration ?? (frames ? String(durFrames) : timecode(durFrames, fps));

  const loopLabel = loop === "off" ? "Off" : loop === "loop" ? "Loop" : "Ping-pong";

  return (
    <div
      role="toolbar"
      aria-label="Timeline header"
      className="ll-ph ll-mh ll:h-11 ll:grid ll:grid-cols-timeline-header ll:items-center ll:gap-2 ll:px-3 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:min-w-0 ll:overflow-hidden"
    >
      {/* 1. Left: Timecode and total */}
      <div className="ll-mtc ll:flex ll:items-baseline ll:gap-2 ll:min-w-0">
        <button
          ref={timecodeBtnRef}
          type="button"
          onClick={() => motionActions.toggleFrames()}
          aria-label="Playhead time"
          title="Click to switch between timecode and frames"
          style={{ fontSize: "20px", lineHeight: "28px" }}
          className="ll-tc ll:font-mono ll:font-medium ll:h-7 ll:rounded-sm ll:px-1 ll:-ml-1 ll:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          {formattedTime}
        </button>
        <span className="ll-tt ll:font-mono ll:font-normal ll:text-nano ll:text-muted ll:whitespace-nowrap">
          / {formattedTotal}
        </span>
      </div>

      {/* 2. Center: Transport Controls */}
      <div className="ll-mtr ll:flex ll:items-center ll:gap-0.5 ll:justify-self-center">
        <button
          type="button"
          onClick={() => {
            const wa = getTransport().workArea;
            transport.seek(wa.start);
          }}
          aria-label="Go to start (Home)"
          title="Go to start (Home)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={SkipBack} size={15} />
        </button>

        <button
          type="button"
          onClick={() => motionActions.jumpKey(-1)}
          aria-label="Previous keyframe (Alt+Left)"
          title="Previous keyframe (Alt+Left)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={StepBack} size={15} />
        </button>

        <button
          type="button"
          onClick={() => transport.stepFrame(-1)}
          aria-label="Step back (Left)"
          title="Step back (Left)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={ChevronLeft} size={16} />
        </button>

        <button
          type="button"
          onClick={() => transport.togglePlay()}
          aria-pressed={effectivePlaying}
          aria-label={effectivePlaying ? "Pause (Space)" : "Play (Space)"}
          title={effectivePlaying ? "Pause (Space)" : "Play (Space)"}
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            effectivePlaying
              ? "ll:bg-control-active ll:text-control-active-fg"
              : "ll:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={effectivePlaying ? Pause : Play} size={15} />
        </button>

        <button
          type="button"
          onClick={() => transport.stepFrame(1)}
          aria-label="Step forward (Right)"
          title="Step forward (Right)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={ChevronRight} size={16} />
        </button>

        <button
          type="button"
          onClick={() => motionActions.jumpKey(1)}
          aria-label="Next keyframe (Alt+Right)"
          title="Next keyframe (Alt+Right)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={StepForward} size={15} />
        </button>

        <button
          type="button"
          onClick={() => {
            const wa = getTransport().workArea;
            transport.seek(wa.end);
          }}
          aria-label="Go to end (End)"
          title="Go to end (End)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={SkipForward} size={15} />
        </button>

        <button
          type="button"
          onClick={() => transport.cycleLoop()}
          aria-pressed={loop !== "off"}
          aria-label={`Loop: ${loopLabel}`}
          title={`Loop: ${loopLabel}`}
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            loop !== "off"
              ? "ll:text-control-active ll:bg-surface-hover"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={loop === "ping-pong" ? RotateCcw : Repeat} size={14} />
        </button>

        <button
          type="button"
          onClick={() => useTimelineUiStore.getState().setRecordMode(!recordMode)}
          aria-pressed={recordMode}
          aria-label="Auto-key record mode"
          data-testid="timeline-record-button"
          title={recordMode ? "Auto-key record mode (ON) - changes create keyframes" : "Auto-key record mode (OFF)"}
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            recordMode
              ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <div
            className={`ll:w-2.5 ll:h-2.5 ll:rounded-full ${
              recordMode ? "ll:bg-control-primary-fg" : "ll:bg-current"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => useTimelineUiStore.getState().toggleOnionSkin()}
          aria-pressed={onionSkin.enabled}
          aria-label="Toggle onion skin"
          data-testid="timeline-onion-skin-button"
          title={onionSkin.enabled ? "Onion skin (ON) - shows ghost frames" : "Onion skin (OFF)"}
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            onionSkin.enabled
              ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={Layers} size={14} />
        </button>
      </div>

      {/* 3. Right: View tabs, Tools, Speed, Full Width, Export */}
      <div className="ll-mrt ll:flex ll:items-center ll:gap-1 ll:justify-end ll:min-w-0">
        {/* Segmented view switch (Timeline / Graph) */}
        <div
          role="tablist"
          aria-label="Timeline view"
          className="ll-vseg ll:flex ll:items-center ll:h-7 ll:p-0.5 ll:bg-surface-segmented ll:rounded-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "timeline"}
            onClick={() => motionActions.setView("timeline")}
            className={`ll:h-6 ll:px-2.5 ll:rounded-xs ll:font-sans ll:text-xs ll:font-medium ll:transition-colors ${
              view === "timeline"
                ? "ll:bg-surface-panel ll:text-primary ll:shadow-xs"
                : "ll:text-muted ll:hover:text-primary"
            }`}
          >
            Timeline
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "graph"}
            onClick={() => motionActions.setView("graph")}
            className={`ll:h-6 ll:px-2.5 ll:rounded-xs ll:font-sans ll:text-xs ll:font-medium ll:transition-colors ${
              view === "graph"
                ? "ll:bg-surface-panel ll:text-primary ll:shadow-xs"
                : "ll:text-muted ll:hover:text-primary"
            }`}
          >
            Graph
          </button>
        </div>

        <span className="ll:w-px ll:h-4 ll:bg-border ll:mx-1" aria-hidden="true" />

        {/* Tools: Select (V) and Split (C) */}
        <button
          type="button"
          onClick={() => motionActions.setTool("select")}
          aria-pressed={tool === "select"}
          aria-label="Select (V)"
          title="Select (V)"
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            tool === "select"
              ? "ll:bg-selection ll:text-selection-fg"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={MousePointer2} size={15} />
        </button>

        <button
          type="button"
          onClick={() => motionActions.setTool("split")}
          aria-pressed={tool === "split"}
          aria-label="Split clip (C)"
          title="Split clip (C)"
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            tool === "split"
              ? "ll:bg-selection ll:text-selection-fg"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={Scissors} size={15} />
        </button>

        <span className="ll:w-px ll:h-4 ll:bg-border ll:mx-1" aria-hidden="true" />

        {/* Speed dropdown */}
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setSpeedAnchor({ x: rect.left, y: rect.bottom + 4 });
            setSpeedMenuOpen(true);
          }}
          aria-haspopup="listbox"
          aria-expanded={speedMenuOpen}
          aria-label="Playback speed"
          title="Playback speed"
          className="ll-mdd ll:h-7 ll:px-2 ll:flex ll:items-center ll:gap-1 ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-nano ll:font-medium ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary ll:transition-colors"
        >
          <span>{speed}×</span>
          <Icon icon={ChevronDown} size={12} className="ll:text-muted" />
        </button>

        {speedMenuOpen && speedAnchor && (
          <Menu
            open={speedMenuOpen}
            onClose={() => setSpeedMenuOpen(false)}
            position={speedAnchor}
          >
            {SPEED_OPTIONS.map((opt) => (
              <MenuItem
                key={opt}
                onClick={() => {
                  transport.setRate(opt);
                  setSpeedMenuOpen(false);
                }}
              >
                {opt}×
              </MenuItem>
            ))}
          </Menu>
        )}

        {/* Full width button (Shift+T) */}
        <button
          type="button"
          onClick={() => {
            const next = !isFw;
            motionActions.setFullWidth(next);
            onToggleFullWidth?.(next);
          }}
          aria-pressed={isFw}
          aria-label="Full width (Shift+T)"
          title="Full width (Shift+T)"
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            isFw
              ? "ll:bg-surface-hover ll:text-primary"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={Maximize2} size={15} />
        </button>

        <span className="ll:w-px ll:h-4 ll:bg-border ll:mx-1" aria-hidden="true" />

        {/* Export animation */}
        <button
          type="button"
          onClick={onExport}
          aria-label="Export animation"
          title="Export animation"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={Download} size={15} />
        </button>

        {/* More options menu */}
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMoreAnchor({ x: rect.left, y: rect.bottom + 4 });
            setMoreMenuOpen(true);
          }}
          aria-label="More timeline options"
          title="More options"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={MoreHorizontal} size={15} />
        </button>

        {moreMenuOpen && moreAnchor && (
          <Menu
            open={moreMenuOpen}
            onClose={() => setMoreMenuOpen(false)}
            position={moreAnchor}
          >
            <MenuItem
              onClick={() => {
                motionActions.setCompact(!useMotionModel.getState().compact);
                setMoreMenuOpen(false);
              }}
            >
              Toggle compact rows
            </MenuItem>
            <MenuItem
              onClick={() => {
                motionActions.resetWorkArea();
                setMoreMenuOpen(false);
              }}
            >
              Reset work area
            </MenuItem>
            <MenuItem
              onClick={() => {
                motionActions.setZoom(1);
                motionActions.setT0(0);
                setMoreMenuOpen(false);
              }}
            >
              Fit timeline (1×)
            </MenuItem>
          </Menu>
        )}
      </div>
    </div>
  );
};

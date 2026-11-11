"use client";

import React, { useState } from "react";
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
  Download,
  ChevronDown,
} from "lucide-react";
import { ProtoIcon } from "@/editor/components/icons/ProtoIcon";
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
import { SplitIcon } from "./icons";
import { timelineOpsAdapter } from "./timelineOpsAdapter";
import { BottomCollapseButton } from "@/editor/shell/BottomCollapseButton";

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

/** One control: 32px square, 4px radius. Idle colours are added per button. */
const BTN = "ll:w-8 ll:h-8 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:flex-none ll:transition-colors";
const BTN_IDLE = "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover";
/** 1px hairline between groups, with 6px of margin on each side (the flex gap adds 8px more). */
const Sep: React.FC = () => (
  <i className="tdiv ll:w-px ll:h-5 ll:bg-border ll:mx-1.5 ll:flex-none" aria-hidden="true" />
);

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
  const autoKey = useMotionModel((s) => s.autoKey);
  const recordMode = useTimelineUiStore((s) => s.recordMode);
  const onionSkin = useTimelineUiStore((s) => s.onionSkin);

  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [speedAnchor, setSpeedAnchor] = useState<{ x: number; y: number } | null>(null);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<{ x: number; y: number } | null>(null);

  const isFw = fullWidth ?? storeFullWidth;

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
      style={{ background: "color-mix(in srgb, var(--ll-surface-panel) 95%, var(--ll-text-primary))" }}
      className={`ll-ph ll-mh ll:@container ll:h-11 ll:flex ll:items-center ll:gap-2 ll:px-3 ll:border-b ll:border-border ll:shrink-0 ll:min-w-0 ll:overflow-hidden ${
        autoKey ? "ll:outline ll:outline-1 ll:outline-primary ll:-outline-offset-1" : ""
      }`}
    >
      {/* Left: transport, then playhead time / total */}
      <div className="ll-mtr ll:flex ll:items-center ll:gap-0.5 ll:flex-none">
        <button
          type="button"
          data-ta="start"
          onClick={() => {
            const wa = getTransport().workArea;
            motionActions.seek(wa.start * fps, true);
          }}
          aria-label="Go to start (Home)"
          title="Go to start (Home)"
          className={`${BTN} ${BTN_IDLE}`}
        >
          <Icon icon={SkipBack} size={16} />
        </button>

        <button
          type="button"
          data-ta="kprev"
          onClick={() => motionActions.jumpKey(-1)}
          aria-label="Previous keyframe (Alt+Left)"
          title="Previous keyframe (Alt+Left)"
          className={`${BTN} ${BTN_IDLE} ll:@max-[820px]:hidden`}
        >
          <Icon icon={StepBack} size={16} />
        </button>

        <button
          type="button"
          data-ta="back"
          onClick={() => motionActions.stepFrame(-1)}
          aria-label="Step back (Left)"
          title="Step back (Left)"
          className={`${BTN} ${BTN_IDLE}`}
        >
          <Icon icon={ChevronLeft} size={16} />
        </button>

        <button
          type="button"
          id="tplay"
          data-ta="play"
          onClick={() => transport.togglePlay()}
          aria-pressed={effectivePlaying}
          aria-label={effectivePlaying ? "Pause (Space)" : "Play (Space)"}
          title={effectivePlaying ? "Pause (Space)" : "Play (Space)"}
          className={`${BTN} ${
            effectivePlaying
              ? "ll:bg-control-active ll:text-control-active-fg"
              : "ll:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={effectivePlaying ? Pause : Play} size={16} />
        </button>

        <button
          type="button"
          data-ta="fwd"
          onClick={() => motionActions.stepFrame(1)}
          aria-label="Step forward (Right)"
          title="Step forward (Right)"
          className={`${BTN} ${BTN_IDLE}`}
        >
          <Icon icon={ChevronRight} size={16} />
        </button>

        <button
          type="button"
          data-ta="knext"
          onClick={() => motionActions.jumpKey(1)}
          aria-label="Next keyframe (Alt+Right)"
          title="Next keyframe (Alt+Right)"
          className={`${BTN} ${BTN_IDLE} ll:@max-[820px]:hidden`}
        >
          <Icon icon={StepForward} size={16} />
        </button>

        <button
          type="button"
          data-ta="end"
          onClick={() => {
            const wa = getTransport().workArea;
            motionActions.seek(wa.end * fps, true);
          }}
          aria-label="Go to end (End)"
          title="Go to end (End)"
          className={`${BTN} ${BTN_IDLE}`}
        >
          <Icon icon={SkipForward} size={16} />
        </button>

        <Sep />

        <button
          type="button"
          id="tloop"
          data-ta="loop"
          onClick={() => transport.cycleLoop()}
          aria-pressed={loop !== "off"}
          aria-label={`Loop: ${loopLabel}`}
          title={`Loop: ${loopLabel}`}
          className={`${BTN} ${
            loop !== "off"
              ? "ll:text-control-active ll:bg-surface-hover"
              : BTN_IDLE
          }`}
        >
          <Icon icon={loop === "ping-pong" ? RotateCcw : Repeat} size={16} />
        </button>

        <button
          type="button"
          onClick={() => useTimelineUiStore.getState().setRecordMode(!recordMode)}
          aria-pressed={recordMode}
          aria-label="Auto-key record mode"
          data-testid="timeline-record-button"
          title={recordMode ? "Auto-key record mode (ON) - changes create keyframes" : "Auto-key record mode (OFF)"}
          className={`${BTN} ll:@max-[980px]:hidden ${
            recordMode
              ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
              : BTN_IDLE
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
          className={`${BTN} ll:@max-[980px]:hidden ${
            onionSkin.enabled
              ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
              : BTN_IDLE
          }`}
        >
          <Icon icon={Layers} size={16} />
        </button>
      </div>

      <Sep />

      <div className="ll-mtc ll:flex ll:items-baseline ll:gap-1.5 ll:min-w-0 ll:flex-none">
        <button
          type="button"
          id="tc"
          data-ta="tc"
          onClick={() => motionActions.toggleFrames()}
          aria-label="Playhead time"
          title="Click to switch between timecode and frames"
          style={{ fontSize: "18px", lineHeight: "32px" }}
          className="ll-tc ll:font-mono ll:font-medium ll:tabular-nums ll:h-8 ll:rounded-sm ll:px-1.5 ll:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          {formattedTime}
        </button>
        <span
          id="tt"
          className="ll-tt ll:font-mono ll:font-normal ll:tabular-nums ll:text-micro ll:text-muted ll:whitespace-nowrap"
        >
          / {formattedTotal}
        </span>
      </div>

      <div className="ll:flex-1 ll:min-w-0" aria-hidden="true" />

      {/* Right: view switch, tools, speed, expand width, export, more */}
      <div className="ll-mrt ll:flex ll:items-center ll:gap-0.5 ll:justify-end ll:flex-none">
        {/* Segmented view switch (Timeline / Graph), icon only */}
        <div
          id="vseg"
          role="tablist"
          aria-label="Timeline view"
          className="seg vseg ll-vseg ll:flex ll:items-center ll:h-8 ll:p-px ll:gap-px ll:border ll:border-border ll:rounded-sm ll:flex-none"
        >
          <button
            type="button"
            role="tab"
            data-view="timeline"
            aria-selected={view === "timeline"}
            aria-pressed={view === "timeline"}
            aria-label="Timeline"
            title="Timeline"
            onClick={() => motionActions.setView("timeline")}
            className={`ll:w-9 ll:h-full ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
              view === "timeline"
                ? "ll:bg-surface-segmented ll:text-primary"
                : "ll:text-muted ll:hover:text-primary"
            }`}
          >
            <ProtoIcon name="tlview" size={20} />
          </button>
          <button
            type="button"
            role="tab"
            data-view="graph"
            aria-selected={view === "graph"}
            aria-pressed={view === "graph"}
            aria-label="Graph"
            title="Graph"
            onClick={() => motionActions.setView("graph")}
            className={`ll:w-9 ll:h-full ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
              view === "graph"
                ? "ll:bg-surface-segmented ll:text-primary"
                : "ll:text-muted ll:hover:text-primary"
            }`}
          >
            <ProtoIcon name="graphview" size={20} />
          </button>
        </div>

        <Sep />

        {/* Tools: Select (V), Split (C) */}
        <button
          type="button"
          data-mtool="select"
          onClick={() => motionActions.setTool("select")}
          aria-pressed={tool === "select"}
          aria-label="Select (V)"
          title="Select (V)"
          className={`${BTN} ${tool === "select" ? "ll:bg-selection ll:text-selection-fg" : BTN_IDLE}`}
        >
          <Icon icon={MousePointer2} size={16} />
        </button>

        <button
          type="button"
          data-mtool="split"
          onClick={() => {
            if (tool === "split") {
              timelineOpsAdapter.splitClipAtPlayhead();
            } else {
              motionActions.setTool("split");
            }
          }}
          aria-pressed={tool === "split"}
          aria-label="Split clip (C)"
          title="Split clip (C)"
          className={`${BTN} ${tool === "split" ? "ll:bg-selection ll:text-selection-fg" : BTN_IDLE}`}
        >
          <Icon icon={SplitIcon} size={16} />
        </button>

        <Sep />

        {/* Speed dropdown */}
        <button
          type="button"
          id="tspeed"
          data-ta="speed"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setSpeedAnchor({ x: rect.left, y: rect.bottom + 4 });
            setSpeedMenuOpen(true);
          }}
          aria-haspopup="listbox"
          aria-expanded={speedMenuOpen}
          aria-label="Playback speed"
          title="Playback speed"
          className="ll-mdd ll:h-8 ll:px-2 ll:flex ll:items-center ll:gap-1 ll:border ll:border-border ll:rounded-sm ll:font-mono ll:tabular-nums ll:text-micro ll:font-medium ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary ll:transition-colors ll:flex-none"
        >
          <span className="ddt">{speed}×</span>
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

        {/* Expand width button (Shift+T) */}
        <button
          type="button"
          id="tfw"
          data-ta="fw"
          onClick={() => {
            const next = !isFw;
            motionActions.setFullWidth(next);
            onToggleFullWidth?.(next);
          }}
          aria-pressed={isFw}
          aria-label="Full width (Shift+T)"
          title="Full width (Shift+T)"
          className={`${BTN} ${isFw ? "ll:bg-surface-hover ll:text-primary" : BTN_IDLE}`}
        >
          <ProtoIcon name="expandw" size={18} />
        </button>

        <Sep />

        {/* Export animation */}
        <button
          type="button"
          id="texp"
          data-ta="export"
          onClick={onExport}
          aria-label="Export animation"
          title="Export animation"
          className={`${BTN} ${BTN_IDLE}`}
        >
          <Icon icon={Download} size={16} />
        </button>

        {/* More options menu */}
        <button
          type="button"
          id="tmore"
          data-ta="more"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMoreAnchor({ x: rect.left, y: rect.bottom + 4 });
            setMoreMenuOpen(true);
          }}
          aria-haspopup="menu"
          aria-expanded={moreMenuOpen}
          aria-label="More timeline options"
          title="More"
          className={`ll-more ${BTN} ${BTN_IDLE} ll:font-mono ll:text-sm ll:font-medium ll:leading-none`}
        >
          ...
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

        <Sep />

        {/* Collapse the timeline to this header strip */}
        <BottomCollapseButton mode="motion" />
      </div>
    </div>
  );
};

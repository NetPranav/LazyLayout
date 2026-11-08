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
  MousePointer2,
  Maximize2,
  Download,
  ChevronDown,
} from "lucide-react";
import { Menu, MenuItem } from "@/editor/components/Menu";
import {
  useMotionModel,
  motionActions,
  timecode,
} from "@/editor/motion-model";
import { SPEED_OPTIONS } from "./constants";
import { SplitIcon } from "./icons";
import { timelineOpsAdapter } from "./timelineOpsAdapter";

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
  onTogglePlay: legacyTogglePlay,
  onStepBack: legacyStepBack,
  onStepForward: legacyStepForward,
  onToggleLoop: legacyToggleLoop,
  onToggleGraph: legacyToggleGraph,
}) => {
  const playhead = useMotionModel((s) => s.playhead);
  const playing = useMotionModel((s) => s.playing);
  const speed = useMotionModel((s) => s.speed);
  const loop = useMotionModel((s) => s.loop);
  const frames = useMotionModel((s) => s.frames);
  const dur = useMotionModel((s) => s.comp.dur);
  const fps = useMotionModel((s) => s.fps);
  const tool = useMotionModel((s) => s.tool);
  const view = useMotionModel((s) => s.view);
  const storeFullWidth = useMotionModel((s) => s.fullWidth);
  const autoKey = useMotionModel((s) => s.autoKey);

  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [speedAnchor, setSpeedAnchor] = useState<{ x: number; y: number } | null>(null);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<{ x: number; y: number } | null>(null);

  const isFw = fullWidth ?? storeFullWidth;

  const effectivePlaying = legacyPlaying !== undefined ? legacyPlaying : playing;
  const formattedTime = legacyCurrentTime ?? (frames ? String(playhead) : timecode(playhead, fps));
  const formattedTotal = legacyDuration ?? (frames ? String(dur) : timecode(dur, fps));

  return (
    <div
      role="toolbar"
      aria-label="Timeline header"
      className={`ll-ph ll-mh ll:h-11 ll:grid ll:grid-cols-timeline-header ll:items-center ll:gap-2 ll:px-3 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:min-w-0 ll:overflow-hidden ${
        autoKey ? "ll:outline ll:outline-1 ll:outline-primary ll:-outline-offset-1" : ""
      }`}
    >
      {/* 1. Left: Timecode and total */}
      <div className="ll-mtc ll:flex ll:items-baseline ll:gap-2 ll:min-w-0">
        <button
          type="button"
          id="tc"
          data-ta="tc"
          onClick={() => motionActions.toggleFrames()}
          aria-label="Playhead time"
          title="Click to switch between timecode and frames"
          style={{ fontSize: "20px", lineHeight: "28px" }}
          className="ll-tc ll:font-mono ll:font-medium ll:h-7 ll:rounded-sm ll:px-1 ll:-ml-1 ll:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          {formattedTime}
        </button>
        <span
          id="tt"
          className="ll-tt ll:font-mono ll:font-normal ll:text-nano ll:text-muted ll:whitespace-nowrap ll:-ml-1"
        >
          / {formattedTotal}
        </span>
      </div>

      {/* 2. Center: Transport Controls */}
      <div className="ll-mtr ll:flex ll:items-center ll:gap-0.5 ll:justify-self-center">
        <button
          type="button"
          data-ta="start"
          onClick={() => {
            const wa = useMotionModel.getState().wa;
            motionActions.setPlayhead(wa.a, true);
          }}
          aria-label="Go to start (Home)"
          title="Go to start (Home)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={SkipBack} size={14} />
        </button>

        <button
          type="button"
          data-ta="kprev"
          onClick={() => motionActions.jumpKey(-1)}
          aria-label="Previous keyframe (Alt+Left)"
          title="Previous keyframe (Alt+Left)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={StepBack} size={14} />
        </button>

        <button
          type="button"
          data-ta="back"
          onClick={() => motionActions.stepFrame(-1)}
          aria-label="Step back (Left)"
          title="Step back (Left)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={ChevronLeft} size={15} />
        </button>

        <button
          type="button"
          id="tplay"
          data-ta="play"
          onClick={() => motionActions.setPlaying(!effectivePlaying)}
          aria-pressed={effectivePlaying}
          aria-label={effectivePlaying ? "Pause (Space)" : "Play (Space)"}
          title={effectivePlaying ? "Pause (Space)" : "Play (Space)"}
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            effectivePlaying
              ? "ll:bg-control-active ll:text-control-active-fg"
              : "ll:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={effectivePlaying ? Pause : Play} size={14} />
        </button>

        <button
          type="button"
          data-ta="fwd"
          onClick={() => motionActions.stepFrame(1)}
          aria-label="Step forward (Right)"
          title="Step forward (Right)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={ChevronRight} size={15} />
        </button>

        <button
          type="button"
          data-ta="knext"
          onClick={() => motionActions.jumpKey(1)}
          aria-label="Next keyframe (Alt+Right)"
          title="Next keyframe (Alt+Right)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={StepForward} size={14} />
        </button>

        <button
          type="button"
          data-ta="end"
          onClick={() => {
            const wa = useMotionModel.getState().wa;
            motionActions.setPlayhead(wa.b, true);
          }}
          aria-label="Go to end (End)"
          title="Go to end (End)"
          className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={SkipForward} size={14} />
        </button>

        <button
          type="button"
          id="tloop"
          data-ta="loop"
          onClick={() => motionActions.toggleLoop()}
          aria-pressed={loop > 0}
          aria-label={`Loop: ${loop === 0 ? "Off" : loop === 1 ? "Loop" : "Ping-pong"}`}
          title={`Loop: ${loop === 0 ? "Off" : loop === 1 ? "Loop" : "Ping-pong"}`}
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            loop > 0
              ? "ll:text-control-active ll:bg-surface-hover"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={loop === 2 ? RotateCcw : Repeat} size={14} />
        </button>
      </div>

      {/* 3. Right: View tabs, Tools, Speed, Full Width, Export, More */}
      <div className="ll-mrt ll:flex ll:items-center ll:gap-1 ll:justify-end ll:min-w-0">
        {/* Segmented view switch (Timeline / Graph) */}
        <div
          id="vseg"
          role="tablist"
          aria-label="Timeline view"
          className="seg vseg ll-vseg ll:flex ll:items-center ll:h-8 ll:p-0.5 ll:gap-0.5 ll:border ll:border-border ll:rounded-sm ll:flex-none ll:w-36"
        >
          <button
            type="button"
            role="tab"
            data-view="timeline"
            aria-selected={view === "timeline"}
            aria-pressed={view === "timeline"}
            onClick={() => motionActions.setView("timeline")}
            style={{ fontSize: "13px" }}
            className={`ll:flex-1 ll:h-6.5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:font-sans ll:font-medium ll:transition-colors ${
              view === "timeline"
                ? "ll:bg-surface-segmented ll:text-primary"
                : "ll:text-muted ll:hover:text-primary"
            }`}
          >
            Timeline
          </button>
          <button
            type="button"
            role="tab"
            data-view="graph"
            aria-selected={view === "graph"}
            aria-pressed={view === "graph"}
            onClick={() => motionActions.setView("graph")}
            style={{ fontSize: "13px" }}
            className={`ll:flex-1 ll:h-6.5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:font-sans ll:font-medium ll:transition-colors ${
              view === "graph"
                ? "ll:bg-surface-segmented ll:text-primary"
                : "ll:text-muted ll:hover:text-primary"
            }`}
          >
            Graph
          </button>
        </div>

        <i className="tdiv ll:w-px ll:h-4 ll:bg-border ll:mx-1 ll:flex-none" aria-hidden="true" />

        {/* Tools: Select (V), Split (C) */}
        <button
          type="button"
          data-mtool="select"
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
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            tool === "split"
              ? "ll:bg-selection ll:text-selection-fg"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={SplitIcon} size={15} />
        </button>

        <i className="tdiv ll:w-px ll:h-4 ll:bg-border ll:mx-1 ll:flex-none" aria-hidden="true" />

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
          className="ll-mdd ll:h-7 ll:px-2 ll:flex ll:items-center ll:gap-1 ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-nano ll:font-medium ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary ll:transition-colors ll:flex-none"
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
                  motionActions.setSpeed(opt);
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
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
            isFw
              ? "ll:bg-surface-hover ll:text-primary"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={Maximize2} size={15} />
        </button>

        <i className="tdiv ll:w-px ll:h-4 ll:bg-border ll:mx-1 ll:flex-none" aria-hidden="true" />

        {/* Export animation */}
        <button
          type="button"
          id="texp"
          data-ta="export"
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
          className="ll-more ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors ll:font-mono ll:text-sm ll:font-medium ll:leading-none"
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
      </div>
    </div>
  );
};

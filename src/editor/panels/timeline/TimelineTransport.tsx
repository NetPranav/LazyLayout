"use client";

import React from "react";
import {
  SkipBack,
  StepBack,
  Play,
  Pause,
  StepForward,
  Repeat,
  ZoomIn,
  ZoomOut,
  Plus,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import type { TimelineViewMode } from "./types";

export interface TimelineTransportProps {
  isPlaying: boolean;
  isLooping: boolean;
  currentTimeFormatted: string;
  durationFormatted: string;
  viewMode: TimelineViewMode;
  onTogglePlay: () => void;
  onStop: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onToggleLoop: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleGraph: () => void;
  onPresets?: () => void;
  onExport?: () => void;
  onAddKeyframe?: () => void;
}

export const TimelineTransport: React.FC<TimelineTransportProps> = ({
  isPlaying,
  isLooping,
  currentTimeFormatted,
  durationFormatted,
  viewMode,
  onTogglePlay,
  onStop,
  onStepBack,
  onStepForward,
  onToggleLoop,
  onZoomIn,
  onZoomOut,
  onToggleGraph,
  onPresets,
  onExport,
  onAddKeyframe,
}) => {
  return (
    <header className="ll-ph ll:h-header ll:flex ll:items-center ll:gap-2 ll:px-3 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:min-w-0 ll:overflow-hidden">
      {/* Rewind to 0 / Stop */}
      <IconButton
        aria-label="Stop"
        tooltip="Stop"
        size="md"
        variant="ghost"
        onClick={onStop}
        icon={<Icon icon={SkipBack} size={15} />}
      />

      {/* Step back 1 frame */}
      <IconButton
        aria-label="Step back"
        tooltip="Step back"
        size="md"
        variant="ghost"
        onClick={onStepBack}
        icon={<Icon icon={StepBack} size={15} />}
      />

      {/* Play / Pause toggle */}
      <IconButton
        aria-label={isPlaying ? "Pause" : "Play"}
        tooltip={isPlaying ? "Pause" : "Play"}
        size="md"
        variant="ghost"
        onClick={onTogglePlay}
        icon={<Icon icon={isPlaying ? Pause : Play} size={15} />}
      />

      {/* Step forward 1 frame */}
      <IconButton
        aria-label="Step forward"
        tooltip="Step forward"
        size="md"
        variant="ghost"
        onClick={onStepForward}
        icon={<Icon icon={StepForward} size={15} />}
      />

      {/* Loop toggle */}
      <IconButton
        aria-label="Loop"
        tooltip="Loop"
        size="md"
        variant="ghost"
        pressed={isLooping}
        onClick={onToggleLoop}
        icon={<Icon icon={Repeat} size={15} />}
      />

      {/* Current Time Display */}
      <span
        aria-label="Current timecode"
        className="ll-tc ll:font-mono ll:text-lead ll:font-medium ll:text-primary ll:px-2 ll:whitespace-nowrap ll:select-none"
      >
        {currentTimeFormatted}
      </span>

      {/* Total Duration Display */}
      <span
        aria-label="Total duration"
        className="ll-tt ll:font-mono ll:text-micro ll:text-muted ll:whitespace-nowrap ll:select-none -ll:ml-1"
      >
        / {durationFormatted}
      </span>

      {/* Spacer */}
      <div className="ll-sp ll:flex-1" />

      {/* Zoom controls & Keyframe add */}
      <div className="ll:flex ll:items-center ll:gap-1 ll:mr-2">
        <IconButton
          aria-label="Zoom out"
          tooltip="Zoom out"
          size="sm"
          variant="ghost"
          onClick={onZoomOut}
          icon={<Icon icon={ZoomOut} size={13} />}
        />
        <IconButton
          aria-label="Zoom in"
          tooltip="Zoom in"
          size="sm"
          variant="ghost"
          onClick={onZoomIn}
          icon={<Icon icon={ZoomIn} size={13} />}
        />
        {onAddKeyframe && (
          <IconButton
            aria-label="Add keyframe"
            tooltip="Add keyframe at playhead"
            size="sm"
            variant="ghost"
            onClick={onAddKeyframe}
            icon={<Icon icon={Plus} size={13} />}
          />
        )}
      </div>

      {/* Action buttons from prototype */}
      <div className="ll:flex ll:items-center ll:gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPresets}
          className="ll-tg ll:text-muted ll:hover:text-primary"
        >
          Presets
        </Button>

        <Button
          variant={viewMode === "graph" ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleGraph}
          className={`ll-tg ${
            viewMode === "graph"
              ? "ll:text-primary ll:bg-surface-raised"
              : "ll:text-muted ll:hover:text-primary"
          }`}
        >
          Graph
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          className="ll-tg ll:text-muted ll:hover:text-primary"
        >
          Export
        </Button>
      </div>
    </header>
  );
};

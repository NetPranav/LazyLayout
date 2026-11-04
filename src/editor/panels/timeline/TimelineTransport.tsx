"use client";

import React from "react";
import {
  SkipBack,
  StepBack,
  Play,
  Pause,
  StepForward,
  Repeat,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
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
  onZoomIn?: () => void;
  onZoomOut?: () => void;
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
  onToggleGraph,
  onPresets,
  onExport,
}) => {
  return (
    <header className="ll-ph ll:h-header ll:flex ll:items-center ll:gap-2 ll:px-3 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:min-w-0 ll:overflow-hidden ll:select-none">
      {/* 1. Stop / Rewind to 0 */}
      <IconButton
        aria-label="Stop"
        tooltip="Stop"
        size="sm"
        variant="ghost"
        onClick={onStop}
        icon={<Icon icon={SkipBack} size={15} />}
        className="ll-ib ll:w-7 ll:h-7"
      />

      {/* 2. Step back 1 frame */}
      <IconButton
        aria-label="Step back"
        tooltip="Step back"
        size="sm"
        variant="ghost"
        onClick={onStepBack}
        icon={<Icon icon={StepBack} size={15} />}
        className="ll-ib ll:w-7 ll:h-7"
      />

      {/* 3. Play / Pause toggle */}
      <IconButton
        aria-label={isPlaying ? "Pause" : "Play"}
        tooltip={isPlaying ? "Pause" : "Play"}
        size="sm"
        variant="ghost"
        onClick={onTogglePlay}
        icon={<Icon icon={isPlaying ? Pause : Play} size={15} />}
        className="ll-ib ll:w-7 ll:h-7"
      />

      {/* 4. Step forward 1 frame */}
      <IconButton
        aria-label="Step forward"
        tooltip="Step forward"
        size="sm"
        variant="ghost"
        onClick={onStepForward}
        icon={<Icon icon={StepForward} size={15} />}
        className="ll-ib ll:w-7 ll:h-7"
      />

      {/* 5. Loop toggle */}
      <IconButton
        aria-label="Loop"
        tooltip="Loop"
        size="sm"
        variant="ghost"
        pressed={isLooping}
        onClick={onToggleLoop}
        icon={<Icon icon={Repeat} size={15} />}
        className="ll-ib ll:w-7 ll:h-7"
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
        className="ll-tt ll:font-mono ll:text-micro ll:text-muted ll:whitespace-nowrap ll:select-none ll:-ml-1"
      >
        / {durationFormatted}
      </span>

      {/* Spacer */}
      <div className="ll-sp ll:flex-1" />

      {/* Prototype Right Buttons: Presets, Graph, Export */}
      <div className="ll:flex ll:items-center ll:gap-1.5 ll:shrink-0">
        <button
          type="button"
          onClick={onPresets}
          className="ll-tg ll:border-0 ll:bg-transparent ll:h-7 ll:px-2 ll:text-small ll:font-medium ll:text-muted ll:hover:text-primary ll:hover:bg-transparent ll:transition-colors ll:cursor-pointer ll:rounded-sm ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
        >
          Presets
        </button>

        <button
          type="button"
          onClick={onToggleGraph}
          className={`ll-tg ll:border-0 ll:h-7 ll:px-2 ll:text-small ll:font-medium ll:transition-colors ll:cursor-pointer ll:rounded-sm ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
            viewMode === "graph"
              ? "ll:text-primary ll:bg-surface-raised"
              : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-transparent"
          }`}
        >
          Graph
        </button>

        <button
          type="button"
          onClick={onExport}
          className="ll-tg ll:border-0 ll:bg-transparent ll:h-7 ll:px-2 ll:text-small ll:font-medium ll:text-muted ll:hover:text-primary ll:hover:bg-transparent ll:transition-colors ll:cursor-pointer ll:rounded-sm ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
        >
          Export
        </button>
      </div>
    </header>
  );
};

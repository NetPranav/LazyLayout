import type React from "react";

export interface TimelineKeyframe {
  id: string;
  time: number;
  value?: unknown;
  ease?: string;
  selected?: boolean;
}

export interface TimelineClip {
  id: string;
  name?: string;
  start: number;
  duration: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  property?: string;
  clip?: TimelineClip;
  keyframes: TimelineKeyframe[];
  selected?: boolean;
  locked?: boolean;
  hidden?: boolean;
}

export type TimelineViewMode = "tracks" | "graph";

export interface TimelinePanelProps {
  tracks?: TimelineTrack[];
  selectedTrackId?: string;
  onSelectTrack?: (id: string) => void;
  selectedKeyframeId?: string | null;
  onSelectKeyframe?: (kfId: string | null, trackId?: string) => void;
  onAddKeyframe?: (trackId: string, time: number) => void;
  onUpdateKeyframeTime?: (trackId: string, kfId: string, time: number) => void;
  onDeleteKeyframe?: (trackId: string, kfId: string) => void;
  onSlideClip?: (trackId: string, deltaSec: number) => void;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  onExport?: () => void;
  onOpenPresets?: () => void;
}

export interface DraggingKeyframeState {
  trackId: string;
  keyframeId: string;
  initialTime: number;
  startClientX: number;
}

export interface DraggingClipState {
  trackId: string;
  initialStart: number;
  startClientX: number;
}

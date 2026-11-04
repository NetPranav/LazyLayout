import type React from "react";

export type PlaybackMode = "Off" | "Loop" | "Bounce";

export interface CubicBezierCurve {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface KeyframeInspectorProps {
  /** Target layer name (e.g. 'Headline') */
  layer?: string;
  onLayerChange?: (layer: string) => void;
  availableLayers?: readonly string[];

  /** Target animated property (e.g. 'Opacity') */
  property?: string;
  onPropertyChange?: (property: string) => void;
  availableProperties?: readonly string[];

  /** Timecode timestamp of keyframe (e.g. '00:01.20') */
  timecode?: string;
  onTimecodeChange?: (timecode: string) => void;

  /** Property value at keyframe (e.g. '100' for Opacity 100%) */
  value?: string;
  onValueChange?: (value: string) => void;
  valueSuffix?: string;
  valuePrefix?: string;

  /** Duration of transition (e.g. '0.6') */
  duration?: string;
  onDurationChange?: (duration: string) => void;

  /** Delay before animation segment (e.g. '0') */
  delay?: string;
  onDelayChange?: (delay: string) => void;

  /** Easing name preset (e.g. 'Ease out') */
  easing?: string;
  onEasingChange?: (easing: string) => void;
  availableEasings?: readonly string[];

  /** Bezier control points for custom cubic curve */
  bezier?: CubicBezierCurve;
  onBezierChange?: (curve: CubicBezierCurve) => void;

  /** Playback mode: 'Off' | 'Loop' | 'Bounce' */
  playback?: PlaybackMode;
  onPlaybackChange?: (playback: PlaybackMode) => void;

  /** Presets list */
  presets?: string[];
  onAddPreset?: (preset: string) => void;
  onRemovePreset?: (index: number) => void;

  /** Container class and styling */
  className?: string;
  style?: React.CSSProperties;
}

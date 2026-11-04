/**
 * Named constants for TimelinePanel.
 * Per UI rules: no px/ms literals in JSX or styling; all dimensions and defaults are named here.
 */

export const TIMELINE_ROW_HEIGHT_PX = 32;
export const TIMELINE_HEADER_HEIGHT_PX = 44;
export const TIMELINE_RULER_HEIGHT_PX = 24;

export const TIMELINE_DEFAULT_DURATION_SEC = 5;
export const TIMELINE_DEFAULT_FPS = 60;
export const TIMELINE_DEFAULT_PPS = 100; // Matches prototype ruler: 100px per second (0s-5s at 0-500px)

export const TIMELINE_ZOOM_MIN_PPS = 20;
export const TIMELINE_ZOOM_MAX_PPS = 1200;
export const TIMELINE_ZOOM_STEP_FACTOR = 1.25;

export const KEYFRAME_SIZE_PX = 8;
export const KEYFRAME_SELECTED_SIZE_PX = 10;
export const KEYFRAME_ROTATION_DEG = 45;

export const CLIP_HEIGHT_PX = 18;
export const CLIP_TOP_PX = 7;
export const CLIP_BORDER_RADIUS_PX = 4;

export const PLAYHEAD_LINE_WIDTH_PX = 1;
export const PLAYHEAD_KNOB_WIDTH_PX = 9;
export const PLAYHEAD_KNOB_HEIGHT_PX = 9;
export const PLAYHEAD_KNOB_OFFSET_PX = -4;
export const PLAYHEAD_KNOB_RADIUS_PX = 2;

export const FRAME_SNAP_FPS = 60;
export const TIME_STEP_FRAME = 1;

export const TIMELINE_MIN_PADDING_RIGHT_PX = 120;
export const RULER_MIN_TICK_DISTANCE_PX = 70;

export const DEFAULT_SAMPLE_TRACKS = [
  {
    id: "headline",
    name: "Headline",
    property: "transform.y",
    clip: {
      id: "clip-headline",
      name: "Headline FadeUp",
      start: 0.16,
      duration: 3.4,
    },
    keyframes: [
      { id: "kf-1", time: 0.2, value: "30px", ease: "power2.out" },
      { id: "kf-2", time: 1.8, value: "0px", ease: "power2.out" },
      { id: "kf-3", time: 3.48, value: "0px", ease: "power2.out" },
    ],
  },
  {
    id: "button",
    name: "Get started",
    property: "appearance.opacity",
    clip: {
      id: "clip-button",
      name: "Button Entrance",
      start: 1.0,
      duration: 2.8,
    },
    keyframes: [
      { id: "kf-4", time: 1.04, value: "0", ease: "power2.out" },
      { id: "kf-5", time: 3.72, value: "1", ease: "power2.out" },
    ],
  },
  {
    id: "image",
    name: "Hero image",
    property: "transform.scale",
    clip: {
      id: "clip-image",
      name: "Image Scale",
      start: 1.8,
      duration: 3.0,
    },
    keyframes: [
      { id: "kf-6", time: 1.84, value: "0.92", ease: "power2.out" },
      { id: "kf-7", time: 4.72, value: "1.0", ease: "power2.out" },
    ],
  },
] as const;

export const PRESET_EASINGS = [
  { id: "power2.out", name: "Power2.out (Smooth)", label: "Smooth" },
  { id: "power4.inOut", name: "Power4.inOut (Dramatic)", label: "Dramatic" },
  { id: "elastic.out", name: "Elastic.out (Playful)", label: "Elastic" },
  { id: "bounce.out", name: "Bounce.out (Lively)", label: "Bounce" },
  { id: "back.out", name: "Back.out (Anticipate)", label: "Anticipate" },
] as const;

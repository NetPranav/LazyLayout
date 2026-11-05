"use client";

import React, { useState } from "react";
import { Slider } from "@/editor/panels/inspectors/Slider";
import { EasingEditor } from "@/editor/panels/inspectors/EasingEditor";
import { KeyframeInspector } from "@/editor/panels/inspectors/KeyframeInspector";
import { CompositionInspector } from "@/editor/panels/inspectors/CompositionInspector";
import { LayerInspector } from "@/editor/panels/inspectors/LayerInspector";
import { MotionExportModal } from "@/editor/panels/inspectors/MotionExportModal";
import type { Keyframe, MotionLayer } from "@/editor/motion-model";

/**
 * 1. Slider Demos:
 * Demonstrates the one slider across various ranges, steps, units, and spring stretch behavior.
 */
export const SliderDemo: React.FC = () => {
  const [val1, setVal1] = useState(24);
  const [val2, setVal2] = useState(0.35);
  const [val3, setVal3] = useState(75);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:max-w-md">
      <div className="ll:flex ll:flex-col ll:gap-2">
        <div className="ll:flex ll:justify-between ll:text-micro ll:text-muted">
          <span>Grid size (8px - 48px)</span>
          <span className="ll:font-mono ll:text-primary">{val1}px</span>
        </div>
        <Slider
          min={8}
          max={48}
          step={1}
          value={val1}
          onChange={setVal1}
          unit="px"
          ariaLabel="Grid size"
        />
      </div>

      <div className="ll:flex ll:flex-col ll:gap-2">
        <div className="ll:flex ll:justify-between ll:text-micro ll:text-muted">
          <span>Spring response (0.1s - 1.5s)</span>
          <span className="ll:font-mono ll:text-primary">{val2.toFixed(2)}s</span>
        </div>
        <Slider
          min={0.1}
          max={1.5}
          step={0.01}
          value={val2}
          onChange={setVal2}
          unit="s"
          ariaLabel="Spring response"
        />
      </div>

      <div className="ll:flex ll:flex-col ll:gap-2">
        <div className="ll:flex ll:justify-between ll:text-micro ll:text-muted">
          <span>Opacity percentage (0% - 100%)</span>
          <span className="ll:font-mono ll:text-primary">{val3}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={val3}
          onChange={setVal3}
          unit="%"
          ariaLabel="Opacity percentage"
        />
      </div>
    </div>
  );
};

/**
 * 2. Easing Editor Demo:
 * Curve tab with 240px bezier plot, interactive handles, and traveling square preview.
 */
export const EasingEditorCurveDemo: React.FC = () => {
  const [keyframe, setKeyframe] = useState<Keyframe>({
    id: "demo-k1",
    t: 0,
    v: 0,
    ease: "Ease out",
    bz: [0, 0, 0.58, 1],
  });

  return (
    <div className="ll:w-80 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
      <EasingEditor
        keyframe={keyframe}
        onKeyframeChange={(patch) => setKeyframe((prev) => ({ ...prev, ...patch }))}
        segmentDurationSec={0.8}
      />
    </div>
  );
};

/**
 * 3. Easing Editor Spring Demo:
 * Spring tab with real spring plot over its settle duration, response and damping sliders.
 */
export const EasingEditorSpringDemo: React.FC = () => {
  const [keyframe, setKeyframe] = useState<Keyframe>({
    id: "demo-k2",
    t: 0,
    v: 100,
    ease: "Spring",
    spring: { response: 0.42, damping: 0.55 },
  });

  return (
    <div className="ll:w-80 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
      <EasingEditor
        keyframe={keyframe}
        onKeyframeChange={(patch) => setKeyframe((prev) => ({ ...prev, ...patch }))}
        segmentDurationSec={1.2}
      />
    </div>
  );
};

/**
 * 4. Composition Inspector Demo:
 * State when nothing is selected: fps, length, loop, playback speed, default easing, animated layers, markers.
 */
export const CompositionInspectorDemo: React.FC = () => {
  return (
    <div className="ll:w-80 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
      <CompositionInspector />
    </div>
  );
};

/**
 * 5. Layer Inspector Demo:
 * State when a layer is selected: trigger, clip delay/dur, repeat, stagger, property rows with stopwatch, live scrub, navigator.
 */
export const LayerInspectorDemo: React.FC = () => {
  const sampleLayer: MotionLayer = {
    id: "headline",
    lbl: 1,
    gopen: true,
    clips: [{ s: 0, e: 300 }],
    open: true,
    mute: false,
    lock: false,
    solo: false,
    trig: "On load",
    ease: "Ease out",
    rep: "Once",
    rn: 1,
    yoyo: false,
    ss: "top 80%",
    se: "bottom 20%",
    scrub: false,
    pin: false,
    sprev: 0,
    stag: 60,
    sfrom: "Start",
    tr: [
      {
        p: "opacity",
        keys: [
          { id: "k1", t: 0, v: 0, ease: "Ease out" },
          { id: "k2", t: 36, v: 100, ease: "Ease out" },
        ],
      },
      {
        p: "y",
        keys: [
          { id: "k3", t: 0, v: 24, ease: "Ease out" },
          { id: "k4", t: 36, v: 0, ease: "Ease out" },
        ],
      },
    ],
  };

  return (
    <div className="ll:w-80 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
      <LayerInspector layer={sampleLayer} />
    </div>
  );
};

/**
 * 6. Keyframe Inspector Demo:
 * State when keyframes are selected: target, timing, clip, full easing editor, keyframe manipulation.
 */
export const KeyframeInspectorDemo: React.FC = () => {
  const [bezier, setBezier] = useState({ x1: 0, y1: 0, x2: 0.58, y2: 1 });
  const [timecodeVal, setTimecodeVal] = useState("00:01.20");
  const [valueStr, setValueStr] = useState("100");

  return (
    <div className="ll:w-80 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
      <KeyframeInspector
        layer="Headline"
        property="Opacity"
        timecode={timecodeVal}
        onTimecodeChange={setTimecodeVal}
        value={valueStr}
        onValueChange={setValueStr}
        valueSuffix="%"
        duration="00:00.60"
        delay="00:00.00"
        easing="Ease out"
        bezier={bezier}
        onBezierChange={setBezier}
      />
    </div>
  );
};

/**
 * 7. Motion Export Modal Demo:
 * Popover modal demonstrating code generation in 4 flavours: CSS, WAAPI, Framer Motion, GSAP.
 */
export const MotionExportDemo: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ll:h-8 ll:px-3 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-primary ll:hover:bg-surface-bar"
      >
        Toggle Export Modal ({open ? "Open" : "Closed"})
      </button>

      <div className="ll:relative ll:h-120">
        <MotionExportModal
          isOpen={open}
          onClose={() => setOpen(false)}
          className="ll:!relative"
        />
      </div>
    </div>
  );
};

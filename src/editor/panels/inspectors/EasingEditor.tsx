"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { Select } from "@/editor/components/Select";
import { Slider } from "./Slider";
import {
  EZ,
  EZL,
  bezierOf,
  bez,
  springX,
  clampN,
  numStr,
  type Bezier,
  type EaseName,
  type Keyframe,
  type SpringParams,
} from "@/editor/motion-model";
import { defaultHost, prefersReducedMotion } from "@/editor/motion";

export interface EasingPreset {
  name: string;
  bz?: Bezier;
  spring?: SpringParams;
  pts?: [number, number][];
}

export interface EasingEditorProps {
  keyframe: Keyframe;
  onKeyframeChange?: (patch: Partial<Keyframe>) => void;
  onChangeEase?: (ease: EaseName, bz?: Bezier, spring?: SpringParams) => void;
  segmentDurationSec?: number;
  segmentSec?: number;
  presets?: EasingPreset[];
  customPresets?: { name: string; bz?: Bezier; spring?: SpringParams }[];
  onSavePreset?: (preset: { name: string; bz?: Bezier; spring?: SpringParams }) => void;
  className?: string;
}

const EC_W = 288;
const EC_H = 240;
const EC_P = 22;

const DEFAULT_SPRING: SpringParams = { response: 0.35, damping: 0.6 };

export function settleOf(sp: SpringParams): number {
  let t = 3.0;
  const dt = 1 / 120;
  while (t > 0.15 && Math.abs(springX(sp, t) - 1) < 0.005) {
    t -= dt;
  }
  return clampN(t + 0.05, 0.2, 3.0);
}

const TABS = [
  { value: "Curve", label: "Curve" },
  { value: "Spring", label: "Spring" },
] as const;

export const EasingEditor: React.FC<EasingEditorProps> = ({
  keyframe,
  onKeyframeChange: rawOnKeyframeChange,
  onChangeEase,
  segmentDurationSec = 1.0,
  segmentSec,
  presets = [],
  customPresets = [],
  onSavePreset,
  className = "",
}) => {
  const onKeyframeChange = useCallback(
    (patch: Partial<Keyframe>) => {
      rawOnKeyframeChange?.(patch);
      if (onChangeEase) {
        onChangeEase(
          patch.ease ?? keyframe.ease,
          patch.bz ?? keyframe.bz,
          patch.spring ?? keyframe.spring
        );
      }
    },
    [rawOnKeyframeChange, onChangeEase, keyframe]
  );
  const isSpring = keyframe.ease === "Spring";
  const [activeTab, setActiveTab] = useState<string>(isSpring ? "Spring" : "Curve");
  const [activePointIndex, setActivePointIndex] = useState(0);

  const curveSvgRef = useRef<SVGSVGElement>(null);
  const previewSquareRef = useRef<HTMLSpanElement>(null);

  const bz = useMemo<Bezier>(() => bezierOf(keyframe), [keyframe]);
  const sp = useMemo<SpringParams>(() => keyframe.spring ?? DEFAULT_SPRING, [keyframe.spring]);

  // Synchronize tab if ease switches externally
  const [prevEase, setPrevEase] = useState(keyframe.ease);
  if (prevEase !== keyframe.ease) {
    setPrevEase(keyframe.ease);
    setActiveTab(keyframe.ease === "Spring" ? "Spring" : "Curve");
  }

  // Handle Tab Switch
  const handleTabChange = (val: string) => {
    setActiveTab(val);
    if (val === "Spring") {
      onKeyframeChange({
        ease: "Spring",
        spring: keyframe.spring ?? DEFAULT_SPRING,
      });
    } else {
      onKeyframeChange({
        ease: keyframe.bz ? "Custom" : "Ease out",
      });
    }
  };

  // Preview Square Animation Loop
  useEffect(() => {
    const startTime = defaultHost.now();

    const onFrame = (info: { now: number; dt: number; frame: number }) => {
      const sq = previewSquareRef.current;
      if (!sq || !sq.parentElement) return;

      if (prefersReducedMotion()) {
        sq.style.left = "70%";
        return;
      }

      const dur = isSpring ? settleOf(sp) : 0.9;
      const cycle = dur + 0.7;
      const elapsed = ((info.now - startTime) / 1000) % cycle;
      const t = Math.min(1, elapsed / dur);

      let factor = 1;
      if (isSpring) {
        factor = springX(sp, Math.min(elapsed, dur));
      } else {
        factor = bez(bz[0], bz[1], bz[2], bz[3], t);
      }

      const parentW = sq.parentElement.clientWidth || 256;
      const leftPx = parentW * 0.12 + factor * parentW * 0.64;
      sq.style.left = `${leftPx.toFixed(1)}px`;
    };

    const unregister = defaultHost.register(onFrame);
    return () => {
      unregister();
    };
  }, [isSpring, sp, bz]);

  // Curve Plot Geometry
  const { pathD, gridLines, lo, hi, T, X0, Y } = useMemo(() => {
    const N = 96;
    const ys: number[] = [];
    const settle = isSpring ? settleOf(sp) : 1;

    for (let i = 0; i <= N; i++) {
      const u = i / N;
      if (isSpring) {
        ys.push(springX(sp, u * settle));
      } else {
        ys.push(bez(bz[0], bz[1], bz[2], bz[3], u));
      }
    }

    let minVal = Math.min(0, ...ys);
    let maxVal = Math.max(1, ...ys);
    if (!isSpring) {
      minVal = Math.min(minVal, bz[1], bz[3]);
      maxVal = Math.max(maxVal, bz[1], bz[3]);
    }
    minVal -= 0.12;
    maxVal += 0.12;

    const calcX = (u: number) => +(EC_P + u * (EC_W - 2 * EC_P)).toFixed(1);
    const calcY = (v: number) => +(EC_H - EC_P - ((v - minVal) / (maxVal - minVal)) * (EC_H - 2 * EC_P)).toFixed(1);

    let d = "";
    for (let i = 0; i <= N; i++) {
      d += (i ? "L" : "M") + calcX(i / N) + " " + calcY(ys[i]);
    }

    return {
      pathD: d,
      gridLines: [1 / 4, 2 / 4, 3 / 4],
      lo: minVal,
      hi: maxVal,
      T: settle,
      X0: calcX,
      Y: calcY,
    };
  }, [isSpring, sp, bz]);

  // Handle Dragging of Bezier Handles
  const handleKhPointerDown = (handleIndex: 1 | 2, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      const svg = curveSvgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * EC_W;
      const py = ((ev.clientY - rect.top) / rect.height) * EC_H;

      const normX = clampN((px - EC_P) / (EC_W - 2 * EC_P), 0, 1);
      const normY = clampN(lo + ((EC_H - EC_P - py) / (EC_H - 2 * EC_P)) * (hi - lo), -2, 3);

      const nextBz: [number, number, number, number] = [...bz];
      if (handleIndex === 1) {
        nextBz[0] = +normX.toFixed(2);
        nextBz[1] = +normY.toFixed(2);
      } else {
        nextBz[2] = +normX.toFixed(2);
        nextBz[3] = +normY.toFixed(2);
      }

      onKeyframeChange({
        ease: "Custom",
        bz: nextBz,
      });
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleKhKeyDown = (handleIndex: 1 | 2, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!e.key.startsWith("Arrow")) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.1 : 0.01;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = step;
    else if (e.key === "ArrowDown") dy = -step;

    const nextBz: [number, number, number, number] = [...bz];
    if (handleIndex === 1) {
      nextBz[0] = +clampN(nextBz[0] + dx, 0, 1).toFixed(2);
      nextBz[1] = +clampN(nextBz[1] + dy, -2, 3).toFixed(2);
    } else {
      nextBz[2] = +clampN(nextBz[2] + dx, 0, 1).toFixed(2);
      nextBz[3] = +clampN(nextBz[3] + dy, -2, 3).toFixed(2);
    }

    onKeyframeChange({
      ease: "Custom",
      bz: nextBz,
    });
  };

  // Easing Preset Selection
  const easingOptions = useMemo(() => {
    const defaultOptions = EZL.filter((e) => e !== "Spring").map((e) => ({
      value: e,
      label: e,
    }));
    const customPresets = presets.map((p) => ({
      value: p.name,
      label: p.name,
    }));
    return [...defaultOptions, ...customPresets];
  }, [presets]);

  const handleEaseSelect = (name: string) => {
    const matched = presets.find((p) => p.name === name);
    if (matched) {
      if (matched.spring) {
        onKeyframeChange({
          ease: "Spring",
          spring: matched.spring,
        });
      } else {
        onKeyframeChange({
          ease: "Custom",
          bz: matched.bz,
        });
      }
      return;
    }

    if (name === "Custom") {
      onKeyframeChange({ ease: "Custom", bz });
    } else if (EZ[name]) {
      onKeyframeChange({ ease: name as EaseName, bz: EZ[name] });
    } else {
      onKeyframeChange({ ease: name as EaseName });
    }
  };

  const handleSavePreset = () => {
    const presetName = `Custom ${presets.length + 1}`;
    if (isSpring) {
      onSavePreset?.({
        name: presetName,
        spring: sp,
      });
    } else {
      onSavePreset?.({
        name: presetName,
        bz,
      });
    }
  };

  const handleSpringResponseChange = (v: number) => {
    onKeyframeChange({
      spring: { ...sp, response: v },
    });
  };

  const handleSpringDampingChange = (v: number) => {
    onKeyframeChange({
      spring: { ...sp, damping: v },
    });
  };

  const handleBezierParamChange = (index: 0 | 1 | 2 | 3, val: number) => {
    const nextBz: [number, number, number, number] = [...bz];
    nextBz[index] = val;
    onKeyframeChange({
      ease: "Custom",
      bz: nextBz,
    });
  };

  const settleDuration = settleOf(sp);
  const springCutoff = segmentDurationSec < settleDuration;
  const springCutoffX = X0(segmentDurationSec / settleDuration);

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* 1. Mode Segmented Control: Curve / Spring */}
      <SegmentedControl
        size="sm"
        ariaLabel="Easing type"
        value={activeTab}
        onChange={handleTabChange}
        options={TABS}
      />

      {/* 2. Curve / Spring SVG Plot */}
      <div className="ll-kce ll-ec ll:relative ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
        <svg
          ref={curveSvgRef}
          className="ll-kcurve ll:block ll:w-full ll:text-control-primary"
          style={{ height: "240px" }}
          viewBox={`0 0 ${EC_W} ${EC_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={isSpring ? "Spring response curve" : `${keyframe.ease} easing curve`}
        >
          {/* Vertical quarter guidelines */}
          {gridLines.map((u, i) => (
            <line
              key={i}
              className="ll-x"
              x1={X0(u)}
              x2={X0(u)}
              y1={EC_P}
              y2={EC_H - EC_P}
            />
          ))}

          {/* Horizontal bounds (0 and 1) */}
          <line className="ll-g" x1={EC_P} x2={EC_W - EC_P} y1={Y(0)} y2={Y(0)} />
          <line className="ll-g" x1={EC_P} x2={EC_W - EC_P} y1={Y(1)} y2={Y(1)} />

          {/* Spring segment cutoff line */}
          {isSpring && springCutoff && (
            <line
              className="ll-sg"
              x1={springCutoffX}
              x2={springCutoffX}
              y1={EC_P}
              y2={EC_H - EC_P}
            />
          )}

          {/* Bezier Tangent Handle Lines */}
          {!isSpring && (
            <>
              <line
                className="ll-hn"
                x1={X0(0)}
                y1={Y(0)}
                x2={X0(bz[0])}
                y2={Y(bz[1])}
              />
              <line
                className="ll-hn"
                x1={X0(1)}
                y1={Y(1)}
                x2={X0(bz[2])}
                y2={Y(bz[3])}
              />
            </>
          )}

          {/* The Easing Curve Path */}
          <path d={pathD} />
        </svg>

        {/* Start and End Anchor points for Curve */}
        {!isSpring && (
          <>
            <i
              className="ll-kp"
              style={{
                left: `${(X0(0) / EC_W) * 100}%`,
                top: `${(Y(0) / EC_H) * 100}%`,
              }}
            />
            <i
              className="ll-kp"
              style={{
                left: `${(X0(1) / EC_W) * 100}%`,
                top: `${(Y(1) / EC_H) * 100}%`,
              }}
            />

            {/* Bezier Handle 1 */}
            <button
              type="button"
              className="ll-kh"
              aria-label="Ease out handle, arrow keys to move"
              title="Drag to shape the curve"
              style={{
                left: `${(X0(bz[0]) / EC_W) * 100}%`,
                top: `${(Y(bz[1]) / EC_H) * 100}%`,
              }}
              onPointerDown={(e) => handleKhPointerDown(1, e)}
              onKeyDown={(e) => handleKhKeyDown(1, e)}
            >
              <i />
            </button>

            {/* Bezier Handle 2 */}
            <button
              type="button"
              className="ll-kh"
              aria-label="Ease in handle, arrow keys to move"
              title="Drag to shape the curve"
              style={{
                left: `${(X0(bz[2]) / EC_W) * 100}%`,
                top: `${(Y(bz[3]) / EC_H) * 100}%`,
              }}
              onPointerDown={(e) => handleKhPointerDown(2, e)}
              onKeyDown={(e) => handleKhKeyDown(2, e)}
            >
              <i />
            </button>
          </>
        )}
      </div>

      {/* 3. Traveling Preview Strip */}
      <div
        className="ll-ecv ll:relative ll:h-8 ll:border ll:border-border ll:rounded-sm ll:bg-surface-canvas ll:overflow-hidden"
        aria-hidden="true"
      >
        <span ref={previewSquareRef} className="ll-ecq" />
      </div>

      {/* 4. Controls depending on Tab */}
      {isSpring ? (
        <div className="ll:flex ll:flex-col ll:gap-2">
          {/* Response Slider */}
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:w-24 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Response (s)
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <Slider
                min={0.1}
                max={1.5}
                step={0.01}
                value={sp.response}
                onChange={handleSpringResponseChange}
                unit=" s"
                ariaLabel="Spring response in seconds"
              />
            </div>
            <span className="ll:w-10 ll:text-right ll:font-mono ll:text-micro ll:text-primary">
              {sp.response.toFixed(2)}
            </span>
          </div>

          {/* Damping Slider */}
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:w-24 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Damping
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <Slider
                min={0.1}
                max={1.0}
                step={0.01}
                value={sp.damping}
                onChange={handleSpringDampingChange}
                ariaLabel="Damping ratio"
              />
            </div>
            <span className="ll:w-10 ll:text-right ll:font-mono ll:text-micro ll:text-primary">
              {sp.damping.toFixed(2)}
            </span>
          </div>

          {/* Settle info string */}
          <div className="ll:text-micro ll:text-muted ll:leading-snug">
            Settles in {settleDuration.toFixed(2)} s.
            {segmentDurationSec ? ` This segment lasts ${segmentDurationSec.toFixed(2)} s` : ""}
            {springCutoff ? " and cuts it short." : "."}
          </div>
        </div>
      ) : (
        <div className="ll:flex ll:flex-col ll:gap-2">
          {/* Easing Dropdown */}
          <Select
            size="sm"
            aria-label="Easing"
            value={keyframe.ease}
            onChange={handleEaseSelect}
            options={easingOptions}
          />

          {/* Bezier parameter fields */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-2">
            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm">
              <label className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                x1
              </label>
              <input
                type="text"
                aria-label="x1"
                value={numStr(bz[0])}
                onChange={(e) => handleBezierParamChange(0, parseFloat(e.target.value) || 0)}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm">
              <label className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                y1
              </label>
              <input
                type="text"
                aria-label="y1"
                value={numStr(bz[1])}
                onChange={(e) => handleBezierParamChange(1, parseFloat(e.target.value) || 0)}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
          </div>

          <div className="ll:grid ll:grid-cols-2 ll:gap-2">
            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm">
              <label className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                x2
              </label>
              <input
                type="text"
                aria-label="x2"
                value={numStr(bz[2])}
                onChange={(e) => handleBezierParamChange(2, parseFloat(e.target.value) || 0)}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm">
              <label className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                y2
              </label>
              <input
                type="text"
                aria-label="y2"
                value={numStr(bz[3])}
                onChange={(e) => handleBezierParamChange(3, parseFloat(e.target.value) || 0)}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
          </div>

          <div className="ll:text-micro ll:leading-snug ll:text-muted">
            Drag the handles, or click the curve to add points. Eases the segment to the next keyframe.
          </div>
        </div>
      )}

      {/* 5. Save as preset button */}
      <button
        type="button"
        onClick={handleSavePreset}
        className="ll:h-7 ll:w-full ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:transition-colors"
      >
        Save as preset
      </button>
    </div>
  );
};

export default EasingEditor;

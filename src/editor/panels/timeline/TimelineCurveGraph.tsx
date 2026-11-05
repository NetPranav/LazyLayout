"use client";

import React, { useRef, useState } from "react";
import { Icon } from "@/editor/components/Icon";
import { Type, Square, Image as ImageIcon, Sparkles } from "lucide-react";
import {
  useMotionModel,
  motionActions,
  X,
  Fx,
  PROPS,
  formatValue,
  valueAt,
  layerName,
  layerType,
  bezierOf,
  clampN,
  numStr,
} from "@/editor/motion-model";
import type { PropId, Keyframe } from "@/editor/motion-model";

export interface TimelineCurveGraphProps {
  trackWidth?: number;
  laneWidth?: number;
  pps?: number;
  selectedLayerId?: string;
  // Legacy compatibility props
  onClose?: () => void;
  onApplyEase?: (easeName: string) => void;
}

function niceStep(r: number): number {
  const e = Math.pow(10, Math.floor(Math.log10(r)));
  const m = r / e;
  const factor = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return factor * e;
}

export const TimelineCurveGraph: React.FC<TimelineCurveGraphProps> = ({
  trackWidth = 264,
  laneWidth = 600,
  pps = 100,
  selectedLayerId,
  onClose: _onClose,
  onApplyEase: _onApplyEase,
}) => {
  const comp = useMotionModel((s) => s.comp);
  const playhead = useMotionModel((s) => s.playhead);
  const fps = useMotionModel((s) => s.fps);
  const t0 = useMotionModel((s) => s.t0);
  const selectedProp = useMotionModel((s) => s.selectedProp);
  const selectedKeys = useMotionModel((s) => s.selectedKeys);

  const [activeProp, setActiveProp] = useState<PropId>("opacity");
  const graphContainerRef = useRef<HTMLDivElement | null>(null);

  // Determine which layer to plot
  const targetLayer =
    (selectedLayerId ? comp.layers.find((l) => l.id === selectedLayerId) : null) ??
    comp.layers.find((l) => l.tr.length > 0) ??
    comp.layers[0];

  if (!targetLayer || targetLayer.tr.length === 0) {
    return (
      <div
        style={{ gridTemplateColumns: `${trackWidth}px minmax(0, 1fr)` }}
        className="ll-gvb ll:grid ll:flex-1 ll:min-h-0 ll:h-full"
      >
        <div className="ll-gvl ll:border-r ll:border-border ll:bg-surface-panel ll:p-3 ll:text-muted ll:font-sans ll:text-xs">
          No animated tracks
        </div>
        <div className="ll-gvp ll:flex ll:items-center ll:justify-center ll:text-muted ll:font-sans ll:text-xs">
          Select an animated layer to inspect curves
        </div>
      </div>
    );
  }

  // Active property track
  const currentPropId = selectedProp?.layerId === targetLayer.id ? selectedProp.p : activeProp;
  const track = targetLayer.tr.find((t) => t.p === currentPropId) ?? targetLayer.tr[0];
  const spec = PROPS[track.p];
  const ks = track.keys;

  const H = 220; // Canvas height
  const pm = 20; // Vertical padding in px
  const W = Math.max(600, laneWidth);

  // Compute vertical min & max
  let lo = Infinity;
  let hi = -Infinity;
  for (const k of ks) {
    lo = Math.min(lo, k.v);
    hi = Math.max(hi, k.v);
  }

  if (ks.length > 1) {
    for (let i = 0; i <= 80; i++) {
      const t = ks[0].t + ((ks[ks.length - 1].t - ks[0].t) * i) / 80;
      const v = valueAt(targetLayer, track.p, t);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }

  if (!isFinite(lo) || !isFinite(hi) || Math.abs(hi - lo) < 1e-4) {
    lo = (isFinite(lo) ? lo : spec.d) - 10;
    hi = (isFinite(hi) ? hi : spec.d) + 10;
  }
  const padVal = (hi - lo) * 0.14;
  lo -= padVal;
  hi += padVal;

  const gY = (v: number) => H - pm - ((v - lo) / (hi - lo)) * (H - 2 * pm);
  const gV = (y: number) => lo + ((H - pm - y) / (H - 2 * pm)) * (hi - lo);

  // Grid lines
  const step = niceStep((hi - lo) / 4);
  const gridLines: Array<{ v: number; y: number }> = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    gridLines.push({ v, y: gY(v) });
  }

  // Curve path SVG data
  let curvePath = "";
  if (ks.length > 0) {
    const x0 = X(ks[0].t, pps, t0, 24, fps);
    const x1 = X(ks[ks.length - 1].t, pps, t0, 24, fps);
    const n = Math.max(8, Math.min(480, Math.round((x1 - x0) / 2)));
    for (let i = 0; i <= n; i++) {
      const t = ks[0].t + ((ks[ks.length - 1].t - ks[0].t) * i) / n;
      const x = X(t, pps, t0, 24, fps);
      const y = gY(valueAt(targetLayer, track.p, t));
      curvePath += (i === 0 ? "M" : "L") + `${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }

  // Playhead value indicator dot
  const currentVal = valueAt(targetLayer, track.p, playhead);
  const dotX = X(playhead, pps, t0, 24, fps);
  const dotY = gY(currentVal);

  // Keyframe drag in Graph view
  const handleKeyDrag = (e: React.PointerEvent, k: Keyframe) => {
    if (e.button !== 0 || targetLayer.lock) return;
    e.stopPropagation();
    e.preventDefault();

    motionActions.selectKeys([k.id], false);
    const startX = e.clientX;
    const startY = e.clientY;
    const initialT = k.t;
    const initialV = k.v;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;
      const deltaF = Math.round((deltaX / pps) * fps);
      const nextT = clampN(initialT + deltaF, 0, comp.dur);
      const nextV = clampN(
        initialV - (deltaY / (H - 2 * pm)) * (hi - lo),
        spec.lo,
        spec.hi
      );

      motionActions.setKeyTime(k.id, nextT);
      motionActions.setKeyValue(k.id, +nextV.toFixed(2));
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Tangent handle drag
  const handleTangentDrag = (e: React.PointerEvent, a: Keyframe, b: Keyframe, handleIdx: 1 | 2) => {
    if (e.button !== 0 || targetLayer.lock) return;
    e.stopPropagation();
    e.preventDefault();

    const dt = b.t - a.t;
    const dv = b.v - a.v;
    const rect = graphContainerRef.current?.getBoundingClientRect();

    const onPointerMove = (ev: PointerEvent) => {
      if (!rect) return;
      const rawX = ev.clientX - rect.left;
      const rawY = ev.clientY - rect.top;
      const currentF = Fx(rawX, pps, t0, 24, fps);
      const currentVal = gV(rawY);

      const bz = [...bezierOf(a)] as [number, number, number, number];
      if (handleIdx === 1) {
        bz[0] = clampN((currentF - a.t) / (dt || 1), 0, 1);
        bz[1] = Math.abs(dv) > 1e-4 ? clampN((currentVal - a.v) / dv, -2, 3) : 0;
      } else {
        bz[2] = clampN((currentF - a.t) / (dt || 1), 0, 1);
        bz[3] = Math.abs(dv) > 1e-4 ? clampN((currentVal - a.v) / dv, -2, 3) : 1;
      }

      motionActions.setKeyEase(a.id, "Custom", bz);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const layerTypeKey = layerType(targetLayer.id);
  const TargetIconComp =
    layerTypeKey === "text"
      ? Type
      : layerTypeKey === "button"
      ? Square
      : layerTypeKey === "image"
      ? ImageIcon
      : Sparkles;

  return (
    <div
      style={{ gridTemplateColumns: `${trackWidth}px minmax(0, 1fr)` }}
      className="ll-gvb ll:grid ll:flex-1 ll:min-h-0 ll:h-full ll:bg-surface-panel ll:select-none"
    >
      {/* 1. Left property column */}
      <div className="ll-gvl ll:flex ll:flex-col ll:border-r ll:border-border ll:bg-surface-panel ll:overflow-y-auto">
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:px-3 ll:h-8 ll:border-b ll:border-border ll:bg-surface-panel ll:font-sans ll:text-xs ll:font-semibold ll:text-primary">
          <Icon icon={TargetIconComp} size={13} className="ll:text-muted" />
          <span>{layerName(targetLayer.id)}</span>
        </div>

        {targetLayer.tr.map((t) => {
          const isCurrent = t.p === currentPropId;
          const pSpec = PROPS[t.p];
          const val = valueAt(targetLayer, t.p, playhead);

          return (
            <div
              key={t.p}
              onClick={() => {
                setActiveProp(t.p);
                motionActions.setSelectedProp(targetLayer.id, t.p);
              }}
              className={`ll:flex ll:items-center ll:justify-between ll:px-3 ll:h-7 ll:border-b ll:border-border ll:cursor-pointer ll:transition-colors ${
                isCurrent
                  ? "ll:bg-surface-hover ll:text-primary ll:font-medium"
                  : "ll:text-secondary ll:hover:bg-surface-hover"
              }`}
            >
              <span className="ll:font-sans ll:text-nano">{pSpec.n}</span>
              <span className="ll:font-mono ll:text-nano ll:text-primary">
                {formatValue(t.p, val)}
              </span>
            </div>
          );
        })}
      </div>

      {/* 2. Right Canvas: Curve plot */}
      <div
        ref={graphContainerRef}
        className="ll-gvp ll:relative ll:h-full ll:w-full ll:overflow-hidden ll:bg-surface-panel"
      >
        <svg
          style={{ width: `${W}px`, height: `${H}px` }}
          viewBox={`0 0 ${W} ${H}`}
          className="ll-gvs ll:absolute ll:left-0 ll:top-0"
        >
          {/* Horizontal value grid lines */}
          {gridLines.map((gl) => (
            <line
              key={`gl-${gl.v}`}
              x1={0}
              x2={W}
              y1={gl.y}
              y2={gl.y}
              stroke="var(--ll-color-border)"
              strokeWidth={1}
            />
          ))}

          {/* Curve Path */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke="var(--ll-color-control-active)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}

          {/* Tangent handle lines */}
          {ks.map((k, idx) => {
            if (idx >= ks.length - 1) return null;
            const nextK = ks[idx + 1];
            if (k.ease === "Spring") return null;

            const bz = bezierOf(k);
            const dt = nextK.t - k.t;
            const dv = nextK.v - k.v;

            const h1x = X(k.t + bz[0] * dt, pps, t0, 24, fps);
            const h1y = gY(k.v + bz[1] * dv);
            const h2x = X(k.t + bz[2] * dt, pps, t0, 24, fps);
            const h2y = gY(k.v + bz[3] * dv);

            const ax = X(k.t, pps, t0, 24, fps);
            const ay = gY(k.v);
            const bx = X(nextK.t, pps, t0, 24, fps);
            const by = gY(nextK.v);

            return (
              <React.Fragment key={`tan-${k.id}`}>
                <line
                  x1={ax}
                  y1={ay}
                  x2={h1x}
                  y2={h1y}
                  stroke="var(--ll-color-text-muted)"
                  strokeWidth={1}
                />
                <line
                  x1={bx}
                  y1={by}
                  x2={h2x}
                  y2={h2y}
                  stroke="var(--ll-color-text-muted)"
                  strokeWidth={1}
                />
              </React.Fragment>
            );
          })}
        </svg>

        {/* Value labels on grid */}
        {gridLines.map((gl) => (
          <span
            key={`lbl-${gl.v}`}
            style={{ left: "8px", top: `${gl.y - 12}px` }}
            className="ll-gvy ll:absolute ll:font-mono ll:text-nano ll:text-muted ll:pointer-events-none"
          >
            {numStr(gl.v)}
            {spec.u}
          </span>
        ))}

        {/* Bezier Tangent Handle knobs */}
        {ks.map((k, idx) => {
          if (idx >= ks.length - 1) return null;
          const nextK = ks[idx + 1];
          if (k.ease === "Spring") return null;

          const bz = bezierOf(k);
          const dt = nextK.t - k.t;
          const dv = nextK.v - k.v;

          const h1x = X(k.t + bz[0] * dt, pps, t0, 24, fps);
          const h1y = gY(k.v + bz[1] * dv);
          const h2x = X(k.t + bz[2] * dt, pps, t0, 24, fps);
          const h2y = gY(k.v + bz[3] * dv);

          return (
            <React.Fragment key={`knobs-${k.id}`}>
              <div
                onPointerDown={(e) => handleTangentDrag(e, k, nextK, 1)}
                style={{ left: `${h1x}px`, top: `${h1y}px` }}
                title="Ease out handle"
                className="ll-gh ll:absolute ll:w-4 ll:h-4 ll:-translate-x-1/2 ll:-translate-y-1/2 ll:flex ll:items-center ll:justify-center ll:cursor-grab ll:z-20"
              >
                <i className="ll:w-2 ll:h-2 ll:rounded-xs ll:bg-surface-panel ll:border ll:border-primary" />
              </div>

              <div
                onPointerDown={(e) => handleTangentDrag(e, k, nextK, 2)}
                style={{ left: `${h2x}px`, top: `${h2y}px` }}
                title="Ease in handle"
                className="ll-gh ll:absolute ll:w-4 ll:h-4 ll:-translate-x-1/2 ll:-translate-y-1/2 ll:flex ll:items-center ll:justify-center ll:cursor-grab ll:z-20"
              >
                <i className="ll:w-2 ll:h-2 ll:rounded-xs ll:bg-surface-panel ll:border ll:border-primary" />
              </div>
            </React.Fragment>
          );
        })}

        {/* Keyframe diamond handles */}
        {ks.map((k) => {
          const x = X(k.t, pps, t0, 24, fps);
          const y = gY(k.v);
          const isSel = !!selectedKeys[k.id];

          return (
            <div
              key={`gk-${k.id}`}
              onPointerDown={(e) => handleKeyDrag(e, k)}
              style={{ left: `${x}px`, top: `${y}px` }}
              title={`${spec.n} ${k.v}${spec.u} at ${k.t}`}
              className="ll-gk ll:absolute ll:w-4 ll:h-4 ll:-translate-x-1/2 ll:-translate-y-1/2 ll:flex ll:items-center ll:justify-center ll:cursor-grab ll:z-20"
            >
              <i
                className={`ll:w-2.5 ll:h-2.5 ll:rotate-45 ll:transition-transform ${
                  isSel
                    ? "ll:bg-control-active ll:scale-125 ll:ring-2 ll:ring-control-active"
                    : "ll:bg-secondary ll:hover:bg-primary"
                }`}
              />
            </div>
          );
        })}

        {/* Value Playhead Dot */}
        {ks.length > 0 && (
          <i
            style={{
              left: `${dotX}px`,
              top: `${dotY}px`,
              display: dotX < 0 || dotX > W ? "none" : "block",
            }}
            className="ll-gdot ll:absolute ll:w-2 ll:h-2 ll:-translate-x-1/2 ll:-translate-y-1/2 ll:rounded-xs ll:bg-control-active ll:shadow-xs ll:pointer-events-none ll:z-30"
          />
        )}
      </div>
    </div>
  );
};

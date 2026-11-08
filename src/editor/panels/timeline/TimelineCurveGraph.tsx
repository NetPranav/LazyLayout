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
        style={{ gridTemplateColumns: `var(--hw, ${trackWidth}px) minmax(0, 1fr)` }}
        className="gvb ll-gvb ll:grid ll:flex-1 ll:min-h-0 ll:h-full ll:bg-surface-panel"
      >
        <div className="gvl ll-gvl ll:border-r ll:border-border ll:bg-surface-panel" />
        <div className="gvp ll-gvp ll:relative ll:h-full ll:w-full ll:overflow-hidden ll:bg-surface-panel">
          <div className="gve ll-gve ll:absolute ll:inset-0 ll:flex ll:items-center ll:justify-center ll:text-muted ll:font-sans ll:text-xs">
            Select an animated layer to see its curves
          </div>
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
      style={{ gridTemplateColumns: `var(--hw, ${trackWidth}px) minmax(0, 1fr)` }}
      className="gvb ll-gvb ll:grid ll:flex-1 ll:min-h-0 ll:h-full ll:bg-surface-panel ll:select-none"
    >
      <style>{`
        .gvb { flex: 1; min-height: 0; display: grid; }
        .gvl { min-height: 0; overflow-y: auto; border-bottom: 0; }
        .gvl .tlrow { display: flex; height: 32px; border-bottom: 1px solid var(--ll-border, var(--border)); }
        .gvl .tlrow.prp { height: 32px; }
        .gvl .tlrow .tlhc { height: 100%; width: 100%; display: flex; align-items: center; }
        .gvl .tlrow.prp .tlhc { padding-left: 24px; padding-right: 12px; justify-content: space-between; }
        .gvl .tlrow.prp[data-on] .tlhc { background: var(--ll-surface-hover, var(--hover)); box-shadow: inset 2px 0 0 var(--ll-control-primary-bg, var(--ctl)); }
        .gvp { position: relative; min-width: 0; min-height: 0; overflow: hidden; isolation: isolate; }
        .gvs { position: absolute; left: 0; top: 0; display: block; }
        .gvs .g { stroke: var(--ll-border, var(--border)); stroke-width: 1; shape-rendering: crispEdges; }
        .gvs .c { fill: none; stroke: var(--ll-control-primary-bg, var(--ctl)); stroke-width: 1.5; stroke-linejoin: round; }
        .gvs .f { fill: none; stroke: var(--ll-text-muted, var(--muted)); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.7; }
        .gvs .hn { stroke: var(--ll-text-muted, var(--muted)); stroke-width: 1; }
        .gvy { position: absolute; left: 8px; font: 400 10px/1 var(--ll-font-mono, monospace); color: var(--ll-text-muted, var(--muted)); pointer-events: none; transform: translateY(calc(-100% - 2px)); }
        .gk { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; display: grid; place-items: center; cursor: grab; touch-action: none; }
        .gk i { width: 9px; height: 9px; background: var(--ll-text-secondary, var(--text2)); transform: rotate(45deg); pointer-events: none; transition: background 0.12s; }
        .gk:hover i { background: var(--ll-text-primary, var(--text)); }
        .gk.sel i { width: 11px; height: 11px; background: var(--ll-control-primary-bg, var(--ctl)); box-shadow: 0 0 0 2px var(--ll-surface-panel, var(--panel)), 0 0 0 3px var(--ll-control-primary-bg, var(--ctl)); }
        .gh { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; display: grid; place-items: center; cursor: grab; touch-action: none; }
        .gh i { width: 7px; height: 7px; border-radius: 2px; background: var(--ll-surface-panel, var(--panel)); border: 1.5px solid var(--ll-text-primary, var(--text)); pointer-events: none; }
        .gdot { position: absolute; left: 0; top: 0; width: 7px; height: 7px; margin: -3px 0 0 -3px; border-radius: 2px; background: var(--ll-control-primary-bg, var(--ctl)); box-shadow: 0 0 0 2px var(--ll-surface-panel, var(--panel)); pointer-events: none; }
        .gve { position: absolute; inset: 0; display: grid; place-items: center; font: 400 12px var(--ll-font-sans, sans-serif); color: var(--ll-text-muted, var(--muted)); }
      `}</style>

      {/* 1. Left property column */}
      <div className="gvl ll-gvl ll:flex ll:flex-col ll:border-r ll:border-border ll:bg-surface-panel ll:overflow-y-auto">
        <div className="tlrow lay ll-tlrow ll:flex ll:items-center ll:h-8 ll:border-b ll:border-border ll:bg-surface-panel" data-l={targetLayer.id}>
          <div className="tlhc ll-tlhc ll:flex ll:items-center ll:gap-1.5 ll:px-3 ll:h-full ll:w-full ll:font-sans ll:text-xs ll:font-semibold ll:text-primary">
            <Icon icon={TargetIconComp} size={13} className="lty ll:text-muted ll:mr-1" />
            <button
              type="button"
              className="tlnm ll-tlnm ll:bg-transparent ll:border-0 ll:p-0 ll:text-left ll:cursor-pointer ll:text-inherit"
              data-la="sel"
              data-l={targetLayer.id}
            >
              {layerName(targetLayer.id)}
            </button>
          </div>
        </div>

        {targetLayer.tr.map((t, j) => {
          const isCurrent = t.p === currentPropId;
          const pSpec = PROPS[t.p];
          const val = valueAt(targetLayer, t.p, playhead);

          return (
            <div
              key={t.p}
              data-l={targetLayer.id}
              data-p={t.p}
              data-on={isCurrent ? "" : undefined}
              onClick={() => {
                setActiveProp(t.p);
                motionActions.setSelectedProp(targetLayer.id, t.p);
              }}
              className={`tlrow prp ll-tlrow ${j % 2 === 1 ? "alt" : ""} ${
                isCurrent ? "ll:bg-surface-hover" : ""
              } ll:flex ll:items-center ll:h-8 ll:border-b ll:border-border ll:cursor-pointer ll:transition-colors`}
            >
              <div className="tlhc ll-tlhc ll:flex ll:items-center ll:justify-between ll:px-6 ll:h-full ll:w-full">
                <button
                  type="button"
                  data-pa="sel"
                  data-l={targetLayer.id}
                  data-p={t.p}
                  className="tlnm ll-tlnm ll:font-sans ll:text-nano ll:text-secondary ll:bg-transparent ll:border-0 ll:p-0 ll:text-left ll:cursor-pointer"
                >
                  {pSpec.n}
                </button>
                <span className="rd ll-rd ll:min-w-10 ll:text-right ll:font-mono ll:text-nano ll:text-primary">
                  {formatValue(t.p, val)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Right Canvas: Curve plot */}
      <div
        id="gvp"
        ref={graphContainerRef}
        className="gvp ll-gvp ll:relative ll:h-full ll:w-full ll:overflow-hidden ll:bg-surface-panel"
      >
        <svg
          style={{ width: `${W}px`, height: `${H}px` }}
          viewBox={`0 0 ${W} ${H}`}
          className="gvs ll-gvs ll:absolute ll:left-0 ll:top-0"
        >
          {/* Horizontal value grid lines */}
          {gridLines.map((gl) => (
            <line
              key={`gl-${gl.v}`}
              x1={0}
              x2={W}
              y1={Math.round(gl.y) + 0.5}
              y2={Math.round(gl.y) + 0.5}
              className="g"
            />
          ))}

          {/* Boundaries dashed lines */}
          {ks.length > 0 && (
            <path
              className="f"
              d={`M0 ${gY(ks[0].v).toFixed(1)}H${X(ks[0].t, pps, t0, 24, fps).toFixed(1)}M${X(ks[ks.length - 1].t, pps, t0, 24, fps).toFixed(1)} ${gY(ks[ks.length - 1].v).toFixed(1)}H${W}`}
            />
          )}

          {/* Curve Path */}
          {curvePath && <path d={curvePath} className="c" />}

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
                <line x1={ax} y1={ay} x2={h1x} y2={h1y} className="hn" />
                <line x1={bx} y1={by} x2={h2x} y2={h2y} className="hn" />
              </React.Fragment>
            );
          })}
        </svg>

        {/* Value labels on grid */}
        {gridLines.map((gl) => (
          <span
            key={`lbl-${gl.v}`}
            style={{ left: "8px", top: `${gl.y.toFixed(1)}px` }}
            className="gvy ll-gvy"
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
                style={{ left: `${h1x.toFixed(1)}px`, top: `${h1y.toFixed(1)}px` }}
                title="Ease out handle"
                data-gh="1"
                data-gs={k.id}
                className="gh ll-gh"
              >
                <i />
              </div>

              <div
                onPointerDown={(e) => handleTangentDrag(e, k, nextK, 2)}
                style={{ left: `${h2x.toFixed(1)}px`, top: `${h2y.toFixed(1)}px` }}
                title="Ease in handle"
                data-gh="2"
                data-gs={k.id}
                className="gh ll-gh"
              >
                <i />
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
              data-gk={k.id}
              onPointerDown={(e) => handleKeyDrag(e, k)}
              style={{ left: `${x.toFixed(1)}px`, top: `${y.toFixed(1)}px` }}
              title={`${spec.n} ${k.v}${spec.u} at ${k.t}`}
              className={`gk ll-gk ${isSel ? "sel" : ""}`}
            >
              <i />
            </div>
          );
        })}

        {/* Value Playhead Dot */}
        {ks.length > 0 && (
          <i
            id="gdot"
            style={{
              left: `${dotX}px`,
              top: `${dotY}px`,
              display: dotX < 0 || dotX > W ? "none" : "block",
            }}
            className="gdot ll-gdot"
          />
        )}
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * STAGE 5 · PHASE 215 — RIG EXPORT RUNTIME
 * ============================================================================
 * Tree-shaken `rig` runtime module copied only when a document uses rigs, for Next.js, Vite and plain HTML:
 * forward kinematics, the keyframed pose track, and an SVG player that draws the bones and plays the track
 * (first pose only under prefers-reduced-motion). Parity checks run the exported runtime itself, for both the pose
 * sampling and the bone transforms. Lottie JSON bone export is separate.
 *
 * Not exported yet: skinned meshes (linear-blend skinning lives in rigModel.ts but the runtime draws bones only),
 * and Canvas/WebGL drawing (`renderRigOutput` returns raw points for those modes; the player always draws SVG).
 * Review 2026-11-17: the Next.js output used to render an empty <div data-bones>, and nothing played the track.
 * ============================================================================
 */

import {
  type RigDefinition,
  type RigPoseMap,
  type WorldBoneTransform,
  evaluateRigWorldTransforms,
} from "./rigModel";
import { evaluatePoseTrackAtTime, type BonePoseTrack } from "./boneTimeline";

export type RigExportTarget = "nextjs" | "vite" | "html";
export type RigSkinRenderMode = "svg" | "canvas" | "webgl";

export interface RigExportBundle {
  readonly target: RigExportTarget;
  readonly renderMode: RigSkinRenderMode;
  /** The exported player draws bones as SVG lines (whatever `renderMode` is). */
  readonly drawnWith: "svg";
  /** False: skinned meshes are not exported yet; only the skeleton is drawn. */
  readonly skinsMeshes: false;
  readonly includesRigRuntime: boolean;
  readonly files: Record<string, string>;
  readonly checkpoints: readonly {
    readonly timeSec: number;
    readonly boneWorldHeads: Record<string, { x: number; y: number }>;
    readonly boneWorldTails: Record<string, { x: number; y: number }>;
  }[];
}

export interface LottieBoneLayer {
  readonly ddd: 0;
  readonly ind: number;
  readonly ty: 3;
  readonly nm: string;
  readonly parent?: number;
  readonly ks: {
    readonly p: { readonly a: 0; readonly k: readonly [number, number, number] };
    readonly a: { readonly a: 0; readonly k: readonly [number, number, number] };
    readonly s: { readonly a: 1; readonly k: readonly unknown[] } | { readonly a: 0; readonly k: readonly [number, number, number] };
    readonly r: { readonly a: 1; readonly k: readonly unknown[] };
  };
  readonly ip: number;
  readonly op: number;
  readonly st: 0;
}

export interface LottieRigAnimation {
  readonly v: "5.7.4";
  readonly fr: number;
  readonly ip: number;
  readonly op: number;
  readonly w: number;
  readonly h: number;
  readonly nm: string;
  readonly layers: readonly LottieBoneLayer[];
}

/** Include the `rig` runtime module only when a project actually uses rigs. */
export function shouldIncludeRigRuntime(hasRigs: boolean): boolean {
  return Boolean(hasRigs);
}

/** Emit the standalone MIT-licensed JS runtime: FK, the pose track, and an SVG bone player (no skinning yet). */
export function emitRigRuntimeSource(renderMode: RigSkinRenderMode): string {
  const renderAdapter =
    renderMode === "svg"
      ? `export function renderRigOutput(pts){return "M "+pts.map(p=>p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" L ");}`
      : renderMode === "canvas"
        ? `export function renderRigOutput(pts){return pts;}`
        : `export function renderRigOutput(pts){const f=new Float32Array(pts.length*2);for(let i=0;i<pts.length;i++){f[i*2]=pts[i].x;f[i*2+1]=pts[i].y;}return f;}`;

  return `/* LazyLayout Vendored Rig Runtime (MIT License) */
const D2R = Math.PI / 180;
export function mul2d(m1, m2) {
  return [
    m1[0]*m2[0]+m1[2]*m2[1], m1[1]*m2[0]+m1[3]*m2[1],
    m1[0]*m2[2]+m1[2]*m2[3], m1[1]*m2[2]+m1[3]*m2[3],
    m1[0]*m2[4]+m1[2]*m2[5]+m1[4], m1[1]*m2[4]+m1[3]*m2[5]+m1[5],
  ];
}
export function evalRig(rig, pose = {}) {
  const out = {};
  const byId = {};
  for (const b of rig.bones) byId[b.id] = b;
  const order = [];
  const seen = {};
  const visit = (b) => {
    if (seen[b.id]) return;
    seen[b.id] = true;
    if (b.parentId && byId[b.parentId]) visit(byId[b.parentId]);
    order.push(b);
  };
  for (const b of rig.bones) visit(b);
  for (const b of order) {
    const p = pose[b.id] || {};
    const parent = b.parentId ? byId[b.parentId] : null;
    const pw = b.parentId ? out[b.parentId] : null;
    const ax = (parent ? parent.length : 0) + b.restX + (p.dx || 0);
    const ay = b.restY + (p.dy || 0);
    const rad = (b.restRotationDeg + (p.rotationDeg || 0)) * D2R;
    const sx = (b.restScaleX || 1) * (p.scaleX || 1);
    const sy = (b.restScaleY || 1) * (p.scaleY || 1);
    const c = Math.cos(rad), s = Math.sin(rad);
    const loc = [c*sx, s*sx, -s*sy, c*sy, ax, ay];
    const m = pw ? mul2d(pw.matrix, loc) : loc;
    out[b.id] = {
      matrix: m,
      head: { x: m[4], y: m[5] },
      tail: { x: m[0]*b.length + m[4], y: m[1]*b.length + m[5] },
    };
  }
  return out;
}
${renderAdapter}
function lerpAngle(a, b, t) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}
export function samplePose(track, t) {
  if (!track.length) return {};
  const keys = [...track].sort((k1, k2) => k1.timeSec - k2.timeSec);
  if (t <= keys[0].timeSec) return keys[0].pose;
  const last = keys[keys.length - 1];
  if (t >= last.timeSec) return last.pose;
  for (let i = 1; i < keys.length; i++) {
    const k0 = keys[i - 1], k1 = keys[i];
    if (t <= k1.timeSec) {
      const span = k1.timeSec - k0.timeSec;
      let u = span <= 1e-9 ? 1 : (t - k0.timeSec) / span;
      u = Math.max(0, Math.min(1, u));
      if (k0.easing === "easeInOut") u = u * u * (3 - 2 * u);
      const out = {};
      const ids = new Set([...Object.keys(k0.pose), ...Object.keys(k1.pose)]);
      for (const id of ids) {
        const a = k0.pose[id] || {}, b = k1.pose[id] || {};
        out[id] = {
          dx: (a.dx || 0) + ((b.dx || 0) - (a.dx || 0)) * u,
          dy: (a.dy || 0) + ((b.dy || 0) - (a.dy || 0)) * u,
          rotationDeg: lerpAngle(a.rotationDeg || 0, b.rotationDeg || 0, u),
          scaleX: (a.scaleX ?? 1) + ((b.scaleX ?? 1) - (a.scaleX ?? 1)) * u,
          scaleY: (a.scaleY ?? 1) + ((b.scaleY ?? 1) - (a.scaleY ?? 1)) * u,
        };
      }
      return out;
    }
  }
  return last.pose;
}
const SVG_NS = "http://www.w3.org/2000/svg";
/** Draws the rig's bones into \`svg\` and plays \`track\` (looping). Returns a stop function. */
export function playRig(svg, rig, track, { loop = true, stroke = "currentColor", width = 4 } = {}) {
  const lines = {};
  for (const b of rig.bones) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("stroke", stroke);
    line.setAttribute("stroke-width", String(width));
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("data-bone", b.id);
    svg.appendChild(line);
    lines[b.id] = line;
  }
  const draw = (t) => {
    const world = evalRig(rig, samplePose(track, t));
    for (const id in world) {
      const w = world[id], line = lines[id];
      if (!line) continue;
      line.setAttribute("x1", w.head.x.toFixed(2)); line.setAttribute("y1", w.head.y.toFixed(2));
      line.setAttribute("x2", w.tail.x.toFixed(2)); line.setAttribute("y2", w.tail.y.toFixed(2));
    }
  };
  const end = track.length ? Math.max(...track.map((k) => k.timeSec)) : 0;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  draw(0);
  if (reduced || end <= 0) return () => { for (const id in lines) lines[id].remove(); };
  let raf = 0;
  const start = performance.now();
  const tick = (now) => {
    const elapsed = (now - start) / 1000;
    draw(loop ? elapsed % end : Math.min(elapsed, end));
    if (loop || elapsed < end) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); for (const id in lines) lines[id].remove(); };
}
`;
}

type ExportedEvalRig = (
  rig: unknown,
  pose: RigPoseMap,
) => Record<string, { head: { x: number; y: number }; tail: { x: number; y: number } }>;
type ExportedSamplePose = (track: unknown, timeSec: number) => RigPoseMap;

export function loadExportedRigRuntime(runtimeSrc: string): ExportedEvalRig {
  return loadExportedRigFunctions(runtimeSrc).evalRig;
}

/** Runs the exported runtime source and returns its functions, so parity checks test the shipped code. */
export function loadExportedRigFunctions(runtimeSrc: string): { evalRig: ExportedEvalRig; samplePose: ExportedSamplePose } {
  const body = runtimeSrc.replace(/^export\s+/gm, "");
  const factory = new Function(`${body}\nreturn { evalRig, samplePose };`) as () => {
    evalRig: ExportedEvalRig;
    samplePose: ExportedSamplePose;
  };
  return factory();
}

/** Export a rigged character for Next.js, Vite, or plain HTML with checkpoint parity data. */
/** JSON placed inside an inline <script>: `<` escaped so a name like "</script>" can't close the tag. */
function scriptSafe(json: string): string {
  return json.replace(/[<\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function escapeHtmlAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function exportRigForFramework(
  rig: RigDefinition,
  target: RigExportTarget,
  poseTrack: BonePoseTrack,
  renderMode: RigSkinRenderMode = "svg",
  sampleTimes: readonly number[] = [0, 0.25, 0.5, 0.75, 1.0],
): RigExportBundle {
  const runtimeSrc = emitRigRuntimeSource(renderMode);
  const rigJson = JSON.stringify(rig);
  const trackJson = JSON.stringify(poseTrack);

  const entryFile =
    target === "nextjs"
      ? `"use client";
import { useEffect, useRef } from "react";
import { playRig } from "./rig-runtime";
export const RIG_DEF = ${rigJson};
export const RIG_TRACK = ${trackJson};
export function RiggedCharacter({ width = 400, height = 300, loop = true }) {
  const svgRef = useRef(null);
  useEffect(() => (svgRef.current ? playRig(svgRef.current, RIG_DEF, RIG_TRACK, { loop }) : undefined), [loop]);
  return <svg ref={svgRef} data-rig={RIG_DEF.id} width={width} height={height} viewBox={\`0 0 \${width} \${height}\`} role="img" aria-label={RIG_DEF.name} />;
}
`
      : target === "vite"
        ? `import { playRig } from "./rig-runtime";
export const RIG_DEF = ${rigJson};
export const RIG_TRACK = ${trackJson};
/** Draws the character into \`container\` and plays its track. Returns a stop function. */
export function mountRig(container, { width = 400, height = 300, loop = true } = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", \`0 0 \${width} \${height}\`);
  svg.setAttribute("data-rig", RIG_DEF.id);
  container.appendChild(svg);
  const stop = playRig(svg, RIG_DEF, RIG_TRACK, { loop });
  return () => { stop(); svg.remove(); };
}
`
        : `<!doctype html>
<html><body>
<svg data-rig="${escapeHtmlAttr(rig.id)}" width="400" height="300" viewBox="0 0 400 300"></svg>
<script type="module">
${runtimeSrc}
playRig(document.querySelector("svg[data-rig]"), ${scriptSafe(rigJson)}, ${scriptSafe(trackJson)});
</script>
</body></html>
`;

  const files: Record<string, string> =
    target === "html"
      ? { "index.html": entryFile }
      : { "rig-runtime.js": runtimeSrc, [`Character.${target === "nextjs" ? "tsx" : "ts"}`]: entryFile };

  // The checkpoints come from running the exported runtime itself, so the parity check compares two implementations.
  // Both the pose sampling and the bone transforms come from the exported runtime, so parity covers the shipped code.
  const exported = loadExportedRigFunctions(runtimeSrc);
  const checkpoints = sampleTimes.map((timeSec) => {
    const pose = exported.samplePose(JSON.parse(trackJson), timeSec);
    const world = exported.evalRig(JSON.parse(rigJson), pose);
    const boneWorldHeads: Record<string, { x: number; y: number }> = {};
    const boneWorldTails: Record<string, { x: number; y: number }> = {};
    for (const [id, wt] of Object.entries(world)) {
      boneWorldHeads[id] = { x: wt.head.x, y: wt.head.y };
      boneWorldTails[id] = { x: wt.tail.x, y: wt.tail.y };
    }
    return { timeSec, boneWorldHeads, boneWorldTails };
  });

  return {
    target,
    renderMode,
    drawnWith: "svg",
    skinsMeshes: false,
    includesRigRuntime: true,
    files,
    checkpoints,
  };
}

/** Verify exported bundle matches editor rig evaluation across all tape times (`< 0.01 px`). */
export function verifyRigExportParity(
  rig: RigDefinition,
  poseTrack: BonePoseTrack,
  target: RigExportTarget,
  renderMode: RigSkinRenderMode = "svg",
): { passed: boolean; maxDiffPx: number; bundle: RigExportBundle } {
  const sampleTimes = [0, 0.25, 0.5, 0.75, 1.0];
  const bundle = exportRigForFramework(rig, target, poseTrack, renderMode, sampleTimes);
  let maxDiffPx = 0;

  for (let i = 0; i < sampleTimes.length; i++) {
    const t = sampleTimes[i];
    const pose = evaluatePoseTrackAtTime(poseTrack, t);
    const editorWorld: Record<string, WorldBoneTransform> = evaluateRigWorldTransforms(rig, pose);
    const exportedHeads = bundle.checkpoints[i].boneWorldHeads;

    for (const bone of rig.bones) {
      const ew = editorWorld[bone.id];
      const xw = exportedHeads[bone.id];
      const xt = bundle.checkpoints[i].boneWorldTails[bone.id];
      if (!ew || !xw || !xt) {
        maxDiffPx = Infinity;
        continue;
      }
      const d = Math.max(Math.hypot(ew.head.x - xw.x, ew.head.y - xw.y), Math.hypot(ew.tail.x - xt.x, ew.tail.y - xt.y));
      if (!(d <= maxDiffPx)) maxDiffPx = Number.isNaN(d) ? Infinity : Math.max(maxDiffPx, d);
    }
  }

  return { passed: maxDiffPx < 0.01, maxDiffPx, bundle };
}

/** Export keyframed bone animation into Lottie v5.7.4 bone hierarchy JSON. */
export function exportRigToLottieJson(
  rig: RigDefinition,
  poseTrack: BonePoseTrack,
  fps = 60,
  width = 800,
  height = 600,
): LottieRigAnimation {
  const sortedTrack = [...poseTrack].sort((a, b) => a.timeSec - b.timeSec);
  const maxTimeSec = sortedTrack.length > 0 ? sortedTrack[sortedTrack.length - 1].timeSec : 1;
  const totalFrames = Math.max(1, Math.round(maxTimeSec * fps));

  const indexMap = new Map<string, number>();
  rig.bones.forEach((b, idx) => indexMap.set(b.id, idx + 1));

  const boneById = new Map(rig.bones.map((b) => [b.id, b] as const));

  const layers: LottieBoneLayer[] = rig.bones.map((bone) => {
    const ind = indexMap.get(bone.id)!;
    const parentInd = bone.parentId !== null ? indexMap.get(bone.parentId) : undefined;
    const parentBone = bone.parentId !== null ? boneById.get(bone.parentId) : undefined;

    const rotKeys = (sortedTrack.length > 0
      ? sortedTrack
      : [{ timeSec: 0, pose: {} as RigPoseMap }]
    ).map((kf, ki, arr) => {
      const rot = bone.restRotationDeg + (kf.pose[bone.id]?.rotationDeg ?? 0);
      const next = arr[ki + 1];
      const frame = Math.round(kf.timeSec * fps);
      return next
        ? {
            t: frame,
            s: [rot],
            e: [bone.restRotationDeg + (next.pose[bone.id]?.rotationDeg ?? 0)],
          }
        : { t: frame, s: [rot] };
    });

    const scaleKeys = (sortedTrack.length > 0
      ? sortedTrack
      : [{ timeSec: 0, pose: {} as RigPoseMap }]
    ).map((kf, ki, arr) => {
      const sx = ((bone.restScaleX ?? 1) * (kf.pose[bone.id]?.scaleX ?? 1)) * 100;
      const sy = ((bone.restScaleY ?? 1) * (kf.pose[bone.id]?.scaleY ?? 1)) * 100;
      const next = arr[ki + 1];
      const frame = Math.round(kf.timeSec * fps);
      return next
        ? {
            t: frame,
            s: [sx, sy, 100],
            e: [
              ((bone.restScaleX ?? 1) * (next.pose[bone.id]?.scaleX ?? 1)) * 100,
              ((bone.restScaleY ?? 1) * (next.pose[bone.id]?.scaleY ?? 1)) * 100,
              100,
            ],
          }
        : { t: frame, s: [sx, sy, 100] };
    });

    const posX = (parentBone ? parentBone.length : 0) + bone.restX;
    const posY = bone.restY;

    return {
      ddd: 0,
      ind,
      ty: 3,
      nm: bone.name,
      ...(parentInd !== undefined ? { parent: parentInd } : {}),
      ks: {
        p: { a: 0, k: [posX, posY, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: scaleKeys },
        r: { a: 1, k: rotKeys },
      },
      ip: 0,
      op: totalFrames,
      st: 0,
    };
  });

  return {
    v: "5.7.4",
    fr: fps,
    ip: 0,
    op: totalFrames,
    w: width,
    h: height,
    nm: rig.name,
    layers,
  };
}

import { formatBinding, type Binding, type SignalExpr } from "../document/signals";
import type { InputTape } from "../document/effects";
import { compileExpr, toNumber, type Frame } from "./evaluate";
import { serializeInputTape } from "./tape";

export interface SignalGraphNode {
  readonly id: string;
  readonly kind: "signal" | "operator" | "target";
  readonly label: string;
  readonly bindingId: string;
  readonly value?: number;
}

export interface SignalGraphEdge {
  readonly from: string;
  readonly to: string;
}

export interface SignalNodeGraph {
  readonly nodes: readonly SignalGraphNode[];
  readonly edges: readonly SignalGraphEdge[];
}

/** Builds a Pro node-view DAG with live meter readings for each binding. */
export function buildSignalNodeGraph(
  bindings: readonly Binding[],
  liveReadings: Readonly<Record<string, number>> = {}
): SignalNodeGraph {
  const nodes: SignalGraphNode[] = [];
  const edges: SignalGraphEdge[] = [];

  for (const b of bindings) {
    const sigId = `${b.id}:sig`;
    nodes.push({
      id: sigId,
      kind: "signal",
      label: b.expr.signal.kind,
      bindingId: b.id,
      value: liveReadings[b.id],
    });
    let prev = sigId;
    b.expr.operators.forEach((op, idx) => {
      const opId = `${b.id}:op:${idx}`;
      nodes.push({ id: opId, kind: "operator", label: op.op, bindingId: b.id });
      edges.push({ from: prev, to: opId });
      prev = opId;
    });
    const targetId = `${b.id}:target`;
    const targetLabel =
      b.target.kind === "property"
        ? b.target.path
        : b.target.kind === "cssvar"
          ? `--${b.target.name}`
          : b.target.kind === "input"
            ? `sm.${b.target.name}`
            : b.target.kind;
    nodes.push({
      id: targetId,
      kind: "target",
      label: targetLabel,
      bindingId: b.id,
      value: liveReadings[b.id],
    });
    edges.push({ from: prev, to: targetId });
  }

  return { nodes, edges };
}

export interface PlaygroundTapeSession {
  readonly title: string;
  readonly serializedTape: string;
  readonly bindingsDsl: readonly string[];
}

export function buildPlaygroundTapeSession(
  bindings: readonly Binding[],
  tape: InputTape,
  title = "Signals Playground"
): PlaygroundTapeSession {
  return {
    title,
    serializedTape: serializeInputTape(tape),
    bindingsDsl: bindings.map((b) => formatBinding(b)),
  };
}

/**
 * Checks whether a binding is pure scroll/view progress -> remap/clamp and
 * compiles a zero-JS CSS `animation-timeline` rule when expressible.
 */
export function compileCssScrollTimeline(binding: Binding): string | null {
  const sig = binding.expr.signal;
  if (sig.kind !== "scroll" && sig.kind !== "view") return null;
  if (sig.kind === "scroll" && sig.channel !== "progress") return null;
  if (sig.kind === "view" && sig.channel !== "progress") return null;
  if (binding.target.kind !== "property" && binding.target.kind !== "cssvar") return null;
  if (binding.expr.operators.some((op) => op.op !== "remap" && op.op !== "clamp")) return null;

  const evalExpr = compileExpr(binding.expr);
  const frameAt = (p: number): Frame => ({
    time: p,
    dt: 1 / 60,
    seed: 0,
    read: () => p,
  });
  const fromVal = toNumber(evalExpr.step(frameAt(0)));
  const toVal = toNumber(evalExpr.step(frameAt(1)));
  const timeline = sig.kind === "scroll" ? "scroll(root block)" : "view(block)";
  const animName = `ll-${binding.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;

  let cssDecl = (v: number): string => `--ll-val: ${v};`;
  if (binding.target.kind === "cssvar") {
    const name = binding.target.name;
    cssDecl = (v) => `--${name}: ${v};`;
  } else {
    const path = binding.target.path;
    if (path === "appearance.opacity") cssDecl = (v) => `opacity: ${v};`;
    else if (path === "transform.rotate") cssDecl = (v) => `rotate: ${v}deg;`;
    else if (path === "transform.scale") cssDecl = (v) => `scale: ${v};`;
    else if (path === "transform.x") cssDecl = (v) => `translate: ${v}px 0;`;
    else if (path === "transform.y") cssDecl = (v) => `translate: 0 ${v}px;`;
    else return null;
  }

  return [
    `@keyframes ${animName} {`,
    `  from { ${cssDecl(fromVal)} }`,
    `  to { ${cssDecl(toVal)} }`,
    `}`,
    `[data-ll="${binding.ownerLayerId}"] {`,
    `  animation: ${animName} linear both;`,
    `  animation-timeline: ${timeline};`,
    `}`,
  ].join("\n");
}

export interface VendoredSignalsBundle {
  readonly target: "next" | "vite";
  readonly files: Readonly<Record<"ticker.ts" | "signals.ts" | "timelines.css", string>>;
  readonly cssTimelineCount: number;
}

/**
 * Generates the vendored TypeScript runtime modules (`ticker.ts` + `signals.ts`)
 * plus pure CSS scroll/view timelines (`timelines.css`) for Next.js and Vite exports.
 */
export function compileVendoredSignalsBundle(
  bindings: readonly Binding[],
  target: "next" | "vite"
): VendoredSignalsBundle {
  const timelines: string[] = [];
  for (const b of bindings) {
    const css = compileCssScrollTimeline(b);
    if (css) timelines.push(css);
  }

  const clientDirective = target === "next" ? '"use client";\n\n' : "";
  const tickerTs = `${clientDirective}// Vendored LazyLayout runtime module: ticker.ts (${target})
export type FrameCallback = (timeSec: number, dtSec: number) => void;

export function createExportTicker(onFrame: FrameCallback): { start(): void; stop(): void } {
  let rafId = 0;
  let running = false;
  let lastMs = 0;
  const startMs = typeof performance !== "undefined" ? performance.now() : 0;

  const loop = (nowMs: number) => {
    if (!running) return;
    const dt = lastMs > 0 ? Math.min(1 / 15, Math.max(0, (nowMs - lastMs) / 1000)) : 1 / 60;
    lastMs = nowMs;
    onFrame((nowMs - startMs) / 1000, dt);
    rafId = requestAnimationFrame(loop);
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastMs = typeof performance !== "undefined" ? performance.now() : 0;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}
`;

  const signalsTs = `${clientDirective}// Vendored LazyLayout runtime module: signals.ts (${target})
import type { FrameCallback } from "./ticker";

export interface ExportBindingSpec {
  readonly id: string;
  readonly ownerLayerId: string;
  readonly target: unknown;
  readonly expr: unknown;
}

export const EXPORT_BINDINGS: readonly ExportBindingSpec[] = ${JSON.stringify(
    bindings.map((b) => ({ id: b.id, ownerLayerId: b.ownerLayerId, target: b.target, expr: b.expr })),
    null,
    2
  )};

export function createSignalsStepHandler(
  stepFn: (timeSec: number, dtSec: number) => void
): FrameCallback {
  return (timeSec, dtSec) => {
    stepFn(timeSec, dtSec);
  };
}
`;

  return {
    target,
    cssTimelineCount: timelines.length,
    files: {
      "ticker.ts": tickerTs,
      "signals.ts": signalsTs,
      "timelines.css": timelines.join("\n\n"),
    },
  };
}

/**
 * Evaluates exported bindings on a deterministic frame sequence so tests can
 * verify exact tape parity across Next and Vite bundles.
 */
export function evaluateExportedBindingsParity(
  bundle: VendoredSignalsBundle,
  frames: readonly Frame[],
  parseExpr: (expr: unknown) => SignalExpr = (e) => e as SignalExpr
): Readonly<Record<string, number>> {
  const specs = JSON.parse(
    bundle.files["signals.ts"]
      .split("export const EXPORT_BINDINGS: readonly ExportBindingSpec[] = ")[1]!
      .split(";\n\nexport function")[0]!
  ) as Array<{ id: string; expr: unknown }>;

  const runtimes = specs.map((s) => ({
    id: s.id,
    rt: compileExpr(parseExpr(s.expr)),
  }));

  const lastValues: Record<string, number> = {};
  for (const frame of frames) {
    for (const item of runtimes) {
      lastValues[item.id] = toNumber(item.rt.step(frame));
    }
  }
  return lastValues;
}

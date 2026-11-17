/**
 * @file blueprintCompiler.ts
 * @module core/nodescript/blueprintCompiler
 * @description Phase 169: Compiles Blueprint graphs into dependency-free, strict TypeScript (zero `any`, zero
 * LazyLayout imports) for React hooks, Vue composables and vanilla DOM. Each event node becomes a real DOM listener
 * (pointerdown, pointerenter, focus, keydown, mount, IntersectionObserver, interval, custom event) and the action
 * nodes wired after it run in wire order, writing styles to the page. Node types it can't run yet (physics,
 * particles, sound, state machines) are listed in `unsupportedNodes`, not emitted as empty stubs.
 *
 * Review 2026-11-17: the earlier version wired every graph to one `pointerdown`, ordered actions by canvas x
 * position, wrote values into an in-memory map instead of the DOM, and emitted empty physics stubs.
 */

import type { BlueprintGraph, BlueprintNodeInstance } from "../ast/ASTManager";

export type BlueprintExportTarget = "react" | "vue" | "vanilla";

export interface CompiledBlueprintOutput {
  readonly target: BlueprintExportTarget;
  readonly filename: string;
  readonly code: string;
  readonly cssFallbackRules: string;
  readonly usedVendoredModules: readonly ("kinetics" | "physics2d" | "blueprint")[];
  readonly hasCssFastPath: boolean;
  /** The graph as the exported runtime runs it. */
  readonly program: CompiledBlueprintProgram;
  /** Nodes this export does not run (unsupported types, or not reached from an event). Empty = the whole graph runs. */
  readonly unsupportedNodes: readonly string[];
}

const DISALLOWED_ARBITRARY_NODES = new Set([
  "custom/eval",
  "custom/script",
  "script/raw",
  "interaction/eval",
  "interaction/rawScript",
]);

function sanitizeIdent(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `g_${cleaned}`;
}

function escapeComment(text: string): string {
  return text.replace(/\*\//g, "* /").replace(/\r?\n/g, " ");
}

/** Determine whether a node graph is purely expressible as a CSS hover/focus/active rule. */
export function isGraphCssExpressible(graph: BlueprintGraph): boolean {
  const nodes = Object.values(graph.nodes);
  const evt = nodes.filter((n) => n.type.startsWith("interaction/on"));
  if (evt.length !== 1) return false;
  const evtType = evt[0]!.type;
  if (evtType !== "interaction/onHover" && evtType !== "interaction/onFocus" && evtType !== "interaction/onPointer") {
    return false;
  }
  const actions = nodes.filter((n) => n.id !== evt[0]!.id);
  if (actions.length === 0) return false;
  return actions.every((n) => {
    if (n.type !== "interaction/setProperty" && n.type !== "interaction/springProperty") {
      return false;
    }
    const p = String(n.customParams?.property ?? n.customParams?.path ?? "");
    return (
      p === "effects.glow" ||
      p === "appearance.opacity" ||
      p === "opacity" ||
      p === "transform.scale" ||
      p === "transform.y"
    );
  });
}

function buildCssRulesForGraph(graph: BlueprintGraph): string {
  const nodes = Object.values(graph.nodes);
  const evt = nodes.find((n) => n.type.startsWith("interaction/on"));
  if (!evt) return "";
  const pseudo =
    evt.type === "interaction/onFocus"
      ? ":focus-visible"
      : evt.type === "interaction/onPointer"
        ? ":active"
        : ":hover";
  const lines: string[] = [];
  for (const n of nodes) {
    if (n.id === evt.id) continue;
    const target = sanitizeIdent(String(n.customParams?.target ?? "element"));
    const prop = String(n.customParams?.property ?? n.customParams?.path ?? "opacity");
    const val = n.customParams?.value ?? 1;
    const decl =
      prop === "effects.glow"
        ? `box-shadow: 0 0 ${Math.round(Number(val) * 24)}px currentColor;`
        : prop === "transform.scale"
          ? `transform: scale(${Number(val)});`
          : prop === "transform.y"
            ? `transform: translateY(${Number(val)}px);`
            : `opacity: ${Number(val)};`;
    lines.push(`[data-layer="${target}"]${pseudo} { transition: all 240ms cubic-bezier(0.22, 1, 0.36, 1); ${decl} }`);
  }
  return lines.join("\n");
}

/** One action the exported runtime performs, in wire order. */
export type CompiledBlueprintAction =
  | { readonly kind: "setStyle"; readonly target: string; readonly path: string; readonly value: number | string | boolean; readonly transitionMs: number }
  | { readonly kind: "showHide"; readonly target: string; readonly visible: boolean }
  | { readonly kind: "focus"; readonly target: string }
  | { readonly kind: "scrollTo"; readonly target: string; readonly offsetY: number }
  | { readonly kind: "openUrl"; readonly url: string; readonly newTab: boolean }
  | { readonly kind: "emit"; readonly name: string; readonly target: string };

export type CompiledBlueprintEvent = "pointerdown" | "pointerenter" | "focus" | "keydown" | "mount" | "view" | "timer" | "custom";

export interface CompiledBlueprintListener {
  readonly nodeId: string;
  readonly title: string;
  readonly event: CompiledBlueprintEvent;
  /** The layer (key in `targets`) the event listens on; "" = the root element. */
  readonly target: string;
  readonly key?: string;
  readonly seconds?: number;
  readonly eventName?: string;
  readonly actions: readonly CompiledBlueprintAction[];
}

/** The graph as data the exported runtime interprets: one listener per event node, its actions in wire order. */
export interface CompiledBlueprintProgram {
  readonly listeners: readonly CompiledBlueprintListener[];
}

const EVENT_MAP: Readonly<Record<string, CompiledBlueprintEvent>> = {
  "interaction/onPointer": "pointerdown",
  "interaction/onHover": "pointerenter",
  "interaction/onFocus": "focus",
  "interaction/onKey": "keydown",
  "interaction/onMount": "mount",
  "interaction/onView": "view",
  "interaction/onTimer": "timer",
  "interaction/onCustomEvent": "custom",
};

/** Exec output pins followed in this order when walking from a node. */
const EXEC_OUT_PINS = ["exec", "then", "completed", "then0", "then1", "then2", "a", "b", "exit"] as const;

function param(node: BlueprintNodeInstance, ...names: string[]): unknown {
  for (const n of names) {
    const v = node.customParams?.[n] ?? node.pinValues?.[n];
    if (v !== undefined) return v;
  }
  return undefined;
}

function safeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw, "https://example.invalid");
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return raw.startsWith("/") || /^https?:\/\//i.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Turns a Blueprint graph into a program the exported runtime runs: each event node becomes a DOM listener and
 * the action nodes reached from it over exec wires run in wire order. Node types the runtime can't run yet (physics,
 * particles, sound, state machines, flow control other than straight chains) are returned in `unsupported` instead of
 * being emitted as empty stubs.
 */
export function compileBlueprintProgram(graph: BlueprintGraph): {
  readonly program: CompiledBlueprintProgram;
  readonly unsupported: readonly string[];
} {
  for (const node of Object.values(graph.nodes)) {
    if (DISALLOWED_ARBITRARY_NODES.has(node.type)) {
      throw new Error(`Security error: arbitrary-code node "${node.type}" is prohibited in exported graphs.`);
    }
  }
  const unsupported = new Set<string>();
  const execOut = (nodeId: string): string[] => {
    const wires = graph.wires.filter((w) => w.sourceNodeId === nodeId && (w.isExec || w.pinType === "exec"));
    const rank = (pin: string) => {
      const i = (EXEC_OUT_PINS as readonly string[]).indexOf(pin);
      return i < 0 ? EXEC_OUT_PINS.length : i;
    };
    return wires.sort((a, b) => rank(a.sourcePinId) - rank(b.sourcePinId) || a.id.localeCompare(b.id)).map((w) => w.targetNodeId);
  };

  const toAction = (node: BlueprintNodeInstance): CompiledBlueprintAction | null => {
    const target = String(param(node, "target") ?? "");
    switch (node.type) {
      case "interaction/setProperty":
      case "interaction/springProperty": {
        const path = String(param(node, "property", "path") ?? "appearance.opacity");
        const value = param(node, "value") ?? 1;
        const v = typeof value === "number" || typeof value === "string" || typeof value === "boolean" ? value : String(value);
        // springProperty is approximated by a CSS transition of its `time` (default 0.35 s), not a true spring.
        const seconds = Number(param(node, "time", "timeSec") ?? 0.35);
        return { kind: "setStyle", target, path, value: v, transitionMs: node.type === "interaction/springProperty" ? Math.max(0, Math.round(seconds * 1000)) : 0 };
      }
      case "interaction/showHide":
        return { kind: "showHide", target, visible: param(node, "visible") !== false };
      case "interaction/focus":
        return { kind: "focus", target };
      case "interaction/scrollTo":
        return { kind: "scrollTo", target, offsetY: Number(param(node, "offsetY") ?? 0) || 0 };
      case "interaction/openUrl": {
        const url = safeUrl(param(node, "url"));
        if (!url) {
          unsupported.add(`${node.id} (${node.type}: only http(s) or site-relative URLs are exported)`);
          return null;
        }
        return { kind: "openUrl", url, newTab: param(node, "newTab") === true };
      }
      default:
        unsupported.add(`${node.id} (${node.type})`);
        return null;
    }
  };

  const listeners: CompiledBlueprintListener[] = [];
  const events = Object.values(graph.nodes)
    .filter((n) => n.type.startsWith("interaction/on"))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const evt of events) {
    const event = EVENT_MAP[evt.type];
    if (!event) {
      unsupported.add(`${evt.id} (${evt.type})`);
      continue;
    }
    const actions: CompiledBlueprintAction[] = [];
    const seen = new Set<string>([evt.id]);
    const queue = execOut(evt.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = graph.nodes[id];
      if (!node) continue;
      const action = toAction(node);
      if (action) actions.push(action);
      queue.push(...execOut(id));
    }
    const seconds = Number(param(evt, "seconds", "interval") ?? 1);
    listeners.push({
      nodeId: evt.id,
      title: escapeComment(evt.title || evt.type),
      event,
      target: String(param(evt, "target") ?? ""),
      ...(event === "keydown" ? { key: String(param(evt, "key") ?? "Enter") } : {}),
      ...(event === "timer" ? { seconds: seconds > 0 ? seconds : 1 } : {}),
      ...(event === "custom" ? { eventName: String(param(evt, "eventName") ?? "ll-event") } : {}),
      actions,
    });
  }
  // Nodes no event reaches never run; say so rather than dropping them silently.
  const reached = new Set<string>();
  for (const evt of events) {
    const stack = [evt.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (reached.has(id)) continue;
      reached.add(id);
      stack.push(...execOut(id));
    }
  }
  for (const node of Object.values(graph.nodes)) {
    if (!reached.has(node.id)) unsupported.add(`${node.id} (${node.type}: not connected to an event)`);
  }
  return { program: { listeners }, unsupported: [...unsupported].sort() };
}

/** The fixed runtime every target embeds. It reads the program as data, so no graph text becomes code. */
const RUNTIME_SOURCE = [
  `type Prim = number | string | boolean;`,
  `type Action =`,
  `  | { kind: "setStyle"; target: string; path: string; value: Prim; transitionMs: number }`,
  `  | { kind: "showHide"; target: string; visible: boolean }`,
  `  | { kind: "focus"; target: string }`,
  `  | { kind: "scrollTo"; target: string; offsetY: number }`,
  `  | { kind: "openUrl"; url: string; newTab: boolean }`,
  `  | { kind: "emit"; name: string; target: string };`,
  `interface Listener { nodeId: string; title: string; event: string; target: string; key?: string; seconds?: number; eventName?: string; actions: Action[] }`,
  `interface Program { listeners: Listener[] }`,
  `interface Pose { x: number; y: number; scale: number; rotate: number }`,
  ``,
  `function runBlueprintProgram(program: Program, root: HTMLElement, targets: Readonly<Record<string, HTMLElement>>): () => void {`,
  `  const poses = new Map<HTMLElement, Pose>();`,
  `  const el = (id: string): HTMLElement => (id && targets[id]) || root;`,
  `  const pose = (node: HTMLElement): Pose => poses.get(node) ?? { x: 0, y: 0, scale: 1, rotate: 0 };`,
  `  const apply = (a: Action): void => {`,
  `    if (a.kind === "openUrl") { window.open(a.url, a.newTab ? "_blank" : "_self", "noopener"); return; }`,
  `    if (a.kind === "emit") { el(a.target).dispatchEvent(new CustomEvent(a.name, { bubbles: true })); return; }`,
  `    const node = el(a.target);`,
  `    if (a.kind === "focus") { node.focus(); return; }`,
  `    if (a.kind === "scrollTo") { window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY + a.offsetY, behavior: "smooth" }); return; }`,
  `    if (a.kind === "showHide") { node.style.visibility = a.visible ? "visible" : "hidden"; return; }`,
  `    node.style.transition = a.transitionMs > 0 ? "all " + a.transitionMs + "ms cubic-bezier(0.22, 1, 0.36, 1)" : "";`,
  `    const n = Number(a.value);`,
  `    const p = pose(node);`,
  `    switch (a.path) {`,
  `      case "appearance.opacity": case "opacity": node.style.opacity = String(n); return;`,
  `      case "effects.glow": node.style.boxShadow = "0 0 " + Math.round(n * 24) + "px currentColor"; return;`,
  `      case "transform.x": p.x = n; break;`,
  `      case "transform.y": p.y = n; break;`,
  `      case "transform.scale": p.scale = n; break;`,
  `      case "transform.rotate": p.rotate = n; break;`,
  `      default: node.style.setProperty("--" + a.path.replace(/[^A-Za-z0-9_-]/g, "-"), String(a.value)); return;`,
  `    }`,
  `    poses.set(node, p);`,
  `    node.style.transform = "translate(" + p.x + "px, " + p.y + "px) scale(" + p.scale + ") rotate(" + p.rotate + "deg)";`,
  `  };`,
  `  const run = (l: Listener): void => { for (const a of l.actions) apply(a); };`,
  `  const cleanups: (() => void)[] = [];`,
  `  for (const l of program.listeners) {`,
  `    const node = el(l.target);`,
  `    if (l.event === "mount") { run(l); continue; }`,
  `    if (l.event === "timer") { const t = window.setInterval(() => run(l), (l.seconds ?? 1) * 1000); cleanups.push(() => window.clearInterval(t)); continue; }`,
  `    if (l.event === "view") {`,
  `      const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) run(l); });`,
  `      io.observe(node);`,
  `      cleanups.push(() => io.disconnect());`,
  `      continue;`,
  `    }`,
  `    if (l.event === "keydown") {`,
  `      const onKey = (e: KeyboardEvent): void => {`,
  `        const t = e.target;`,
  `        if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;`,
  `        if (e.key === l.key || e.code === l.key) run(l);`,
  `      };`,
  `      root.addEventListener("keydown", onKey);`,
  `      cleanups.push(() => root.removeEventListener("keydown", onKey));`,
  `      continue;`,
  `    }`,
  `    const type = l.event === "custom" ? (l.eventName ?? "ll-event") : l.event;`,
  `    const handler = (): void => run(l);`,
  `    node.addEventListener(type, handler);`,
  `    cleanups.push(() => node.removeEventListener(type, handler));`,
  `  }`,
  `  return () => { for (const c of cleanups) c(); };`,
  `}`,
].join("\n");

/** Compile a Blueprint graph to dependency-free React, Vue or vanilla TypeScript that runs the graph on the page. */
export function compileBlueprintToTarget(
  graph: BlueprintGraph,
  target: BlueprintExportTarget
): CompiledBlueprintOutput {
  const safeName = sanitizeIdent(graph.name || graph.id);
  const { program, unsupported } = compileBlueprintProgram(graph);
  const cssFallbackRules = isGraphCssExpressible(graph) ? buildCssRulesForGraph(graph) : "";
  const nodeComments = program.listeners.map(
    (l) => `// Node [${l.nodeId}]: ${l.title} (${l.event}) -> ${l.actions.length} action(s)`
  );
  for (const node of Object.values(graph.nodes)) {
    if (!node.type.startsWith("interaction/on")) nodeComments.push(`// Node [${node.id}]: ${escapeComment(node.title || node.type)} (${node.type})`);
  }
  const header = [
    `/* LazyLayout Blueprint export (MIT): ${escapeComment(graph.name || graph.id)}. Runs the graph's event listeners and actions. */`,
    ...nodeComments,
    ...(unsupported.length > 0
      ? [`// Not exported yet (these nodes do nothing in this file): ${escapeComment(unsupported.join(", "))}`]
      : []),
  ].join("\n");
  const programDecl = `const PROGRAM: Program = ${JSON.stringify(program, null, 2)};`;

  let code: string;
  let filename: string;
  if (target === "react") {
    filename = `use${safeName}.ts`;
    code = [
      header,
      `import { useEffect } from "react";`,
      ``,
      RUNTIME_SOURCE,
      ``,
      programDecl,
      ``,
      `export function use${safeName}(root: HTMLElement | null, targets: Readonly<Record<string, HTMLElement>> = {}): void {`,
      `  useEffect(() => (root ? runBlueprintProgram(PROGRAM, root, targets) : undefined), [root, targets]);`,
      `}`,
    ].join("\n");
  } else if (target === "vue") {
    filename = `use${safeName}.vue.ts`;
    code = [
      header,
      `import { onMounted, onUnmounted, type Ref } from "vue";`,
      ``,
      RUNTIME_SOURCE,
      ``,
      programDecl,
      ``,
      `export function use${safeName}(root: Ref<HTMLElement | null>, targets: Readonly<Record<string, HTMLElement>> = {}): void {`,
      `  let dispose = (): void => {};`,
      `  onMounted(() => { if (root.value) dispose = runBlueprintProgram(PROGRAM, root.value, targets); });`,
      `  onUnmounted(() => dispose());`,
      `}`,
    ].join("\n");
  } else {
    filename = `${safeName}.ts`;
    code = [
      header,
      RUNTIME_SOURCE,
      ``,
      programDecl,
      ``,
      `export function mount${safeName}(root: HTMLElement, targets: Readonly<Record<string, HTMLElement>> = {}): () => void {`,
      `  return runBlueprintProgram(PROGRAM, root, targets);`,
      `}`,
    ].join("\n");
  }

  return {
    target,
    filename,
    code,
    cssFallbackRules,
    usedVendoredModules: ["blueprint"],
    hasCssFastPath: cssFallbackRules.length > 0,
    program,
    unsupportedNodes: unsupported,
  };
}

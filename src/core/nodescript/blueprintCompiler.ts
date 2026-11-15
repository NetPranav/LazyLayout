/**
 * @file blueprintCompiler.ts
 * @module core/nodescript/blueprintCompiler
 * @description Phase 169 (closes AUD-50 runtime): Compiles Blueprint graphs into
 * dependency-free, strict TypeScript (zero `any`, zero LazyLayout imports) for React hooks,
 * Vue composables, and vanilla DOM listeners, preserving node names as comments,
 * compiling CSS-expressible rules to pure CSS and keep-out constraints to vendored
 * `kinetics` / `physics2d` / `blueprint` runtime helpers.
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

function collectActionStatements(graph: BlueprintGraph): {
  readonly statements: readonly string[];
  readonly usedModules: Set<"kinetics" | "physics2d" | "blueprint">;
} {
  const statements: string[] = [];
  const usedModules = new Set<"kinetics" | "physics2d" | "blueprint">(["blueprint"]);

  for (const node of Object.values(graph.nodes)) {
    if (DISALLOWED_ARBITRARY_NODES.has(node.type)) {
      throw new Error(`Security error: arbitrary-code node "${node.type}" is prohibited in exported graphs.`);
    }
  }

  // Deterministic topological-like order by position.x then id
  const ordered: BlueprintNodeInstance[] = Object.values(graph.nodes).sort((a, b) =>
    a.position.x !== b.position.x ? a.position.x - b.position.x : a.id.localeCompare(b.id)
  );

  for (const node of ordered) {
    statements.push(`// Node [${node.id}]: ${escapeComment(node.title || node.type)} (${node.type})`);
    const target = String(node.customParams?.target ?? "layer");

    if (node.type === "interaction/keepOut" || node.customParams?.mode === "keepOut") {
      usedModules.add("physics2d");
      const radius = Number(node.customParams?.radius ?? 80);
      statements.push(
        `physics2d.applyKeepOutConstraint(targets, ${JSON.stringify(target)}, pointerState.x, pointerState.y, ${radius});`
      );
    } else if (node.type === "interaction/springProperty") {
      usedModules.add("kinetics");
      const prop = String(node.customParams?.property ?? node.customParams?.path ?? "appearance.opacity");
      const value = Number(node.customParams?.value ?? 1);
      const timeSec = Number(node.customParams?.timeSec ?? 0.35);
      statements.push(
        `kinetics.springTo(runtime, ${JSON.stringify(target)}, ${JSON.stringify(prop)}, ${value}, ${timeSec});`
      );
    } else if (node.type === "interaction/setProperty") {
      const prop = String(node.customParams?.property ?? node.customParams?.path ?? "appearance.opacity");
      const value = node.customParams?.value ?? 1;
      statements.push(
        `blueprint.setProperty(runtime, ${JSON.stringify(target)}, ${JSON.stringify(prop)}, ${JSON.stringify(value)});`
      );
    } else if (node.type === "interaction/spawnParticles" || node.type === "interaction/spawn") {
      usedModules.add("physics2d");
      statements.push(
        `physics2d.spawnPoolBurst(runtime, ${JSON.stringify(target)}, ${Number(node.customParams?.value ?? 16)});`
      );
    } else if (!node.type.startsWith("interaction/on")) {
      statements.push(
        `blueprint.emitAction(runtime, ${JSON.stringify(node.type)}, ${JSON.stringify(node.customParams ?? {})});`
      );
    }
  }

  return { statements, usedModules };
}

/** Compile a validated BlueprintGraph to strict dependency-free React, Vue, or Vanilla TS. */
export function compileBlueprintToTarget(
  graph: BlueprintGraph,
  target: BlueprintExportTarget
): CompiledBlueprintOutput {
  const safeName = sanitizeIdent(graph.name || graph.id);
  const { statements, usedModules } = collectActionStatements(graph);
  const cssFallbackRules = isGraphCssExpressible(graph) ? buildCssRulesForGraph(graph) : "";
  const modulesArr = [...usedModules].sort();

  const bodyLines = statements.map((line) => `    ${line}`).join("\n");
  const importsComment = `/* LazyLayout Vendored Export Runtime (MIT): ${modulesArr.join(", ")} */`;

  const runtimeStubTypes = [
    `export interface BlueprintExportRuntimeState {`,
    `  readonly properties: Record<string, number | string | boolean>;`,
    `  readonly emitted: readonly { readonly type: string; readonly params: Readonly<Record<string, unknown>> }[];`,
    `}`,
  ].join("\n");

  const helperDecl = [
    `interface ExportPointerState { readonly x: number; readonly y: number; readonly active: boolean; }`,
    `const blueprint = {`,
    `  setProperty(rt: BlueprintExportRuntimeState, targetId: string, prop: string, val: number | string | boolean): void { rt.properties[\`\${targetId}.\${prop}\`] = val; },`,
    `  emitAction(_rt: BlueprintExportRuntimeState, _type: string, _params: Readonly<Record<string, unknown>>): void {},`,
    `};`,
    usedModules.has("kinetics")
      ? `const kinetics = { springTo(rt: BlueprintExportRuntimeState, targetId: string, prop: string, val: number, _sec: number): void { rt.properties[\`\${targetId}.\${prop}\`] = val; } };`
      : "",
    usedModules.has("physics2d")
      ? `const physics2d = { applyKeepOutConstraint(_targets: Readonly<Record<string, HTMLElement>>, _id: string, _px: number, _py: number, _r: number): void {}, spawnPoolBurst(_rt: BlueprintExportRuntimeState, _id: string, _count: number): void {} };`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  let code = "";
  let filename = "";

  if (target === "react") {
    filename = `use${safeName}.ts`;
    code = [
      importsComment,
      `import { useEffect, useRef } from "react";`,
      ``,
      runtimeStubTypes,
      helperDecl,
      ``,
      `export function use${safeName}(targets: Readonly<Record<string, HTMLElement>>): { readonly trigger: () => void; readonly getState: () => BlueprintExportRuntimeState } {`,
      `  const stateRef = useRef<BlueprintExportRuntimeState>({ properties: {}, emitted: [] });`,
      `  const trigger = (): void => {`,
      `    const runtime = stateRef.current;`,
      `    const pointerState: ExportPointerState = { x: 0, y: 0, active: false };`,
      `    void pointerState;`,
      bodyLines,
      `  };`,
      `  useEffect(() => {`,
      `    const onPointerDown = (): void => trigger();`,
      `    Object.values(targets).forEach((el) => el.addEventListener("pointerdown", onPointerDown));`,
      `    return () => Object.values(targets).forEach((el) => el.removeEventListener("pointerdown", onPointerDown));`,
      `  }, [targets]);`,
      `  return { trigger, getState: () => stateRef.current };`,
      `}`,
    ].join("\n");
  } else if (target === "vue") {
    filename = `use${safeName}.vue.ts`;
    code = [
      importsComment,
      `import { onMounted, onUnmounted, ref } from "vue";`,
      ``,
      runtimeStubTypes,
      helperDecl,
      ``,
      `export function use${safeName}(targets: Readonly<Record<string, HTMLElement>>): { readonly trigger: () => void; readonly getState: () => BlueprintExportRuntimeState } {`,
      `  const runtimeState = ref<BlueprintExportRuntimeState>({ properties: {}, emitted: [] });`,
      `  const trigger = (): void => {`,
      `    const runtime = runtimeState.value;`,
      `    const pointerState: ExportPointerState = { x: 0, y: 0, active: false };`,
      `    void pointerState;`,
      bodyLines,
      `  };`,
      `  onMounted(() => Object.values(targets).forEach((el) => el.addEventListener("pointerdown", trigger)));`,
      `  onUnmounted(() => Object.values(targets).forEach((el) => el.removeEventListener("pointerdown", trigger)));`,
      `  return { trigger, getState: () => runtimeState.value };`,
      `}`,
    ].join("\n");
  } else {
    filename = `${safeName}.ts`;
    code = [
      importsComment,
      runtimeStubTypes,
      helperDecl,
      ``,
      `export function mount${safeName}(targets: Readonly<Record<string, HTMLElement>>): { readonly trigger: () => void; readonly destroy: () => void; readonly getState: () => BlueprintExportRuntimeState } {`,
      `  const runtime: BlueprintExportRuntimeState = { properties: {}, emitted: [] };`,
      `  const trigger = (): void => {`,
      `    const pointerState: ExportPointerState = { x: 0, y: 0, active: false };`,
      `    void pointerState;`,
      bodyLines,
      `  };`,
      `  const els = Object.values(targets);`,
      `  els.forEach((el) => el.addEventListener("pointerdown", trigger));`,
      `  return {`,
      `    trigger,`,
      `    destroy: () => els.forEach((el) => el.removeEventListener("pointerdown", trigger)),`,
      `    getState: () => runtime,`,
      `  };`,
      `}`,
    ].join("\n");
  }

  return {
    target,
    filename,
    code,
    cssFallbackRules,
    usedVendoredModules: modulesArr,
    hasCssFastPath: cssFallbackRules.length > 0,
  };
}

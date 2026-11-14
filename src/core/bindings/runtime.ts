/**
 * The binding runtime (Design track D4, engine spec §6): evaluates every enabled binding each frame, applies guards,
 * resolves targets to layers, blends the results per property, clamps them to the registry range, and returns what to
 * write. Pure: the host (editor stage, an export's runtime, a test) supplies the frame and applies the answer.
 *
 * Property targets (`transform.*`, `appearance.opacity`, ...) come back from `step`; CSS-variable targets (`hero.cssvar.glow`)
 * come back in `vars` after each step (last one wins by priority). Other target kinds are reported as `unsupported-target` until
 * their phases land; a binding to a `layout` property is refused (`SIG_LAYOUT`, decision 0003).
 */
import type { Binding, BindingTarget, BlendMode, Condition, Guard } from "../document/signals";
import { defaultBlend } from "../document/signals";
import { PROPERTY_REGISTRY } from "../document/properties";
import { compileExpr, toNumber, type ExprRuntime, type Frame } from "./evaluate";

/** What the runtime needs to know about the document and the page. */
export interface BindingHost {
  /** The layer ids a target set names (`layer`, `group` pieces, `tag`). */
  layersOf(target: Extract<BindingTarget, { on: unknown }>["on"]): readonly string[];
  /** A layer's own value for a property (before any binding), or undefined. */
  base(layerId: string, path: string): number | undefined;
  /** Condition inputs. */
  env: { pointerCoarse: boolean; reducedMotion: boolean; breakpoint: string; states: ReadonlySet<string> };
}

export type DiagnosticCode = "SIG_LAYOUT" | "unsupported-target" | "unknown-path" | "not-animatable" | "unsupported-operator";
export interface Diagnostic {
  bindingId: string;
  code: DiagnosticCode;
  message: string;
}

/** What to write: `layerId` -> `path` -> value. */
export type BoundValues = Map<string, Map<string, number>>;

interface Contribution {
  value: number;
  blend: BlendMode;
  priority: number;
  order: number;
}

export interface BindingRuntime {
  /** Evaluate every binding for this frame. Call in time order. */
  step(frame: Frame): BoundValues;
  /** Forget every operator's state (after a seek). */
  reset(): void;
  readonly diagnostics: readonly Diagnostic[];
  /** The CSS variables the last `step` set: layer id -> name (without `--`) -> value. */
  readonly vars: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** True when there is nothing to evaluate: the host can skip the frame loop entirely. */
  readonly idle: boolean;
}

function checkTarget(b: Binding): Diagnostic | null {
  const t = b.target;
  if (t.kind === "cssvar") return null;
  if (t.kind !== "property") return { bindingId: b.id, code: "unsupported-target", message: `${t.kind} targets are not applied yet.` };
  const def = PROPERTY_REGISTRY[t.path];
  if (!def) return { bindingId: b.id, code: "unknown-path", message: `${t.path} is not a property.` };
  if (def.compositing === "layout") return { bindingId: b.id, code: "SIG_LAYOUT", message: `${t.path} changes layout; drive transform.* instead.` };
  if (!def.animatable) return { bindingId: b.id, code: "not-animatable", message: `${t.path} cannot be driven.` };
  return null;
}

export function createBindingRuntime(bindings: readonly Binding[], host: BindingHost): BindingRuntime {
  const diagnostics: Diagnostic[] = [];
  const live: { binding: Binding; expr: ExprRuntime; guard: GuardRuntime | null; order: number }[] = [];
  bindings.forEach((binding, order) => {
    if (!binding.enabled) return;
    const bad = checkTarget(binding);
    if (bad) {
      diagnostics.push(bad);
      return;
    }
    try {
      live.push({ binding, expr: compileExpr(binding.expr), guard: binding.guard ? compileGuard(binding.guard) : null, order });
    } catch (e) {
      diagnostics.push({ bindingId: binding.id, code: "unsupported-operator", message: e instanceof Error ? e.message : String(e) });
    }
  });

  let vars: ReadonlyMap<string, ReadonlyMap<string, number>> = new Map();
  return {
    diagnostics,
    get vars() {
      return vars;
    },
    idle: live.length === 0,
    reset() {
      for (const l of live) {
        l.expr.reset();
        l.guard?.reset();
      }
    },
    step(frame) {
      const perProperty = new Map<string, Map<string, Contribution[]>>();
      const perVar = new Map<string, Map<string, { value: number; priority: number; order: number }>>();
      for (const { binding, expr, guard, order } of live) {
        const value = toNumber(expr.step(frame)); // always advance state, even when guarded off, so it stays continuous
        if (guard && !guard.holds(host, frame)) continue;
        if (binding.target.kind === "cssvar") {
          for (const layerId of host.layersOf(binding.target.on)) {
            const byName = perVar.get(layerId) ?? new Map();
            const prev = byName.get(binding.target.name);
            const next = { value, priority: binding.priority ?? 0, order };
            if (!prev || next.priority > prev.priority || (next.priority === prev.priority && next.order > prev.order)) byName.set(binding.target.name, next); // the highest priority wins; a later binding wins a tie
            perVar.set(layerId, byName);
          }
          continue;
        }
        const target = binding.target as Extract<BindingTarget, { kind: "property" }>;
        const blend = binding.blend ?? defaultBlend(target);
        for (const layerId of host.layersOf(target.on)) {
          const byPath = perProperty.get(layerId) ?? new Map<string, Contribution[]>();
          const list = byPath.get(target.path) ?? [];
          list.push({ value, blend, priority: binding.priority ?? 0, order });
          byPath.set(target.path, list);
          perProperty.set(layerId, byPath);
        }
      }
      vars = new Map([...perVar].map(([layerId, byName]) => [layerId, new Map([...byName].map(([n, v]) => [n, v.value]))]));
      const out: BoundValues = new Map();
      for (const [layerId, byPath] of perProperty) {
        const written = new Map<string, number>();
        for (const [path, list] of byPath) written.set(path, blendAll(host.base(layerId, path), list, path));
        out.set(layerId, written);
      }
      return out;
    },
  };
}

/** Ranges the registry does not carry yet but a binding must never leave (a blend can multiply opacity past 1). */
const FALLBACK_RANGE: Record<string, { min?: number; max?: number }> = { "appearance.opacity": { min: 0, max: 1 } };

/** Replace by priority (a later binding wins a tie), then add, multiply, max; clamped to the registry range. */
export function blendAll(base: number | undefined, list: readonly Contribution[], path: string): number {
  const def = PROPERTY_REGISTRY[path];
  let v = typeof base === "number" ? base : typeof def?.default === "number" ? def.default : 0;
  const replaced = list.filter((c) => c.blend === "replace").sort((a, b) => a.priority - b.priority || a.order - b.order);
  if (replaced.length > 0) v = replaced[replaced.length - 1].value;
  for (const c of list) if (c.blend === "add") v += c.value;
  for (const c of list) if (c.blend === "multiply") v *= c.value;
  for (const c of list) if (c.blend === "max") v = Math.max(v, c.value);
  const r = def?.range ?? FALLBACK_RANGE[path];
  if (r) {
    if (typeof r.min === "number") v = Math.max(r.min, v);
    if (typeof r.max === "number") v = Math.min(r.max, v);
  }
  return v;
}

// ---------------------------------------------------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------------------------------------------------

interface GuardRuntime {
  holds(host: BindingHost, frame: Frame): boolean;
  reset(): void;
}

function compileGuard(guard: Guard): GuardRuntime {
  const compares = new Map<Condition, ExprRuntime>();
  for (const c of guard.conditions) if (c.kind === "compare") compares.set(c, compileExpr(c.expr));
  const check = (c: Condition, host: BindingHost, frame: Frame): boolean => {
    switch (c.kind) {
      case "state":
        return host.env.states.has(c.name);
      case "pointerCoarse":
        return host.env.pointerCoarse === c.equals;
      case "breakpoint":
        return (host.env.breakpoint === c.name) !== c.negate;
      case "reducedMotion":
        return host.env.reducedMotion === c.equals;
      case "compare": {
        const v = toNumber(compares.get(c)!.step(frame));
        return c.cmp === ">" ? v > c.value : c.cmp === "<" ? v < c.value : c.cmp === ">=" ? v >= c.value : v <= c.value;
      }
    }
  };
  return {
    holds(host, frame) {
      // every condition is read each frame (so a compare's state keeps advancing), then joined left to right
      const results = guard.conditions.map((c) => check(c, host, frame));
      let acc = results[0];
      for (let i = 0; i < guard.joins.length; i++) acc = guard.joins[i] === "and" ? acc && results[i + 1] : acc || results[i + 1];
      return acc;
    },
    reset() {
      for (const r of compares.values()) r.reset();
    },
  };
}

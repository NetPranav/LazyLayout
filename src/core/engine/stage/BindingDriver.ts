/**
 * Design track D4: the stage's side of the binding runtime. Each frame, in the scheduler's `apply` phase, it measures the
 * inputs (through an `InputSource`), steps the runtime, and hands the answer to the kernel as `inputs.bound`, so what is
 * drawn is always `evaluate()` of the document with those inputs.
 *
 * Costs nothing when unused: with no enabled binding the driver is idle, `update` returns null at once, and the engine
 * neither measures the pointer nor marks the frame dirty.
 */
import type { MotionDocument } from "../../document/schema";
import { evaluate } from "../../kernel/evaluate";
import { busFrame, newBusState, type BusState, type InputSource } from "../../bindings/inputBus";
import { createBindingRuntime, type BindingRuntime, type BoundValues } from "../../bindings/runtime";

export interface BindingDriverHost {
  getDocument(): MotionDocument;
  compositionId(): string;
  source: InputSource;
  reducedMotion(): boolean;
}

export class BindingDriver {
  private runtime: BindingRuntime | null = null;
  private builtFor: unknown = null;
  private bus: BusState = newBusState();
  private lastTime = Number.NaN;

  constructor(private readonly host: BindingDriverHost) {}

  /** Something the runtime depends on changed (the document): rebuild on the next frame. */
  invalidate(): void {
    this.builtFor = null;
  }

  /** True when no binding is enabled (or none can be applied). */
  get idle(): boolean {
    this.ensure();
    return this.runtime?.idle ?? true;
  }

  /** The CSS variables the last frame set (layer id -> name -> value). */
  get vars(): ReadonlyMap<string, ReadonlyMap<string, number>> {
    return this.runtime?.vars ?? new Map();
  }

  get diagnostics() {
    this.ensure();
    return this.runtime?.diagnostics ?? [];
  }

  private ensure(): void {
    const doc = this.host.getDocument();
    if (this.builtFor === doc.bindings && this.runtime) return;
    this.builtFor = doc.bindings;
    this.bus = newBusState();
    this.lastTime = Number.NaN;
    const coarse = () => this.host.source.pointer()?.coarse ?? false;
    this.runtime = createBindingRuntime(Object.values(doc.bindings ?? {}), {
      layersOf: (set) => (set.kind === "layer" ? [set.ref] : []),
      base: (layerId, path) => {
        const v = evaluate(this.host.getDocument(), this.host.compositionId(), layerId, this.lastTime || 0)[path];
        return typeof v === "number" ? v : undefined;
      },
      env: {
        get pointerCoarse() {
          return coarse();
        },
        reducedMotion: this.host.reducedMotion(),
        breakpoint: "",
        states: new Set<string>(),
      },
    });
  }

  /** Step one frame. `time` is the transport's time (so scrubbing scrubs `time`-driven bindings); null when idle. */
  update(time: number, dt: number): BoundValues | null {
    this.ensure();
    const runtime = this.runtime!;
    if (runtime.idle) return null;
    if (Number.isFinite(this.lastTime) && time < this.lastTime - 1e-9) runtime.reset(); // a seek backwards: stateful operators start again
    this.lastTime = time;
    return runtime.step(busFrame(this.host.source, this.bus, time, dt));
  }

  dispose(): void {
    this.runtime = null;
    this.builtFor = null;
  }
}

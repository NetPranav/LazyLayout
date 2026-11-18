/**
 * ROADMAP Phase 87: the stage's side of layout motion and presence. Each frame it reads where every layer that asked
 * for layout motion sits in its parent (`offsetLeft` / `offsetTop`: the layout's answer, which no transform changes).
 * When that jumps (a sibling was reordered, the stack turned, the variant changed the layout) the layer is drawn where
 * it was and travels to the new place on its transition: the jump goes into an offset, written as CSS `translate`,
 * which springs back to zero. A second jump while it travels is added to the offset without touching its speed, so
 * interrupting never snaps.
 *
 * A layer with a way to appear plays it when the stage goes live (Preview starts) and when the layer is made; one with
 * a way to disappear leaves a copy of itself behind when it is deleted, which plays the exit and is then removed.
 *
 * It writes `translate`, `scale` and `opacity` on the layer's element, and puts back what was there when it is done.
 * Idle with no such layer on the page.
 */
import type { MotionDocument } from "../../document/schema";
import { kernelMover, transitionOf, type MoverFactory, type MoverLike } from "../../states/transitions";
import { hasLayoutMotion, layoutJump, layoutMotionOf, presencePose, type PresenceKind } from "../motion/layoutMotion";

export interface LayoutElement {
  offsetLeft: number;
  offsetTop: number;
  offsetWidth?: number;
  offsetHeight?: number;
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): string; getPropertyValue(name: string): string };
  parentElement?: unknown;
  cloneNode?(deep: boolean): unknown;
}
interface Ghost extends LayoutElement {
  remove(): void;
  setAttribute(name: string, value: string): void;
  removeAttribute?(name: string): void;
  querySelectorAll?(selector: string): ArrayLike<{ removeAttribute(name: string): void }>;
}

export interface LayoutDriverHost {
  getDocument(): MotionDocument;
  node(layerId: string): LayoutElement | undefined;
  /** Whether Preview (or the States switch) is on: entering plays when this turns true. */
  live(): boolean;
  reducedMotion(): boolean;
  mover?(): MoverFactory;
}

const WRITTEN = ["translate", "scale", "opacity"] as const;

interface Track {
  element: LayoutElement;
  parent: unknown;
  /** The last two layout positions, newest last. */
  xs: number[];
  ys: number[];
  x: MoverLike | null;
  y: MoverLike | null;
  /** 0 absent, 1 present. */
  presence: MoverLike | null;
  presenceKind: PresenceKind;
  originals: Map<string, string>;
  written: Map<string, string>;
}
interface Leaving {
  ghost: Ghost;
  kind: PresenceKind;
  mover: MoverLike;
}

export class LayoutDriver {
  private doc: MotionDocument | null = null;
  private watched: string[] = [];
  private known: Set<string> | null = null;
  private readonly tracks = new Map<string, Track>();
  private readonly leaving = new Set<Leaving>();
  private wasLive = false;
  /** Layers that should play their entrance on the next frame they are drawn. */
  private readonly entering = new Set<string>();

  constructor(private readonly host: LayoutDriverHost) {}

  private sync(): void {
    const doc = this.host.getDocument();
    if (doc === this.doc) return;
    const before = this.doc;
    this.doc = doc;
    this.watched = Object.values(doc.layers).filter((l) => hasLayoutMotion(l.properties) && l.visible !== false).map((l) => l.id);
    const now = new Set(this.watched);
    if (this.known) {
      // made (or shown, or just given a way to appear is not "made": only a layer new to the document, or shown again)
      for (const id of now) if (!this.known.has(id) && (!before?.layers[id] || before.layers[id].visible === false)) this.entering.add(id);
      for (const id of this.known) if (!now.has(id)) this.leave(id, before);
    }
    this.known = now;
  }

  /** A watched layer is gone (deleted or hidden): its copy plays the exit. */
  private leave(id: string, before: MotionDocument | null): void {
    const track = this.tracks.get(id);
    const was = before?.layers[id];
    this.tracks.delete(id);
    if (!track || !was) return;
    const kind = layoutMotionOf(was.properties).exit;
    const gone = !this.doc?.layers[id] || this.doc.layers[id].visible === false;
    this.restore(track);
    if (!gone || kind === "none" || this.host.reducedMotion()) return;
    const parent = (track.element.parentElement ?? track.parent) as { appendChild?(n: unknown): void; isConnected?: boolean } | null | undefined;
    if (parent?.isConnected === false) return; // its parent went too
    const copy = track.element.cloneNode?.(true) as Ghost | undefined;
    if (!parent?.appendChild || !copy?.style) return;
    // the copy is a picture, not a layer: nothing may find it by the layer's id
    copy.removeAttribute?.("data-element-id");
    for (const inner of Array.from(copy.querySelectorAll?.("[data-element-id]") ?? [])) inner.removeAttribute("data-element-id");
    copy.setAttribute("data-ll-leaving", "");
    copy.setAttribute("aria-hidden", "true");
    copy.style.setProperty("position", "absolute");
    copy.style.setProperty("left", `${track.xs[track.xs.length - 1] ?? 0}px`);
    copy.style.setProperty("top", `${track.ys[track.ys.length - 1] ?? 0}px`);
    if (track.element.offsetWidth !== undefined) copy.style.setProperty("width", `${track.element.offsetWidth}px`);
    if (track.element.offsetHeight !== undefined) copy.style.setProperty("height", `${track.element.offsetHeight}px`);
    copy.style.setProperty("margin", "0");
    copy.style.setProperty("pointer-events", "none");
    parent.appendChild(copy);
    const mover = (this.host.mover?.() ?? kernelMover)(transitionOf(was.properties), 1);
    mover.to(0);
    this.leaving.add({ ghost: copy, kind, mover });
  }

  get idle(): boolean {
    this.sync();
    return this.watched.length === 0 && this.tracks.size === 0 && this.leaving.size === 0;
  }

  /** How many layers are on the move (travelling, entering or leaving), for tests and the redraw decision. */
  get moving(): number {
    let n = this.leaving.size;
    for (const t of this.tracks.values()) if ((t.x && !t.x.resting) || (t.y && !t.y.resting) || (t.presence && !t.presence.resting)) n++;
    return n;
  }

  update(dt: number): void {
    this.sync();
    const doc = this.doc!;
    const reduced = this.host.reducedMotion();
    const make = this.host.mover?.() ?? kernelMover;
    const live = this.host.live();
    if (live && !this.wasLive) for (const id of this.watched) if (layoutMotionOf(doc.layers[id].properties).enter !== "none") this.entering.add(id);
    this.wasLive = live;

    for (const id of this.watched) {
      const element = this.host.node(id);
      const layer = doc.layers[id];
      if (!element?.style || !layer) continue;
      const settings = layoutMotionOf(layer.properties);
      const spec = transitionOf(layer.properties);
      let track = this.tracks.get(id);
      if (track && track.element !== element) {
        this.restore(track); // drawn into a new element: start again from where it is
        track = undefined;
      }
      if (!track) this.tracks.set(id, (track = { element, parent: element.parentElement, xs: [], ys: [], x: null, y: null, presence: null, presenceKind: "none", originals: new Map(), written: new Map() }));

      // layout motion: a jump in where the layout puts it becomes an offset that springs away
      const lx = element.offsetLeft;
      const ly = element.offsetTop;
      if (settings.on && !reduced && track.xs.length === 2) {
        const jx = layoutJump(track.xs[0], track.xs[1], lx);
        const jy = layoutJump(track.ys[0], track.ys[1], ly);
        if (jx !== 0) {
          track.x ??= make(spec, 0);
          track.x.use(spec);
          track.x.shift(-jx);
        }
        if (jy !== 0) {
          track.y ??= make(spec, 0);
          track.y.use(spec);
          track.y.shift(-jy);
        }
        // a jump is absorbed: the series carries on as if the layer had always been here
        if (jx !== 0) track.xs = [track.xs[0] + jx, track.xs[1] + jx];
        if (jy !== 0) track.ys = [track.ys[0] + jy, track.ys[1] + jy];
      }
      track.parent = element.parentElement ?? track.parent; // kept: a deleted layer's element has no parent any more
      track.xs = [...track.xs.slice(-1), lx];
      track.ys = [...track.ys.slice(-1), ly];
      if (track.xs.length === 1) {
        track.xs = [lx, lx];
        track.ys = [ly, ly];
      }
      if (!settings.on || reduced) track.x = track.y = null;
      let ox = track.x ? track.x.step(dt) : 0;
      let oy = track.y ? track.y.step(dt) : 0;
      // an offset is in px: a twentieth of one, hardly moving, is there
      if (track.x && Math.abs(ox) < 0.05 && Math.abs(track.x.velocity) < 3) track.x.jump((ox = 0));
      if (track.y && Math.abs(oy) < 0.05 && Math.abs(track.y.velocity) < 3) track.y.jump((oy = 0));
      if (track.x?.resting) track.x = null;
      if (track.y?.resting) track.y = null;

      // presence: the entrance
      if (this.entering.has(id)) {
        this.entering.delete(id);
        if (settings.enter !== "none" && !reduced) {
          track.presence = make(spec, 0);
          track.presence.to(1);
          track.presenceKind = settings.enter;
        }
      }
      let pose = { opacity: 1, scale: 1, y: 0 };
      if (track.presence) {
        pose = presencePose(track.presenceKind, track.presence.step(dt));
        if (track.presence.resting) track.presence = null;
      }

      const writes: Record<string, string> = {};
      const tx = ox;
      const ty = oy + pose.y;
      if (track.x || track.y || (track.presence && pose.y !== 0)) writes.translate = `${round(tx)}px ${round(ty)}px`;
      if (track.presence && pose.scale !== 1) writes.scale = String(round(pose.scale));
      if (track.presence && track.presenceKind !== "none") writes.opacity = String(round(pose.opacity));
      this.write(track, writes);
    }
    for (const id of [...this.tracks.keys()]) if (!this.watched.includes(id)) {
      this.restore(this.tracks.get(id)!);
      this.tracks.delete(id);
    }
    for (const id of [...this.entering]) if (!this.watched.includes(id)) this.entering.delete(id); // one not drawn yet waits for its element

    for (const l of [...this.leaving]) {
      const pose = presencePose(l.kind, reduced ? 0 : l.mover.step(dt));
      l.ghost.style.setProperty("opacity", String(round(pose.opacity)));
      if (pose.scale !== 1) l.ghost.style.setProperty("scale", String(round(pose.scale)));
      if (pose.y !== 0) l.ghost.style.setProperty("translate", `0px ${round(pose.y)}px`);
      if (reduced || l.mover.resting) {
        l.ghost.remove();
        this.leaving.delete(l);
      }
    }
  }

  private write(track: Track, writes: Record<string, string>): void {
    for (const property of WRITTEN) {
      const value = writes[property];
      if (value === undefined) {
        if (!track.originals.has(property)) continue;
        const original = track.originals.get(property)!;
        if (original) track.element.style.setProperty(property, original);
        else track.element.style.removeProperty(property);
        track.originals.delete(property);
        track.written.delete(property);
        continue;
      }
      if (!track.originals.has(property)) track.originals.set(property, track.element.style.getPropertyValue(property));
      if (track.written.get(property) === value) continue;
      track.element.style.setProperty(property, value);
      track.written.set(property, value);
    }
  }

  private restore(track: Track): void {
    this.write(track, {});
  }

  /** The offset a layer is drawn at now, for tests. */
  offsetOf(id: string): { x: number; y: number } {
    const t = this.tracks.get(id);
    return { x: t?.x?.value ?? 0, y: t?.y?.value ?? 0 };
  }

  dispose(): void {
    for (const t of this.tracks.values()) this.restore(t);
    this.tracks.clear();
    for (const l of this.leaving) l.ghost.remove();
    this.leaving.clear();
    this.entering.clear();
    this.doc = null;
    this.known = null;
    this.wasLive = false;
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;

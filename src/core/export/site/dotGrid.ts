/**
 * The cheapest form of a static dot grid (Design track D9): a cloner's copies that are all the same plain ellipse on a lattice
 * are written as ONE element with a CSS background (a repeating radial gradient), not one element per dot. A 100 x 60 grid is
 * one `<div>` instead of 6,000 nodes, and no script.
 *
 * It works on the markup the export already drew, and collapses only what it can prove identical: every copy is a wrapper of
 * pure translations around markup equal to the layer's own (one plain ellipse, no stroke, no filter), the offsets form a
 * complete lattice with a fixed pitch, and there are at least `MIN_DOTS` of them (a small grid stays as elements, which are
 * easier to edit afterwards). Anything else is left exactly as drawn.
 */
import type { ENode } from "./markup";

export const MIN_DOTS = 50;

const same = (a: ENode, b: ENode): boolean => JSON.stringify(strip(a)) === JSON.stringify(strip(b));
/** A node without the attributes that name the layer, which copies share anyway. */
const strip = (n: ENode): unknown => ({ tag: n.tag, attrs: Object.fromEntries(Object.entries(n.attrs).filter(([k]) => k !== "data-element-id")), style: n.style, text: n.text, children: n.children.map(strip) });

/** `#rgb` or `#rrggbb` with an opacity, as `rgba()`; null for anything else (a gradient, a named colour, `currentColor`). */
function rgba(color: string, opacity: number): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const n = parseInt(h, 16);
  const a = Math.round(opacity * 1000) / 1000;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** The dot an element draws: an `<svg>` holding one plain `<ellipse>`; its size, colour and the style it is placed with. */
function plainDot(n: ENode): { w: number; h: number; color: string; style: [string, string][] } | null {
  if (n.tag !== "svg" || n.children.length !== 1) return null;
  const g = n.children[0];
  if (g.tag !== "g" || g.children.length !== 1 || Object.keys(g.attrs).length > 0 || g.style.length > 0) return null;
  const e = g.children[0];
  if (e.tag !== "ellipse" || e.children.length > 0) return null;
  const a = e.attrs;
  if (a.stroke !== undefined && a.stroke !== "none") return null;
  if (a.filter || a.mask || a["clip-path"] || a.transform || a.opacity || e.style.length > 0) return null;
  const w = parseFloat(n.attrs.width ?? "");
  const h = parseFloat(n.attrs.height ?? "");
  const rx = parseFloat(a.rx ?? ""), ry = parseFloat(a.ry ?? ""), cx = parseFloat(a.cx ?? ""), cy = parseFloat(a.cy ?? "");
  if (![w, h, rx, ry, cx, cy].every(Number.isFinite)) return null;
  if (Math.abs(rx * 2 - w) > 1e-6 || Math.abs(ry * 2 - h) > 1e-6 || Math.abs(cx - w / 2) > 1e-6 || Math.abs(cy - h / 2) > 1e-6) return null; // a whole ellipse that fills its box
  const color = rgba(a.fill ?? "", a["fill-opacity"] === undefined ? 1 : parseFloat(a["fill-opacity"]));
  if (!color) return null;
  for (const [k] of n.style) if (!["position", "left", "top", "width", "height", "display", "flex-shrink", "box-sizing", "overflow", "pointer-events"].includes(k)) return null;
  return { w, h, color, style: n.style };
}

const px = (s: string | undefined): number | null => {
  const m = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec((s ?? "").trim());
  return m ? Number(m[1]) : null;
};

/** The pure translation a wrapper applies, or null. */
function translation(n: ENode): [number, number] | null {
  if (n.attrs["data-repeat-copy"] === undefined || n.children.length !== 1) return null;
  const t = n.style.find(([k]) => k === "transform")?.[1];
  const m = t ? /^translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)$/.exec(t.trim()) : null;
  if (!m) return null;
  for (const [k, v] of n.style) if (k === "opacity" && v !== "1") return null;
  if (n.style.some(([k]) => k === "filter")) return null;
  return [Number(m[1]), Number(m[2])];
}

/** Sorted distinct values, with the pitch if they are evenly spaced (or null). */
function lattice(values: number[]): { sorted: number[]; pitch: number } | null {
  const sorted = [...new Set(values.map((v) => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
  if (sorted.length < 2) return sorted.length === 1 ? { sorted, pitch: 0 } : null;
  const pitch = sorted[1] - sorted[0];
  if (!(pitch > 0)) return null;
  for (let i = 1; i < sorted.length; i++) if (Math.abs(sorted[i] - sorted[i - 1] - pitch) > 1e-3) return null;
  return { sorted, pitch };
}

function collapseIn(children: ENode[], skip: ReadonlySet<string>): ENode[] {
  const out: ENode[] = [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const dot = node.tag !== "#text" && node.attrs["data-element-id"] !== undefined ? plainDot(node) : null;
    if (!dot) { out.push(node); continue; }
    // the copies that follow: wrappers of this layer, in a row
    const id = node.attrs["data-element-id"];
    if (skip.has(id)) { out.push(node); continue; } // a live effector restyles these copies: they stay as they are
    let j = i + 1;
    const offsets: [number, number][] = [[0, 0]];
    while (j < children.length && children[j].attrs["data-repeat-of"] === id) {
      const t = translation(children[j]);
      if (!t || !same(children[j].children[0], node)) break;
      offsets.push(t);
      j++;
    }
    const wrappers = j - i - 1;
    // every wrapper after this layer's own copies must belong to the run: if the run broke early, leave it all as drawn
    const breaks = j < children.length && children[j].attrs["data-repeat-of"] === id;
    if (wrappers + 1 < MIN_DOTS || breaks) { out.push(node); continue; }
    const lx = lattice(offsets.map((o) => o[0]));
    const ly = lattice(offsets.map((o) => o[1]));
    const left = px(dot.style.find(([k]) => k === "left")?.[1]);
    const top = px(dot.style.find(([k]) => k === "top")?.[1]);
    const complete = lx && ly && lx.sorted.length * ly.sorted.length === offsets.length && new Set(offsets.map((o) => `${Math.round(o[0] * 1e4)}|${Math.round(o[1] * 1e4)}`)).size === offsets.length;
    if (!complete || left === null || top === null || (lx.sorted.length > 1 && lx.pitch < dot.w - 1e-6) || (ly.sorted.length > 1 && ly.pitch < dot.h - 1e-6)) { out.push(...children.slice(i, j)); i = j - 1; continue; }
    const pitchX = lx.sorted.length > 1 ? lx.pitch : dot.w;
    const pitchY = ly.sorted.length > 1 ? ly.pitch : dot.h;
    const width = (lx.sorted.length - 1) * pitchX + dot.w;
    const height = (ly.sorted.length - 1) * pitchY + dot.h;
    const r = (n: number) => Math.round(n * 1e4) / 1e4;
    const image = `radial-gradient(ellipse ${r(dot.w / 2)}px ${r(dot.h / 2)}px at ${r(dot.w / 2)}px ${r(dot.h / 2)}px, ${dot.color} calc(100% - 0.6px), rgba(0, 0, 0, 0) 100%)`;
    const placed: [string, string][] = dot.style.filter(([k]) => k !== "left" && k !== "top" && k !== "width" && k !== "height");
    out.push({
      tag: "div",
      attrs: { "data-element-id": id, "data-archetype": node.attrs["data-archetype"] ?? "ellipse", "aria-hidden": "true" },
      style: [...placed, ["left", `${r(left + lx.sorted[0])}px`], ["top", `${r(top + ly.sorted[0])}px`], ["width", `${r(width)}px`], ["height", `${r(height)}px`], ["background-image", image], ["background-size", `${r(pitchX)}px ${r(pitchY)}px`], ["background-repeat", "repeat"]],
      children: [],
    });
    i = j - 1;
  }
  return out;
}

/** Writes each qualifying grid of identical dots as one element, in place, everywhere in the tree. */
export function collapseDotGrids(roots: ENode[], skip: ReadonlySet<string> = new Set()): ENode[] {
  const visit = (nodes: ENode[]): ENode[] => collapseIn(nodes, skip).map((n) => (n.children.length > 0 ? { ...n, children: visit(n.children) } : n));
  return visit(roots);
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMarkup, walk, type ENode } from "../markup";
import { MIN_DOTS, collapseDotGrids } from "../dotGrid";

const dot = (id: string, w = 24, h = 24, fill = "#cbd5e1", extra = "", ellipseExtra = "") =>
  `<svg data-element-id="${id}" data-archetype="ellipse" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="box-sizing:border-box;position:absolute;left:100px;top:80px;width:${w}px;height:${h}px;display:block;flex-shrink:0;overflow:visible;${extra}"><g><ellipse fill="${fill}" fill-opacity="1" stroke="none" cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" ${ellipseExtra}></ellipse></g></svg>`;
const wrap = (id: string, i: number, tx: number, ty: number, inner: string, extraStyle = "") =>
  `<div data-repeat-copy="${i}" data-repeat-of="${id}" aria-hidden="true" style="position:absolute;left:0px;top:0px;width:0px;height:0px;overflow:visible;pointer-events:none;transform:translate(${tx}px, ${ty}px);transform-origin:112px 92px;opacity:1${extraStyle}">${inner}</div>`;
/** A cols x rows grid the way the cloner draws it: the layer, then a wrapper per copy. */
function grid(cols: number, rows: number, pitchX = 40, pitchY = 40, opts: { fill?: string; wrapExtra?: string; ellipseExtra?: string; skipOne?: number } = {}): string {
  let html = dot("e", 24, 24, opts.fill, "", opts.ellipseExtra);
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (r === 0 && c === 0) continue;
    n++;
    if (opts.skipOne === n) continue;
    html += wrap("e", n, c * pitchX, r * pitchY, dot("e", 24, 24, opts.fill, "", opts.ellipseExtra), opts.wrapExtra ?? "");
  }
  return `<div data-element-id="page" data-archetype="container">${html}</div>`;
}
const count = (roots: ENode[]) => { let n = 0; walk(roots, () => n++); return n; };
const find = (roots: ENode[], tag: string) => { const out: ENode[] = []; walk(roots, (n) => { if (n.tag === tag) out.push(n); }); return out; };

describe("a grid of identical dots is one element (D9)", () => {
  it("collapses a 20 x 10 grid (200 dots) into one div with a repeating radial-gradient, at the right size and place", () => {
    const before = parseMarkup(grid(20, 10));
    const after = collapseDotGrids(before);
    assert.ok(count(after) < 6, `from ${count(before)} nodes to ${count(after)}`);
    const [d] = find(after, "div").filter((n) => n.attrs["data-element-id"] === "e");
    const style = Object.fromEntries(d.style);
    assert.equal(style.left, "100px");
    assert.equal(style.top, "80px");
    assert.equal(style.width, `${19 * 40 + 24}px`); // 19 pitches plus one dot
    assert.equal(style.height, `${9 * 40 + 24}px`);
    assert.equal(style["background-size"], "40px 40px");
    assert.equal(style["background-repeat"], "repeat");
    assert.match(style["background-image"], /^radial-gradient\(ellipse 12px 12px at 12px 12px, rgba\(203, 213, 225, 1\) calc\(100% - 0\.6px\)/);
    assert.equal(find(after, "svg").length, 0, "no dot is left as an element");
    assert.equal(style.position, "absolute");
    assert.equal(d.style.filter(([k]) => k === "width").length, 1, "one width, the grid's");
  });

  it("the dots are in the same places: tile i, j is at (left + i * pitch, top + j * pitch), as the copies' translations say", () => {
    const after = collapseDotGrids(parseMarkup(grid(12, 5, 33, 27)));
    const [d] = find(after, "div").filter((n) => n.attrs["data-element-id"] === "e");
    const s = Object.fromEntries(d.style);
    assert.equal(s["background-size"], "33px 27px");
    assert.equal(s.width, `${11 * 33 + 24}px`);
    assert.equal(s.height, `${4 * 27 + 24}px`);
  });

  it("a colour with opacity becomes an rgba", () => {
    const html = grid(10, 6).replace(/fill-opacity="1"/g, 'fill-opacity="0.5"');
    const [d] = find(collapseDotGrids(parseMarkup(html)), "div").filter((n) => n.attrs["data-element-id"] === "e");
    assert.match(Object.fromEntries(d.style)["background-image"], /rgba\(203, 213, 225, 0\.5\)/);
  });

  it(`a small grid (under ${MIN_DOTS} dots) stays as elements`, () => {
    const roots = parseMarkup(grid(6, 6)); // 36
    assert.equal(count(collapseDotGrids(roots)), count(roots));
  });

  it("anything not provably identical and plain stays as drawn", () => {
    for (const [name, html] of [
      ["a stroke", grid(10, 6, 40, 40, { ellipseExtra: 'stroke-width="2"' }).replace(/stroke="none"/g, 'stroke="#000"')],
      ["a gradient fill", grid(10, 6, 40, 40, { fill: "url(#g1)" })],
      ["a filter", grid(10, 6, 40, 40, { ellipseExtra: 'filter="url(#blur)"' })],
      ["a scale in a copy", grid(10, 6).replace("translate(40px, 0px)", "translate(40px, 0px) scale(1.5)")],
      ["a faded copy", grid(10, 6, 40, 40, { wrapExtra: "" }).replace("opacity:1", "opacity:0.5")],
      ["a missing dot (the lattice has a hole)", grid(10, 6, 40, 40, { skipOne: 7 })],
      ["a copy of something else", grid(10, 6).replace(/fill="#cbd5e1"/, 'fill="#ff0000"')], // the layer itself differs from its copies
    ] as const) {
      const roots = parseMarkup(html);
      assert.equal(count(collapseDotGrids(roots)), count(roots), name);
    }
  });

  it("a layer a live effector restyles keeps its copies", () => {
    const roots = parseMarkup(grid(12, 6));
    assert.equal(count(collapseDotGrids(roots, new Set(["e"]))), count(roots));
  });

  it("is deterministic and does not change its input", () => {
    const roots = parseMarkup(grid(12, 6));
    const snapshot = JSON.stringify(roots);
    assert.equal(JSON.stringify(collapseDotGrids(roots)), JSON.stringify(collapseDotGrids(roots)));
    assert.equal(JSON.stringify(roots), snapshot);
  });
});

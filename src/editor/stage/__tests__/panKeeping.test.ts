import { test } from "node:test";
import assert from "node:assert/strict";
import { panKeeping } from "../panRequest";

/** Where a page point (relative to the artboard's middle, page px) lands on screen. */
const screenOf = (p: { x: number; y: number }, base: { x: number; y: number }, pan: { x: number; y: number }, zoom: number) => ({
  x: base.x + pan.x + p.x * zoom,
  y: base.y + pan.y + p.y * zoom,
});

test("panKeeping keeps the page point under the anchor in place across a zoom", () => {
  const base = { x: 800, y: 520 };
  const pan = { x: -120, y: 60 };
  const anchor = { x: 340, y: 210 };
  const from = 0.59;
  const to = 0.59 * 1.2;
  // the page point under the anchor before the zoom
  const p = { x: (anchor.x - base.x - pan.x) / from, y: (anchor.y - base.y - pan.y) / from };
  const next = panKeeping(anchor, base, pan, from, to);
  const after = screenOf(p, base, next, to);
  assert.ok(Math.abs(after.x - anchor.x) < 1e-9);
  assert.ok(Math.abs(after.y - anchor.y) < 1e-9);
});

test("panKeeping leaves the pan alone when the zoom does not change, or the old zoom is not usable", () => {
  const pan = { x: 10, y: -5 };
  assert.deepEqual(panKeeping({ x: 1, y: 2 }, { x: 3, y: 4 }, pan, 1, 1), pan);
  assert.deepEqual(panKeeping({ x: 1, y: 2 }, { x: 3, y: 4 }, pan, 0, 2), pan);
});

test("panKeeping around the artboard's middle with no pan keeps the pan at zero", () => {
  const base = { x: 500, y: 400 };
  assert.deepEqual(panKeeping(base, base, { x: 0, y: 0 }, 1, 2), { x: 0, y: 0 });
});

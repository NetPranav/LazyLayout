import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { MAIN_COMPOSITION_ID } from "../../document/compositions";
import { exprPath } from "../../expressions/exprModel";
import { evaluate } from "../evaluate";

/** A layer that swings left and right, x = 300 sin(2t) px, so its speed is 600 cos(2t) px/s. */
const swing = (extra: Record<string, number | string | boolean>) =>
  createDocumentFromLayers([
    createLayer({
      id: "ball", archetype: "rectangle",
      properties: { positioning: "absolute", "frame.x": 100, "frame.y": 100, "frame.width": 60, "frame.height": 60, [exprPath(1, "target")]: "transform.x", [exprPath(1, "text")]: "300 * sin(time * 2)", [exprPath(1, "enabled")]: true, ...extra },
    }) as Layer,
  ]);
const at = (doc: ReturnType<typeof swing>, t: number) => evaluate(doc, MAIN_COMPOSITION_ID, "ball", t);
const lastScale = (transform: unknown): [number, number] | null => {
  const all = [...String(transform ?? "").matchAll(/scale\(([\d.]+), ([\d.]+)\)/g)];
  const m = all[all.length - 1];
  return m ? [Number(m[1]), Number(m[2])] : null;
};

describe("speed effects in the kernel (D18)", () => {
  const doc = swing({ "speed.stretch": 1, "speed.ref": 1000, "speed.lean": 20, "speed.blur": 0.02 });

  // the effect amount against the velocity curve, at five times: speed = |600 cos(2t)|, along = 1 + min(1, speed / 1000)
  for (const t of [0, 0.5, 1.0, 1.5, 2.2]) {
    it(`at t = ${t} s the stretch follows the speed curve`, () => {
      const speed = Math.abs(600 * Math.cos(2 * t));
      const along = 1 + Math.min(1, speed / 1000);
      const got = lastScale(at(doc, t).transform)!;
      assert.ok(got, "there is a stretch");
      assert.ok(Math.abs(got[0] - along) < 0.01, `along ${got[0]} vs ${along}`);
      assert.ok(Math.abs(got[1] - 1 / Math.sqrt(along)) < 0.01, `across ${got[1]} vs ${1 / Math.sqrt(along)}`);
    });
  }

  it("at the turning point (speed 0) the layer is left exactly as it was: no stretch, no lean, no blur", () => {
    const t = Math.PI / 4; // cos(2t) = 0
    const withFx = at(doc, t);
    const without = at(swing({}), t);
    assert.equal(lastScale(withFx.transform), null);
    assert.equal(withFx.transform, without.transform);
    assert.equal(withFx["motion.blur.x"], undefined);
  });

  it("a layer with no speed effect is the same object it always was: nothing is measured", () => {
    const plain = swing({});
    const r = at(plain, 0.3);
    assert.equal("motion.blur.x" in r, false);
    assert.equal(lastScale(r.transform), null);
  });

  it("the blur follows each axis's speed", () => {
    const r = at(doc, 0);
    const want = 600 * 0.02 * 0.2887;
    assert.ok(Math.abs(Number(r["motion.blur.x"]) - want) < 0.05, `${r["motion.blur.x"]} vs ${want}`);
    assert.ok(!(Number(r["motion.blur.y"]) > 0.05), "no vertical motion, no vertical blur");
  });

  it("it leans toward the side it moves: right at t = 0, left at t = 1.5", () => {
    const rot = (t: number) => /rotate\((-?[\d.]+)deg\)(?!.*rotate)/.exec(String(at(doc, t).transform))?.[1];
    assert.ok(Number(rot(0)) > 0, `right: ${rot(0)}`);
    assert.ok(Number(rot(1.5)) < 0, `left: ${rot(1.5)}`);
  });

  it("scrubbing is the same as playing: the same time gives the same answer, in any order", () => {
    const a = [0.4, 1.7, 0.4].map((t) => String(at(doc, t).transform));
    assert.equal(a[0], a[2]);
  });
});

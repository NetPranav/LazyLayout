import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "../../document/compositions";
import { evaluate } from "../evaluate";

describe("Design track D4: bound values in the kernel", () => {
  const make = () => {
    const b = new DocBuilder();
    const a = b.layer("container", "A", null, { "transform.x": 10, "appearance.opacity": 1 });
    const c = b.layer("container", "C", null, { "transform.x": 5 });
    return { doc: b.build(), a, c };
  };

  it("a bound value replaces the property it drives, and only on that layer", () => {
    const { doc, a, c } = make();
    const bound = new Map([[a, new Map([["transform.x", 42]])]]);
    assert.equal(evaluate(doc, MAIN_COMPOSITION_ID, a, 0, { bound })["transform.x"], 42);
    assert.equal(evaluate(doc, MAIN_COMPOSITION_ID, c, 0, { bound })["transform.x"], 5);
    assert.equal(evaluate(doc, MAIN_COMPOSITION_ID, a, 0, { bound })["appearance.opacity"], 1); // untouched properties stay
  });

  it("with nothing bound, evaluation is exactly what it was", () => {
    const { doc, a } = make();
    assert.deepEqual(evaluate(doc, MAIN_COMPOSITION_ID, a, 0), evaluate(doc, MAIN_COMPOSITION_ID, a, 0, { bound: new Map() }));
    assert.deepEqual(evaluate(doc, MAIN_COMPOSITION_ID, a, 0), evaluate(doc, MAIN_COMPOSITION_ID, a, 0, { bound: new Map([[a, new Map()]]) }));
  });

  it("the same inputs give the same output (the kernel stays pure)", () => {
    const { doc, a } = make();
    const bound = new Map([[a, new Map([["transform.x", 7]])]]);
    assert.deepEqual(evaluate(doc, MAIN_COMPOSITION_ID, a, 1.5, { bound }), evaluate(doc, MAIN_COMPOSITION_ID, a, 1.5, { bound }));
  });
});

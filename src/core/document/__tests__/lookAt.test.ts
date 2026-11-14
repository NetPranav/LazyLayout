import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingDraftSchema, formatBinding, parseBinding } from "../signals";

describe("lookAt in the binding grammar (D6)", () => {
  it("parses, validates and formats back", () => {
    const text = "pointer.px(page) |> lookAt(120, 80) |> add(90) -> hero.transform.rotate";
    const draft = parseBinding(text);
    assert.deepEqual(draft.expr.operators[0], { op: "lookAt", x: 120, y: 80 });
    assert.ok(BindingDraftSchema.safeParse(draft).success);
    assert.equal(formatBinding(draft), "pointer.px(page) |> lookAt(120, 80) |> add(90) -> hero.transform.rotate");
  });
  it("needs two numbers", () => {
    assert.throws(() => parseBinding("pointer.px(page) |> lookAt(120) -> hero.transform.rotate"));
  });
});

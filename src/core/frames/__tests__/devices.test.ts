import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { frameSizeLabel, framesOfPage, mirrorBreakpointId, pageFrameOf } from "../devices";
import { isResponsiveFrame, isTopLevelFrame } from "../../breakpoints/breakpoints";
import { planDeviceChoiceAction } from "../../../editor/stage/deviceViews";

const L = (id: string, parentId: string | null, children: string[] = [], properties: Record<string, unknown> = {}, archetype: "container" | "text" = "container") =>
  createLayer({ id, archetype, parentId, name: id, children, properties: { "frame.width": 100, "frame.height": 100, ...properties } }) as Layer;

/** Two pages: page 1 has a Desktop frame with a card in it and a nested group; page 2 is empty. */
function twoPages(): Record<string, Layer> {
  const list = [
    L("page1", null, ["desk"], { "frame.width": 1440 }),
    L("desk", "page1", ["card", "inner"], { "frame.x": 0, "frame.width": 1440, "breakpoints.responsive": true }),
    L("card", "desk", [], {}, "text"),
    L("inner", "desk", [], { "breakpoints.responsive": true }),
    L("page2", null, [], { "frame.width": 1440 }),
  ];
  return Object.fromEntries(list.map((l) => [l.id, l]));
}

describe("frames belong to their page", () => {
  it("another page's root is not a frame of this page", () => {
    const layers = twoPages();
    assert.deepEqual(framesOfPage(layers, "page1").map((l) => l.id), ["desk"]);
    assert.deepEqual(framesOfPage(layers, "page2"), []);
    assert.equal(pageFrameOf(layers, "page1", "card"), "desk");
    assert.equal(pageFrameOf(layers, "page2", "card"), null);
  });

  it("on an empty second page, a device choice makes a frame at 0,0 (not beside page 1's root)", () => {
    const action = planDeviceChoiceAction({ device: "mobile", layers: twoPages(), rootId: "page2", selectedIds: [] });
    assert.equal(action.kind, "create_frame");
    assert.deepEqual(action.placement, { x: 0, y: 0 });
  });

  it("only a page's own frames can be responsive, not a frame nested inside one", () => {
    const layers = twoPages();
    assert.equal(isTopLevelFrame(layers.desk, layers), true);
    assert.equal(isTopLevelFrame(layers.inner, layers), false);
    assert.equal(isResponsiveFrame(layers.desk, layers), true);
    assert.equal(isResponsiveFrame(layers.inner, layers), false);
  });
});

describe("where a mirror's edits go", () => {
  const doc = (device: string) => ({
    breakpoints: [{ id: "base", name: "Desktop", width: 1440 }, { id: "tab", name: "Tablet", width: 768 }, { id: "mob", name: "Mobile", width: 375 }],
    layers: { ...twoPages(), m: L("m", "page1", [], { "frame.mirrorOf": "desk", "frame.device": device }) },
  });
  it("a Tablet mirror edits the Tablet breakpoint, a Desktop mirror the base, a non-mirror nothing", () => {
    assert.equal(mirrorBreakpointId(doc("tablet"), "m"), "tab");
    assert.equal(mirrorBreakpointId(doc("mobile"), "m"), "mob");
    assert.equal(mirrorBreakpointId(doc("desktop"), "m"), null);
    assert.equal(mirrorBreakpointId(doc("tablet"), "desk"), undefined);
    assert.equal(mirrorBreakpointId(doc("tablet"), null), undefined);
  });
});

describe("a frame's size label tells the truth", () => {
  it("a stored device or an exact device width is named; any other size is Custom with its own width", () => {
    assert.deepEqual(frameSizeLabel({ properties: { "frame.width": 864 } }), { label: "Custom", width: 864 });
    assert.deepEqual(frameSizeLabel({ properties: { "frame.width": 768 } }), { label: "Tablet", width: 768 });
    assert.deepEqual(frameSizeLabel({ properties: { "frame.width": 400, "frame.device": "mobile" } }), { label: "Mobile", width: 400 });
  });
});

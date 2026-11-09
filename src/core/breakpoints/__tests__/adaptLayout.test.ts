import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer, MotionDocument } from "../../document/schema";
import type { PropValue } from "../../document/registry";
import { resolveDocumentAt } from "../breakpoints";
import { adaptedFontSize, estimateTextHeight } from "../adaptLayout";
import { buildSiteExport } from "../../export/site";

const L = (id: string, parentId: string | null, children: string[], properties: Record<string, PropValue>, archetype: "container" | "text" | "image" | "button" = "container") =>
  createLayer({ id, archetype, parentId, name: id, children, properties: { ...(parentId ? { positioning: "absolute" } : {}), ...properties } }) as Layer;
const at = (id: string, x: number, y: number, w: number, h: number, extra: Record<string, PropValue> = {}, archetype: "container" | "text" | "image" | "button" = "container") =>
  L(id, "desk", [], { "frame.x": x, "frame.y": y, "frame.width": w, "frame.height": h, ...extra }, archetype);

/** A Desktop page: a headline, a picture beside a paragraph, three cards, and a button. */
function page(frameProps: Record<string, PropValue> = { "breakpoints.responsive": true, "breakpoints.adapt": true }, extra: Layer[] = []): MotionDocument {
  const kids = [
    at("title", 100, 60, 1240, 90, { "content.text": "Design it once, ship it lazily", "typography.fontSize": 64 }, "text"),
    at("pic", 100, 200, 600, 400, {}, "image"),
    at("para", 760, 200, 580, 200, { "content.text": "Words about the picture. ".repeat(12), "typography.fontSize": 18 }, "text"),
    at("c1", 100, 660, 380, 240),
    at("c2", 530, 660, 380, 240),
    at("c3", 960, 660, 380, 240),
    at("cta", 620, 960, 200, 48, { "content.label": "Start" }, "button"),
    ...extra,
  ];
  const doc = createDocumentFromLayers([
    L("page", null, ["desk"], { "frame.width": 1440, "frame.height": 900 }),
    L("desk", "page", kids.map((k) => k.id), { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 1040, ...frameProps }),
    ...kids,
  ]);
  return { ...doc, breakpoints: [{ id: "desktop", name: "Desktop", width: 1440 }, { id: "tablet", name: "Tablet", width: 768 }, { id: "mobile", name: "Mobile", width: 375 }] };
}

const box = (doc: MotionDocument, id: string) => {
  const p = doc.layers[id].properties;
  return { x: Number(p["frame.x"]), y: Number(p["frame.y"]), w: Number(p["frame.width"]), h: Number(p["frame.height"]) };
};
const IDS = ["title", "pic", "para", "c1", "c2", "c3", "cta"];

function assertTidy(doc: MotionDocument, width: number) {
  const boxes = IDS.map((id) => ({ id, ...box(doc, id) }));
  for (const b of boxes) {
    assert.ok(b.x >= 0, `${b.id} starts inside the frame (x ${b.x})`);
    assert.ok(b.x + b.w <= width + 0.5, `${b.id} ends inside the frame (${b.x + b.w} of ${width})`);
  }
  for (const a of boxes) {
    for (const b of boxes) {
      if (a.id >= b.id) continue;
      const crossX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const crossY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(crossX <= 1 || crossY <= 1, `${a.id} and ${b.id} do not overlap`);
    }
  }
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  assert.ok(Number(doc.layers.desk.properties["frame.height"]) >= bottom, "the frame holds everything");
}

describe("a frame adapts to narrower breakpoints by itself", () => {
  it("Tablet: everything is inside the frame, nothing overlaps, and rows that still fit stay side by side", () => {
    const tablet = resolveDocumentAt(page(), "tablet");
    assertTidy(tablet, 768);
    assert.equal(box(tablet, "pic").y, box(tablet, "para").y, "the picture and its paragraph stay side by side");
    assert.equal(box(tablet, "c1").y, box(tablet, "c3").y, "the three cards stay in a row");
  });

  it("Mobile: rows that no longer fit stack, the frame grows taller, and large type comes down", () => {
    const mobile = resolveDocumentAt(page(), "mobile");
    assertTidy(mobile, 375);
    assert.ok(box(mobile, "para").y > box(mobile, "pic").y, "the paragraph goes under the picture");
    assert.ok(box(mobile, "c2").y > box(mobile, "c1").y && box(mobile, "c3").y > box(mobile, "c2").y, "the cards stack");
    assert.ok(Number(mobile.layers.desk.properties["frame.height"]) > 1040);
    assert.ok(Number(mobile.layers.title.properties["typography.fontSize"]) < 64);
  });

  it("a picture keeps its shape, and a centred button stays centred at its own height", () => {
    const mobile = resolveDocumentAt(page(), "mobile");
    const pic = box(mobile, "pic");
    assert.ok(Math.abs(pic.w / pic.h - 600 / 400) < 0.02);
    const cta = box(mobile, "cta");
    assert.equal(cta.h, 48);
    assert.ok(Math.abs(cta.x + cta.w / 2 - 187.5) < 1);
  });

  it("the Desktop design itself is untouched", () => {
    const doc = page();
    assert.deepEqual(box(resolveDocumentAt(doc, null), "pic"), { x: 100, y: 200, w: 600, h: 400 });
    assert.equal(doc.layers.pic.overrides, undefined);
  });

  it("a layer moved at the breakpoint keeps its place; everything else still flows", () => {
    const doc = page();
    doc.layers.c1 = { ...doc.layers.c1, overrides: { tablet: { "frame.x": 7, "frame.y": 9 } } };
    const tablet = resolveDocumentAt(doc, "tablet");
    assert.equal(box(tablet, "c1").x, 7);
    assert.equal(box(tablet, "c1").y, 9);
    assert.notEqual(box(tablet, "c2").x, 530);
  });

  it("a layer pinned by a constraint follows its constraint, not the flow", () => {
    const pinned = at("corner", 1300, 10, 100, 40, { "constraints.horizontal": "right" });
    const tablet = resolveDocumentAt(page(undefined, [pinned]), "tablet");
    assert.equal(box(tablet, "corner").x, 1300 + (768 - 1440));
    assert.equal(box(tablet, "corner").y, 10);
  });

  it("a frame not opened through a device view keeps its layers where they were (the plain breakpoint bar)", () => {
    const tablet = resolveDocumentAt(page({ "breakpoints.responsive": true }), "tablet");
    assert.equal(box(tablet, "c3").x, 960);
  });

  it("a frame with a linked view adapts even if it was made before the flag existed", () => {
    const doc = page({ "breakpoints.responsive": true });
    const mirror = L("m", "page", [], { "frame.x": 1560, "frame.width": 768, "frame.height": 1024, "frame.mirrorOf": "desk", "frame.device": "tablet" });
    doc.layers.m = mirror;
    assertTidy(resolveDocumentAt(doc, "tablet"), 768);
  });

  it("is what ships: the export carries the adapted layout as @media rules", async () => {
    const { files } = await buildSiteExport({ ...page(), layers: { ...page().layers, page: { ...page().layers.page, page: { route: "/" } } } }, { target: "html", styling: "css" });
    const css = files.filter((f) => typeof f.content === "string").map((f) => f.content as string).join("\n");
    assert.match(css, /@media \(max-width: 375px\)/);
    assert.match(css, /@media \(max-width: 768px\)/);
  });
});

describe("a device frame is as tall as what is in it", () => {
  const doc = (kidY: number) => {
    const kid = at("k", 0, kidY, 100, 100);
    const d = createDocumentFromLayers([
      L("page", null, ["desk"], { "frame.width": 1440 }),
      L("desk", "page", ["k"], { "frame.width": 375, "frame.height": 812, "frame.device": "mobile" }),
      kid,
    ]);
    return d;
  };
  it("grows to hold a layer below its bottom, and keeps a height made by hand", () => {
    assert.equal(resolveDocumentAt(doc(1000), null).layers.desk.properties["frame.height"], 1100);
    assert.equal(resolveDocumentAt(doc(10), null).layers.desk.properties["frame.height"], 812);
  });
  it("with nothing to stretch, the document is the same object, so nothing re-renders", () => {
    const d = doc(10);
    assert.equal(resolveDocumentAt(d, null), d);
  });
  it("a frame of no device is left alone", () => {
    const d = createDocumentFromLayers([L("page", null, ["desk"], {}), L("desk", "page", ["k"], { "frame.width": 500, "frame.height": 100 }), at("k", 0, 900, 10, 10)]);
    assert.equal(resolveDocumentAt(d, null).layers.desk.properties["frame.height"], 100);
  });
});

describe("the pieces", () => {
  it("large type comes down gently, body text stays", () => {
    assert.equal(adaptedFontSize(16, 0.26), 16);
    assert.equal(adaptedFontSize(64, 0.25), 32);
    assert.equal(adaptedFontSize(64, 1), 64);
  });
  it("a text's height grows as it gets narrower", () => {
    assert.ok(estimateTextHeight("a".repeat(100), 16, 1.5, 200) > estimateTextHeight("a".repeat(100), 16, 1.5, 800));
  });
});

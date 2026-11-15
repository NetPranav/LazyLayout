/**
 * ROADMAP Phase 130: design-depth export. What can't be exact is listed as a warning (and only when the page uses
 * it); stock photos' credits go into CREDITS.md and, on a plain HTML page, a credits line; the page using every Stage 3
 * feature exports with every construct its features draw with.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../../document/factories";
import type { Layer, MotionDocument } from "../../../document/schema";
import { buildSiteExport } from "..";
import { creditsHtml, creditsMarkdown, designDepthWarnings, photoCredits } from "../designDepth";
import { buildDesignDepthDocument } from "../../../../../tests/export-harness/design-depth-fixture";

const docWith = (props: Record<string, unknown>, archetype = "container"): MotionDocument =>
  createDocumentFromLayers([createLayer({ id: "p", archetype: "container", parentId: null, name: "P", children: ["x"], properties: { "frame.width": 400, "frame.height": 300 } }) as Layer, createLayer({ id: "x", archetype: archetype as Layer["archetype"], parentId: "p", name: "x", properties: props as never }) as Layer]);

describe("Phase 130: warnings", () => {
  it("only for what the page uses", () => {
    assert.deepEqual(designDepthWarnings(docWith({ "appearance.background.color": "#fff" })), []);
    assert.match(designDepthWarnings(docWith({ "paint.effects": JSON.stringify([{ type: "glass" }]) })).join(" "), /Glass is drawn with CSS/);
    assert.match(designDepthWarnings(docWith({ "paint.effects": JSON.stringify([{ type: "layerBlur", blurType: "progressive", radius: 8 }]) })).join(" "), /5 steps/);
    assert.match(designDepthWarnings(docWith({ "paint.fills": JSON.stringify([{ type: "mesh", cols: 2, rows: 2, points: [{ x: 0, y: 0, color: "#000" }, { x: 1, y: 0, color: "#fff" }, { x: 0, y: 1, color: "#fff" }, { x: 1, y: 1, color: "#000" }] }]) }, "rectangle")).join(" "), /mesh gradient/);
    assert.match(designDepthWarnings(docWith({ "transform.style3d": "preserve3d", "transform.perspective": 900 })).join(" "), /2\.5D space/);
  });
});

describe("Phase 130: photo credits", () => {
  it("the photos a page shows, in CREDITS.md and as a credits line", () => {
    const doc = docWith({});
    const id = "a".repeat(64);
    doc.assets = { [id]: { id, name: "harbour.jpg", kind: "image", mime: "image/jpeg", bytes: 10, addedAt: 0, source: { kind: "photo", provider: "Openverse", id: "p1", title: "Harbour", author: "Ana", licence: "CC BY 4.0", url: "https://example.org/p1", attribution: '"Harbour" by Ana is licensed under CC BY 4.0.' } } };
    const credits = photoCredits(doc, [id, "b".repeat(64)]);
    assert.equal(credits.length, 1);
    assert.match(creditsMarkdown(credits), /- "Harbour" by Ana is licensed under CC BY 4\.0\. \(https:\/\/example\.org\/p1\)/);
    assert.match(creditsHtml(credits), /<footer class="ll-credits"[^>]*>Photos: <a href="https:\/\/example\.org\/p1">&quot;Harbour&quot; by Ana/);
  });
});

describe("Phase 130: the page with every Stage 3 feature", () => {
  it("exports with each feature's construct, and its warnings", async () => {
    const res = await buildSiteExport(buildDesignDepthDocument(), { target: "html", styling: "css" });
    const all = res.files.map((f) => String(f.content)).join("\n");
    for (const re of [/data-boolean="union"/, /<textPath /, /shape-outside:\s*polygon\(/, /preserve-3d/, /<feComponentTransfer/, /<foreignObject/, /<mask /, /column-count:\s*2/])
      assert.match(all, re);
    assert.ok(res.warnings.some((w) => w.includes("5 steps")));
  });
});

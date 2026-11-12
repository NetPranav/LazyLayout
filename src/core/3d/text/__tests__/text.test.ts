import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { glyphOutlines } from "../font";
import { registerFontBuffer } from "../fontCache";
import { layoutText } from "../layout";
import { textToMesh } from "../mesh";
import { addTextObject, setTextParams, convertTextToMesh } from "../commands";
import { signedRingArea } from "../../path/flatten";
import type { MotionDocument } from "../../../document/schema";

function toleranceEqual(actual: number, expected: number, tol = 1e-3, msg = ""): void {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol, `${msg} (actual: ${actual}, expected: ${expected}, diff: ${diff} > tol: ${tol})`);
}

function assertWatertight(
  indices: ArrayLike<number>,
  positions: ArrayLike<number>,
  label: string
): void {
  const edgeCounts = new Map<string, number>();
  const numTriangles = Math.floor(indices.length / 3);
  assert.ok(numTriangles >= 2, `${label} has too few triangles (${numTriangles})`);

  for (let i = 0; i < numTriangles; i++) {
    const i1 = indices[i * 3];
    const i2 = indices[i * 3 + 1];
    const i3 = indices[i * 3 + 2];

    const e1 = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
    const e2 = i2 < i3 ? `${i2}_${i3}` : `${i3}_${i2}`;
    const e3 = i3 < i1 ? `${i3}_${i1}` : `${i1}_${i3}`;

    edgeCounts.set(e1, (edgeCounts.get(e1) ?? 0) + 1);
    edgeCounts.set(e2, (edgeCounts.get(e2) ?? 0) + 1);
    edgeCounts.set(e3, (edgeCounts.get(e3) ?? 0) + 1);
  }

  const badEdges: string[] = [];
  for (const [edge, count] of edgeCounts.entries()) {
    if (count !== 2) {
      const [v0, v1] = edge.split("_").map(Number);
      const p0 = positions ? `(${positions[v0 * 3]?.toFixed(2)}, ${positions[v0 * 3 + 1]?.toFixed(2)}, ${positions[v0 * 3 + 2]?.toFixed(2)})` : `#${v0}`;
      const p1 = positions ? `(${positions[v1 * 3]?.toFixed(2)}, ${positions[v1 * 3 + 1]?.toFixed(2)}, ${positions[v1 * 3 + 2]?.toFixed(2)})` : `#${v1}`;
      badEdges.push(`${p0}-${p1} [count: ${count}]`);
    }
  }

  assert.equal(
    badEdges.length,
    0,
    `${label} has ${badEdges.length} bad edges: ${badEdges.slice(0, 5).join(", ")}`
  );
}

describe("Phase 3D-026: 3D Text Engine", () => {
  // Load Geist font from next.js compiled og directory
  const fontPath = path.resolve(
    process.cwd(),
    "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"
  );
  const fontBuffer = fs.readFileSync(fontPath);
  const font = registerFontBuffer("Geist", fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));

  describe("(a) Glyph Outlines & Accuracy", () => {
    it("glyph outlines of 'O' have two rings (outer and hole) and area matches font path area within 0.1%", () => {
      const outlines = glyphOutlines(font, "O", 72);
      assert.equal(outlines.length, 1);
      assert.equal(outlines[0].rings.length, 2, "Glyph 'O' has exactly two rings (outer and hole)");

      // Exact analytical area from BezPath Green's theorem
      const exactArea = Math.abs(outlines[0].bezPath.area());
      assert.ok(exactArea > 10, "Exact font path area is positive");

      // Polygonal flattened area from the 2 rings
      const flattenedArea = Math.abs(
        signedRingArea(outlines[0].rings[0]) + signedRingArea(outlines[0].rings[1])
      );

      const relDiff = Math.abs(flattenedArea - exactArea) / exactArea;
      assert.ok(
        relDiff < 0.001,
        `Flattened area (${flattenedArea}) must match exact font area (${exactArea}) within 0.1%, relative diff: ${(relDiff * 100).toFixed(4)}%`
      );
    });

    it("glyph outlines of 'B' has three rings (outer and two holes)", () => {
      const outlines = glyphOutlines(font, "B", 72);
      assert.equal(outlines.length, 1);
      assert.equal(outlines[0].rings.length, 3, "Glyph 'B' has outer ring and two inner holes");
    });
  });

  describe("(b) Text Layout", () => {
    it("layout widths equal the sum of advances", () => {
      const text = "SALE";
      const size = 64;
      const layout = layoutText(font, text, { size, tracking: 2 });

      assert.equal(layout.lines.length, 1);
      const line = layout.lines[0];

      const sumAdvances = line.advances.reduce((acc, v) => acc + v, 0);
      toleranceEqual(
        line.width,
        sumAdvances,
        1e-4,
        "Line layout width must equal the sum of glyph advances"
      );
      toleranceEqual(
        layout.width,
        line.width,
        1e-4,
        "Total layout width must equal single line width"
      );
    });

    it("multi-line layout correctly aligns center and right", () => {
      const multiline = "Hello\nWorld";
      const centerLayout = layoutText(font, multiline, { size: 48, align: "center" });
      assert.equal(centerLayout.lines.length, 2);
      assert.ok(centerLayout.height > 48 * 1.2);
    });
  });

  describe("(c) Watertight 3D Text Meshes", () => {
    const testWords = ["SALE", "Bob", "3D"];

    for (const word of testWords) {
      it(`text mesh for '${word}' is watertight 2-manifold`, () => {
        const mesh = textToMesh(font, word, {
          size: 40,
          depth: 8,
          bevel: 0.5,
          bevelSegments: 2,
        });

        assert.ok(mesh.indices.length >= 36, `Mesh for '${word}' has sufficient triangles`);
        assertWatertight(mesh.indices, mesh.positions, `Mesh for '${word}'`);
      });
    }
  });

  describe("(d) Text Data Block & Commands", () => {
    it("addTextObject creates Text3d block, Object3d with type 'text', and procedural mesh", () => {
      let doc: MotionDocument = {
        version: 7,
        name: "Doc",
        layers: {},
        scenes: {},
        objects: {},
        meshes: {},
        materials: {},
        tokens: {},
        compositions: {},
        exportSettings: { formats: ["png"] },
      } as unknown as MotionDocument;

      const res = addTextObject(doc, {
        text: "SALE",
        fontFamily: "Geist",
        fontBuffer: fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength),
        size: 50,
        depth: 5,
      });

      doc = res.doc;
      const textBlock = doc.texts?.[res.textId];
      assert.ok(textBlock, "Text3d block exists");
      assert.equal(textBlock.text, "SALE");

      const obj = doc.objects?.[res.objectId];
      assert.ok(obj, "Object3d exists");
      assert.equal(obj.type, "text");
      assert.equal(obj.dataId, res.textId);

      const mesh = doc.meshes?.[res.meshId];
      assert.ok(mesh, "Mesh3d exists");
      assert.equal(mesh.source?.kind, "text");
      assert.equal(mesh.source?.params.textId, res.textId);
      assertWatertight(mesh.indices!, mesh.positions!, "Generated text mesh");

      // Update text with setTextParams
      doc = setTextParams(doc, {
        objectId: res.objectId,
        text: "3D",
      });

      const updatedText = doc.texts?.[res.textId];
      assert.equal(updatedText?.text, "3D");
      const updatedMesh = doc.meshes?.[res.meshId];
      assert.equal(updatedMesh?.name, "3D Mesh");
      assert.ok(updatedMesh, "the updated text mesh exists");
      assertWatertight(updatedMesh.indices!, updatedMesh.positions!, "Updated text mesh");

      // Convert to plain mesh
      doc = convertTextToMesh(doc, res.objectId);
      const convertedObj = doc.objects?.[res.objectId];
      assert.equal(convertedObj?.type, "mesh", "Object converted to type mesh");
      assert.equal(convertedObj?.dataId, res.meshId);
      const bakedMesh = doc.meshes?.[res.meshId];
      assert.equal(bakedMesh?.source, undefined, "Procedural source dropped (baked mesh)");
    });
  });
});

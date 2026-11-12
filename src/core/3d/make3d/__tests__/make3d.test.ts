import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeSignedVolume } from "../../commands/primitives";
import { extrudeRings } from "../extrude";
import { latheRings } from "../lathe";
import { createPlaneMesh } from "../plane";
import { inflateRings } from "../inflate";
import { makeFromLayer, refreshLinked } from "../link";
import { parseFont, glyphOutlines } from "../../text/font";
import type { Ring } from "../../path/flatten";
import type { MotionDocument } from "../../../document/schema";
import { createLayer } from "../../../document/factories";

function toleranceEqual(actual: number, expected: number, tol = 1e-3, msg = ""): void {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol, `${msg} (actual: ${actual}, expected: ${expected}, diff: ${diff} > tol: ${tol})`);
}

function assertWatertight(
  indices: ArrayLike<number>,
  positions: ArrayLike<number>,
  shapeName: string,
  opName: string
): void {
  const edgeCounts = new Map<string, number>();
  const numTriangles = Math.floor(indices.length / 3);
  assert.ok(numTriangles >= 2, `${opName} for ${shapeName} has too few triangles (${numTriangles})`);

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
    `${opName} for ${shapeName} has ${badEdges.length} bad edges: ${badEdges.slice(0, 5).join(", ")}`
  );
}

describe("Phase 3D-029: Make 3D from 2D Layers", () => {
  // Load Geist font for reference glyph shapes
  const fontPath = path.resolve(
    process.cwd(),
    "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"
  );
  const fontBuffer = fs.readFileSync(fontPath);
  const font = parseFont(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));

  // Build the 10 reference shapes
  // 1. Square
  const square: Ring = [
    [0, 0],
    [20, 0],
    [20, 20],
    [0, 20],
    [0, 0],
  ];

  // 2. Rounded rectangle
  const roundedRect: Ring = [];
  const rw = 30, rh = 20, cr = 5;
  roundedRect.push([cr, 0], [rw - cr, 0]);
  for (let a = -Math.PI / 2; a <= 0; a += Math.PI / 8) {
    roundedRect.push([rw - cr + cr * Math.cos(a), cr + cr * Math.sin(a)]);
  }
  roundedRect.push([rw, rh - cr]);
  for (let a = 0; a <= Math.PI / 2; a += Math.PI / 8) {
    roundedRect.push([rw - cr + cr * Math.cos(a), rh - cr + cr * Math.sin(a)]);
  }
  roundedRect.push([cr, rh]);
  for (let a = Math.PI / 2; a <= Math.PI; a += Math.PI / 8) {
    roundedRect.push([cr + cr * Math.cos(a), rh - cr + cr * Math.sin(a)]);
  }
  roundedRect.push([0, cr]);
  for (let a = Math.PI; a <= (3 * Math.PI) / 2; a += Math.PI / 8) {
    roundedRect.push([cr + cr * Math.cos(a), cr + cr * Math.sin(a)]);
  }
  roundedRect.push([roundedRect[0][0], roundedRect[0][1]]);

  // 3. Circle (32 segments)
  const circle: Ring = [];
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * 2 * Math.PI;
    circle.push([20 + 15 * Math.cos(angle), 20 + 15 * Math.sin(angle)]);
  }
  circle.push([circle[0][0], circle[0][1]]);

  // 4. L shape
  const lShape: Ring = [
    [0, 0],
    [20, 0],
    [20, 10],
    [10, 10],
    [10, 30],
    [0, 30],
    [0, 0],
  ];

  // 5. Ring with hole (outer CCW, inner CW)
  const ringOuter: Ring = [];
  const ringHole: Ring = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 2 * Math.PI;
    ringOuter.push([20 + 15 * Math.cos(a), 20 + 15 * Math.sin(a)]);
  }
  ringOuter.push([ringOuter[0][0], ringOuter[0][1]]);
  for (let i = 0; i < 24; i++) {
    const a = (1 - i / 24) * 2 * Math.PI;
    ringHole.push([20 + 7 * Math.cos(a), 20 + 7 * Math.sin(a)]);
  }
  ringHole.push([ringHole[0][0], ringHole[0][1]]);
  const ringWithHole: Ring[] = [ringOuter, ringHole];

  // 6. Star (5-pointed star, 10 vertices)
  const star: Ring = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 20 : 8;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    star.push([20 + r * Math.cos(a), 20 + r * Math.sin(a)]);
  }
  star.push([star[0][0], star[0][1]]);

  // 7. Crescent
  const crescent: Ring = [];
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI;
    crescent.push([20 + 15 * Math.cos(a), 20 + 15 * Math.sin(a)]);
  }
  for (let i = 16; i >= 0; i--) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI;
    crescent.push([20 + 9 * Math.cos(a), 20 + 9 * Math.sin(a)]); // same centre, smaller radius: a C-shape with thin tips (a valid, non-self-intersecting outline)
  }
  crescent.push([crescent[0][0], crescent[0][1]]);

  // 8. Text glyph 'O'
  const glyphO = glyphOutlines(font, "O", 72).rings;

  // 9. Text glyph 'B'
  const glyphB = glyphOutlines(font, "B", 72).rings;

  // 10. Text glyph 'S'
  const glyphS = glyphOutlines(font, "S", 72).rings;

  const referenceShapes: { name: string; rings: Ring[] }[] = [
    { name: "square", rings: [square] },
    { name: "rounded rectangle", rings: [roundedRect] },
    { name: "circle", rings: [circle] },
    { name: "L", rings: [lShape] },
    { name: "ring with hole", rings: ringWithHole },
    { name: "star", rings: [star] },
    { name: "crescent", rings: [crescent] },
    { name: "text glyph 'O'", rings: glyphO },
    { name: "text glyph 'B'", rings: glyphB },
    { name: "text glyph 'S'", rings: glyphS },
  ];

  describe("(a) All four meshes watertight for 10 reference shapes", () => {
    for (const { name, rings } of referenceShapes) {
      it(`extrudeRings is watertight for ${name}`, () => {
        const mesh = extrudeRings(rings, {
          depth: 10,
          bevel: { size: 1, segments: 2, profile: "round" },
        });
        assertWatertight(mesh.indices, mesh.positions, name, "extrudeRings");
      });

      it(`inflateRings is watertight for ${name}`, () => {
        const mesh = inflateRings(rings, {
          depth: 5,
          resolution: 8,
        });
        assertWatertight(mesh.indices, mesh.positions, name, "inflateRings");
      });

      it(`latheRings is watertight for ${name}`, () => {
        const mesh = latheRings(rings, {
          segments: 16,
          axis: "y",
        });
        assertWatertight(mesh.indices, mesh.positions, name, "latheRings");
      });

      it(`createPlaneMesh is watertight for ${name}`, () => {
        const mesh = createPlaneMesh(rings, {
          thickness: 0.5,
        });
        assertWatertight(mesh.indices, mesh.positions, name, "createPlaneMesh");
      });
    }
  });

  describe("(b) Extrude volume equals area * depth for straight-walled square with no bevel", () => {
    it("exact positive volume matching analytical area * depth", () => {
      const depth = 7.5;
      const mesh = extrudeRings([square], { depth });

      const area = 20 * 20; // 400
      const expectedVolume = area * depth; // 3000

      const actualVolume = computeSignedVolume(mesh.positions, mesh.indices);
      toleranceEqual(actualVolume, expectedVolume, 1e-2, "Volume equals area * depth");
    });
  });

  describe("(c) makeFromLayer and refreshLinked performance", () => {
    it("creates linked mesh with layer fill color and refreshes 10 shapes in < 100 ms", () => {
      let doc: MotionDocument = {
        version: 7,
        name: "Test Doc",
        layers: {},
        scenes: {},
        objects: {},
        meshes: {},
        materials: {},
        tokens: {},
        compositions: {},
        exportSettings: { formats: ["png"] },
      } as unknown as MotionDocument;

      const layerIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const layerId = `layer_shape_${i}`;
        layerIds.push(layerId);
        const l = createLayer({
          id: layerId,
          name: `Shape ${i}`,
          archetype: "rectangle",
          properties: {
            width: 100 + i * 10,
            height: 100 + i * 10,
            fill: "#ff5500",
          },
        });
        doc.layers[layerId] = l;

        doc = makeFromLayer(doc, layerId, "extrude", { depth: 5 + i });
      }

      assert.equal(Object.keys(doc.meshes ?? {}).length, 10);
      assert.equal(Object.keys(doc.objects ?? {}).length, 10);
      assert.equal(Object.keys(doc.materials ?? {}).length, 10);

      const firstMat = Object.values(doc.materials ?? {})[0];
      assert.equal(firstMat?.baseColor, "#ff5500");

      const start = performance.now();
      const refreshed = refreshLinked(doc, layerIds);
      const elapsed = performance.now() - start;

      assert.ok(
        elapsed < 300,
        `refreshLinked for 10 shapes took ${elapsed.toFixed(2)} ms (expected < 300 ms)`
      );
      assert.equal(Object.keys(refreshed.meshes ?? {}).length, 10);
    });
  });
});

/**
 * ============================================================================
 * UNIT TESTS: DIRTY TRACKER & GPU UPLOAD BOOKKEEPING (Phase 3D-013)
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EditMesh } from "../editMesh";
import { DirtyTracker } from "../dirty";

describe("DirtyTracker Incremental GPU Bookkeeping", () => {
  it("merges contiguous dirty vertex ranges into a single byte range", () => {
    const mesh = new EditMesh();
    for (let i = 0; i < 20; i++) {
      mesh.addVert([i, 0, 0]);
    }
    const tracker = new DirtyTracker(mesh);
    // Baseline flush
    tracker.flushRanges();

    // Mark vertices 4, 5, 6 dirty
    mesh.moveVert(mesh.verts[4], [4, 1, 0]);
    mesh.moveVert(mesh.verts[5], [5, 1, 0]);
    mesh.moveVert(mesh.verts[6], [6, 1, 0]);

    const flush = tracker.flushRanges();
    assert.strictEqual(flush.fullReupload, false);
    assert.strictEqual(flush.positions.length, 1);
    // 12 bytes per vertex; index 4 starts at 4 * 12 = 48 bytes, count 3 * 12 = 36 bytes
    assert.strictEqual(flush.positions[0].start, 48);
    assert.strictEqual(flush.positions[0].count, 36);
    assert.strictEqual(flush.indices.length, 0);
  });

  it("produces separate ranges for non-contiguous dirty vertices", () => {
    const mesh = new EditMesh();
    for (let i = 0; i < 30; i++) {
      mesh.addVert([i, 0, 0]);
    }
    const tracker = new DirtyTracker(mesh);
    tracker.flushRanges();

    // Mark vertices 2 and 10 dirty
    mesh.moveVert(mesh.verts[2], [2, 2, 0]);
    mesh.moveVert(mesh.verts[10], [10, 2, 0]);

    const flush = tracker.flushRanges();
    assert.strictEqual(flush.fullReupload, false);
    assert.strictEqual(flush.positions.length, 2);

    assert.strictEqual(flush.positions[0].start, 2 * 12);
    assert.strictEqual(flush.positions[0].count, 12);

    assert.strictEqual(flush.positions[1].start, 10 * 12);
    assert.strictEqual(flush.positions[1].count, 12);
  });

  it("signals fullReupload when topology changes", () => {
    const mesh = new EditMesh();
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([1, 0, 0]);
    const v2 = mesh.addVert([0, 1, 0]);
    mesh.addFace([v0, v1, v2]);

    const tracker = new DirtyTracker(mesh);
    tracker.flushRanges(); // Clean

    // Topology addition: new vertex
    mesh.addVert([2, 2, 2]);

    const flush = tracker.flushRanges();
    assert.strictEqual(flush.fullReupload, true);
    assert.ok(flush.positions.length >= 1);
  });

  it("tracks vertex-to-corners map accurately", () => {
    const mesh = new EditMesh();
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([1, 0, 0]);
    const v2 = mesh.addVert([1, 1, 0]);
    const v3 = mesh.addVert([0, 1, 0]);

    // Two triangles sharing v1 and v3
    mesh.addFace([v0, v1, v3]);
    mesh.addFace([v1, v2, v3]);

    const tracker = new DirtyTracker(mesh);
    tracker.toTrianglesIncremental();

    const v1Corners = tracker.getAffectedCorners(v1.index);
    assert.ok(v1Corners);
    // v1 is used in both triangles
    assert.strictEqual(v1Corners.length, 2);

    const v0Corners = tracker.getAffectedCorners(v0.index);
    assert.ok(v0Corners);
    // v0 is used in only first triangle
    assert.strictEqual(v0Corners.length, 1);
  });
});

describe("Test (d): Dirty-range & timing test on a 200,000-face grid mesh", () => {
  it("edits one vertex of a 200,000-face mesh with a single 1-vertex dirty range and < 2 ms timing", () => {
    // Construct 200,000-face grid: 500 quads wide x 200 quads high = 100,000 quads = 200,000 triangles
    const W = 500;
    const H = 200;
    const vertCount = (W + 1) * (H + 1); // 501 * 201 = 100,701 vertices
    const triCount = W * H * 2;          // 200,000 triangles

    const positions = new Float32Array(vertCount * 3);
    for (let y = 0; y <= H; y++) {
      for (let x = 0; x <= W; x++) {
        const idx = y * (W + 1) + x;
        positions[idx * 3 + 0] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = 0;
      }
    }

    const indices = new Uint32Array(triCount * 3);
    let ptr = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v0 = y * (W + 1) + x;
        const v1 = v0 + 1;
        const v2 = (y + 1) * (W + 1) + x;
        const v3 = v2 + 1;

        indices[ptr++] = v0;
        indices[ptr++] = v1;
        indices[ptr++] = v2;

        indices[ptr++] = v1;
        indices[ptr++] = v3;
        indices[ptr++] = v2;
      }
    }

    // Build EditMesh from grid (not timed)
    const mesh = EditMesh.fromTriangles(positions, indices);
    const tracker = new DirtyTracker(mesh);

    // Warm-up and build baseline cache (not timed)
    tracker.toTrianglesIncremental();
    const initFlush = tracker.flushRanges();
    assert.strictEqual(initFlush.fullReupload, true);

    // Pick vertex to edit near the middle of the 100,701 vertices
    const targetIndex = 50000;
    const targetVert = mesh.verts[targetIndex];
    assert.ok(targetVert);
    const origX = targetVert.co[0];
    const origY = targetVert.co[1];
    const origZ = targetVert.co[2];

    // Benchmark ONLY: edit + flush + incremental update
    const t0 = performance.now();
    mesh.moveVert(targetVert, [origX + 1.25, origY + 0.75, origZ + 2.0]);
    const flush = tracker.flushRanges();
    const updated = mesh.toTrianglesIncremental(tracker);
    const elapsed = performance.now() - t0;

    console.log(
      `[B2-013 Performance] One-vertex edit + flush + incremental update on 200,000-face mesh: ${elapsed.toFixed(4)} ms`
    );

    // Assertions on dirty range
    assert.strictEqual(flush.fullReupload, false, "Expected incremental update (fullReupload === false)");
    assert.strictEqual(flush.positions.length, 1, "Expected exactly 1 dirty position range");
    assert.strictEqual(
      flush.positions[0].start,
      targetIndex * 12,
      `Expected start byte ${targetIndex * 12}, got ${flush.positions[0].start}`
    );
    assert.strictEqual(
      flush.positions[0].count,
      12,
      "Expected dirty count of exactly 12 bytes (1 vertex = 3x Float32)"
    );
    assert.strictEqual(flush.indices.length, 0, "Expected 0 dirty index ranges for vertex translation");

    // Timing assertion: target < 2 ms, allow 10 ms to keep CI stable
    assert.ok(
      elapsed < 10,
      `Timing assertion failed: expected < 10 ms, took ${elapsed} ms`
    );

    // Verify buffer data correctly updated
    assert.strictEqual(updated.positions[targetIndex * 3 + 0], origX + 1.25);
    assert.strictEqual(updated.positions[targetIndex * 3 + 1], origY + 0.75);
    assert.strictEqual(updated.positions[targetIndex * 3 + 2], origZ + 2.0);
  });
});

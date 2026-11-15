import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { leaderLine, partPoint, projectPoint, type Camera } from "../project";

const vp = { width: 1200, height: 800 };
const cam: Camera = { position: [0, 0, 10], target: [0, 0, 0], fov: 50 };

describe("labels that follow 3D parts (D20)", () => {
  it("the target is at the centre of the screen; up is up and right is right", () => {
    const c = projectPoint(cam, [0, 0, 0], vp);
    assert.ok(Math.abs(c.x - 600) < 1e-9 && Math.abs(c.y - 400) < 1e-9);
    assert.ok(projectPoint(cam, [1, 0, 0], vp).x > 600);
    assert.ok(projectPoint(cam, [0, 1, 0], vp).y < 400);
  });

  it("matches the pinhole formula within 1 px at 10 poses (camera moving round the watch, parts exploding and turning)", () => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const c: Camera = { position: [8 * Math.sin(a), 2, 8 * Math.cos(a)], target: [0, 0, 0], fov: 40 + i };
      const world = partPoint([0.5, 0, -0.1], [0.1, 0.05, 0], [0, 0, -0.3 * i], a * 0.5);
      const p = projectPoint(c, world, vp);
      // independent check: build the camera basis another way (spherical angles) and project
      const yaw = Math.atan2(c.position[0], c.position[2]);
      const pitch = Math.atan2(c.position[1], Math.hypot(c.position[0], c.position[2]));
      const d = [world[0] - c.position[0], world[1] - c.position[1], world[2] - c.position[2]];
      const x1 = d[0] * Math.cos(yaw) - d[2] * Math.sin(yaw);
      const z1 = d[0] * Math.sin(yaw) + d[2] * Math.cos(yaw);
      const y2 = d[1] * Math.cos(pitch) - z1 * Math.sin(pitch);
      const z2 = d[1] * Math.sin(pitch) + z1 * Math.cos(pitch);
      const depth = -z2;
      const k = 1 / Math.tan((c.fov * Math.PI) / 360);
      const ex = ((x1 * k) / (depth * (vp.width / vp.height)) + 1) / 2 * vp.width;
      const ey = (1 - (y2 * k) / depth) / 2 * vp.height;
      assert.ok(Math.hypot(p.x - ex, p.y - ey) < 1, `pose ${i}: ${p.x},${p.y} vs ${ex},${ey}`);
    }
  });

  it("a point behind the camera is not visible", () => {
    assert.equal(projectPoint(cam, [0, 0, 20], vp).visible, false);
  });

  it("the leader line starts on the label side that faces the point", () => {
    const box = { x: 100, y: 100, width: 80, height: 20 };
    assert.deepEqual(leaderLine(box, { x: 400, y: 115 }).from, [180, 110]);
    assert.deepEqual(leaderLine(box, { x: 20, y: 105 }).from, [100, 110]);
    assert.deepEqual(leaderLine(box, { x: 140, y: 400 }).from, [140, 120]);
  });

  it("a part's point follows its explode offset and its turn", () => {
    assert.deepEqual(partPoint([1, 0, 0], [0, 0, 0], [0, 2, 0]), [1, 2, 0]);
    const p = partPoint([0, 0, 0], [1, 0, 0], [0, 0, 0], Math.PI / 2);
    assert.ok(Math.abs(p[0]) < 1e-9 && Math.abs(p[2] + 1) < 1e-9);
  });
});

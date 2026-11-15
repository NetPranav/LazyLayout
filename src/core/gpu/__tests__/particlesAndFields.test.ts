import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayerTextureSdfRegistry } from "../layerTexturesAndSdf";
import {
  CPU_MAX_PARTICLES,
  GPU_MAX_PARTICLES,
  compileGpuParticleUpdateShader,
  createParticleSimulation,
  resolveParticleTierBudget,
  type ParticleEmitterConfig,
} from "../particlesAndFields";

describe("Phase 183: Particles & force fields", () => {
  it("enforces tier particle budgets and seeded determinism", () => {
    assert.equal(resolveParticleTierBudget("T1").backend, "cpu");
    assert.equal(resolveParticleTierBudget("T1").maxParticles, CPU_MAX_PARTICLES);
    assert.equal(resolveParticleTierBudget("T3").backend, "gpu");
    assert.equal(resolveParticleTierBudget("T3").maxParticles, GPU_MAX_PARTICLES);

    const cfg: ParticleEmitterConfig = {
      seed: 1337,
      spawnRatePerSec: 120,
      maxParticles: 300,
      lifeSec: 4,
      originX: 100,
      originY: 100,
      spreadRadiusPx: 18,
      initialSpeedPxPerSec: 45,
      renderMode: "links",
      linkDistancePx: 28,
      forces: [
        { type: "gravity", gx: 0, gy: 40 },
        { type: "drag", coefficient: 0.4 },
        { type: "noise_curl", strength: 25, frequency: 0.05 },
        { type: "pointer_orbit", strength: 180, radiusPx: 120 },
      ],
    };

    const a = createParticleSimulation(cfg, "T1", "cpu");
    const b = createParticleSimulation(cfg, "T1", "cpu");
    for (let f = 0; f < 30; f += 1) {
      a.step(1 / 60, { pointerX: 110, pointerY: 95 });
      b.step(1 / 60, { pointerX: 110, pointerY: 95 });
    }
    assert.deepEqual(a.getPositionsXY(), b.getPositionsXY());
    assert.deepEqual(a.getStats(), b.getStats());
  });

  it("keeps CPU and GPU backends within 2% on active density and centroid across reference presets", () => {
    const presets: ParticleEmitterConfig[] = [
      {
        seed: 7,
        spawnRatePerSec: 200,
        maxParticles: 400,
        lifeSec: 5,
        originX: 160,
        originY: 90,
        spreadRadiusPx: 12,
        initialSpeedPxPerSec: 50,
        renderMode: "points",
        forces: [
          { type: "gravity", gx: 0, gy: 90 },
          { type: "drag", coefficient: 0.2 },
          { type: "bounds", minX: 0, minY: 0, maxX: 320, maxY: 200, restitution: 0.7 },
        ],
      },
      {
        seed: 21,
        spawnRatePerSec: 180,
        maxParticles: 400,
        lifeSec: 5,
        originX: 150,
        originY: 120,
        spreadRadiusPx: 20,
        initialSpeedPxPerSec: 30,
        renderMode: "sprites",
        forces: [
          { type: "vortex", cx: 150, cy: 120, strength: 160 },
          { type: "pointer_attract", strength: 210, radiusPx: 200 },
        ],
      },
      {
        seed: 42,
        spawnRatePerSec: 150,
        maxParticles: 300,
        lifeSec: 5,
        originX: 80,
        originY: 80,
        spreadRadiusPx: 8,
        initialSpeedPxPerSec: 25,
        renderMode: "trails",
        trailLength: 6,
        forces: [
          { type: "pointer_repel", strength: 240, radiusPx: 160 },
          { type: "drag", coefficient: 0.5 },
        ],
      },
      {
        seed: 99,
        spawnRatePerSec: 240,
        maxParticles: 500,
        lifeSec: 5,
        originX: 100,
        originY: 100,
        spreadRadiusPx: 30,
        initialSpeedPxPerSec: 60,
        renderMode: "links",
        linkDistancePx: 25,
        forces: [{ type: "noise_curl", strength: 45, frequency: 0.04 }],
      },
      {
        seed: 555,
        spawnRatePerSec: 160,
        maxParticles: 350,
        lifeSec: 5,
        originX: 200,
        originY: 140,
        spreadRadiusPx: 10,
        initialSpeedPxPerSec: 35,
        renderMode: "instanced_meshes",
        forces: [
          { type: "pointer_orbit", strength: 190, radiusPx: 180 },
          { type: "drag", coefficient: 0.3 },
        ],
      },
    ];

    for (const cfg of presets) {
      const cpu = createParticleSimulation(cfg, "T1", "cpu");
      const gpu = createParticleSimulation(cfg, "T3", "gpu");
      for (let f = 0; f < 45; f += 1) {
        const ptr = { pointerX: 130 + f, pointerY: 110 };
        cpu.step(1 / 60, ptr);
        gpu.step(1 / 60, ptr);
      }
      const cs = cpu.getStats();
      const gs = gpu.getStats();
      const densityDrift = Math.abs(cs.activeCount - gs.activeCount) / Math.max(1, cs.activeCount);
      assert.ok(densityDrift <= 0.02, `CPU/GPU density drifted by ${(densityDrift * 100).toFixed(2)}%`);
      const dx = Math.abs(cs.centroidX - gs.centroidX);
      const dy = Math.abs(cs.centroidY - gs.centroidY);
      const scale = Math.max(100, Math.hypot(cs.centroidX, cs.centroidY));
      assert.ok(dx / scale <= 0.02 && dy / scale <= 0.02, `CPU/GPU centroid parity drifted (${dx}, ${dy})`);
      assert.ok(compileGpuParticleUpdateShader(cfg).includes("#version 300 es"));
    }
  });

  it("emits from and spring-assembles particles onto any Phase 175 layer outline and SDF fill", () => {
    const reg = createLayerTextureSdfRegistry("p183-shape");
    try {
      const boxSdf = reg.updateLayer({
        id: "hero-text-box",
        kind: "rectangle",
        version: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 40,
      });

      const sim = createParticleSimulation(
        {
          seed: 77,
          spawnRatePerSec: 0,
          maxParticles: 120,
          lifeSec: 10,
          originX: 50,
          originY: 20,
          spreadRadiusPx: 60,
          initialSpeedPxPerSec: 10,
          renderMode: "points",
          shapeTarget: { sdf: boxSdf, mode: "outline", offsetX: 10, offsetY: 10 },
          forces: [{ type: "spring_to_shape", stiffness: 28, damping: 8 }],
        },
        "T2"
      );

      sim.spawnBurst(120, 120, 90, 40);
      for (let f = 0; f < 90; f += 1) {
        sim.step(1 / 60, {
          pointerX: 60,
          pointerY: 30,
          activeInteraction: f === 10 ? "burst_on_tap" : undefined,
          tapX: 60,
          tapY: 30,
        });
      }

      const stats = sim.getStats();
      assert.equal(stats.activeCount, 120);
      assert.ok(Math.abs(stats.centroidX - 60) < 12, `centroidX should settle near shape center 60, got ${stats.centroidX}`);
      assert.ok(Math.abs(stats.centroidY - 30) < 12, `centroidY should settle near shape center 30, got ${stats.centroidY}`);
    } finally {
      reg.unmountAll();
    }
  });
});

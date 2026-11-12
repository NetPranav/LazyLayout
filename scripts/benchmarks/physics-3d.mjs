/**
 * ROADMAP_3D 3D-001: the rigid-physics benchmark behind decision 0013. 100 bodies (balls and boxes) fall into a pile
 * for 600 steps at 60 Hz, twice per engine; reports time, whether both runs end identically, and gzipped size.
 *
 *   mkdir /tmp/pb && cd /tmp/pb && npm init -y && npm i @dimforge/rapier3d-compat@0.14.0 cannon-es@0.20.0
 *   node scripts/benchmarks/physics-3d.mjs /tmp/pb
 *
 * The engines are installed in a scratch folder on purpose: none is a dependency until ROADMAP_3D 3D-135.
 */
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
const req = createRequire(process.argv[2] + "/package.json");
const STEPS = 600, N = 100;
const layout = (i) => ({ x: (i % 10) * 1.1 - 5, y: 2 + Math.floor(i / 10) * 1.2, z: ((i * 7) % 5) * 0.3 });
const hash = (arr) => createHash("sha256").update(Buffer.from(new Float64Array(arr).buffer)).digest("hex").slice(0, 16);

async function rapierRun() {
  const RAPIER = req("@dimforge/rapier3d-compat");
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20));
  const bodies = [];
  for (let i = 0; i < N; i++) {
    const p = layout(i);
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z));
    world.createCollider(i % 2 ? RAPIER.ColliderDesc.ball(0.5) : RAPIER.ColliderDesc.cuboid(0.45, 0.45, 0.45), b);
    bodies.push(b);
  }
  world.timestep = 1 / 60;
  const t0 = performance.now();
  for (let s = 0; s < STEPS; s++) world.step();
  const ms = performance.now() - t0;
  const out = bodies.flatMap((b) => { const t = b.translation(); return [t.x, t.y, t.z]; });
  return { ms, h: hash(out) };
}
async function cannonRun() {
  const C = req("cannon-es");
  const world = new C.World({ gravity: new C.Vec3(0, -9.81, 0) });
  const ground = new C.Body({ mass: 0, shape: new C.Box(new C.Vec3(20, 0.1, 20)) });
  world.addBody(ground);
  const bodies = [];
  for (let i = 0; i < N; i++) {
    const p = layout(i);
    const b = new C.Body({ mass: 1, shape: i % 2 ? new C.Sphere(0.5) : new C.Box(new C.Vec3(0.45, 0.45, 0.45)), position: new C.Vec3(p.x, p.y, p.z) });
    world.addBody(b);
    bodies.push(b);
  }
  const t0 = performance.now();
  for (let s = 0; s < STEPS; s++) world.step(1 / 60);
  const ms = performance.now() - t0;
  const out = bodies.flatMap((b) => [b.position.x, b.position.y, b.position.z]);
  return { ms, h: hash(out) };
}
const r1 = await rapierRun(), r2 = await rapierRun();
const c1 = await cannonRun(), c2 = await cannonRun();
const size = (f) => (gzipSync(readFileSync(req.resolve(f))).length / 1024).toFixed(0) + " KB gz";
console.log(JSON.stringify({
  steps: STEPS, bodies: N,
  rapier: { ms: [r1.ms.toFixed(1), r2.ms.toFixed(1)], deterministic: r1.h === r2.h, hash: r1.h, size: size("@dimforge/rapier3d-compat") },
  cannon: { ms: [c1.ms.toFixed(1), c2.ms.toFixed(1)], deterministic: c1.h === c2.h, hash: c1.h, size: size("cannon-es") },
}, null, 1));

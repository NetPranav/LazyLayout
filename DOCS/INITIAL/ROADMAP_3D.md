# LazyLayout — 3D Engine Roadmap (Blender for the web builder)

**Version:** 3D-1.0 (2026-11-11) · **Owner:** Lane A (proposed; see §8) · **Status:** Planned. Takes priority over the main roadmap's remaining order, by the project owner's decision of 2026-11-11.
**Phases:** 190, numbered **3D-001 … 3D-190**. **24** of them are main-roadmap phases pulled in because the 3D work needs them. Each says where it came from (`Was: Main 173`), and the main roadmap's row points here.
**Relationship to ROADMAP.md:**
- This file replaces the main roadmap's Stage 6 (Phases 218–240) and takes over the 24 phases listed in §7.
- Everything else in ROADMAP.md is unchanged: its laws, Definition of Done and lane rules apply here too.
- A phase is ✅ only when its gate passes in CI (main roadmap, Law 16 and §4).

> **Why a separate roadmap.** A page builder that wants the best websites on the market needs real 3D: objects that turn, light that bounces, cloth that inflates, characters that look at the cursor. Blender shows how to make that powerful. This roadmap brings in Blender's ideas a website needs, makes them simple enough to use in 8 steps, and ships them to a fast exported site.

---

## 0. How to read this

- **Number = order.** Take the lowest phase that isn't ✅ and whose **Needs** are all ✅. Phases are grouped into **4 milestones** and **23 stages**.
- **Was:** where a pulled-in phase came from in ROADMAP.md (`Main 173`). It is not done twice: it is done here, and its row in ROADMAP.md says *Moved to ROADMAP_3D 3D-002*.
- **Lane:**
  - A by default.
  - **B** where the work is Lane B's in ROADMAP.md (property links, expressions, states and transitions). Lane B builds those, or agrees that Lane A does (COLLABORATION §2).
- **Each phase has:** what is built, **You'll see** (what a person notices), **Done when** (the test that proves it).
- **Milestones end in a gate** that a person checks side by side with a reference, plus CI.

| Milestone | Phases | At the gate, a person can… |
|---|---|---|
| **M1 · The foil button** | 3D-001 – 3D-062 | Turn any 2D shape into a real 3D object, give it a material, light it with a studio, inflate it like a foil balloon with a cloth simulation, press it and see it dent, and export it. Made in 7 steps, matched side by side with the reference video. |
| **M2 · Studio quality** | 3D-063 – 3D-116 | Model in edit mode, stack modifiers, build node materials, render with depth of field, bloom and grading, move cameras along paths, animate anything, use shape keys and drivers. Make a product hero that matches a reference render. |
| **M3 · Living components** | 3D-117 – 3D-157 | Rig characters with bones, weights, IK and Blender's constraints. Add rigid bodies, joints, soft bodies, particles, force fields and fracture. Make 3D components react to hover, press, drag, scroll and tilt. Ship a mascot that watches the cursor. |
| **M4 · Ship & simplicity** | 3D-158 – 3D-190 | Import models, put real page text in 3D, export small and fast to React Three Fiber, three.js or an embed, degrade by device, and make every recipe in 8 steps or fewer. |

---

## 1. The idea in one paragraph

Every 3D thing is a **scene layer** on the page. A scene holds **objects**:
- meshes, curves and text;
- lights and cameras;
- armatures (bones).

Objects use shared **data blocks** (meshes, materials, images, actions), as in Blender. A mesh is shaped by **primitives**, light **edit mode** and a non-destructive **modifier stack**. It is coloured by **PBR materials** and lit by **lights and a world**. It moves by **keyframes** on the same timeline as the 2D layers, by **simulation** (cloth, soft bodies, rigid bodies, particles) or by **rigs** (bones, IK, constraints, drivers). It reacts to the **page's inputs** (hover, press, drag, scroll, tilt). The editor draws it in real time. A path tracer draws the "Rendered" view and bakes posters. The export ships it with **baked** simulations and lighting, so a phone stays smooth.

## 2. What we take from Blender, and what we leave

| Blender | Here | Phases |
|---|---|---|
| 3D viewport, navigation, gizmos, G / R / S, snapping, pivots, orientations, 3D cursor | Same, on the canvas | 3D-014 – 3D-020 |
| Outliner, Properties editor (tabs) | Layers panel, the right panel's 3D side (tabs as sections, Simple / Pro) | 3D-021 – 3D-024 |
| Primitives, text, curves | Same | 3D-025, 3D-026, 3D-074 |
| Edit mode (extrude, inset, bevel, loop cut, knife, merge, bridge, spin) | A light version: the tools most used | 3D-063 – 3D-073 |
| Modifiers | Same idea; the 20 a website needs | 3D-030 – 3D-032, 3D-075 – 3D-082 |
| Shader nodes, Principled BSDF | PBR material + node editor (TSL) | 3D-033 – 3D-036, 3D-083 – 3D-089 |
| Lights, world, colour management | Same, plus one-click studio rigs | 3D-037 – 3D-041 |
| Eevee / Cycles | Real-time renderer / path-traced Rendered view and baking | 3D-042, 3D-043, 3D-056, 3D-057, 3D-090 – 3D-098 |
| Cameras, markers | Same | 3D-099 – 3D-103 |
| Dope sheet, graph editor, F-curve modifiers, NLA, shape keys, drivers | The existing timeline and graph editor, extended | 3D-104 – 3D-115 |
| Armatures, weight paint, IK, constraints, Rigify | Same, shared with 2D rigs | 3D-117 – 3D-134 |
| Physics (rigid, cloth, soft, particles, force fields, fracture) | Same, plus pointer forces and baking | 3D-048 – 3D-055, 3D-135 – 3D-145 |
| Bake | To keyframes, morph targets, vertex-animation textures, light maps | 3D-055, 3D-057, 3D-088, 3D-173 |

**Left out, on purpose:**
- sculpting;
- geometry nodes;
- hair grooming;
- the video sequence editor;
- grease pencil;
- render farms;
- large fluid simulations.

A website doesn't need them, and each is a project of its own. They can be reconsidered after 3D-190.

## 3. Laws for 3D (in addition to ROADMAP.md §3)

1. **One GPU, shared.** Only the compositor (3D-002) creates WebGL/WebGPU contexts. Every scene shares them (Law 13).
2. **Deterministic.** The same document, inputs and time give the same frame: fixed simulation steps, seeded randomness, scrubbable caches.
3. **Everything is a command.** Every 3D edit is a command with one undo step per gesture, so the agent can do it too (Law 20). Blender's "Adjust last operation" panel works on every command.
4. **Simple first.** Every properties section opens on **looks** (one-click presets sized to the object). Every library recipe is makeable in **8 steps or fewer** with the Simple face (3D-183).
5. **The live site gets baked results.** Path tracing, cloth and soft-body solving run in the editor. The export ships baked animation, simulation and light, plus a poster fallback.
6. **Licences first.** Every dependency is in `LICENSES.md` before use (Law 7). Allowed: MIT, Apache-2.0, BSD, ISC, zlib.
7. **Budgets per device tier.** Each feature declares its cost and its downgrade. CI fails a recipe that misses its tier's budget.
8. **Core stays pure.** Geometry, simulation, rigging and evaluation maths live in `src/core/3d/…` as pure, unit-tested code. GPU and DOM code live in the renderer and editor (COLLABORATION §10).

## 4. Technology

| Need | Choice | Licence | State |
|---|---|---|---|
| Renderer | three.js (WebGPU renderer with TSL, WebGL2 fallback) | MIT | installed (0.186.1) |
| React export | React Three Fiber, drei | MIT | installed (9.8.1, 10.7.8) |
| Raycasting, BVH | three-mesh-bvh | MIT | installed (0.8.3) |
| Path tracer (editor and baking only) | three-gpu-pathtracer | MIT | to add at 3D-056 |
| Rigid physics | Rapier (`@dimforge/rapier3d-compat`) | Apache-2.0 | to add at 3D-135, after a benchmark |
| Cloth, soft bodies, pressure | Our own XPBD solver (from `src/core/surface/cloth.ts`) on the GPU | ours | prototype exists |
| Mesh compression | meshoptimizer, Draco decoder | MIT, Apache-2.0 | to add at 3D-172 |
| Textures | KTX2 / Basis transcoder | Apache-2.0 | to add at 3D-159 |

## 5. Definition of Done for a 3D phase (adds to ROADMAP.md §4)

- [ ] Pure maths has unit tests (golden values). GPU output has golden images within the GPU tolerance (3D-004) in Chromium, Firefox and WebKit.
- [ ] Every edit is a command with one undo step. The agent can run it (MCP).
- [ ] Simple face (looks first) and Pro face. Labels in plain words, with the Blender term in the tooltip.
- [ ] Exported, with the export matching the editor within tolerance, or the phase says why it is editor-only.
- [ ] A tier budget declared and measured.
- [ ] On /design-system, if it adds UI. A changelog fragment.

## 6. Index

| # | Phase | Was | Needs | Lane | Status |
|---|---|---|---|---|---|
| **M1 · The foil button** |||||
| | **Stage 1 · GPU base** |||||
| 3D-001 | 3D stack decision & licences | Main 218 | — | A | 🚧 |
| 3D-002 | GPU surface strategy & compositor | Main 173 | 3D-001 | A | 🚧 |
| 3D-003 | Passes, render targets & GPU memory ledger | Main 174 | 3D-002 | A | 🚧 |
| 3D-004 | GPU & interactive verification harness | Main 137 | 3D-003 | A | 📋 |
| 3D-005 | 3D performance tiers & budgets | new | 3D-004 | A | 📋 |
| 3D-006 | Worker & WASM job system | new | 3D-001 | A | 📋 |
| | **Stage 2 · The 3D document** |||||
| 3D-007 | 3D data blocks & schema v7 | new | 3D-001 | A | 📋 |
| 3D-008 | Transforms & hierarchy | new | 3D-007 | A | 📋 |
| 3D-009 | Units, axes & conventions | new | 3D-008 | A | 📋 |
| 3D-010 | 3D in the evaluation kernel | new | 3D-009 | A | 📋 |
| 3D-011 | 3D commands, undo & "Adjust last operation" | new | 3D-010 | A | 📋 |
| 3D-012 | Scene layer on the canvas | Main 219 | 3D-003, 3D-011 | A | 📋 |
| 3D-013 | Mesh data structure & GPU upload | new | 3D-012 | A | 📋 |
| | **Stage 3 · Viewport core** |||||
| 3D-014 | Navigation & views | Main 220 | 3D-012 | A | 📋 |
| 3D-015 | Selection in 3D | new | 3D-014, 3D-013 | A | 📋 |
| 3D-016 | Gizmos and G / R / S | Main 220 | 3D-015 | A | 📋 |
| 3D-017 | Snapping, pivots & orientations | new | 3D-016 | A | 📋 |
| 3D-018 | Shading modes | new | 3D-014 | A | 📋 |
| 3D-019 | Overlays & the 3D cursor | new | 3D-016 | A | 📋 |
| 3D-020 | Keymaps: Blender and Beginner | new | 3D-019 | A | 📋 |
| | **Stage 4 · Outliner & properties** |||||
| 3D-021 | Outliner in the Layers panel | Main 221 | 3D-015 | A | 📋 |
| 3D-022 | Properties editor (the right panel's 3D side) | Main 221 | 3D-021 | A | 📋 |
| 3D-023 | Looks system | new | 3D-022 | A | 📋 |
| 3D-024 | Shared data blocks & copy attributes | new | 3D-022 | A | 📋 |
| | **Stage 5 · First shapes** |||||
| 3D-025 | Primitives with parameters & handles | Main 222 | 3D-016, 3D-022 | A | 📋 |
| 3D-026 | 3D text | Main 222 | 3D-025 | A | 📋 |
| 3D-027 | Path engine for extrusion | Main 103 (part) | 3D-025 | A | 📋 |
| 3D-028 | Layer textures, outlines & distance fields | Main 175 | 3D-003, 3D-027 | A | 📋 |
| 3D-029 | Make 3D from any 2D layer | Main 223 | 3D-028 | A | 📋 |
| 3D-030 | Modifier stack | new | 3D-025 | A | 📋 |
| 3D-031 | Subdivision surface & normals | new | 3D-030 | A | 📋 |
| 3D-032 | Solidify, displace & smooth | new | 3D-031 | A | 📋 |
| | **Stage 6 · Look** |||||
| 3D-033 | PBR material model | Main 225 | 3D-022 | A | 📋 |
| 3D-034 | Material looks v1 | new | 3D-033, 3D-023 | A | 📋 |
| 3D-035 | Textures & procedural textures | new | 3D-033 | A | 📋 |
| 3D-036 | Decals & labels on surfaces | new | 3D-035, 3D-028 | A | 📋 |
| 3D-037 | Lights | Main 226 | 3D-033 | A | 📋 |
| 3D-038 | Shadows | Main 226 | 3D-037 | A | 📋 |
| 3D-039 | World: HDRI & studio environments | Main 226 | 3D-037 | A | 📋 |
| 3D-040 | Light-rig looks | new | 3D-039, 3D-023 | A | 📋 |
| 3D-041 | Colour management | new | 3D-039 | A | 📋 |
| 3D-042 | Real-time renderer | new | 3D-041 | A | 📋 |
| 3D-043 | Ambient occlusion & screen-space reflections | new | 3D-042 | A | 📋 |
| | **Stage 7 · Input & simulation core** |||||
| 3D-044 | Input bus & coordinate spaces | Main 132 | 3D-012 | A | 📋 |
| 3D-045 | Signal catalogue | Main 133 | 3D-044 | A | 📋 |
| 3D-046 | Input tapes | Main 136 | 3D-045 | A | 📋 |
| 3D-047 | Operators & bindings runtime | Main 138 | 3D-046 | A | 📋 |
| 3D-048 | Stateful simulations & replay | Main 184 | 3D-006, 3D-046 | A | 📋 |
| 3D-049 | Simulation framework for 3D | new | 3D-048, 3D-013 | A | 📋 |
| 3D-050 | Cloth on the GPU (XPBD) | new (from S4b) | 3D-049 | A | 📋 |
| 3D-051 | Cloth pins, seams, sewing & pressure | new (from S4b) | 3D-050 | A | 📋 |
| 3D-052 | Cloth collisions | new | 3D-051 | A | 📋 |
| 3D-053 | Raycast pointer events on objects | Main 232 (part) | 3D-047, 3D-015 | A | 📋 |
| 3D-054 | Pointer forces | new (from S6) | 3D-053, 3D-051 | A | 📋 |
| 3D-055 | Bake simulations | new | 3D-054 | A | 📋 |
| | **Stage 8 · First ship** |||||
| 3D-056 | Rendered view: path tracer | new | 3D-042 | A | 📋 |
| 3D-057 | Bake lighting & posters | new | 3D-056 | A | 📋 |
| 3D-058 | Interactive export runtime | Main 197 | 3D-047 | A | 📋 |
| 3D-059 | 3D export v1 | Main 238 (part) | 3D-055, 3D-057, 3D-058 | A | 📋 |
| 3D-060 | Reference comparison harness for 3D | new (from S8) | 3D-046, 3D-004 | A | 📋 |
| 3D-061 | Reference images in 3D | new (from S1) | 3D-060 | A | 📋 |
| 3D-062 | **Gate M1: the foil button** | new | 3D-001 – 3D-061 | A | 📋 |
| **M2 · Studio quality** |||||
| | **Stage 9 · Edit mode** |||||
| 3D-063 | Edit mode & mesh selection | new | 3D-062 | A | 📋 |
| 3D-064 | Extrude, inset & bevel | new | 3D-063 | A | 📋 |
| 3D-065 | Loop cut, slide & knife | new | 3D-064 | A | 📋 |
| 3D-066 | Merge, dissolve, fill & bridge | new | 3D-065 | A | 📋 |
| 3D-067 | Spin, screw & symmetry | new | 3D-066 | A | 📋 |
| 3D-068 | Proportional editing | new | 3D-063 | A | 📋 |
| 3D-069 | Normals | new | 3D-066 | A | 📋 |
| 3D-070 | UV unwrapping | new | 3D-066 | A | 📋 |
| 3D-071 | UV editor | new | 3D-070 | A | 📋 |
| 3D-072 | Mesh booleans | new | 3D-066 | A | 📋 |
| 3D-073 | Cleanup & remesh | new | 3D-072 | A | 📋 |
| 3D-074 | Curves in 3D | new | 3D-027, 3D-063 | A | 📋 |
| | **Stage 10 · Modifier depth** |||||
| 3D-075 | Mirror & array | new | 3D-030 | A | 📋 |
| 3D-076 | Bevel modifier & weighted normals | new | 3D-075, 3D-069 | A | 📋 |
| 3D-077 | Lattice & mesh deform | new | 3D-075 | A | 📋 |
| 3D-078 | Curve & simple deform | new | 3D-077, 3D-074 | A | 📋 |
| 3D-079 | Boolean modifier | new | 3D-072 | A | 📋 |
| 3D-080 | Shrinkwrap, wave, cast & wireframe | new | 3D-078 | A | 📋 |
| 3D-081 | Weld, decimate, remesh & triangulate | new | 3D-073 | A | 📋 |
| 3D-082 | Geometry looks | new | 3D-081, 3D-023 | A | 📋 |
| | **Stage 11 · Material depth** |||||
| 3D-083 | Material node editor | Main 177, 231 | 3D-042 | A | 📋 |
| 3D-084 | Raw shaders (Pro) & shader safety | Main 178 | 3D-083 | A | 📋 |
| 3D-085 | Vertex colours & painting | new | 3D-083 | A | 📋 |
| 3D-086 | Texture painting | new | 3D-071, 3D-085 | A | 📋 |
| 3D-087 | Material slots per face | new | 3D-083 | A | 📋 |
| 3D-088 | Texture baking | new | 3D-071, 3D-087 | A | 📋 |
| 3D-089 | Material looks v2 | new | 3D-088 | A | 📋 |
| | **Stage 12 · Rendering depth** |||||
| 3D-090 | Depth of field | new | 3D-042 | A | 📋 |
| 3D-091 | Motion blur | new | 3D-090 | A | 📋 |
| 3D-092 | Bloom, lens & film | new | 3D-091 | A | 📋 |
| 3D-093 | Post-processing stack & tiers | Main 236 | 3D-092 | A | 📋 |
| 3D-094 | Colour grading | new | 3D-093 | A | 📋 |
| 3D-095 | Fog & volumetrics | new | 3D-093 | A | 📋 |
| 3D-096 | Render passes, layers & shadow catchers | new | 3D-093 | A | 📋 |
| 3D-097 | Render to image, sequence & video | new | 3D-096 | A | 📋 |
| 3D-098 | Toon & stylised shading | new | 3D-083 | A | 📋 |
| | **Stage 13 · Cameras** |||||
| 3D-099 | Cameras | Main 227 | 3D-062 | A | 📋 |
| 3D-100 | Camera markers & switching | new | 3D-099 | A | 📋 |
| 3D-101 | Camera paths & look-at | Main 227 | 3D-100, 3D-074 | A | 📋 |
| 3D-102 | Camera rigs | new | 3D-101 | A | 📋 |
| 3D-103 | Scroll- & cursor-driven cameras | Main 232 (part) | 3D-102, 3D-047 | A | 📋 |
| | **Stage 14 · Animation** |||||
| 3D-104 | 3D keyframes | Main 228 | 3D-062 | A | 📋 |
| 3D-105 | Animate any property | new | 3D-104 | A | 📋 |
| 3D-106 | Dope sheet & graph editor for 3D | new | 3D-105 | A | 📋 |
| 3D-107 | F-curve modifiers | new | 3D-106 | A | 📋 |
| 3D-108 | 3D motion paths & ghosts | Main 228 | 3D-104 | A | 📋 |
| 3D-109 | Follow path | new | 3D-108, 3D-074 | A | 📋 |
| 3D-110 | Animated GLTF playback | Main 229 | 3D-104 | A | 📋 |
| 3D-111 | Actions & strips | new | 3D-110 | A | 📋 |
| 3D-112 | Shape keys | new | 3D-111 | A | 📋 |
| 3D-113 | Property links & pick-whip | Main 76 | 3D-105 | B | 📋 |
| 3D-114 | Expressions | Main 77 | 3D-113 | B | 📋 |
| 3D-115 | Animation looks | new | 3D-112, 3D-023 | A | 📋 |
| 3D-116 | **Gate M2: the studio product hero** | new | 3D-063 – 3D-115 | A | 📋 |
| **M3 · Living components** |||||
| | **Stage 15 · The rig model (shared by 2D and 3D)** |||||
| 3D-117 | Rig model: bones & skins | Main 203 | 3D-116 | A | 📋 |
| 3D-118 | Bone tool & posing | Main 204 | 3D-117 | A | 📋 |
| 3D-119 | Bones on the timeline | Main 205 | 3D-118 | A | 📋 |
| 3D-120 | Mesh deformation & weights | Main 206 | 3D-119 | A | 📋 |
| 3D-121 | Inverse kinematics | Main 207 | 3D-120 | A | 📋 |
| 3D-122 | Constraints & secondary motion | Main 208 | 3D-121 | A | 📋 |
| | **Stage 16 · 3D rigging** |||||
| 3D-123 | Armatures in 3D | new | 3D-122 | A | 📋 |
| 3D-124 | Bind with automatic weights | new | 3D-123 | A | 📋 |
| 3D-125 | Vertex groups & weight painting | new | 3D-124 | A | 📋 |
| 3D-126 | Pose mode & pose library | new | 3D-125 | A | 📋 |
| 3D-127 | 3D IK | Main 230 | 3D-126 | A | 📋 |
| 3D-128 | Blender's constraints | Main 230 | 3D-127 | A | 📋 |
| 3D-129 | Rig controls & custom properties | new | 3D-128, 3D-113 | A | 📋 |
| 3D-130 | Auto-rig | new | 3D-129 | A | 📋 |
| 3D-131 | Retargeting | new | 3D-130, 3D-110 | A | 📋 |
| 3D-132 | Faces: shape-key rigs, blinks & lip sync | Main 213 (3D) | 3D-131, 3D-112 | A | 📋 |
| 3D-133 | Secondary motion: spring bones & jiggle | new | 3D-128 | A | 📋 |
| 3D-134 | Procedural locomotion | new | 3D-133 | A | 📋 |
| | **Stage 17 · Physics depth** |||||
| 3D-135 | Rigid bodies & colliders | Main 235 | 3D-116, 3D-049 | A | 📋 |
| 3D-136 | Joints, ropes & chains | new | 3D-135 | A | 📋 |
| 3D-137 | Contact events | new | 3D-136 | A | 📋 |
| 3D-138 | Soft bodies & jelly | new | 3D-052 | A | 📋 |
| 3D-139 | Cloth depth | new | 3D-138 | A | 📋 |
| 3D-140 | Particles | Main 183 (3D) | 3D-049 | A | 📋 |
| 3D-141 | Force fields | new | 3D-140 | A | 📋 |
| 3D-142 | Fracture | new | 3D-137 | A | 📋 |
| 3D-143 | Metaballs & liquid blobs | new | 3D-141 | A | 📋 |
| 3D-144 | Grab & throw in Preview | new | 3D-137, 3D-054 | A | 📋 |
| 3D-145 | Physics looks | new | 3D-144, 3D-023 | A | 📋 |
| | **Stage 18 · Interaction** |||||
| 3D-146 | Targets, blending & cycles | Main 139 | 3D-047 | A | 📋 |
| 3D-147 | States & transitions | Main 78, 79 | 3D-146 | B | 📋 |
| 3D-148 | State machines | Main 151 | 3D-147 | A | 📋 |
| 3D-149 | 3D states | new | 3D-148, 3D-053 | A | 📋 |
| 3D-150 | Cursor reactions | Main 232 | 3D-149 | A | 📋 |
| 3D-151 | Viewer interactions: spin, inspect, zoom | new | 3D-150 | A | 📋 |
| 3D-152 | Scroll-driven 3D scenes | new | 3D-103, 3D-151 | A | 📋 |
| 3D-153 | Tilt & touch gestures | new | 3D-152 | A | 📋 |
| 3D-154 | Interactive 3D components | new | 3D-153 | A | 📋 |
| 3D-155 | Accessibility for 3D | new | 3D-154 | A | 📋 |
| 3D-156 | Interaction looks | new | 3D-155, 3D-023 | A | 📋 |
| 3D-157 | **Gate M3: living components** | new | 3D-117 – 3D-156 | A | 📋 |
| **M4 · Ship & simplicity** |||||
| | **Stage 19 · Assets & import** |||||
| 3D-158 | GLTF / GLB import pipeline | Main 224 | 3D-157 | A | 📋 |
| 3D-159 | Texture & HDRI pipeline | new | 3D-158 | A | 📋 |
| 3D-160 | 3D asset browser | new | 3D-159 | A | 📋 |
| 3D-161 | Import from Blender, Spline & others | new | 3D-158 | A | 📋 |
| 3D-162 | Logos & 2D sets to 3D in bulk | new | 3D-029, 3D-160 | A | 📋 |
| 3D-163 | Sharing materials, looks & rigs | new | 3D-160 | A | 📋 |
| | **Stage 20 · On the page** |||||
| 3D-164 | Responsive scenes | new | 3D-157 | A | 📋 |
| 3D-165 | Page layers inside 3D scenes | Main 233 | 3D-164 | A | 📋 |
| 3D-166 | 3D layers with 2D effects | new | 3D-165 | A | 📋 |
| 3D-167 | 2.5D surfaces as the fast path | new (S1–S9) | 3D-166 | A | 📋 |
| 3D-168 | One timeline for 2D and 3D | new | 3D-166 | A | 📋 |
| 3D-169 | Posters, SEO & no-WebGL fallbacks | new | 3D-168 | A | 📋 |
| 3D-170 | Instancing, LOD & 3D cloners | Main 234 | 3D-168 | A | 📋 |
| | **Stage 21 · Export & performance** |||||
| 3D-171 | 3D export v2: components, three.js, embed | Main 238 | 3D-170 | A | 📋 |
| 3D-172 | Geometry & texture compression | new | 3D-171 | A | 📋 |
| 3D-173 | Baked motion in the export | new | 3D-172 | A | 📋 |
| 3D-174 | Bundles, lazy loading & size budgets | new | 3D-173 | A | 📋 |
| 3D-175 | Device tiers & automatic downgrade | new | 3D-174 | A | 📋 |
| 3D-176 | 3D memory discipline | Main 237 | 3D-175 | A | 📋 |
| 3D-177 | Performance budgets in CI | new | 3D-176 | A | 📋 |
| 3D-178 | Editor–export parity | new | 3D-177 | A | 📋 |
| 3D-179 | Export runtime for states, bindings & physics | new | 3D-178 | A | 📋 |
| 3D-180 | Offline posters & social images | new | 3D-178 | A | 📋 |
| | **Stage 22 · Simplicity** |||||
| 3D-181 | "Make 3D" wizards | new | 3D-180 | A | 📋 |
| 3D-182 | Looks everywhere: audit | new | 3D-181 | A | 📋 |
| 3D-183 | The 8-step rule, tested | new | 3D-182 | A | 📋 |
| 3D-184 | Recipe library | Main 239 | 3D-183 | A | 📋 |
| 3D-185 | Help inside: plain words and Blender terms | new | 3D-184 | A | 📋 |
| 3D-186 | AI assist for 3D | new (after Main 241) | 3D-185 | A | 📋 |
| | **Stage 23 · Gates** |||||
| 3D-187 | Gate M4a: phones | new | 3D-186 | A | 📋 |
| 3D-188 | Gate M4b: accessibility & fallbacks | new | 3D-187 | A | 📋 |
| 3D-189 | Gate M4c: the 3D journey | Main 240 | 3D-188 | A | 📋 |
| 3D-190 | Close-out: docs, audit, licences & hand-back | new | 3D-189 | A | 📋 |

---
## 7. Phases pulled in from ROADMAP.md

These 24 main-roadmap phases are done **here**, in this order, because the 3D work needs them first. Each keeps its main-roadmap scope and adds the 3D parts. In ROADMAP.md each row becomes *Moved to ROADMAP_3D*.

| Main | Title | Here | Why 3D needs it |
|---|---|---|---|
| 218 | 3D stack decision & licences | 3D-001 | The choices everything rests on |
| 173 | GPU surface strategy & compositor | 3D-002 | One GPU context for every scene (Law 13) |
| 174 | Passes, render targets & memory ledger | 3D-003 | Render passes, baking, memory |
| 137 | GPU & interactive verification harness | 3D-004 | Golden images with a GPU tolerance |
| 219 | Scene layer | 3D-012 | The 3D layer on the page |
| 220 | 3D viewport editing | 3D-014, 3D-016 | Navigation and gizmos |
| 221 | Scene hierarchy & 3D inspector | 3D-021, 3D-022 | Outliner and properties |
| 222 | Primitives & 3D text | 3D-025, 3D-026 | First shapes |
| 103 (part) | Path engine: flatten, offset, booleans | 3D-027 | Extruding and inflating 2D shapes |
| 175 | Layer textures, outlines & distance fields | 3D-028 | Inflate from a shape; text and images as textures |
| 223 | Inflate & extrude any vector into 3D | 3D-029 | 2D to 3D |
| 225, 226 | Materials; lights, shadows & environments | 3D-033, 3D-037 – 3D-039 | The look |
| 132, 133, 136, 138 | Input bus, signals, tapes, bindings | 3D-044 – 3D-047 | Pointer, scroll and replay for interaction and tests |
| 184 | Stateful simulations & replay | 3D-048 | Scrubbable, deterministic simulation |
| 197 | Interactive export runtime | 3D-058 | Interaction on the exported site |
| 177, 231, 178 | Shader graph, 3D node materials, raw shaders | 3D-083, 3D-084 | Material nodes |
| 236 | Post-processing | 3D-093 | Bloom, DOF, grading |
| 227, 228, 229 | Cameras, 3D keyframes, GLTF playback | 3D-099, 3D-101, 3D-104, 3D-108, 3D-110 | Animation |
| 76, 77 | Property links, expressions (**Lane B**) | 3D-113, 3D-114 | Drivers |
| 203 – 208 | Rig model, bones, bones on the timeline, weights, IK, constraints | 3D-117 – 3D-122 | One rig model for 2D and 3D |
| 230 | 3D skeletons & IK | 3D-127, 3D-128 | 3D rigs |
| 235 | 3D physics | 3D-135 | Rigid bodies |
| 183 (3D part) | Particles & force fields | 3D-140, 3D-141 | 3D particles |
| 139, 151 | Targets & blending, state machines | 3D-146, 3D-148 | Reactive components |
| 78, 79 | States, transitions (**Lane B**) | 3D-147 | Hover and press states |
| 213 (3D part) | Faces | 3D-132 | Blinks and lip sync |
| 232, 233, 234, 237, 238, 239, 240, 224 | Reactions, page layers, instancing, memory, export, library, gate, GLTF | 3D-053, 3D-150, 3D-165, 3D-170, 3D-176, 3D-171, 3D-184, 3D-189, 3D-158 | The rest of Stage 6 |

The 2D parts of 132–208 that 3D doesn't use (keyboard signals, 2D physics, 2D rig tools) stay in ROADMAP.md, in their order.

## 8. Decisions needed before 3D-001

1. **Lane:** Lane A takes this roadmap. Lane B builds 3D-113, 3D-114 and 3D-147 (its own phases 76, 77, 78, 79), or agrees that Lane A does.
2. **Priority:** this roadmap goes before ROADMAP.md's Stages 3–6 (project owner, 2026-11-11). Stage 1's open items and the merge of #86 come first.
3. **Schema v7** for the 3D data blocks: claim it in `DOCS/TEAM/CLAIMS.md` (v6 is Lane B's).
4. **Decision records:**
   - 0013 (3D stack), already planned at Main 218.
   - 0019 (3D document model).
   - 0020 (simulation and baking).
   - 0021 (path tracer in the editor only).
5. **The Surfaces track (S1–S9):** kept as the 2.5D fast path, with no new features (3D-167). Decision 0018's private GL context moves into the compositor at 3D-002.

---

# M1 · THE FOIL BUTTON (3D-001 – 3D-062)

> At the gate: a frame becomes a real 3D foil balloon with its label printed on it, lit by a studio, inflated by a cloth simulation, dented by a press, exported, made in 7 steps, and matched side by side with the reference video.

## Stage 1 · GPU base

### Phase 3D-001 · 3D stack decision & licences
**Needs:** — · **Was:** Main 218 · **Lane:** A · **Status:** 🚧
- [ ] Decision record 0013 (3D stack):
  - three.js through the compositor, with WebGPU and TSL first and WebGL2 as the fallback.
  - R3F and drei for the React export.
  - three-mesh-bvh for raycasts.
  - three-gpu-pathtracer for the Rendered view and baking (editor only).
  - Rapier chosen by a benchmark against one other permissively licensed engine (100 bodies, determinism, WASM size).
  - Our own XPBD solver for cloth, soft bodies and pressure.
  - The fallback if any licence changed.
- [ ] Every dependency in `LICENSES.md` before use (Law 7). A size budget per dependency in the exported bundle.

**You'll see:** nothing yet; the choices are written down.
**Done when:** the record is reviewed, the benchmark is archived, and every dependency is in `LICENSES.md`.
**Evidence (2026-11-11):** decision `decisions/0013-3d-stack.md` (stack, budgets, fallbacks); licences read from the installed packages and the registry, recorded in `LICENSES.md`; physics benchmark archived (`scripts/benchmarks/physics-3d.mjs`: Rapier 0.1–0.2 ms a step for 100 bodies, deterministic, 749 KB gz; cannon-es 0.8–1 ms, 74 KB gz). Stays 🚧 until the record is reviewed.

### Phase 3D-002 · GPU surface strategy & compositor
**Needs:** 3D-001 · **Was:** Main 173 · **Lane:** A · **Status:** 🚧
- [ ] Decision record 0011 (GPU surfaces): per-surface canvases within a budget, a shared backdrop canvas, or one hidden context drawing into 2D, chosen per surface role. WebGL2 baseline, WebGPU opt-in.
- [ ] The compositor service:
  - it owns every context;
  - surfaces register with it and get a draw slot;
  - context loss is recovered;
  - an off-screen surface sleeps and shows its last frame.
- [ ] Decision 0018's private context (the 2.5D surfaces) moves into it.

**You'll see:** many 3D layers on a page without the browser's "too many WebGL contexts" warning.
**Done when:** a 20-surface page never exceeds the budget in 3 browsers; a forced context loss recovers within 1 s.
**Evidence (2026-11-11):** decision `decisions/0011-gpu-surfaces.md` from a measurement of three strategies (`scripts/benchmarks/gpu-surfaces.ts`, real GPU and SwiftShader); `src/core/gpu/compositor.ts` (shared surface context, scene contexts within a budget, sleep with a poster, loss recovery); the 2.5D surfaces draw through it (comparison score unchanged, 0.6065); `tests/e2e/gpu-compositor.spec.ts` (budget, sleep and wake, loss within 1 s) passes in Chromium.

### Phase 3D-003 · Passes, render targets & GPU memory ledger
**Needs:** 3D-002 · **Was:** Main 174 · **Lane:** A · **Status:** 🚧
- [ ] Pass stacks (render, feedback ping-pong, post), float targets after a capability check.
- [ ] A memory ledger: every texture, target, buffer and program counted, by owner, and freed when unused.

**You'll see:** a debug view of what the GPU holds, by layer.
**Done when:** mounting and unmounting 50 scenes returns the ledger to zero; float targets fall back cleanly where unsupported.
**Evidence (2026-11-11):** `src/core/gpu/ledger.ts` (pure bookkeeping: owner, kind, bytes, release by handle or owner) and `passes.ts` (render targets, ping-pong, pass stacks, float targets after a capability check with RGBA8 fallback); the 2.5D surfaces track every texture; `ledger.test.ts` (7 unit tests) and the browser test (50 surfaces mount and unmount twice, ledger back to the shared baseline); a ledger view on `/editor/gpu-lab`.

### Phase 3D-004 · GPU & interactive verification harness
**Needs:** 3D-003 · **Was:** Main 137 · **Lane:** A · **Status:** 📋
- [ ] Headless Chromium with a software WebGL2 / WebGPU rasteriser on every pull request, and a nightly real-GPU job.
- [ ] Frame capture at exact times (deterministic scheduler).
- [ ] Perceptual metrics with a documented tolerance: SSIM, plus a FLIP-style metric.
- [ ] Golden images with a review flow: approve a changed golden in the PR.

**You'll see:** each 3D pull request has picture checks, with the difference shown when one fails.
**Done when:** a deliberate one-pixel shift passes, a wrong colour fails, and the same scene gives the same image twice in a row.

### Phase 3D-005 · 3D performance tiers & budgets
**Needs:** 3D-004 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Device tiers (low, mid, high), each with budgets:
  - frame time;
  - GPU memory;
  - draw calls;
  - triangles;
  - texture memory;
  - simulation time.
- [ ] Each feature declares its cost and its downgrade order (for example: shadows → soft shadows off → AO off → resolution scale).
- [ ] A budget overlay in the editor.

**You'll see:** a small meter that says whether the scene fits phones, mid laptops and high-end machines.
**Done when:** the reference scenes report their cost per tier, and a scene over budget names the feature to drop.

### Phase 3D-006 · Worker & WASM job system
**Needs:** 3D-001 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] A pool of workers for geometry, simulation and baking:
  - jobs carry typed arrays (transferred, not copied);
  - jobs can be cancelled and given priorities;
  - results are cached by key.
- [ ] Progress shown on the layer ("Simulating… 40%").
- [ ] The cloth job from `src/core/surface/cloth.worker.ts` moves onto it.

**You'll see:** heavy work never freezes the editor; a progress ring on the object while it computes.
**Done when:** a 5-second job leaves the main thread under 4 ms per frame; cancelling stops it within one step.

## Stage 2 · The 3D document

### Phase 3D-007 · 3D data blocks & schema v7
**Needs:** 3D-001 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Decision record 0019 (3D document model).
- [ ] Data blocks shared by id, as in Blender:
  - **Scene**: objects, world, active camera, settings.
  - **Object**: type, transform, parent, data, modifiers, constraints, material slots, physics, visibility.
  - **Mesh**: vertices, faces, attributes, UVs, shape keys, vertex groups.
  - **Curve**, **Text**.
  - **Material**.
  - **Light**.
  - **Camera**.
  - **Armature**.
  - **Action**.
  - **Image**: from the asset store.
  - **World**.
- [ ] The rule for users: "one material on many objects", "make single user".
- [ ] Schema v7 claimed in CLAIMS.md, with a migration (additive) and validation.
- [ ] Large geometry stored as binary in the asset store, not inline JSON.

**You'll see:** nothing yet; 3D saves and reloads.
**Done when:** a document with every data-block kind round-trips exactly; the migration test passes; a 1-million-vertex mesh saves in under 1 s.

### Phase 3D-008 · Transforms & hierarchy
**Needs:** 3D-007 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Location, rotation and scale:
  - rotation stored as a quaternion and shown as Euler (mode XYZ … ZYX);
  - a parent inverse matrix, as in Blender, so parenting keeps the world position;
  - delta transforms.
- [ ] Apply transforms. Set the origin to geometry, cursor or centre of mass.

**You'll see:** parent a cube to a sphere; it stays where it was and follows from then on.
**Done when:** golden tests for world matrices through 4-level hierarchies; parenting and unparenting keep world transforms within 1e-6.

### Phase 3D-009 · Units, axes & conventions
**Needs:** 3D-008 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Y-up, right-handed (glTF), with the Blender Z-up shown as an option in the viewport.
- [ ] Metres in the document; a scale that maps 1 px on the page to a length in the scene, so a 2D frame turned 3D keeps its size on screen.
- [ ] Angles in degrees in the UI and radians in the document.

**You'll see:** a 454 px frame turned 3D is 454 px on screen at the default camera.
**Done when:** glTF import and export keep axes and units (round-trip test); 2D-to-3D keeps size within 0.5 px.

### Phase 3D-010 · 3D in the evaluation kernel
**Needs:** 3D-009 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] `evaluate()` gives every 3D property at any time, the same way it does for 2D:
  - transforms;
  - material, light and camera values;
  - modifier parameters;
  - shape-key weights;
  - bone poses (later).
- [ ] The renderer only applies what the kernel evaluated, so scrubbing and playing agree.

**You'll see:** scrubbing a 3D animation is exact.
**Done when:** 3D tracks match `evaluate()` at 5 times; the parity monitor covers 3D.

### Phase 3D-011 · 3D commands, undo & "Adjust last operation"
**Needs:** 3D-010 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Every 3D edit is a typed command (Law 20) with one undo step per gesture.
- [ ] The "Adjust last operation" panel, as in Blender: after "Add cylinder", change its vertex count; after "Extrude", change its depth. It re-runs the command with new arguments as the same undo step.
- [ ] The MCP agent can call every 3D command.

**You'll see:** add a cylinder, then set its sides to 64 in the small panel that appears.
**Done when:** 30 commands round-trip through undo / redo exactly; the agent builds a scene through MCP.

### Phase 3D-012 · Scene layer on the canvas
**Needs:** 3D-003, 3D-011 · **Was:** Main 219 · **Lane:** A · **Status:** 📋
- [ ] A `scene3d` layer, lazily loaded, drawn through the compositor:
  - its box is part of the page's layout;
  - off screen it shows a poster;
  - it recovers from context loss.
- [ ] Double-click enters the scene (3D editing). Escape leaves it.

**You'll see:** Insert > 3D scene; a cube on a grid inside a box on the page.
**Done when:** a scene renders in 3 browsers, recovers from a forced context loss, and costs nothing while off screen.

### Phase 3D-013 · Mesh data structure & GPU upload
**Needs:** 3D-012 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] An editable mesh with vertices, edges, faces (n-gons), loops and attributes, after Blender's BMesh.
- [ ] Triangulation for drawing; incremental GPU upload (only what changed).
- [ ] Pure, in `src/core/3d/mesh/`.

**You'll see:** nothing new; edits stay fast on big meshes.
**Done when:** topology invariants hold under 10,000 random edits (property test); editing one vertex of a 200,000-face mesh uploads in under 2 ms.

## Stage 3 · Viewport core

### Phase 3D-014 · Navigation & views
**Needs:** 3D-012 · **Was:** Main 220 · **Lane:** A · **Status:** 📋
- [ ] Orbit, pan, dolly (mouse, trackpad and touch) and fly mode.
- [ ] Views: front, back, left, right, top, bottom (numpad and a view cube). Perspective / orthographic toggle.
- [ ] Frame selected, frame all. The camera view.

**You'll see:** spin round a model with the mouse; press 1, 3, 7 for front, side and top.
**Done when:** a 15-step navigation tape lands on exact view matrices.

### Phase 3D-015 · Selection in 3D
**Needs:** 3D-014, 3D-013 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Click selection by raycast (three-mesh-bvh), with an active object and Shift to add. Box and lasso selection; select linked, select similar.
- [ ] Selection outline drawn in the selection colour.

**You'll see:** click an object to select it; drag a box round several.
**Done when:** picking is exact on 30 test views; 100,000-face picking takes under 1 ms.

### Phase 3D-016 · Gizmos and G / R / S
**Needs:** 3D-015 · **Was:** Main 220 · **Lane:** A · **Status:** 📋
- [ ] Move, rotate and scale gizmos, and the keys G, R, S with axis locks (X, Y, Z, Shift for planes) and typed values ("G X 2 Enter").
- [ ] One undo step per gesture. Right-click or Escape cancels.

**You'll see:** press G, X, type 2, Enter; the object moves 2 along X.
**Done when:** a 15-step gizmo journey gives exact transforms and one undo step per gesture.

### Phase 3D-017 · Snapping, pivots & orientations
**Needs:** 3D-016 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Snapping: increment, grid, vertex, edge, face (project onto a surface, align rotation to its normal).
- [ ] Pivot points: median, individual origins, 3D cursor, active.
- [ ] Transform orientations: global, local, normal, view, cursor.

**You'll see:** drop a cup onto a table and it sits on the surface, upright.
**Done when:** golden tests for every snap target and pivot on 20 cases.

### Phase 3D-018 · Shading modes
**Needs:** 3D-014 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Wireframe, Solid (with studio lighting and cavity), Material preview (an HDRI), Rendered (the real renderer; the path tracer from 3D-056).
- [ ] X-ray toggle.

**You'll see:** the four shading buttons at the top right of the viewport.
**Done when:** each mode renders its golden image in 3 browsers.

### Phase 3D-019 · Overlays & the 3D cursor
**Needs:** 3D-016 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Grid, axes, origins, face orientation, normals, wireframe on shaded, statistics (vertices, faces, objects, memory).
- [ ] The 3D cursor: Shift+right-click places it; new objects appear at it.

**You'll see:** an overlays menu like Blender's; a red-white ring where new things appear.
**Done when:** each overlay has a golden image; the cursor snaps to surfaces.

### Phase 3D-020 · Keymaps: Blender and Beginner
**Needs:** 3D-019 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] **Blender** keymap (G, R, S, Tab, numpad, Shift+A add menu, X delete, H hide), and a **Beginner** keymap (the editor's own keys, with toolbar buttons for everything).
- [ ] Chosen in settings. Shown in View > Show keystrokes.

**You'll see:** Blender users feel at home; beginners never need a key.
**Done when:** no two 3D commands share a key in the same context (the conflict test); each keymap passes a scripted journey.

## Stage 4 · Outliner & properties

### Phase 3D-021 · Outliner in the Layers panel
**Needs:** 3D-015 · **Was:** Main 221 · **Lane:** A · **Status:** 📋
- [ ] Inside a scene, the Layers panel shows the scene tree:
  - collections, objects, their data, materials and modifiers;
  - visibility, selectability and render toggles.
- [ ] Drag to reparent (keeps the world transform).

**You'll see:** the scene's objects in the Layers panel, with eye, arrow and camera toggles.
**Done when:** reparenting in the tree keeps world transforms (golden tests); the tree mirrors the document both ways.

### Phase 3D-022 · Properties editor (the right panel's 3D side)
**Needs:** 3D-021 · **Was:** Main 221 · **Lane:** A · **Status:** 📋
- [ ] The right panel's **2D | 3D** switch (from S9) becomes Blender's Properties editor for the selection.
- [ ] Its tabs are sections: **Object, Modifiers, Physics, Material, Object data** (Mesh, Light, Camera, Armature), **Constraints, World, Render**.
- [ ] **Simple** face: looks and 4–6 plain controls per section. **Pro** face: every field.
- [ ] The 2.5D "Surface" sections become the Simple face of Physics and Material for a 2D layer.

**You'll see:** select a light and the right panel shows its power, colour and size; select a cube and it shows its transform, modifiers and material.
**Done when:** every data-block field is reachable in the Pro face; the Simple face passes the plain-word label check.

### Phase 3D-023 · Looks system
**Needs:** 3D-022 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] A look is data: a named set of property values, sized by rules to the object (depth from its smallest side, light power from scene size).
- [ ] Looks for every section: material, light rig, physics, modifier, animation, interaction.
- [ ] A thumbnail rendered offline. User looks saved from any object ("Save as look").

**You'll see:** each section opens on a strip of thumbnails; one click applies.
**Done when:** a look applied to objects of 5 sizes gives a similar picture on each (perceptual test); saving and re-applying a look round-trips.

### Phase 3D-024 · Shared data blocks & copy attributes
**Needs:** 3D-022 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] A material, mesh or action used by several objects shows its user count; "Make single user" splits it.
- [ ] Copy and paste attributes (material, modifiers, transforms) from one object to others.

**You'll see:** change one shared material and every object with it changes.
**Done when:** user counts are exact under 200 random operations; undo restores sharing.

## Stage 5 · First shapes

### Phase 3D-025 · Primitives with parameters & handles
**Needs:** 3D-016, 3D-022 · **Was:** Main 222 · **Lane:** A · **Status:** 📋
- [ ] Cube, cylinder, cone, UV sphere, ico sphere, torus, plane, circle, capsule, rounded box. Each has its parameters (sides, rings, radius, depth, bevel) editable after adding (3D-011) and with handles on the object.
- [ ] Shift+A add menu (Blender keymap) and an Add button.

**You'll see:** add a cylinder, drag its handle to make it taller, set 64 sides.
**Done when:** each primitive's vertex positions match golden values; each renders the same within tolerance in 3 browsers.

### Phase 3D-026 · 3D text
**Needs:** 3D-025 · **Was:** Main 222 · **Lane:** A · **Status:** 📋
- [ ] Text objects in the project's fonts:
  - extrude depth, bevel depth and resolution;
  - alignment, spacing.
- [ ] Editable in place. Converts to a mesh.

**You'll see:** type "SALE", give it depth and a rounded bevel.
**Done when:** glyph outlines match the font within 0.1 px; meshes are watertight for 10 fonts.

### Phase 3D-027 · Path engine for extrusion
**Needs:** 3D-025 · **Was:** Main 103 (part) · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 103, the parts 3D needs:
  - flatten curves to a tolerance;
  - offset (round, mitre, bevel joins);
  - booleans of 2D paths;
  - holes (even-odd and non-zero).
- [ ] The rest of 103 (live boolean groups in 2D) stays in ROADMAP.md.

**You'll see:** nothing on its own; it shapes 3D-029.
**Done when:** golden areas for booleans and offsets on 20 shapes (the 103 tests that apply).

### Phase 3D-028 · Layer textures, outlines & distance fields
**Needs:** 3D-003, 3D-027 · **Was:** Main 175 · **Lane:** A · **Status:** 📋
- [ ] Any layer or group becomes:
  - a live GPU texture (for labels and decals);
  - an outline path (for extrusion);
  - a signed distance field (for inflation and rounded bevels).
- [ ] All three update when the layer changes and count in the memory ledger.

**You'll see:** a debug view of any layer as a texture, an outline or a distance field.
**Done when:** distance-field error < 0.5 px on 10 shapes; textures update within one frame of an edit; the ledger returns to 0 after unmount.

### Phase 3D-029 · Make 3D from any 2D layer
**Needs:** 3D-028 · **Was:** Main 223 · **Lane:** A · **Status:** 📋
- [ ] Right-click > Make 3D:
  - **Extrude** (depth, bevel profile);
  - **Inflate** (pressure from the distance field, as a pillow);
  - **Lathe** (round an axis);
  - **Plane** (a flat card).
- [ ] It stays linked to the 2D source: editing the 2D shape updates the 3D. The 2D layer's fill becomes the material's colour and its text becomes a decal (3D-036).

**You'll see:** a rounded rectangle becomes a puffy 3D button, still editable as a rectangle.
**Done when:** meshes are watertight for 10 reference shapes; an edit to the 2D source updates the mesh in < 100 ms.

### Phase 3D-030 · Modifier stack
**Needs:** 3D-025 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] A non-destructive, ordered stack per object, evaluated in the kernel:
  - each modifier has viewport and render toggles;
  - its parameters can be keyframed and driven;
  - Apply bakes it into the mesh.
- [ ] Evaluated in a worker for heavy stacks; cached by input.

**You'll see:** a Modifiers section with add, reorder (drag), hide and apply.
**Done when:** stacks of 5 modifiers evaluate to golden meshes; reordering changes the result as specified; apply equals the evaluated result.

### Phase 3D-031 · Subdivision surface & normals
**Needs:** 3D-030 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Catmull-Clark subdivision (levels for viewport and render, crease weights).
- [ ] Shade smooth or flat, auto smooth by angle.

**You'll see:** a cube becomes a smooth rounded shape; creased edges stay sharp.
**Done when:** subdivision matches reference meshes (OpenSubdiv-style rules) on 5 cages; normals match golden values.

### Phase 3D-032 · Solidify, displace & smooth
**Needs:** 3D-031 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] **Solidify:** thickness for thin surfaces such as a cloth sheet or a foil skin.
- [ ] **Displace:** by a texture or seeded noise, along normals.
- [ ] **Smooth** and **Laplacian smooth**.

**You'll see:** a plane becomes a thick, bumpy slab.
**Done when:** golden meshes for each modifier; displace is identical for the same seed.

## Stage 6 · Look

### Phase 3D-033 · PBR material model
**Needs:** 3D-022 · **Was:** Main 225 · **Lane:** A · **Status:** 📋
- [ ] A Principled-style material, mapped to the renderer's physical material:
  - base colour, metallic, roughness, normal;
  - emission;
  - transmission and thickness, IOR;
  - clearcoat, sheen;
  - **thin film** (iridescence, for foil and soap);
  - anisotropy, alpha.

**You'll see:** a Material section with plain names ("Shine", "Metal", "See-through") and the Blender names in tooltips.
**Done when:** 12 reference spheres match reference renders within tolerance.

### Phase 3D-034 · Material looks v1
**Needs:** 3D-033, 3D-023 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Looks:
  - **black foil / mylar** (metal, low roughness, thin film, crinkle normal);
  - chrome, gold;
  - glass, frosted glass;
  - clay, rubber, satin;
  - glossy plastic, matte plastic;
  - car paint.
- [ ] Each a thumbnail; colour editable after.

**You'll see:** one click turns an object into foil, glass or clay.
**Done when:** each look matches its reference image within tolerance under the default studio.

### Phase 3D-035 · Textures & procedural textures
**Needs:** 3D-033 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Image textures from the asset store on any map (colour, roughness, normal, height).
- [ ] Procedural textures: noise, Voronoi, gradient, wave, checker, brick.
- [ ] Mapping: UV, generated, object; scale, rotation, offset.

**You'll see:** a wood image on a table top; noise to rough up a metal.
**Done when:** procedural textures are identical for the same seed and match golden images.

### Phase 3D-036 · Decals & labels on surfaces
**Needs:** 3D-035, 3D-028 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] A 2D layer, text or image projected onto a mesh as a decal:
  - it follows the surface, bends with deformation and simulation, and takes the material's light;
  - the text stays real, accessible text in the page (hidden from sight, in the accessibility tree once).
- [ ] This is how the balloon's "Get Started" sits on the foil and warps when pressed.

**You'll see:** the button's label printed on the 3D foil, bending into a dent.
**Done when:** the decal stays within 0.5 px of its projection on a deforming surface; the label is in the accessibility tree exactly once.

### Phase 3D-037 · Lights
**Needs:** 3D-033 · **Was:** Main 226 · **Lane:** A · **Status:** 📋
- [ ] Point, sun, spot (cone, blend) and area (rectangle, disk) lights. Emissive meshes counted as light in the Rendered view.
- [ ] Power in watts, colour, temperature in kelvin. Gizmos to aim and size.

**You'll see:** add a spot light and aim it by dragging its gizmo.
**Done when:** each light type matches reference renders within tolerance.

### Phase 3D-038 · Shadows
**Needs:** 3D-037 · **Was:** Main 226 · **Lane:** A · **Status:** 📋
- [ ] Shadow maps with soft shadows (PCSS-style), contact shadows, per-light toggles. Quality per device tier.
- [ ] Shadow catcher planes (shadows on a transparent floor, for 3D on a page background).

**You'll see:** the button casts a soft shadow onto the page.
**Done when:** shadows match references; each tier stays within budget.

### Phase 3D-039 · World: HDRI & studio environments
**Needs:** 3D-037 · **Was:** Main 226 · **Lane:** A · **Status:** 📋
- [ ] HDRI environments (from the asset store and a built-in library):
  - rotation, strength;
  - shown as background, or hidden behind a transparent page.
- [ ] Studio environments made in code (the softbox maps from S3b).
- [ ] Image-based lighting prefiltered per roughness.

**You'll see:** choose "Studio softbox" and every material lights like a product photo.
**Done when:** prefiltered lighting matches reference within tolerance; a 4K HDRI loads in under 1 s (worker).

### Phase 3D-040 · Light-rig looks
**Needs:** 3D-039, 3D-023 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] One-click rigs, each lights plus a world, sized to the scene:
  - studio softbox;
  - three-point;
  - product (top softbox and rim);
  - dramatic rim;
  - soft daylight;
  - dusk;
  - neon.

**You'll see:** "Studio softbox" gives the reference button's lighting in one click.
**Done when:** each rig matches its reference image on 3 test objects.

### Phase 3D-041 · Colour management
**Needs:** 3D-039 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Linear workflow, exposure, tone mapping (AgX, Filmic, ACES, neutral), the view's look, sRGB / Display-P3 output.
- [ ] 3D colours on the page match 2D colours (a 2D fill and an unlit 3D material of the same colour look the same).

**You'll see:** highlights roll off softly instead of clipping.
**Done when:** a colour chart renders within ΔE 2 of the reference; unlit 3D equals the 2D fill.

### Phase 3D-042 · Real-time renderer
**Needs:** 3D-041 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] The live renderer on the compositor:
  - physically based, forward rendering;
  - sorted transparency, with transmission for glass;
  - instanced draws;
  - frustum culling.
- [ ] Renders only when something changed, or while something moves.
- [ ] WebGPU first, WebGL2 fallback. Same picture within tolerance.

**You'll see:** Material preview and Rendered modes draw in real time.
**Done when:** the 12 material references match within tolerance on both back-ends; an idle scene costs 0 frames.

### Phase 3D-043 · Ambient occlusion & screen-space reflections
**Needs:** 3D-042 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Ground-truth ambient occlusion (GTAO) and screen-space reflections. Per-tier quality and a downgrade order.

**You'll see:** folds and creases darken; glossy floors reflect.
**Done when:** AO and reflections match references; low tier turns them off cleanly.

## Stage 7 · Input & simulation core

### Phase 3D-044 · Input bus & coordinate spaces
**Needs:** 3D-012 · **Was:** Main 132 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 132: one input bus for pointer, wheel, keys and touch, with coordinate spaces (page, layer, frame).
- [ ] New for 3D: scene space and object space (through the camera), so a pointer has a ray and a hit point.

**You'll see:** nothing on its own; it feeds 3D-047 and 3D-053.
**Done when:** the 132 tests pass; pointer → ray → hit point is exact on 20 views.

### Phase 3D-045 · Signal catalogue
**Needs:** 3D-044 · **Was:** Main 133 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 133: named signals (pointer position, speed, press, scroll progress, time, keys), smoothed and normalised. New: signals for objects (hovered, pressed, hit point, hit normal).

**You'll see:** a list of signals you can connect things to.
**Done when:** the 133 tests pass; object signals fire on a scripted tape.

### Phase 3D-046 · Input tapes
**Needs:** 3D-045 · **Was:** Main 136 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 136: record and replay input with exact timing.
- [ ] Used by tests, the comparison harness (3D-060) and the demo runs (View > Show keystrokes).

**You'll see:** record a press sequence and replay it exactly.
**Done when:** a replayed tape gives the same frames twice (hash equality).

### Phase 3D-047 · Operators & bindings runtime
**Needs:** 3D-046 · **Was:** Main 138 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 138: bindings from a signal to any property, through operators (map range, smooth, spring, clamp, curve). New: 3D properties as targets.

**You'll see:** tilt an object with the pointer by binding pointer x to its rotation.
**Done when:** the 138 tests pass; 3D targets update in the same frame as their signal.

### Phase 3D-048 · Stateful simulations & replay
**Needs:** 3D-006, 3D-046 · **Was:** Main 184 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 184: a fixed time step, state snapshots at checkpoints, scrubbing by restoring the nearest snapshot and stepping forward, and replay with a tape.

**You'll see:** scrub a simulation back and forth on the timeline.
**Done when:** a 10-second simulation scrubbed to any time equals playing to that time (hash equality).

### Phase 3D-049 · Simulation framework for 3D
**Needs:** 3D-048, 3D-013 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Decision record 0020 (simulation and baking).
- [ ] Per object: a physics type (none, rigid, cloth, soft, particles, collider) and settings.
- [ ] Per scene:
  - gravity, sub-steps;
  - a cache (in memory, then baked);
  - a start and end frame.
- [ ] Simulations run in workers or on the GPU, and only while needed.

**You'll see:** a Physics section on every object; a cache bar on the timeline.
**Done when:** caches are reused until an input changes; changing an input invalidates exactly the frames after it.

### Phase 3D-050 · Cloth on the GPU (XPBD)
**Needs:** 3D-049 · **Was:** — (from Surfaces S4b) · **Lane:** A · **Status:** 📋
- [ ] Extended position-based dynamics on the GPU:
  - stretch, shear and bend with compliance;
  - damping;
  - gravity.
- [ ] Any mesh can be cloth. The solver from `src/core/surface/cloth.ts` (CPU) moves here, with the CPU version kept as the reference for tests.
- [ ] Looks: silk, cotton, denim, leather, foil, rubber.

**You'll see:** a flag waves; a sheet drapes over a sphere.
**Done when:** the GPU and CPU solvers agree within tolerance on 5 reference scenes; 20,000 vertices step at 60 fps on mid tier.

### Phase 3D-051 · Cloth pins, seams, sewing & pressure
**Needs:** 3D-050 · **Was:** — (from Surfaces S4b) · **Lane:** A · **Status:** 📋
- [ ] Pin groups (vertex groups that don't move, or follow an animated object).
- [ ] Sewing springs that pull edges together.
- [ ] **Pressure:** a closed cloth holds air, for balloons, cushions and the foil button.
- [ ] Slack (extra material that crumples) and seam behaviour (fixed or pulled in), from S4b.

**You'll see:** a 3D button inflates like a foil balloon, with pleats at its seam and pinched corners.
**Done when:** the reference button's resting shape is judged a match side by side (harness 3D-060); volume is kept within 1% under pressure.

### Phase 3D-052 · Cloth collisions
**Needs:** 3D-051 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Collisions with collider objects (distance-field based) and basic self-collision, with friction and thickness.

**You'll see:** cloth falls onto a chair and folds over it without passing through.
**Done when:** no penetration deeper than the thickness in 5 reference scenes.

### Phase 3D-053 · Raycast pointer events on objects
**Needs:** 3D-047, 3D-015 · **Was:** Main 232 (part) · **Lane:** A · **Status:** 📋
- [ ] Enter, leave, press, release, click and drag on objects, with the hit point and normal, in Preview and on the exported site. Never taking the canvas pointer in Design (COLLABORATION §10).

**You'll see:** hovering an object in Preview highlights it; clicking it fires an event.
**Done when:** a scripted tape produces the expected events with exact hit points.

### Phase 3D-054 · Pointer forces
**Needs:** 3D-053, 3D-051 · **Was:** — (from Surfaces S6) · **Lane:** A · **Status:** 📋
- [ ] The pointer acts on simulations:
  - **press** (a dent at the hit point, depth and radius);
  - **poke** (an impulse);
  - **push** (a moving sphere);
  - **drag** (grab a vertex and pull);
  - **inflate** (pressure while held).
- [ ] Works on cloth and soft bodies (and rigid bodies after 3D-135).

**You'll see:** press the 3D foil button and it dents where you press, crumples round the dent and springs back.
**Done when:** a replay of the reference's four presses is judged a match side by side (3D-060).

### Phase 3D-055 · Bake simulations
**Needs:** 3D-054 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Bake a simulation to:
  - **keyframes** (rigid bodies);
  - **morph targets** (short cloth motions);
  - **vertex-animation textures** (long motions);
  - **a rest pose** (the inflated shape, frozen, plus interactive press clips).
- [ ] The export uses baked data (Law 5).

**You'll see:** "Bake" on the Physics section; the timeline shows the baked range.
**Done when:** baked playback matches the live simulation within tolerance; the baked button's export is under its size budget.

## Stage 8 · First ship

### Phase 3D-056 · Rendered view: path tracer
**Needs:** 3D-042 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Decision record 0021 (the path tracer is for the editor and baking only).
- [ ] The Rendered view uses a progressive path tracer: three-gpu-pathtracer on three-mesh-bvh, with denoising. It shows light bouncing between folds, soft shadows and real reflections.
- [ ] Sample count and time limit.

**You'll see:** switch to Rendered and the scene refines into a photo-like picture in a few seconds.
**Done when:** 5 reference scenes converge within tolerance of reference renders; the editor stays responsive while it refines.

### Phase 3D-057 · Bake lighting & posters
**Needs:** 3D-056 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Bake from the path tracer into textures:
  - light maps;
  - ambient occlusion;
  - bent normals.
- [ ] So the real-time renderer on the live site looks close to the Rendered view.
- [ ] Render posters (the still shown before load, and where WebGL is missing).

**You'll see:** "Bake lighting"; the live view jumps closer to the Rendered view.
**Done when:** baked real-time frames are within a set perceptual distance of the Rendered view on 3 references.

### Phase 3D-058 · Interactive export runtime
**Needs:** 3D-047 · **Was:** Main 197 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 197: a small vendored runtime for bindings, states and the scheduler in the exported site. New: the 3D parts (raycast events, pointer forces on baked press clips).

**You'll see:** interactions work the same on the exported site.
**Done when:** the 197 parity tests pass; the runtime is under its size budget.

### Phase 3D-059 · 3D export v1
**Needs:** 3D-055, 3D-057, 3D-058 · **Was:** Main 238 (part) · **Lane:** A · **Status:** 📋
- [ ] Export a scene layer as a React Three Fiber component (Next, Vite) and as plain three.js (HTML):
  - lazily loaded;
  - the poster first;
  - baked simulation and light;
  - glTF with compression.

**You'll see:** the exported site shows the same 3D button, and pressing it dents it.
**Done when:** the export matches the editor within 2% (GPU tolerance) and builds in the fixtures.

### Phase 3D-060 · Reference comparison harness for 3D
**Needs:** 3D-046, 3D-004 · **Was:** — (from Surfaces S8) · **Lane:** A · **Status:** 📋
- [ ] From `scripts/surface-compare.ts`:
  - replay a reference video's input tape against a scene;
  - render frame by frame at exact times;
  - build a side-by-side page (both clips in sync, paired stills, a score per frame).
- [ ] Published as an artifact for a person to judge.

**You'll see:** the reference and ours side by side, frame by frame.
**Done when:** the harness runs in CI for every reference recipe and posts its page.

### Phase 3D-061 · Reference images in 3D
**Needs:** 3D-060 · **Was:** — (from Surfaces S1) · **Lane:** A · **Status:** 📋
- [ ] Place a reference image as the camera's background (matched to the frame), or as a blueprint plane in the scene (front, side, top). Never exported.

**You'll see:** the reference photo behind the 3D button, lined up with the camera.
**Done when:** the image stays aligned to the camera within 0.5 px while you orbit back to the camera view.

### Phase 3D-062 · Gate M1: the foil button
**Needs:** 3D-001 – 3D-061 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] **The journey, 7 steps, Simple face only:**
  1. Place reference image.
  2. Draw a frame and type the label.
  3. Make 3D > Inflate.
  4. Material look: Black foil.
  5. Physics look: Over-inflated.
  6. Light look: Studio softbox.
  7. Interaction look: Dents when pressed.
- [ ] A person can't tell it from the reference side by side (harness), resting and pressed.
- [ ] Exported; 60 fps on the mid tier, 30 fps on the low tier.

**You'll see:** the button from the reference video, made by you in 7 clicks and keys, on your exported site.
**Done when:** the journey passes in CI in 3 browsers, plus one recorded manual run judged by the project owner.

---

# M2 · STUDIO QUALITY (3D-063 – 3D-116)

> At the gate: a product hero modelled in edit mode with modifiers, node materials, a studio rig, a camera on a path, depth of field, bloom and grading, animated with keys, shape keys and drivers, and matched to a reference render.

## Stage 9 · Edit mode

### Phase 3D-063 · Edit mode & mesh selection
**Needs:** 3D-062 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Tab into edit mode:
  - vertex, edge and face selection (1, 2, 3);
  - select loop and ring (Alt-click);
  - grow and shrink, select linked, select by trait (non-manifold, loose);
  - hide and reveal.
- [ ] Every edit-mode operation is a command (3D-011).

**You'll see:** Tab, click a face, Alt-click a loop.
**Done when:** loop and ring selection match golden sets on 10 meshes.

### Phase 3D-064 · Extrude, inset & bevel
**Needs:** 3D-063 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Extrude (region, individual, along normals), inset (individual or region, depth), bevel (edges and vertices, segments, profile shape, clamp overlap).

**You'll see:** extrude a face into a handle; bevel the edges of a box to round them.
**Done when:** golden meshes for 15 operations; results stay manifold.

### Phase 3D-065 · Loop cut, slide & knife
**Needs:** 3D-064 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Loop cut with number of cuts and slide, edge slide, vertex slide, knife (cut through, angle snap).

**You'll see:** Ctrl+R adds a loop round a cylinder; K cuts a line across a face.
**Done when:** golden meshes for each tool; knife cuts snap exactly to midpoints and angles.

### Phase 3D-066 · Merge, dissolve, fill & bridge
**Needs:** 3D-065 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Merge (at centre, cursor, collapse, by distance), dissolve (vertices, edges, faces, limited), delete, fill (F), grid fill, bridge edge loops, separate and join.

**You'll see:** join two tubes with Bridge edge loops.
**Done when:** golden meshes; topology invariants hold after each.

### Phase 3D-067 · Spin, screw & symmetry
**Needs:** 3D-066 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Spin (round an axis by an angle), screw, mirror editing (X / Y / Z symmetry in edit mode), symmetrize.

**You'll see:** draw half a vase profile and spin it into a vase.
**Done when:** golden meshes; symmetric edits stay symmetric within 1e-6.

### Phase 3D-068 · Proportional editing
**Needs:** 3D-063 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Moving a vertex moves its neighbours with a falloff (smooth, sphere, root, sharp, linear, constant, random), a radius on the wheel, connected-only option.

**You'll see:** pull one vertex and the surface around it rises like cloth.
**Done when:** falloff weights match golden values.

### Phase 3D-069 · Normals
**Needs:** 3D-066 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Recalculate outside or inside, flip, smooth / flat per face, auto smooth by angle, weighted normals, custom normals (set from faces, transfer).

**You'll see:** a low-poly model shades cleanly with sharp edges where wanted.
**Done when:** golden normals on 10 meshes; export keeps custom normals.

### Phase 3D-070 · UV unwrapping
**Needs:** 3D-066 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Mark seams, unwrap (angle-based / conformal), smart project, cube / cylinder / sphere projection, project from view, follow active quads.

**You'll see:** a wood texture wraps a chair without stretching.
**Done when:** stretch metrics within bounds on 10 meshes; no overlapping islands from Unwrap on manifold meshes.

### Phase 3D-071 · UV editor
**Needs:** 3D-070 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] A light UV editor:
  - move, rotate and scale islands;
  - pin, average island scale, pack islands with margin;
  - show the texture behind.

**You'll see:** a 2D view of the UVs beside the 3D view.
**Done when:** packing fills at least 70% on 5 test meshes without overlap.

### Phase 3D-072 · Mesh booleans
**Needs:** 3D-066 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Exact union, difference and intersect of meshes (manifold, robust to coplanar faces), in a worker.

**You'll see:** cut a round hole through a box with a cylinder.
**Done when:** outputs are manifold on 20 fixture pairs, including coplanar and touching cases.

### Phase 3D-073 · Cleanup & remesh
**Needs:** 3D-072 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Merge by distance, delete loose, triangulate, quads from triangles, decimate (collapse, planar), voxel remesh (for inflated and sculpt-like shapes).

**You'll see:** a messy imported model becomes clean and light.
**Done when:** decimate keeps silhouettes within 1% (Hausdorff) at 50% reduction; voxel remesh outputs are manifold.

### Phase 3D-074 · Curves in 3D
**Needs:** 3D-027, 3D-063 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Bézier curves in 3D (handles, tilt, radius), NURBS-lite, curve to mesh with a bevel profile and taper, curve from a 2D path.

**You'll see:** draw a curve and give it a round profile: a neon tube.
**Done when:** sampled curves match golden points; bevelled meshes are watertight.

## Stage 10 · Modifier depth

### Phase 3D-075 · Mirror & array
**Needs:** 3D-030 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Mirror (axes, bisect, merge at the seam), Array (count, offset, by object for radial, fit to curve), with caps.

**You'll see:** model half a mask, mirror it; array a link into a chain.
**Done when:** golden meshes for 10 set-ups.

### Phase 3D-076 · Bevel modifier & weighted normals
**Needs:** 3D-075, 3D-069 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Bevel as a modifier (by angle, by weight, segments, profile), weighted-normal modifier for clean shading.

**You'll see:** every hard edge gets a soft rounded highlight, live.
**Done when:** golden meshes and normals.

### Phase 3D-077 · Lattice & mesh deform
**Needs:** 3D-075 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Lattice objects (resolution, interpolation) and the lattice modifier; mesh-deform cage. Lattice points can be keyframed.

**You'll see:** squash and stretch a character through a box of points.
**Done when:** deformation matches golden values; animated lattices scrub exactly.

### Phase 3D-078 · Curve & simple deform
**Needs:** 3D-077, 3D-074 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Curve deform (follow a curve), Simple deform (bend, twist, taper, stretch, with limits and axis).

**You'll see:** bend a text along a curve; twist a bar.
**Done when:** golden meshes for each mode.

### Phase 3D-079 · Boolean modifier
**Needs:** 3D-072 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] A live boolean with another object or collection (union, difference, intersect), exact or fast solver.

**You'll see:** move the cutter and the hole moves with it.
**Done when:** live boolean results equal the destructive boolean of 3D-072.

### Phase 3D-080 · Shrinkwrap, wave, cast & wireframe
**Needs:** 3D-078 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Shrinkwrap (onto a target surface), wave (animated ripples), cast (towards a sphere / cylinder / cube), wireframe (a mesh of the edges).

**You'll see:** a sticker shrink-wrapped onto a bottle; a pond that ripples.
**Done when:** golden meshes; wave is exact at 5 times.

### Phase 3D-081 · Weld, decimate, remesh & triangulate
**Needs:** 3D-073 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] The cleanup operations of 3D-073 as live modifiers, for imported and generated meshes.

**You'll see:** a heavy model made light without touching its source.
**Done when:** live results equal the destructive operations.

### Phase 3D-082 · Geometry looks
**Needs:** 3D-081, 3D-023 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Modifier stacks as one-click looks:
  - pillow (subdivide + inflate);
  - rounded tile;
  - chain;
  - coil;
  - pleats;
  - knit-like tube;
  - low-poly;
  - wireframe cage.

**You'll see:** one click turns a cube into a soft pillow.
**Done when:** each look gives its reference shape on 3 input objects.

## Stage 11 · Material depth

### Phase 3D-083 · Material node editor
**Needs:** 3D-042 · **Was:** Main 177, 231 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 177 and 231: a node editor for materials, compiled to TSL node materials (WebGPU and WebGL2):
  - textures, maths, colour ramps;
  - mix, fresnel, layer weight;
  - noise, Voronoi, bump, normal map;
  - outputs to the PBR inputs.
- [ ] The 2D shader-graph parts of 177 (backgrounds) use the same editor.

**You'll see:** a node graph like Blender's shader editor; edits show live.
**Done when:** 10 graph materials match between WebGPU and WebGL2 within tolerance; a node edit updates the view in < 100 ms.

### Phase 3D-084 · Raw shaders (Pro) & shader safety
**Needs:** 3D-083 · **Was:** Main 178 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 178: a code node for GLSL / TSL in the Pro face, compiled in a sandbox; unbounded loops and unsafe constructs are refused at compile time.

**You'll see:** a shader code editor in Pro mode.
**Done when:** an injected unbounded-loop shader is refused at compile time.

### Phase 3D-085 · Vertex colours & painting
**Needs:** 3D-083 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Colour attributes on meshes, a vertex-paint mode (brush, blur, fill), usable in materials.

**You'll see:** paint soft colour onto a low-poly model.
**Done when:** painted attributes export in glTF and match.

### Phase 3D-086 · Texture painting
**Needs:** 3D-071, 3D-085 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Paint onto a model's image textures (colour, roughness), with brush, stencil from an image, and symmetry.

**You'll see:** paint a logo onto a mug.
**Done when:** painting maps through UVs exactly on 5 test meshes.

### Phase 3D-087 · Material slots per face
**Needs:** 3D-083 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Several materials on one object, assigned per face in edit mode.

**You'll see:** a can with a metal top and a painted side.
**Done when:** slot assignments round-trip through glTF.

### Phase 3D-088 · Texture baking
**Needs:** 3D-071, 3D-087 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Bake normal (high to low poly), ambient occlusion, curvature, combined lighting and node materials into images, in the path tracer (3D-056).

**You'll see:** a heavy sculpted shape becomes a light mesh that looks the same.
**Done when:** baked maps reproduce the source within tolerance in the real-time view.

### Phase 3D-089 · Material looks v2
**Needs:** 3D-088 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Velvet, fabric weave, ceramic glaze, brushed metal, gems, holographic foil, frosted glass, soap bubble, wax, marble.

**You'll see:** a richer material library, each a thumbnail.
**Done when:** each matches its reference within tolerance.

## Stage 12 · Rendering depth

### Phase 3D-090 · Depth of field
**Needs:** 3D-042 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Focus distance (or a focus object), f-stop, bokeh shape, in real time and in the path tracer.

**You'll see:** the product sharp, the background soft.
**Done when:** blur sizes match the thin-lens reference.

### Phase 3D-091 · Motion blur
**Needs:** 3D-090 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Per-object velocity motion blur in real time, shutter in the camera settings.

**You'll see:** a fast spin smears naturally.
**Done when:** blur length matches velocity × shutter.

### Phase 3D-092 · Bloom, lens & film
**Needs:** 3D-091 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Bloom, lens distortion, chromatic aberration, vignette, film grain.

**You'll see:** neon glows; a cinematic frame.
**Done when:** each effect matches its reference.

### Phase 3D-093 · Post-processing stack & tiers
**Needs:** 3D-092 · **Was:** Main 236 · **Lane:** A · **Status:** 📋
- [ ] From ROADMAP.md 236: an ordered post stack per scene, each with a cost per tier and automatic downgrade.

**You'll see:** a Render section listing the effects in order, with a cost on each.
**Done when:** each effect stays within its tier budget and degrades in the documented order.

### Phase 3D-094 · Colour grading
**Needs:** 3D-093 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Lift / gamma / gain wheels, curves, saturation by hue, LUTs (.cube). The same grading model as 2D, so a page and its 3D share one grade.

**You'll see:** colour wheels like DaVinci's; the 3D scene and the page match.
**Done when:** a graded colour chart matches the reference within ΔE 2.

### Phase 3D-095 · Fog & volumetrics
**Needs:** 3D-093 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Distance and height fog; light shafts from spot lights (real-time approximation), true volumes in the path tracer.

**You'll see:** light beams through haze.
**Done when:** fog density matches the reference; low tier falls back to plain fog.

### Phase 3D-096 · Render passes, layers & shadow catchers
**Needs:** 3D-093 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Render layers (which collections draw) and passes (beauty, shadow, AO, depth, mask), to put 3D over 2D cleanly (a 3D object casting a shadow on the real page).

**You'll see:** a 3D shoe's shadow falls on the page's own background.
**Done when:** compositing passes reproduce the beauty pass within tolerance.

### Phase 3D-097 · Render to image, sequence & video
**Needs:** 3D-096 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Render a frame (PNG, WebP, AVIF, with transparency), an image sequence, or a video (MP4, WebM) from the real-time renderer or the path tracer, at any resolution, in a worker.

**You'll see:** "Render image" and "Render animation".
**Done when:** a rendered frame equals the viewport frame at that time; a 10-second video encodes deterministically.

### Phase 3D-098 · Toon & stylised shading
**Needs:** 3D-083 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Cel shading (bands), outlines (inverted hull and post), hatching, flat colour looks.

**You'll see:** a 3D model that looks hand-drawn.
**Done when:** each style matches its reference.

## Stage 13 · Cameras

### Phase 3D-099 · Cameras
**Needs:** 3D-062 · **Was:** Main 227 · **Lane:** A · **Status:** 📋
- [ ] Perspective and orthographic cameras: focal length or field of view, sensor, shift, clipping. An active camera, the camera view, lock camera to view.

**You'll see:** look through the camera; frame the shot by orbiting with "lock to view".
**Done when:** projections match golden matrices.

### Phase 3D-100 · Camera markers & switching
**Needs:** 3D-099 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Markers on the timeline that switch the active camera (cuts), as in Blender.

**You'll see:** the scene cuts between three cameras as it plays.
**Done when:** cuts happen on exact frames.

### Phase 3D-101 · Camera paths & look-at
**Needs:** 3D-100, 3D-074 · **Was:** Main 227 · **Lane:** A · **Status:** 📋
- [ ] A camera follows a curve at constant speed (or eased), always looking at a target object.

**You'll see:** a camera glides round a product, always facing it.
**Done when:** sampled camera positions on a path match `evaluate()`.

### Phase 3D-102 · Camera rigs
**Needs:** 3D-101 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] One-click rigs:
  - dolly;
  - crane;
  - orbit;
  - turntable;
  - handheld shake (seeded noise);
  - push-in;
  - reveal.

**You'll see:** "Turntable" spins the camera round the product.
**Done when:** each rig produces its reference path, deterministic for its seed.

### Phase 3D-103 · Scroll- & cursor-driven cameras
**Needs:** 3D-102, 3D-047 · **Was:** Main 232 (part) · **Lane:** A · **Status:** 📋
- [ ] Bind the camera's path progress to page scroll, and a small parallax to the cursor.

**You'll see:** scrolling the page flies the camera through the scene.
**Done when:** scroll positions map to exact path progress; the cursor offset is smoothed and bounded.

## Stage 14 · Animation

### Phase 3D-104 · 3D keyframes
**Needs:** 3D-062 · **Was:** Main 228 · **Lane:** A · **Status:** 📋
- [ ] Location, rotation (quaternion slerp, or Euler per channel) and scale tracks on the existing timeline, with auto-key (I to insert, as in Blender).

**You'll see:** keyframe a cube's rotation and scrub it.
**Done when:** 3D tracks match `evaluate()` at 5 times; scrubbing is exact.

### Phase 3D-105 · Animate any property
**Needs:** 3D-104 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Every property can be keyframed:
  - material, light, camera, world;
  - modifier parameters;
  - physics settings where meaningful.
- [ ] A stopwatch on every field in the Pro face.

**You'll see:** animate a light's colour and a bevel's width.
**Done when:** every animatable property path evaluates and exports (coverage test).

### Phase 3D-106 · Dope sheet & graph editor for 3D
**Needs:** 3D-105 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] The timeline's dope sheet and graph editor (Phases 62–67) show 3D channels, grouped by object and data block, with the same tools.

**You'll see:** 3D keys in the same timeline as page animations.
**Done when:** every 3D channel appears and edits through the existing commands.

### Phase 3D-107 · F-curve modifiers
**Needs:** 3D-106 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Modifiers on a curve: noise (seeded), cycles (repeat, with offset), stepped, envelope, limits.

**You'll see:** add noise to a hover so it floats naturally.
**Done when:** modified curves match golden values and export as baked keys where needed.

### Phase 3D-108 · 3D motion paths & ghosts
**Needs:** 3D-104 · **Was:** Main 228 · **Lane:** A · **Status:** 📋
- [ ] An object's path drawn in the viewport with frame ticks, editable keys on it; ghosts before and after the playhead.

**You'll see:** the arc a ball takes, drawn in 3D.
**Done when:** drawn points match `evaluate()` within 0.5 px.

### Phase 3D-109 · Follow path
**Needs:** 3D-108, 3D-074 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] An object follows a curve (constant speed, follow the curve's direction, offset, loop).

**You'll see:** a paper plane flies along a curve, banking with it.
**Done when:** positions and orientations match golden values.

### Phase 3D-110 · Animated GLTF playback
**Needs:** 3D-104 · **Was:** Main 229 · **Lane:** A · **Status:** 📋
- [ ] Skeletal clips and morph targets from imported models appear as clips on the timeline (trim, loop, blend, speed), triggerable by states.

**You'll see:** an imported character's walk as a clip on the timeline.
**Done when:** an animated sample scrubs exactly and plays in sync with other layers.

### Phase 3D-111 · Actions & strips
**Needs:** 3D-110 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Actions as reusable data blocks; strips on an object's track (offset, repeat, blend in/out, add / replace), layered.

**You'll see:** reuse one "bob" motion on five objects, each offset.
**Done when:** blended results match golden values.

### Phase 3D-112 · Shape keys
**Needs:** 3D-111 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Add shape keys (basis and relative keys), edit them in edit mode, mix by value, keyframe and drive them.

**You'll see:** a "squash" shape key on a button, animated on press.
**Done when:** mixed shapes match golden vertices; export as morph targets.

### Phase 3D-113 · Property links & pick-whip
**Needs:** 3D-105 · **Was:** Main 76 · **Lane:** **B** · **Status:** 📋
- [ ] From ROADMAP.md 76: `Link { target, source, map }` with ranges or curves, drawn by dragging from one property to another; cycles refused with `[LINK_CYCLE]`. New: 3D properties on both ends (Blender's drivers).

**You'll see:** link a dial's rotation to a door's opening.
**Done when:** the 76 golden tests pass; a 3D cycle is refused with its chain.

### Phase 3D-114 · Expressions
**Needs:** 3D-113 · **Was:** Main 77 · **Lane:** **B** · **Status:** 📋
- [ ] From ROADMAP.md 77: the typed expression language (`wiggle`, `loopOut`, `time`, `value`, references), usable on 3D properties.

**You'll see:** type `wiggle(1, 5)` on a light's power.
**Done when:** the 77 golden tests pass, including 3D targets.

### Phase 3D-115 · Animation looks
**Needs:** 3D-112, 3D-023 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] One-click motions sized to the object:
  - spin, float, bob, wobble;
  - pop in, breathe, turntable, swing;
  - shake, bounce in.

**You'll see:** "Float" makes an object bob softly forever.
**Done when:** each look produces its reference motion, deterministic.

### Phase 3D-116 · Gate M2: the studio product hero
**Needs:** 3D-063 – 3D-115 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] **The journey:**
  - model a headphone-like product in edit mode with modifiers;
  - node materials;
  - a studio rig;
  - a camera on a path with depth of field;
  - bloom and a grade;
  - a float animation;
  - a shape key on hover.
- [ ] Matched to a reference render by a person; Simple-face recipe in 8 steps from a starting model.

**You'll see:** a product hero good enough for a launch page.
**Done when:** the journey passes in CI in 3 browsers, plus one recorded manual run.


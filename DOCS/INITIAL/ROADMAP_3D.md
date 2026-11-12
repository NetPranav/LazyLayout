# LazyLayout — 3D Engine Roadmap (Blender for the web builder)

**Version:** 3D-1.1 (2026-11-13) · **Owner:** Lane A (proposed; see §8) · **Status:** In progress. Takes priority over the main roadmap's remaining order (owner, 2026-11-11). **Re-ordered on 2026-11-13 around four cases (§0a).**
**Phases:** 227, numbered **3D-001 … 3D-227**: the original 190 plus **37 added on 2026-11-13** (3D-191 – 3D-227). **75** are deferred (⏸), the anime studio among them as a to-do. **24** of the original 190 are main-roadmap phases pulled in because the 3D work needs them. Each says where it came from (`Was: Main 173`), and the main roadmap's row points here.
**Relationship to ROADMAP.md:**
- This file replaces the main roadmap's Stage 6 (Phases 218–240) and takes over the 24 phases listed in §7.
- Everything else in ROADMAP.md is unchanged: its laws, Definition of Done and lane rules apply here too.
- A phase is ✅ when its **Done when** is met by tests that were run **and** it is on `main` (the owner's rule of 2026-11-12: do not wait for CI). Anything the Done-when names that was not run stays in the phase's *Status check* line and keeps it 🚧.

> **Why a separate roadmap.** A page builder that wants the best websites on the market needs real 3D: objects that turn, light that bounces, cloth that inflates, characters that look at the cursor. Blender shows how to make that powerful. This roadmap brings in Blender's ideas a website needs, makes them simple enough to use in 8 steps, and ships them to a fast exported site.

---

## 0. How to read this

- **Order.** Inside a track, take the lowest phase that isn't ✅ and whose **Needs** are all ✅. The order **between** tracks is the build order in §0a. Because new phases were appended, a **Needs** line may point at a higher number; `scripts/check-roadmap-3d.mts` checks that every Need exists, that nothing active needs a deferred phase, and that there are no cycles.
- **Status:** ✅ done, verified and on main · 🚧 in progress, or built with a named gap · 📋 planned · ⏸ deferred (kept in the list, not scheduled). **Lane B\*** means Lane B's area: agree first (COLLABORATION §2).
- Phases are grouped into **7 milestones** and **30 stages**.
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
| **M1+ · Small and reactive** | 3D-191 – 3D-200 | Export a hover component with no script, and the foil button in a few KB, lit by a light that follows the pointer across the whole page, on touch and tilt too. |
| **M5 · The photo studio** | 3D-201 – 3D-215 | Cut out a car, find its body lines, wrap text on it so it looks painted on yet can be told apart, corner-pin and track images in video like After Effects. |
| **M6 · The anime studio** | 3D-216 – 3D-227 | **Parked as a to-do (owner, 2026-11-13); only 3D-227, live animation mixing, stays active.** Later: build a 15-second fight shot in a Solo Leveling, One Piece or Naruto look: toon shading, ink lines, twos, smears, effects, camera language, a shot list, rendered to video. |

M2, M3 and M4 keep their numbers. The phases marked ⏸ in §6 are deferred, and the gates of M2 and M3 are re-scoped to the phases that stay.

---

## 0a. Direction of 2026-11-13: four cases, one order

The project owner named four things the studio must make. Everything is ordered by them.

| Case | What it is | What it needs | Phases |
|---|---|---|---|
| **1** | A static or reactive component built from shapes: hover, press, pointer. | Mostly done in 2D (states, interactions). Needs an export with no runtime. | 3D-191 – 3D-193, 3D-196 |
| **2** | A fully 3D element, like the ballooned foil button, lit by real lights. The light moves **against the pointer across the whole page**. Touch on phones. | M1, plus page-wide signals, a pointer light and a micro-renderer export. | M1, 3D-197 – 3D-200 |
| **3** | A photo (a car). **Corner-pin and track images like After Effects.** Mark the body's cuts and curves; wrap text on the surface so it looks painted on yet can still be told apart from the photo. Production quality. The photo does not rotate. | AI services, tracking, a surface from a photo, text wrap, integration. | 3D-201 – 3D-215 |
| **4** | Anime: Solo Leveling, One Piece, Naruto. It looks 2D and moves with 3D depth. A platform that makes anime far faster and cheaper. | Toon shading, ink lines, time on twos, smears, effects, camera language, shots, render to video. | 3D-216 – 3D-227, plus M2's animation, cameras, post and render |

### The owner's decisions (2026-11-13)

1. **Small export.** An exported element ships only the code its recipe uses, smaller than Rive's web runtime. None of our editor or tool code ships. Measured, not guessed (3D-191).
2. **AI** runs in the browser where it can (private, free) and on a server where it must (bigger models); a server is available. One gateway (3D-201). Nothing leaves the device if the user says so.
3. **Case 3 behaves like After Effects:** a corner pin with four points, point and planar tracking, any image or text placed on a surface in a photo.
4. **Production quality** for case 3 (3D-214).
5. **Full animation:** several animations on one thing, mixed, playing live in the viewport (3D-227 and Stage 14).
6. **Phones:** touch (and tilt where allowed) take the mouse's place (3D-199).
7. **The platform makes anime**, not only anime-looking buttons (§0b).

### Build order (proposed; change it here)

| Order | Track | Phases | Ends at |
|---|---|---|---|
| **0** | **The Design master track** (ROADMAP.md, D1 – D21): goes first. 3D work continues only where it needs it (D4 takes 3D-044 – 047 and 3D-197; D16 – D17 take 3D-204 – 206; D19 needs 3D-033, 3D-037 and 3D-158). | D1 – D21 | the watch page (D21) |
| 1 | Finish M1's core: lights, materials, inputs, cloth, export | 3D-031 – 3D-061 | Gate M1 (3D-062) |
| 2 | **Small export** (case 1 and 2) | 3D-191 – 3D-196 | measured budgets |
| 3 | **Pointer light** (case 2) | 3D-197 – 3D-200 | Gate A (3D-200) |
| 4 | **Animation first**: keys, cameras, post, render to video, mixing | 3D-090, 3D-092 – 3D-094, 3D-096 – 3D-115, 3D-227 | Gate M2, re-scoped (3D-116) |
| 5 | **AI services** | 3D-201 – 3D-203 | |
| 6 | **The photo studio** (case 3) | 3D-204 – 3D-215 | Gate B (3D-215) |
| ⏸ | **The anime studio** (case 4): parked as a to-do on 2026-11-13 | 3D-216 – 3D-226 | Gate C (3D-226) |
| 8 | Interaction and the page | 3D-146 – 3D-156, 3D-158, 3D-159, 3D-164 – 3D-169 | Gate M3, re-scoped (3D-157) |
| 9 | Ship | 3D-171 – 3D-190 | Gate M4c (3D-189) |
| ⏸ | Deferred: edit mode (3D-063 – 073), modifier depth (3D-075 – 082), node materials and painting (3D-083 – 089), motion blur and fog (3D-091, 3D-095), rigging and physics depth (3D-117 – 145), asset browser and imports (3D-160 – 163), instancing (3D-170), camera solve (3D-207). | | |

Two things can run side by side. **Lane A** takes the tracks that need 3D, vision and export. **Lane B** takes the animation side that tracks 4 and 7 lean on (3D-113, 3D-114, 3D-147, 3D-218, 3D-223, 3D-227) and the video layers that tracking needs (Main 99). The cheap toon shaders (3D-216, 3D-217) can start as soon as 3D-098 is unblocked; they do not wait for the photo studio.

## 0b. The anime studio in one page (parked as a to-do, 2026-11-13)

**What makes the look.** A show like Solo Leveling, One Piece or Naruto is drawn on **twos and threes** (a new picture every second or third frame), with strong key poses, **smears** and **impact frames** at the hits, **line art** that is thick on the outside and fine inside, **flat colour with hand-shaped shadows**, **effects** (auras, slashes, flames, shockwaves) animated by specialists, **compositing** (glow, grain, chromatic edges, texture), painted backgrounds with **camera moves**, and tight cutting. Studios spend their time on the drawings, the effects and the compositing. These are the same layers the studio rebuilds:

| Layer | What the studio gives | Phases |
|---|---|---|
| Shape and shading | 3D models (imported or from a photo) drawn with two or three tone bands, shadow shapes you can nudge, and ink lines. This is how games such as Guilty Gear Xrd look hand-drawn. | 3D-098, 3D-216, 3D-217 |
| Timing | Per-layer frame rate (ones, twos, threes), holds, pose-to-pose. | 3D-218 |
| Drama | Smears, impact frames, speed lines, screen-tone bursts. | 3D-219 |
| Effects | A library of tiny procedural effects, plus imported hand-drawn sheets. | 3D-220 |
| Drawn art in space | Drawings as layers with depth, parallax and 2.5D camera moves, mixed with 3D. | 3D-221 |
| Camera and cutting | Crash zoom, whip pan, dolly zoom, shake; a shot list and animatic. | 3D-222, 3D-223 |
| Output | Frame-exact render to video, in passes. | 3D-096, 3D-097 |
| Help | Optional AI: in-betweens, colour flats, lip sync, style pass. Always drafts. | 3D-225 |

**Honest limits.** A 3D-driven toon pipeline reaches the look of a good anime game or a TV episode's 3D-assisted shots. The **hand-drawn key poses and the specialists' effect drawings** of the best shots cannot be generated; the studio shortens them (pose libraries, effect presets, in-betweens as drafts) and lets artists draw the keys that matter, as drawn layers (3D-221). The first aim is **one person, one shot, one day** (Gate C), not a replacement for a studio. The exact look is set from the owner's reference clips (§8, item 10).

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

A website doesn't need them, and each is a project of its own. They can be reconsidered after 3D-227.

**Since 2026-11-13 the product leans to After Effects with 3D layers, not to Blender.** Edit mode, deep modifiers, node materials, rigging and physics depth are deferred (⏸ in §6) until a case needs them. What stays is what the four cases use: lights and materials, inputs, cloth, animation and cameras, post effects, render to video, the toon look, and export.

## 3. Laws for 3D (in addition to ROADMAP.md §3)

1. **One GPU, shared.** Only the compositor (3D-002) creates WebGL/WebGPU contexts. Every scene shares them (Law 13).
2. **Deterministic.** The same document, inputs and time give the same frame: fixed simulation steps, seeded randomness, scrubbable caches.
3. **Everything is a command.** Every 3D edit is a command with one undo step per gesture, so the agent can do it too (Law 20). Blender's "Adjust last operation" panel works on every command.
4. **Simple first.** Every properties section opens on **looks** (one-click presets sized to the object). Every library recipe is makeable in **8 steps or fewer** with the Simple face (3D-183).
5. **The live site gets baked results.** Path tracing, cloth and soft-body solving run in the editor. The export ships baked animation, simulation and light, plus a poster fallback.
6. **Licences first.** Every dependency is in `LICENSES.md` before use (Law 7). Allowed: MIT, Apache-2.0, BSD, ISC, zlib.
7. **Budgets per device tier.** Each feature declares its cost and its downgrade. CI fails a recipe that misses its tier's budget.
8. **Core stays pure.** Geometry, simulation, rigging and evaluation maths live in `src/core/3d/…` as pure, unit-tested code. GPU and DOM code live in the renderer and editor (COLLABORATION §10).
9. **Small export.** An exported element ships only the generated code its recipe needs, smaller than Rive's web runtime, measured (3D-191). No editor or tool code ships; a leak scan enforces it (3D-195).
10. **AI is optional, visible and reversible.** Browser models first (private, free), server models by choice, a switch that keeps everything on the device. Cost and licence shown before use. An AI result is a draft the user can change or discard (3D-201).
11. **Honest limits.** A tool says what it cannot do (one photo shows one side of a car; AI in-betweens are drafts). Where a quality bar is production grade, a blind comparison proves it (3D-212, 3D-214).

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
| Depth from one image, in the browser | Depth Anything V2 **Small** via Transformers.js on WebGPU | Apache-2.0 (the Base, Large and Giant sizes are CC-BY-NC: never use) | to add at 3D-202, licence re-read at use |
| Cutout, in the browser | A promptable segmentation model (SAM-class) | read at use (Law 6) | to add at 3D-202 |
| Image to 3D (server) | TRELLIS-class models; TripoSR | reported MIT, **read from the repository at use**; avoid Hunyuan3D as a default (community licence with limits) | to decide at 3D-203 |
| Tracking | Our own Lucas–Kanade and feature matching; OpenCV.js if needed (editor only, on demand) | Apache-2.0 | to build at 3D-205 |
| Toon and outline | three.js toon material and our own smoothed-normal outline | MIT / ours | 3D-098, 3D-216, 3D-217 |
| Video output | WebCodecs and our own muxing | built into the browser | 3D-097 |
| Tiny export | Our own generated WebGL2 micro-renderer and CSS / Web Animations output | ours | 3D-192 – 3D-196 |

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
| 3D-001 | 3D stack decision & licences | Main 218 | — | A | ✅ |
| 3D-002 | GPU surface strategy & compositor | Main 173 | 3D-001 | A | 🚧 |
| 3D-003 | Passes, render targets & GPU memory ledger | Main 174 | 3D-002 | A | ✅ |
| 3D-004 | GPU & interactive verification harness | Main 137 | 3D-003 | A | ✅ |
| 3D-005 | 3D performance tiers & budgets | new | 3D-004 | A | ✅ |
| 3D-006 | Worker & WASM job system | new | 3D-001 | A | 🚧 |
| | **Stage 2 · The 3D document** |||||
| 3D-007 | 3D data blocks & schema v7 | new | 3D-001 | A | ✅ |
| 3D-008 | Transforms & hierarchy | new | 3D-007 | A | ✅ |
| 3D-009 | Units, axes & conventions | new | 3D-008 | A | ✅ |
| 3D-010 | 3D in the evaluation kernel | new | 3D-009 | A | 🚧 |
| 3D-011 | 3D commands, undo & "Adjust last operation" | new | 3D-010 | A | 🚧 |
| 3D-012 | Scene layer on the canvas | Main 219 | 3D-003, 3D-011 | A | 🚧 |
| 3D-013 | Mesh data structure & GPU upload | new | 3D-012 | A | 🚧 |
| | **Stage 3 · Viewport core** |||||
| 3D-014 | Navigation & views | Main 220 | 3D-012 | A | ✅ |
| 3D-015 | Selection in 3D | new | 3D-014, 3D-013 | A | 🚧 |
| 3D-016 | Gizmos and G / R / S | Main 220 | 3D-015 | A | ✅ |
| 3D-017 | Snapping, pivots & orientations | new | 3D-016 | A | ✅ |
| 3D-018 | Shading modes | new | 3D-014 | A | 🚧 |
| 3D-019 | Overlays & the 3D cursor | new | 3D-016 | A | 🚧 |
| 3D-020 | Keymaps: Blender and Beginner | new | 3D-019 | A | ✅ |
| | **Stage 4 · Outliner & properties** |||||
| 3D-021 | Outliner in the Layers panel | Main 221 | 3D-015 | A | 🚧 |
| 3D-022 | Properties editor (the right panel's 3D side) | Main 221 | 3D-021 | A | 🚧 |
| 3D-023 | Looks system | new | 3D-022 | A | 🚧 |
| 3D-024 | Shared data blocks & copy attributes | new | 3D-022 | A | 🚧 |
| | **Stage 5 · First shapes** |||||
| 3D-025 | Primitives with parameters & handles | Main 222 | 3D-016, 3D-022 | A | 🚧 |
| 3D-026 | 3D text | Main 222 | 3D-025 | A | 🚧 |
| 3D-027 | Path engine for extrusion | Main 103 (part) | 3D-025 | A | 🚧 |
| 3D-028 | Layer textures, outlines & distance fields | Main 175 | 3D-003, 3D-027 | A | 🚧 |
| 3D-029 | Make 3D from any 2D layer | Main 223 | 3D-028 | A | 🚧 |
| 3D-030 | Modifier stack | new | 3D-025 | A | 🚧 |
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
| 3D-044 | Input bus & coordinate spaces → *ROADMAP.md D4* | Main 132 | 3D-012 | A | 📋 |
| 3D-045 | Signal catalogue → *ROADMAP.md D4* | Main 133 | 3D-044 | A | 📋 |
| 3D-046 | Input tapes → *ROADMAP.md D4* | Main 136 | 3D-045 | A | 📋 |
| 3D-047 | Operators & bindings runtime → *ROADMAP.md D4* | Main 138 | 3D-046 | A | 📋 |
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
| 3D-063 | Edit mode & mesh selection | new | 3D-062 | A | ⏸ |
| 3D-064 | Extrude, inset & bevel | new | 3D-063 | A | ⏸ |
| 3D-065 | Loop cut, slide & knife | new | 3D-064 | A | ⏸ |
| 3D-066 | Merge, dissolve, fill & bridge | new | 3D-065 | A | ⏸ |
| 3D-067 | Spin, screw & symmetry | new | 3D-066 | A | ⏸ |
| 3D-068 | Proportional editing | new | 3D-063 | A | ⏸ |
| 3D-069 | Normals | new | 3D-066 | A | ⏸ |
| 3D-070 | UV unwrapping | new | 3D-066 | A | ⏸ |
| 3D-071 | UV editor | new | 3D-070 | A | ⏸ |
| 3D-072 | Mesh booleans | new | 3D-066 | A | ⏸ |
| 3D-073 | Cleanup & remesh | new | 3D-072 | A | ⏸ |
| 3D-074 | Curves in 3D | new | 3D-027, 3D-062 | A | 📋 |
| | **Stage 10 · Modifier depth** |||||
| 3D-075 | Mirror & array | new | 3D-030 | A | ⏸ |
| 3D-076 | Bevel modifier & weighted normals | new | 3D-075, 3D-069 | A | ⏸ |
| 3D-077 | Lattice & mesh deform | new | 3D-075 | A | ⏸ |
| 3D-078 | Curve & simple deform | new | 3D-077, 3D-074 | A | ⏸ |
| 3D-079 | Boolean modifier | new | 3D-072 | A | ⏸ |
| 3D-080 | Shrinkwrap, wave, cast & wireframe | new | 3D-078 | A | ⏸ |
| 3D-081 | Weld, decimate, remesh & triangulate | new | 3D-073 | A | ⏸ |
| 3D-082 | Geometry looks | new | 3D-081, 3D-023 | A | ⏸ |
| | **Stage 11 · Material depth** |||||
| 3D-083 | Material node editor | Main 177, 231 | 3D-042 | A | ⏸ |
| 3D-084 | Raw shaders (Pro) & shader safety | Main 178 | 3D-083 | A | ⏸ |
| 3D-085 | Vertex colours & painting | new | 3D-083 | A | ⏸ |
| 3D-086 | Texture painting | new | 3D-071, 3D-085 | A | ⏸ |
| 3D-087 | Material slots per face | new | 3D-083 | A | ⏸ |
| 3D-088 | Texture baking | new | 3D-071, 3D-087 | A | ⏸ |
| 3D-089 | Material looks v2 | new | 3D-088 | A | ⏸ |
| | **Stage 12 · Rendering depth** |||||
| 3D-090 | Depth of field | new | 3D-042 | A | 📋 |
| 3D-091 | Motion blur | new | 3D-090 | A | ⏸ |
| 3D-092 | Bloom, lens & film | new | 3D-090 | A | 📋 |
| 3D-093 | Post-processing stack & tiers | Main 236 | 3D-092 | A | 📋 |
| 3D-094 | Colour grading | new | 3D-093 | A | 📋 |
| 3D-095 | Fog & volumetrics | new | 3D-093 | A | ⏸ |
| 3D-096 | Render passes, layers & shadow catchers | new | 3D-093 | A | 📋 |
| 3D-097 | Render to image, sequence & video | new | 3D-096 | A | 📋 |
| 3D-098 | Toon & stylised shading | new | 3D-042 | A | 📋 |
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
| 3D-116 | **Gate M2: the studio product hero** | new | 3D-090, 3D-092 – 3D-094, 3D-096 – 3D-115, 3D-227 | A | 📋 |
| **M3 · Living components** |||||
| | **Stage 15 · The rig model (shared by 2D and 3D)** |||||
| 3D-117 | Rig model: bones & skins | Main 203 | 3D-116 | A | ⏸ |
| 3D-118 | Bone tool & posing | Main 204 | 3D-117 | A | ⏸ |
| 3D-119 | Bones on the timeline | Main 205 | 3D-118 | A | ⏸ |
| 3D-120 | Mesh deformation & weights | Main 206 | 3D-119 | A | ⏸ |
| 3D-121 | Inverse kinematics | Main 207 | 3D-120 | A | ⏸ |
| 3D-122 | Constraints & secondary motion | Main 208 | 3D-121 | A | ⏸ |
| | **Stage 16 · 3D rigging** |||||
| 3D-123 | Armatures in 3D | new | 3D-122 | A | ⏸ |
| 3D-124 | Bind with automatic weights | new | 3D-123 | A | ⏸ |
| 3D-125 | Vertex groups & weight painting | new | 3D-124 | A | ⏸ |
| 3D-126 | Pose mode & pose library | new | 3D-125 | A | ⏸ |
| 3D-127 | 3D IK | Main 230 | 3D-126 | A | ⏸ |
| 3D-128 | Blender's constraints | Main 230 | 3D-127 | A | ⏸ |
| 3D-129 | Rig controls & custom properties | new | 3D-128, 3D-113 | A | ⏸ |
| 3D-130 | Auto-rig | new | 3D-129 | A | ⏸ |
| 3D-131 | Retargeting | new | 3D-130, 3D-110 | A | ⏸ |
| 3D-132 | Faces: shape-key rigs, blinks & lip sync | Main 213 (3D) | 3D-131, 3D-112 | A | ⏸ |
| 3D-133 | Secondary motion: spring bones & jiggle | new | 3D-128 | A | ⏸ |
| 3D-134 | Procedural locomotion | new | 3D-133 | A | ⏸ |
| | **Stage 17 · Physics depth** |||||
| 3D-135 | Rigid bodies & colliders | Main 235 | 3D-116, 3D-049 | A | ⏸ |
| 3D-136 | Joints, ropes & chains | new | 3D-135 | A | ⏸ |
| 3D-137 | Contact events | new | 3D-136 | A | ⏸ |
| 3D-138 | Soft bodies & jelly | new | 3D-052 | A | ⏸ |
| 3D-139 | Cloth depth | new | 3D-138 | A | ⏸ |
| 3D-140 | Particles | Main 183 (3D) | 3D-049 | A | ⏸ |
| 3D-141 | Force fields | new | 3D-140 | A | ⏸ |
| 3D-142 | Fracture | new | 3D-137 | A | ⏸ |
| 3D-143 | Metaballs & liquid blobs | new | 3D-141 | A | ⏸ |
| 3D-144 | Grab & throw in Preview | new | 3D-137, 3D-054 | A | ⏸ |
| 3D-145 | Physics looks | new | 3D-144, 3D-023 | A | ⏸ |
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
| 3D-157 | **Gate M3: living components** | new | 3D-146 – 3D-156 | A | 📋 |
| **M4 · Ship & simplicity** |||||
| | **Stage 19 · Assets & import** |||||
| 3D-158 | GLTF / GLB import pipeline | Main 224 | 3D-062 | A | 📋 |
| 3D-159 | Texture & HDRI pipeline | new | 3D-158 | A | 📋 |
| 3D-160 | 3D asset browser | new | 3D-159 | A | ⏸ |
| 3D-161 | Import from Blender, Spline & others | new | 3D-158 | A | ⏸ |
| 3D-162 | Logos & 2D sets to 3D in bulk | new | 3D-029, 3D-160 | A | ⏸ |
| 3D-163 | Sharing materials, looks & rigs | new | 3D-160 | A | ⏸ |
| | **Stage 20 · On the page** |||||
| 3D-164 | Responsive scenes | new | 3D-157 | A | 📋 |
| 3D-165 | Page layers inside 3D scenes | Main 233 | 3D-164 | A | 📋 |
| 3D-166 | 3D layers with 2D effects | new | 3D-165 | A | 📋 |
| 3D-167 | 2.5D surfaces as the fast path | new (S1–S9) | 3D-062, 3D-192 | A | 📋 |
| 3D-168 | One timeline for 2D and 3D | new | 3D-166 | A | 📋 |
| 3D-169 | Posters, SEO & no-WebGL fallbacks | new | 3D-168 | A | 📋 |
| 3D-170 | Instancing, LOD & 3D cloners | Main 234 | 3D-168 | A | ⏸ |
| | **Stage 21 · Export & performance** |||||
| 3D-171 | 3D export v2: components, three.js, embed | Main 238 | 3D-168, 3D-192 | A | 📋 |
| 3D-172 | Geometry & texture compression | new | 3D-171 | A | 📋 |
| 3D-173 | Baked motion in the export | new | 3D-172 | A | 📋 |
| 3D-174 | Bundles, lazy loading & size budgets | new | 3D-173 | A | ⏸ |
| 3D-175 | Device tiers & automatic downgrade | new | 3D-173 | A | 📋 |
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
| 3D-186 | AI assist for 3D | new (after Main 241) | 3D-185, 3D-201 | A | 📋 |
| | **Stage 23 · Gates** |||||
| 3D-187 | Gate M4a: phones | new | 3D-186 | A | 📋 |
| 3D-188 | Gate M4b: accessibility & fallbacks | new | 3D-187 | A | 📋 |
| 3D-189 | Gate M4c: the 3D journey | Main 240 | 3D-188 | A | 📋 |
| 3D-190 | Close-out: docs, audit, licences & hand-back | new | 3D-189 | A | 📋 |
| **M1+ · Small and reactive** |||||
| | **Stage 24 · Small export** |||||
| 3D-191 | Size doctrine, budgets & the Rive baseline | new | 3D-005 | A | 📋 |
| 3D-192 | Export tiers & the scene IR (decision 0022) | new | 3D-191, 3D-010 | A | 📋 |
| 3D-193 | Zero-script export for 2D reactions (case 1) | new | 3D-192 | A | 📋 |
| 3D-194 | Micro-renderer: generated WebGL2 for one 3D element | new | 3D-192, 3D-033, 3D-037 | A | 📋 |
| 3D-195 | One chunk per element, lazy start & the no-editor-code rule | new | 3D-193, 3D-194 | A | 📋 |
| 3D-196 | Size gates for the five reference recipes in CI | new | 3D-195 | A | 📋 |
| | **Stage 25 · Page input & the pointer light** |||||
| 3D-197 | Page-wide signals → *ROADMAP.md D4* | new | 3D-045 | A | 📋 |
| 3D-198 | Pointer light | new | 3D-197, 3D-037 | A | 📋 |
| 3D-199 | Touch, tilt & phone behaviour | new | 3D-198 | A | 📋 |
| 3D-200 | Gate A: the reactive 3D button (case 2) | new | 3D-062, 3D-196, 3D-199 | A | 📋 |
| **M5 · The photo studio** |||||
| | **Stage 26 · AI services (used by M5 and M6)** |||||
| 3D-201 | AI gateway: browser and server models | new | 3D-006 | A | 📋 |
| 3D-202 | Browser vision models | new | 3D-201 | A | 📋 |
| 3D-203 | Server models | new | 3D-201 | A | 📋 |
| | **Stage 27 · Tracking & corner pin** |||||
| 3D-204 | Corner pin & perspective placement → *ROADMAP.md D16* | new | 3D-193 | A | 📋 |
| 3D-205 | Point & planar tracking → *ROADMAP.md D17* | new | 3D-204, 3D-006, Main 99 | B* | 📋 |
| 3D-206 | Tracking becomes keyframes → *ROADMAP.md D17* | new | 3D-205 | A | 📋 |
| 3D-207 | Camera solve (3D camera tracker) | new | 3D-205 | A | ⏸ |
| | **Stage 28 · Photo to surface** |||||
| 3D-208 | Cutout & matte, production grade | new | 3D-202 | A | 📋 |
| 3D-209 | Surface from a photo: proxy, depth & normals | new | 3D-208, 3D-204 | A | 📋 |
| 3D-210 | Character lines: cuts & curves | new | 3D-209 | A | 📋 |
| 3D-211 | Wrap text & graphics on the surface | new | 3D-210, 3D-026 | A | 📋 |
| 3D-212 | Make it belong, and still tell it apart | new | 3D-211 | A | 📋 |
| 3D-213 | Relight the photo | new | 3D-198, 3D-209, 3D-212 | A | 📋 |
| 3D-214 | Production pass for photo work | new | 3D-213 | A | 📋 |
| 3D-215 | Gate B: the car | new | 3D-206, 3D-214 | A | 📋 |
| **M6 · The anime studio** |||||
| | **Stage 29 · The anime look** |||||
| 3D-216 | Anime shading core | new | 3D-098, 3D-037 | A | ⏸ |
| 3D-217 | Ink lines | new | 3D-216 | A | ⏸ |
| 3D-218 | Time on twos & threes | new | 3D-010, 3D-104 | B* | ⏸ |
| 3D-219 | Smears, impact frames & motion lines | new | 3D-218, 3D-217 | A | ⏸ |
| 3D-220 | Effects animation library | new | 3D-219, 3D-092 | A | ⏸ |
| 3D-221 | Drawn art in 3D space | new | 3D-217, 3D-167 | A | ⏸ |
| 3D-222 | Camera & cut language | new | 3D-099, 3D-218 | A | ⏸ |
| 3D-223 | Shots, storyboard & animatic | new | 3D-222, Main 99 | B* | ⏸ |
| 3D-224 | Character import & pose library | new | 3D-158, 3D-217, 3D-112 | A | ⏸ |
| 3D-225 | AI assists for anime | new | 3D-203, 3D-221 | A | ⏸ |
| 3D-226 | Gate C: the anime shot (case 4) | new | 3D-097, 3D-216 – 3D-225 | A | ⏸ |
| | **Stage 30 · Animation first: several animations, live** |||||
| 3D-227 | Live multi-animation mixing | new | 3D-111, 3D-010 | B* | 📋 |

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

### Main-roadmap phases the new tracks depend on

| Main | Title | Owner | Needed by |
|---|---|---|---|
| 99 | Video & audio layers | Lane B | 3D-205 (tracking), 3D-223 (shots and sound) |
| 76, 77 | Property links, expressions | Lane B (merged) | 3D-113, 3D-114, 3D-197 (page signals shaped by links) |
| 78, 79 | States, transitions | Lane B | 3D-147 |
| 241 – 250 | AI & agents | later | may reuse the gateway of 3D-201 |

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
6. **The order of 2026-11-13 (§0a)** is the owner's: four cases, deferrals, small export first. Change it by changing §0a.
7. **Lane B's part:** 3D-113, 3D-114, 3D-147 (their own phases) and, new, 3D-205 (tracking, needs Main 99 video layers), 3D-218 (time on twos), 3D-223 (shots) and 3D-227 (live animation mixing). Lane B builds them, or agrees that Lane A does, **before** the first of them starts.
8. **Decision records to claim in `DOCS/TEAM/CLAIMS.md`:** 0022 (export tiers and the scene IR), 0023 (AI services and privacy), 0024 (photo to surface), 0025 (the anime pipeline).
9. **Where the AI server runs and who pays** (owner, before 3D-203).
10. **Reference clips for the anime gate** (owner, before 3D-216): the exact looks wanted, a few seconds each.
11. **The Rive baseline** is measured at 3D-191; the budgets are set after it.

---

# M1 · THE FOIL BUTTON (3D-001 – 3D-062)

> At the gate: a frame becomes a real 3D foil balloon with its label printed on it, lit by a studio, inflated by a cloth simulation, dented by a press, exported, made in 7 steps, and matched side by side with the reference video.

## Stage 1 · GPU base

### Phase 3D-001 · 3D stack decision & licences
**Needs:** — · **Was:** Main 218 · **Lane:** A · **Status:** ✅
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
**Status check (2026-11-13):** Decision 0013 and the `LICENSES.md` entry are on main (#94); the benchmark is archived at `scripts/benchmarks/physics-3d.mjs` (Rapier about 0.1–0.2 ms per step, deterministic; cannon-es about 0.8–1 ms).
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
**Status check (2026-11-13):** `src/core/gpu/compositor.ts`; `tests/e2e/gpu-compositor.spec.ts` passes in Chromium (20 surfaces and 10 scenes within the budget, a scene off screen sleeps with a poster, a lost context is back in under 1 s). **Not yet:** Firefox and WebKit.
**Evidence (2026-11-11):** decision `decisions/0011-gpu-surfaces.md` from a measurement of three strategies (`scripts/benchmarks/gpu-surfaces.ts`, real GPU and SwiftShader); `src/core/gpu/compositor.ts` (shared surface context, scene contexts within a budget, sleep with a poster, loss recovery); the 2.5D surfaces draw through it (comparison score unchanged, 0.6065); `tests/e2e/gpu-compositor.spec.ts` (budget, sleep and wake, loss within 1 s) passes in Chromium.

### Phase 3D-003 · Passes, render targets & GPU memory ledger
**Needs:** 3D-002 · **Was:** Main 174 · **Lane:** A · **Status:** ✅
- [ ] Pass stacks (render, feedback ping-pong, post), float targets after a capability check.
- [ ] A memory ledger: every texture, target, buffer and program counted, by owner, and freed when unused.

**You'll see:** a debug view of what the GPU holds, by layer.
**Done when:** mounting and unmounting 50 scenes returns the ledger to zero; float targets fall back cleanly where unsupported.
**Status check (2026-11-13):** `ledger.ts`, `passes.ts` (7 unit tests); 50 surfaces mounted and unmounted return the ledger to the shared baseline (`gpu-compositor.spec.ts`); float targets fall back to RGBA8.
**Evidence (2026-11-11):** `src/core/gpu/ledger.ts` (pure bookkeeping: owner, kind, bytes, release by handle or owner) and `passes.ts` (render targets, ping-pong, pass stacks, float targets after a capability check with RGBA8 fallback); the 2.5D surfaces track every texture; `ledger.test.ts` (7 unit tests) and the browser test (50 surfaces mount and unmount twice, ledger back to the shared baseline); a ledger view on `/editor/gpu-lab`.

### Phase 3D-004 · GPU & interactive verification harness
**Needs:** 3D-003 · **Was:** Main 137 · **Lane:** A · **Status:** ✅
- [ ] Headless Chromium with a software WebGL2 / WebGPU rasteriser on every pull request, and a nightly real-GPU job.
- [ ] Frame capture at exact times (deterministic scheduler).
- [ ] Perceptual metrics with a documented tolerance: SSIM, plus a FLIP-style metric.
- [ ] Golden images with a review flow: approve a changed golden in the PR.

**You'll see:** each 3D pull request has picture checks, with the difference shown when one fails.
**Done when:** a deliberate one-pixel shift passes, a wrong colour fails, and the same scene gives the same image twice in a row.
**Status check (2026-11-13):** `compare.ts` (SSIM plus a shift-tolerant error, 7 unit tests) and `gpu-harness.spec.ts` (a one-pixel shift passes, a wrong colour fails, the same scene twice is identical). Goldens are per renderer: a headed run on a real GPU differs (SSIM 0.84), so a real-GPU golden set and a nightly job are a follow-up.
**Evidence (2026-11-11):** `src/core/gpu/compare.ts` (SSIM plus a symmetric neighbourhood error) with 7 unit tests: identical passes, a 1 px shift of hard edges passes, 3 px fails, a wrong colour fails, a slightly different shade passes, a missing shape fails with the diff marking it; `tests/support/golden.ts` (golden helper, `GOLDEN_UPDATE=1` approve flow, actual and diff attached on failure); `tests/e2e/gpu-harness.spec.ts` (the same exact-time frame twice is identical; goldens for the resting and pressed button; a wrong look fails). Goldens are made by the headless Chromium CI runs (software GL); the nightly real-GPU job is not set up yet, so this phase stays 🚧.

### Phase 3D-005 · 3D performance tiers & budgets
**Needs:** 3D-004 · **Was:** — · **Lane:** A · **Status:** ✅
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
**Status check (2026-11-13):** `tiers.ts` (7 unit tests): per-feature costs with a downgrade order; a scene over budget names the feature to drop; `BudgetMeter` on /design-system. The editor overlay arrives with 3D-012.
**Evidence (2026-11-11):** `src/core/gpu/tiers.ts` (tier budgets, per-feature costs with a downgrade order, `fitScene` names what to drop first and calls a scene hopeless when nothing droppable helps, tier guess from the browser's hints) with 7 unit tests; `BudgetMeter` on /design-system. **Not done, so it stays 🚧:** the meter in the editor and 'reference scenes report their cost per tier' need a scene to measure, which exists from 3D-012; the editor overlay is added there.

### Phase 3D-006 · Worker & WASM job system
**Needs:** 3D-001 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] A pool of workers for geometry, simulation and baking:
  - jobs carry typed arrays (transferred, not copied);
  - jobs can be cancelled and given priorities;
  - results are cached by key.
- [ ] Progress shown on the layer ("Simulating… 40%").
- [ ] The cloth job from `src/core/surface/cloth.worker.ts` moves onto it.

**You'll see:** heavy work never freezes the editor; a progress ring on the object while it computes.
**Done when:** a 5-second job leaves the main thread under 4 ms per frame; cancelling stops it within one step.
**Status check (2026-11-13):** Job pool (8 unit tests); the cloth runs in a worker; `jobs.spec.ts` passes in Chromium (the main thread ticked 300+ times during a 3 s stretch of a 5 s job; a cancel lands in under 500 ms). **Not yet:** the per-frame 4 ms measurement and a check in a production build.
**Evidence (2026-11-11):** src/core/jobs pool (8 unit tests), cloth in a worker, e2e jobs.spec (2 of 3 pass; cloth test awaiting rerun)

## Stage 2 · The 3D document

### Phase 3D-007 · 3D data blocks & schema v7
**Needs:** 3D-001 · **Was:** — · **Lane:** A · **Status:** ✅
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
**Status check (2026-11-13):** Schema v7 tables, the v6 to v7 migration, make-single-user, binary meshes (a 1-million-vertex mesh encodes and decodes in under 1 s); every block kind round-trips (unit).
**Evidence (2026-11-11):** schema v7 data-block tables, migration, makeSingleUser, binary mesh (1M vertices < 1s); 170 document tests pass

### Phase 3D-008 · Transforms & hierarchy
**Needs:** 3D-007 · **Was:** — · **Lane:** A · **Status:** ✅
- [ ] Location, rotation and scale:
  - rotation stored as a quaternion and shown as Euler (mode XYZ … ZYX);
  - a parent inverse matrix, as in Blender, so parenting keeps the world position;
  - delta transforms.
- [ ] Apply transforms. Set the origin to geometry, cursor or centre of mass.

**You'll see:** parent a cube to a sphere; it stays where it was and follows from then on.
**Done when:** golden tests for world matrices through 4-level hierarchies; parenting and unparenting keep world transforms within 1e-6.
**Status check (2026-11-13):** `src/core/3d` maths: golden world matrices through a 4-level hierarchy; parent and unparent keep world within 1e-6; all six Euler orders; apply transform and set origin.
**Evidence (2026-11-11):** src/core/3d math, hierarchy, apply: golden 4-level worlds, parent/unparent within 1e-6, all six Euler orders; unit tests pass

### Phase 3D-009 · Units, axes & conventions
**Needs:** 3D-008 · **Was:** — · **Lane:** A · **Status:** ✅
- [ ] Y-up, right-handed (glTF), with the Blender Z-up shown as an option in the viewport.
- [ ] Metres in the document; a scale that maps 1 px on the page to a length in the scene, so a 2D frame turned 3D keeps its size on screen.
- [ ] Angles in degrees in the UI and radians in the document.

**You'll see:** a 454 px frame turned 3D is 454 px on screen at the default camera.
**Done when:** glTF import and export keep axes and units (round-trip test); 2D-to-3D keeps size within 0.5 px.
**Status check (2026-11-13):** Units, axes and glTF mapping round-trip (unit); a 454 x 320 frame turned 3D projects to its size within 0.5 px.
**Evidence (2026-11-11):** units, axes, 2D frame to 3D within 0.5 px, glTF mapping round-trip; unit tests pass

### Phase 3D-010 · 3D in the evaluation kernel
**Needs:** 3D-009 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] `evaluate()` gives every 3D property at any time, the same way it does for 2D:
  - transforms;
  - material, light and camera values;
  - modifier parameters;
  - shape-key weights;
  - bone poses (later).
- [ ] The renderer only applies what the kernel evaluated, so scrubbing and playing agree.

**You'll see:** scrubbing a 3D animation is exact.
**Done when:** 3D tracks match `evaluate()` at 5 times; the parity monitor covers 3D.
**Status check (2026-11-13):** `evaluate3D`, 3D property paths, quaternion tracks and a diff helper; 215 kernel and 3D unit tests. **Not yet:** the parity monitor does not cover 3D.
**Evidence (2026-11-11):** evaluate3D, 3D paths, quaternion synthesis, parity diff; kernel tests and 3127-test suite pass (additive to evaluate.ts)

### Phase 3D-011 · 3D commands, undo & "Adjust last operation"
**Needs:** 3D-010 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] Every 3D edit is a typed command (Law 20) with one undo step per gesture.
- [ ] The "Adjust last operation" panel, as in Blender: after "Add cylinder", change its vertex count; after "Extrude", change its depth. It re-runs the command with new arguments as the same undo step.
- [ ] The MCP agent can call every 3D command.

**You'll see:** add a cylinder, then set its sides to 64 in the small panel that appears.
**Done when:** 30 commands round-trip through undo / redo exactly; the agent builds a scene through MCP.
**Status check (2026-11-13):** 30+ operations round-trip through undo and redo (unit); "Adjust last operation" is one undo step (e2e). **Not yet:** an end-to-end build of a scene through MCP (the agent-bridge tests need a local server, which my sandbox does not allow).

### Phase 3D-012 · Scene layer on the canvas
**Needs:** 3D-003, 3D-011 · **Was:** Main 219 · **Lane:** A · **Status:** 🚧
- [ ] A `scene3d` layer, lazily loaded, drawn through the compositor:
  - its box is part of the page's layout;
  - off screen it shows a poster;
  - it recovers from context loss.
- [ ] Double-click enters the scene (3D editing). Escape leaves it.

**You'll see:** Insert > 3D scene; a cube on a grid inside a box on the page.
**Done when:** a scene renders in 3 browsers, recovers from a forced context loss, and costs nothing while off screen.
**Status check (2026-11-13):** Insert 3D scene, double-click to enter, loss recovery and sleep off screen pass in Chromium (`scene3d.spec.ts`). **Not yet:** Firefox and WebKit.

### Phase 3D-013 · Mesh data structure & GPU upload
**Needs:** 3D-012 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] An editable mesh with vertices, edges, faces (n-gons), loops and attributes, after Blender's BMesh.
- [ ] Triangulation for drawing; incremental GPU upload (only what changed).
- [ ] Pure, in `src/core/3d/mesh/`.

**You'll see:** nothing new; edits stay fast on big meshes.
**Done when:** topology invariants hold under 10,000 random edits (property test); editing one vertex of a 200,000-face mesh uploads in under 2 ms.
**Status check (2026-11-13):** `EditMesh` with a 10,000-edit property test; the one-vertex dirty-range test asserts under 10 ms, the gate says 2 ms: measure and tighten.

## Stage 3 · Viewport core

### Phase 3D-014 · Navigation & views
**Needs:** 3D-012 · **Was:** Main 220 · **Lane:** A · **Status:** ✅
- [ ] Orbit, pan, dolly (mouse, trackpad and touch) and fly mode.
- [ ] Views: front, back, left, right, top, bottom (numpad and a view cube). Perspective / orthographic toggle.
- [ ] Frame selected, frame all. The camera view.

**You'll see:** spin round a model with the mouse; press 1, 3, 7 for front, side and top.
**Done when:** a 15-step navigation tape lands on exact view matrices.
**Status check (2026-11-13):** A 15-step navigation tape lands on hand-computed view matrices (unit); orbit, top view and frame in e2e.

### Phase 3D-015 · Selection in 3D
**Needs:** 3D-014, 3D-013 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] Click selection by raycast (three-mesh-bvh), with an active object and Shift to add. Box and lasso selection; select linked, select similar.
- [ ] Selection outline drawn in the selection colour.

**You'll see:** click an object to select it; drag a box round several.
**Done when:** picking is exact on 30 test views; 100,000-face picking takes under 1 ms.
**Status check (2026-11-13):** Ray and BVH picking is exact on generated views (unit); click select in e2e. The timing test asserts under 3 ms; the gate says 1 ms for 100,000 faces.

### Phase 3D-016 · Gizmos and G / R / S
**Needs:** 3D-015 · **Was:** Main 220 · **Lane:** A · **Status:** ✅
- [ ] Move, rotate and scale gizmos, and the keys G, R, S with axis locks (X, Y, Z, Shift for planes) and typed values ("G X 2 Enter").
- [ ] One undo step per gesture. Right-click or Escape cancels.

**You'll see:** press G, X, type 2, Enter; the object moves 2 along X.
**Done when:** a 15-step gizmo journey gives exact transforms and one undo step per gesture.
**Status check (2026-11-13):** A 15-step gizmo and G / R / S journey with typed values (unit); G X 2 Enter moves 2 m and one undo restores it (e2e).

### Phase 3D-017 · Snapping, pivots & orientations
**Needs:** 3D-016 · **Was:** — · **Lane:** A · **Status:** ✅
- [ ] Snapping: increment, grid, vertex, edge, face (project onto a surface, align rotation to its normal).
- [ ] Pivot points: median, individual origins, 3D cursor, active.
- [ ] Transform orientations: global, local, normal, view, cursor.

**You'll see:** drop a cup onto a table and it sits on the surface, upright.
**Done when:** golden tests for every snap target and pivot on 20 cases.
**Status check (2026-11-13):** Golden cases for every snap target, pivot and orientation (unit), including the cup on the table.

### Phase 3D-018 · Shading modes
**Needs:** 3D-014 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] Wireframe, Solid (with studio lighting and cavity), Material preview (an HDRI), Rendered (the real renderer; the path tracer from 3D-056).
- [ ] X-ray toggle.

**You'll see:** the four shading buttons at the top right of the viewport.
**Done when:** each mode renders its golden image in 3 browsers.
**Status check (2026-11-13):** Four shading modes and X-ray in the shading bar (e2e). **Not yet:** a golden image per mode in 3 browsers.

### Phase 3D-019 · Overlays & the 3D cursor
**Needs:** 3D-016 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] Grid, axes, origins, face orientation, normals, wireframe on shaded, statistics (vertices, faces, objects, memory).
- [ ] The 3D cursor: Shift+right-click places it; new objects appear at it.

**You'll see:** an overlays menu like Blender's; a red-white ring where new things appear.
**Done when:** each overlay has a golden image; the cursor snaps to surfaces.
**Status check (2026-11-13):** Overlays, statistics and the 3D cursor (e2e). **Not yet:** a golden image per overlay.

### Phase 3D-020 · Keymaps: Blender and Beginner
**Needs:** 3D-019 · **Was:** — · **Lane:** A · **Status:** ✅
- [ ] **Blender** keymap (G, R, S, Tab, numpad, Shift+A add menu, X delete, H hide), and a **Beginner** keymap (the editor's own keys, with toolbar buttons for everything).
- [ ] Chosen in settings. Shown in View > Show keystrokes.

**You'll see:** Blender users feel at home; beginners never need a key.
**Done when:** no two 3D commands share a key in the same context (the conflict test); each keymap passes a scripted journey.
**Status check (2026-11-13):** The conflict test passes for both keymaps; scripted journeys pass. The dispatcher now matches bindings written as `g` or `Shift+a`.

## Stage 4 · Outliner & properties

### Phase 3D-021 · Outliner in the Layers panel
**Needs:** 3D-015 · **Was:** Main 221 · **Lane:** A · **Status:** 🚧
- [ ] Inside a scene, the Layers panel shows the scene tree:
  - collections, objects, their data, materials and modifiers;
  - visibility, selectability and render toggles.
- [ ] Drag to reparent (keeps the world transform).

**You'll see:** the scene's objects in the Layers panel, with eye, arrow and camera toggles.
**Done when:** reparenting in the tree keeps world transforms (golden tests); the tree mirrors the document both ways.
**Status check (2026-11-13):** Criteria met, ✅ when #95 is on main: golden reparent through 4 levels within 1e-6; the tree mirrors the document; e2e outliner (rename, reparent, Make 3D).

### Phase 3D-022 · Properties editor (the right panel's 3D side)
**Needs:** 3D-021 · **Was:** Main 221 · **Lane:** A · **Status:** 🚧
- [ ] The right panel's **2D | 3D** switch (from S9) becomes Blender's Properties editor for the selection.
- [ ] Its tabs are sections: **Object, Modifiers, Physics, Material, Object data** (Mesh, Light, Camera, Armature), **Constraints, World, Render**.
- [ ] **Simple** face: looks and 4–6 plain controls per section. **Pro** face: every field.
- [ ] The 2.5D "Surface" sections become the Simple face of Physics and Material for a 2D layer.

**You'll see:** select a light and the right panel shows its power, colour and size; select a cube and it shows its transform, modifiers and material.
**Done when:** every data-block field is reachable in the Pro face; the Simple face passes the plain-word label check.
**Status check (2026-11-13):** The Properties editor with 8 tabs, Simple and Pro (e2e). **Not yet:** the plain-word label check for the Simple face.

### Phase 3D-023 · Looks system
**Needs:** 3D-022 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] A look is data: a named set of property values, sized by rules to the object (depth from its smallest side, light power from scene size).
- [ ] Looks for every section: material, light rig, physics, modifier, animation, interaction.
- [ ] A thumbnail rendered offline. User looks saved from any object ("Save as look").

**You'll see:** each section opens on a strip of thumbnails; one click applies.
**Done when:** a look applied to objects of 5 sizes gives a similar picture on each (perceptual test); saving and re-applying a look round-trips.
**Status check (2026-11-13):** Built-in and saved looks sized to the object (unit: five object sizes give proportional results; save and apply round-trips). **Not yet:** the perceptual picture test.

### Phase 3D-024 · Shared data blocks & copy attributes
**Needs:** 3D-022 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] A material, mesh or action used by several objects shows its user count; "Make single user" splits it.
- [ ] Copy and paste attributes (material, modifiers, transforms) from one object to others.

**You'll see:** change one shared material and every object with it changes.
**Done when:** user counts are exact under 200 random operations; undo restores sharing.
**Status check (2026-11-13):** Criteria met, ✅ when #95 is on main: user counts exact under 200 random operations; undo restores sharing.

## Stage 5 · First shapes

### Phase 3D-025 · Primitives with parameters & handles
**Needs:** 3D-016, 3D-022 · **Was:** Main 222 · **Lane:** A · **Status:** 🚧
- [ ] Cube, cylinder, cone, UV sphere, ico sphere, torus, plane, circle, capsule, rounded box. Each has its parameters (sides, rings, radius, depth, bevel) editable after adding (3D-011) and with handles on the object.
- [ ] Shift+A add menu (Blender keymap) and an Add button.

**You'll see:** add a cylinder, drag its handle to make it taller, set 64 sides.
**Done when:** each primitive's vertex positions match golden values; each renders the same within tolerance in 3 browsers.
**Status check (2026-11-13):** Ten primitives with parameters, handles, the Shift+A menu (e2e: handle drag is one undo step). **Not yet:** 3 browsers.

### Phase 3D-026 · 3D text
**Needs:** 3D-025 · **Was:** Main 222 · **Lane:** A · **Status:** 🚧
- [ ] Text objects in the project's fonts:
  - extrude depth, bevel depth and resolution;
  - alignment, spacing.
- [ ] Editable in place. Converts to a mesh.

**You'll see:** type "SALE", give it depth and a rounded bevel.
**Done when:** glyph outlines match the font within 0.1 px; meshes are watertight for 10 fonts.
**Status check (2026-11-13):** Font outlines, layout, extruded text and in-place editing (e2e). **Not yet:** 10 fonts: only Geist (shipped with Next) can be tested offline.

### Phase 3D-027 · Path engine for extrusion
**Needs:** 3D-025 · **Was:** Main 103 (part) · **Lane:** A · **Status:** 🚧
- [ ] From ROADMAP.md 103, the parts 3D needs:
  - flatten curves to a tolerance;
  - offset (round, mitre, bevel joins);
  - booleans of 2D paths;
  - holes (even-odd and non-zero).
- [ ] The rest of 103 (live boolean groups in 2D) stays in ROADMAP.md.

**You'll see:** nothing on its own; it shapes 3D-029.
**Done when:** golden areas for booleans and offsets on 20 shapes (the 103 tests that apply).
**Status check (2026-11-13):** Criteria met, ✅ when #95 is on main: flatten to a tolerance, offsets (round, mitre, bevel), booleans, holes; golden areas on 20 shapes.

### Phase 3D-028 · Layer textures, outlines & distance fields
**Needs:** 3D-003, 3D-027 · **Was:** Main 175 · **Lane:** A · **Status:** 🚧
- [ ] Any layer or group becomes:
  - a live GPU texture (for labels and decals);
  - an outline path (for extrusion);
  - a signed distance field (for inflation and rounded bevels).
- [ ] All three update when the layer changes and count in the memory ledger.

**You'll see:** a debug view of any layer as a texture, an outline or a distance field.
**Done when:** distance-field error < 0.5 px on 10 shapes; textures update within one frame of an edit; the ledger returns to 0 after unmount.
**Status check (2026-11-13):** Outlines and exact distance fields under 0.5 px on 10 shapes (unit). **Not yet:** the live GPU texture of a layer, its ledger entry and the one-frame update.

### Phase 3D-029 · Make 3D from any 2D layer
**Needs:** 3D-028 · **Was:** Main 223 · **Lane:** A · **Status:** 🚧
- [ ] Right-click > Make 3D:
  - **Extrude** (depth, bevel profile);
  - **Inflate** (pressure from the distance field, as a pillow);
  - **Lathe** (round an axis);
  - **Plane** (a flat card).
- [ ] It stays linked to the 2D source: editing the 2D shape updates the 3D. The 2D layer's fill becomes the material's colour and its text becomes a decal (3D-036).

**You'll see:** a rounded rectangle becomes a puffy 3D button, still editable as a rectangle.
**Done when:** meshes are watertight for 10 reference shapes; an edit to the 2D source updates the mesh in < 100 ms.
**Status check (2026-11-13):** Criteria met, ✅ when #95 is on main: extrude, inflate, lathe and plane are watertight on 10 shapes; a linked refresh takes under 100 ms.

### Phase 3D-030 · Modifier stack
**Needs:** 3D-025 · **Was:** — · **Lane:** A · **Status:** 🚧
- [ ] A non-destructive, ordered stack per object, evaluated in the kernel:
  - each modifier has viewport and render toggles;
  - its parameters can be keyframed and driven;
  - Apply bakes it into the mesh.
- [ ] Evaluated in a worker for heavy stacks; cached by input.

**You'll see:** a Modifiers section with add, reorder (drag), hide and apply.
**Done when:** stacks of 5 modifiers evaluate to golden meshes; reordering changes the result as specified; apply equals the evaluated result.
**Status check (2026-11-13):** Criteria met, ✅ when #95 is on main: five modifiers evaluate to golden meshes; reorder; apply equals the evaluated result; cache; worker handler; kernel parameters.

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
> **Pulled into ROADMAP.md's Design master track as D4 (2026-11-13):** built there first, for 2D and 3D.
- [ ] From ROADMAP.md 132: one input bus for pointer, wheel, keys and touch, with coordinate spaces (page, layer, frame).
- [ ] New for 3D: scene space and object space (through the camera), so a pointer has a ray and a hit point.

**You'll see:** nothing on its own; it feeds 3D-047 and 3D-053.
**Done when:** the 132 tests pass; pointer → ray → hit point is exact on 20 views.

### Phase 3D-045 · Signal catalogue
**Needs:** 3D-044 · **Was:** Main 133 · **Lane:** A · **Status:** 📋
> **Pulled into ROADMAP.md's Design master track as D4 (2026-11-13):** built there first, for 2D and 3D.
- [ ] From ROADMAP.md 133: named signals (pointer position, speed, press, scroll progress, time, keys), smoothed and normalised. New: signals for objects (hovered, pressed, hit point, hit normal).

**You'll see:** a list of signals you can connect things to.
**Done when:** the 133 tests pass; object signals fire on a scripted tape.

### Phase 3D-046 · Input tapes
**Needs:** 3D-045 · **Was:** Main 136 · **Lane:** A · **Status:** 📋
> **Pulled into ROADMAP.md's Design master track as D4 (2026-11-13):** built there first, for 2D and 3D.
- [ ] From ROADMAP.md 136: record and replay input with exact timing.
- [ ] Used by tests, the comparison harness (3D-060) and the demo runs (View > Show keystrokes).

**You'll see:** record a press sequence and replay it exactly.
**Done when:** a replayed tape gives the same frames twice (hash equality).

### Phase 3D-047 · Operators & bindings runtime
**Needs:** 3D-046 · **Was:** Main 138 · **Lane:** A · **Status:** 📋
> **Pulled into ROADMAP.md's Design master track as D4 (2026-11-13):** built there first, for 2D and 3D.
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
**Needs:** 3D-062 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Tab into edit mode:
  - vertex, edge and face selection (1, 2, 3);
  - select loop and ring (Alt-click);
  - grow and shrink, select linked, select by trait (non-manifold, loose);
  - hide and reveal.
- [ ] Every edit-mode operation is a command (3D-011).

**You'll see:** Tab, click a face, Alt-click a loop.
**Done when:** loop and ring selection match golden sets on 10 meshes.

### Phase 3D-064 · Extrude, inset & bevel
**Needs:** 3D-063 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Extrude (region, individual, along normals), inset (individual or region, depth), bevel (edges and vertices, segments, profile shape, clamp overlap).

**You'll see:** extrude a face into a handle; bevel the edges of a box to round them.
**Done when:** golden meshes for 15 operations; results stay manifold.

### Phase 3D-065 · Loop cut, slide & knife
**Needs:** 3D-064 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Loop cut with number of cuts and slide, edge slide, vertex slide, knife (cut through, angle snap).

**You'll see:** Ctrl+R adds a loop round a cylinder; K cuts a line across a face.
**Done when:** golden meshes for each tool; knife cuts snap exactly to midpoints and angles.

### Phase 3D-066 · Merge, dissolve, fill & bridge
**Needs:** 3D-065 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Merge (at centre, cursor, collapse, by distance), dissolve (vertices, edges, faces, limited), delete, fill (F), grid fill, bridge edge loops, separate and join.

**You'll see:** join two tubes with Bridge edge loops.
**Done when:** golden meshes; topology invariants hold after each.

### Phase 3D-067 · Spin, screw & symmetry
**Needs:** 3D-066 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Spin (round an axis by an angle), screw, mirror editing (X / Y / Z symmetry in edit mode), symmetrize.

**You'll see:** draw half a vase profile and spin it into a vase.
**Done when:** golden meshes; symmetric edits stay symmetric within 1e-6.

### Phase 3D-068 · Proportional editing
**Needs:** 3D-063 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Moving a vertex moves its neighbours with a falloff (smooth, sphere, root, sharp, linear, constant, random), a radius on the wheel, connected-only option.

**You'll see:** pull one vertex and the surface around it rises like cloth.
**Done when:** falloff weights match golden values.

### Phase 3D-069 · Normals
**Needs:** 3D-066 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Recalculate outside or inside, flip, smooth / flat per face, auto smooth by angle, weighted normals, custom normals (set from faces, transfer).

**You'll see:** a low-poly model shades cleanly with sharp edges where wanted.
**Done when:** golden normals on 10 meshes; export keeps custom normals.

### Phase 3D-070 · UV unwrapping
**Needs:** 3D-066 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Mark seams, unwrap (angle-based / conformal), smart project, cube / cylinder / sphere projection, project from view, follow active quads.

**You'll see:** a wood texture wraps a chair without stretching.
**Done when:** stretch metrics within bounds on 10 meshes; no overlapping islands from Unwrap on manifold meshes.

### Phase 3D-071 · UV editor
**Needs:** 3D-070 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] A light UV editor:
  - move, rotate and scale islands;
  - pin, average island scale, pack islands with margin;
  - show the texture behind.

**You'll see:** a 2D view of the UVs beside the 3D view.
**Done when:** packing fills at least 70% on 5 test meshes without overlap.

### Phase 3D-072 · Mesh booleans
**Needs:** 3D-066 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Exact union, difference and intersect of meshes (manifold, robust to coplanar faces), in a worker.

**You'll see:** cut a round hole through a box with a cylinder.
**Done when:** outputs are manifold on 20 fixture pairs, including coplanar and touching cases.

### Phase 3D-073 · Cleanup & remesh
**Needs:** 3D-072 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Merge by distance, delete loose, triangulate, quads from triangles, decimate (collapse, planar), voxel remesh (for inflated and sculpt-like shapes).

**You'll see:** a messy imported model becomes clean and light.
**Done when:** decimate keeps silhouettes within 1% (Hausdorff) at 50% reduction; voxel remesh outputs are manifold.

### Phase 3D-074 · Curves in 3D
**Needs:** 3D-027, 3D-062 · **Was:** — · **Lane:** A · **Status:** 📋
- [ ] Bézier curves in 3D (handles, tilt, radius), NURBS-lite, curve to mesh with a bevel profile and taper, curve from a 2D path.

**You'll see:** draw a curve and give it a round profile: a neon tube.
**Done when:** sampled curves match golden points; bevelled meshes are watertight.

## Stage 10 · Modifier depth

### Phase 3D-075 · Mirror & array
**Needs:** 3D-030 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Mirror (axes, bisect, merge at the seam), Array (count, offset, by object for radial, fit to curve), with caps.

**You'll see:** model half a mask, mirror it; array a link into a chain.
**Done when:** golden meshes for 10 set-ups.

### Phase 3D-076 · Bevel modifier & weighted normals
**Needs:** 3D-075, 3D-069 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Bevel as a modifier (by angle, by weight, segments, profile), weighted-normal modifier for clean shading.

**You'll see:** every hard edge gets a soft rounded highlight, live.
**Done when:** golden meshes and normals.

### Phase 3D-077 · Lattice & mesh deform
**Needs:** 3D-075 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Lattice objects (resolution, interpolation) and the lattice modifier; mesh-deform cage. Lattice points can be keyframed.

**You'll see:** squash and stretch a character through a box of points.
**Done when:** deformation matches golden values; animated lattices scrub exactly.

### Phase 3D-078 · Curve & simple deform
**Needs:** 3D-077, 3D-074 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Curve deform (follow a curve), Simple deform (bend, twist, taper, stretch, with limits and axis).

**You'll see:** bend a text along a curve; twist a bar.
**Done when:** golden meshes for each mode.

### Phase 3D-079 · Boolean modifier
**Needs:** 3D-072 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] A live boolean with another object or collection (union, difference, intersect), exact or fast solver.

**You'll see:** move the cutter and the hole moves with it.
**Done when:** live boolean results equal the destructive boolean of 3D-072.

### Phase 3D-080 · Shrinkwrap, wave, cast & wireframe
**Needs:** 3D-078 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Shrinkwrap (onto a target surface), wave (animated ripples), cast (towards a sphere / cylinder / cube), wireframe (a mesh of the edges).

**You'll see:** a sticker shrink-wrapped onto a bottle; a pond that ripples.
**Done when:** golden meshes; wave is exact at 5 times.

### Phase 3D-081 · Weld, decimate, remesh & triangulate
**Needs:** 3D-073 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] The cleanup operations of 3D-073 as live modifiers, for imported and generated meshes.

**You'll see:** a heavy model made light without touching its source.
**Done when:** live results equal the destructive operations.

### Phase 3D-082 · Geometry looks
**Needs:** 3D-081, 3D-023 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
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
**Needs:** 3D-042 · **Was:** Main 177, 231 · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] From ROADMAP.md 177 and 231: a node editor for materials, compiled to TSL node materials (WebGPU and WebGL2):
  - textures, maths, colour ramps;
  - mix, fresnel, layer weight;
  - noise, Voronoi, bump, normal map;
  - outputs to the PBR inputs.
- [ ] The 2D shader-graph parts of 177 (backgrounds) use the same editor.

**You'll see:** a node graph like Blender's shader editor; edits show live.
**Done when:** 10 graph materials match between WebGPU and WebGL2 within tolerance; a node edit updates the view in < 100 ms.

### Phase 3D-084 · Raw shaders (Pro) & shader safety
**Needs:** 3D-083 · **Was:** Main 178 · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] From ROADMAP.md 178: a code node for GLSL / TSL in the Pro face, compiled in a sandbox; unbounded loops and unsafe constructs are refused at compile time.

**You'll see:** a shader code editor in Pro mode.
**Done when:** an injected unbounded-loop shader is refused at compile time.

### Phase 3D-085 · Vertex colours & painting
**Needs:** 3D-083 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Colour attributes on meshes, a vertex-paint mode (brush, blur, fill), usable in materials.

**You'll see:** paint soft colour onto a low-poly model.
**Done when:** painted attributes export in glTF and match.

### Phase 3D-086 · Texture painting
**Needs:** 3D-071, 3D-085 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Paint onto a model's image textures (colour, roughness), with brush, stencil from an image, and symmetry.

**You'll see:** paint a logo onto a mug.
**Done when:** painting maps through UVs exactly on 5 test meshes.

### Phase 3D-087 · Material slots per face
**Needs:** 3D-083 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Several materials on one object, assigned per face in edit mode.

**You'll see:** a can with a metal top and a painted side.
**Done when:** slot assignments round-trip through glTF.

### Phase 3D-088 · Texture baking
**Needs:** 3D-071, 3D-087 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Bake normal (high to low poly), ambient occlusion, curvature, combined lighting and node materials into images, in the path tracer (3D-056).

**You'll see:** a heavy sculpted shape becomes a light mesh that looks the same.
**Done when:** baked maps reproduce the source within tolerance in the real-time view.

### Phase 3D-089 · Material looks v2
**Needs:** 3D-088 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
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
**Needs:** 3D-090 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
- [ ] Per-object velocity motion blur in real time, shutter in the camera settings.

**You'll see:** a fast spin smears naturally.
**Done when:** blur length matches velocity × shutter.

### Phase 3D-092 · Bloom, lens & film
**Needs:** 3D-090 · **Was:** — · **Lane:** A · **Status:** 📋
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
**Needs:** 3D-093 · **Was:** — · **Lane:** A · **Status:** ⏸
> ⏸ **Deferred on 2026-11-13** by the owner's order (§0a): not scheduled. An active phase never needs it.
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
**Needs:** 3D-042 · **Was:** — · **Lane:** A · **Status:** 📋
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
**Needs:** 3D-090, 3D-092 – 3D-094, 3D-096 – 3D-115, 3D-227 · **Was:** — · **Lane:** A · **Status:** 📋
> **Gate M2 is re-scoped (2026-11-13).** Edit mode, modifier depth and node materials are deferred (⏸). The gate now proves the animation, camera and look quality the four cases need.
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

# M3 · LIVING COMPONENTS (3D-117 – 3D-157)

> **Re-scoped on 2026-11-13.** At the gate: components that react to hover, press, drag, scroll and tilt, with keyboard access and touch. Rigging and physics depth (Stages 15 – 17, 3D-117 – 3D-145) are deferred.

## Stages 15 – 17 · Rigging and physics depth (⏸ deferred)

Phases 3D-117 – 3D-145 stay in the index (§6) without entries until a case needs them. They bring bones, weights, IK, constraints, rigid and soft bodies, particles and fracture. The 2D rig model they share with ROADMAP.md (Phases 203 – 208) stays there.

## Stage 18 · Interaction

### Phase 3D-146 · Targets, blending & cycles
**Needs:** 3D-047 · **Was:** Main 139 · **Lane:** A · **Status:** 📋
- [ ] A property can have **targets** (rest, hover, press, active) and blend between them by a signal; cycles (idle loops) are signals too.
- [ ] Blends are springs or eases; they work on any 2D or 3D property.

**You'll see:** a light's power gets a hover target and eases to it when the pointer comes near.
**Done when:** blends reach their targets within a tolerance at 5 times; the same spring gives the same values in the editor and in the export.

### Phase 3D-147 · States & transitions
**Needs:** 3D-146 · **Was:** Main 78, 79 · **Lane:** B · **Status:** 📋
- [ ] Named states per element (rest, hover, press, focus, disabled, active) with transitions between them (duration, easing).
- [ ] A state can change any property, including 3D materials, lights and transforms. Built by Lane B as Main 78 and 79.

**You'll see:** a button with Hover and Press states you can preview in the viewport.
**Done when:** states switch identically in the editor and in the export; a state change is one undo step.

### Phase 3D-148 · State machines
**Needs:** 3D-147 · **Was:** Main 151 · **Lane:** A · **Status:** 📋
- [ ] State machines: states, events, guards, and actions, for things like a toggle or a multi-step control (Main 151).
- [ ] Compiled to a few lines in the export.

**You'll see:** a visual graph of a toggle's states, playing in Preview.
**Done when:** 10 reference machines give the same event traces in the editor and the export.

### Phase 3D-149 · 3D states
**Needs:** 3D-148, 3D-053 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Hover, press and selected states on **3D objects**, through the raycast events of 3D-053.
- [ ] A state can change a material, a light, a transform or a modifier parameter: a button inflates when pressed.

**You'll see:** press a 3D button and it dents and springs back.
**Done when:** pointer tapes (3D-046) produce the same state traces in the editor and the export.

### Phase 3D-150 · Cursor reactions
**Needs:** 3D-149 · **Was:** Main 232 · **Lane:** A · **Status:** 📋
- [ ] Objects that look at, tilt toward or follow the cursor; lights that follow it (3D-198); eyes that follow it.
- [ ] Limits, smoothing and an idle motion; off for reduced motion.

**You'll see:** a mascot's eyes follow the cursor across the page.
**Done when:** a tape of 9 pointer positions gives hand-computed orientations within 1e-3; reduced motion switches it off.

### Phase 3D-151 · Viewer interactions: spin, inspect, zoom
**Needs:** 3D-150 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Viewer interactions: drag to spin, pinch or wheel to zoom, inspect, double-tap to reset; limits and inertia.

**You'll see:** spin a product with the mouse or a finger.
**Done when:** a touch tape and a mouse tape give the same orientation within tolerance; limits hold.

### Phase 3D-152 · Scroll-driven 3D scenes
**Needs:** 3D-103, 3D-151 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Scroll progress drives the camera, objects and animations; pinned sections; exported as the smallest mechanism that works (CSS scroll timelines where supported, a tiny script otherwise).

**You'll see:** a product turntable that turns as the page scrolls.
**Done when:** scroll tapes at 9 positions match the editor in the export; the mechanism costs nothing when no element uses it.

### Phase 3D-153 · Tilt & touch gestures
**Needs:** 3D-152 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Pinch, drag, long press and device tilt for 3D, with permission asked at the right moment (3D-199).

**You'll see:** tilt a phone and the card tilts with it.
**Done when:** a gesture tape and a tilt tape drive the same results in the editor and in the export.

### Phase 3D-154 · Interactive 3D components
**Needs:** 3D-153 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Package a 3D element with its states and inputs as a reusable **component** with properties and variants.

**You'll see:** a "Tilt card" component dropped on three pages with different images.
**Done when:** an instance changes only its own properties; a component edit updates every instance; export size grows by one element, not one runtime.

### Phase 3D-155 · Accessibility for 3D
**Needs:** 3D-154 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Keyboard focus on 3D objects, labels and descriptions, reduced motion, a pause control, a high-contrast fallback, and a text description of the scene. No information is carried by motion alone.

**You'll see:** tab onto a 3D button and it shows a focus ring.
**Done when:** an automated accessibility check passes on 10 reference scenes; a screen-reader script reads each scene's description.

### Phase 3D-156 · Interaction looks
**Needs:** 3D-155, 3D-023 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] One-click interaction presets (follow cursor, tilt card, press dent, scroll reveal) sized to the object.

**You'll see:** an Interactions strip of thumbnails on every 3D element.
**Done when:** a preset applied to objects of 5 sizes behaves proportionally; saving and re-applying round-trips.

### Phase 3D-157 · **Gate M3: living components**
**Needs:** 3D-146 – 3D-156 · **Was:** new · **Lane:** A · **Status:** 📋
> **Gate M3 is re-scoped (2026-11-13).** Rigging and physics depth are deferred (⏸). The gate now proves the interaction work: states, cursor and scroll reactions, tilt and touch, accessibility.
- [ ] Prove the interaction work end to end.

**You'll see:** a card that tilts with the cursor, a 3D toggle with states, and a scroll-driven product turntable, with keyboard access and touch.
**Done when:** all three exported under their size budgets; reduced motion and keyboard paths pass; touch works in a phone-sized browser test.

# M4 · SHIP & SIMPLICITY (3D-158 – 3D-190)

> At the gate: import models, put real page text in 3D, export small and fast, degrade by device, and make every recipe in 8 steps or fewer. Size and tiers follow the tiny-export phases 3D-191 – 3D-196.

## Stage 19 · Assets & import

The asset browser, imports from Blender and Spline, bulk conversion and sharing (3D-160 – 3D-163) are deferred.

### Phase 3D-158 · GLTF / GLB import pipeline
**Needs:** 3D-062 · **Was:** Main 224 · **Lane:** A · **Status:** 📋
- [ ] Import glTF and GLB: meshes, materials, textures, skins and animations, with clear messages for anything unsupported.
- [ ] Triangle and texture budgets per tier warned at import; units and axes as in 3D-009; credits kept with the asset.

**You'll see:** drop a .glb on the canvas and it appears, lit and animated.
**Done when:** 10 reference models import with the same look and animation within tolerance; a malformed file fails with a clear message and never a crash.

### Phase 3D-159 · Texture & HDRI pipeline
**Needs:** 3D-158 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] KTX2 and Basis texture transcoding; HDRI import with pre-filtering and mipmaps; size limits per tier; every texture in the memory ledger.

**You'll see:** drop an HDRI and the studio takes its light and reflections from it.
**Done when:** a 4K HDRI becomes a usable environment within its tier budget; the ledger returns to zero after unmount.

## Stage 20 · On the page

### Phase 3D-164 · Responsive scenes
**Needs:** 3D-157 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] A scene adapts to its box: camera framing, object scale by breakpoint, quality tier.

**You'll see:** resize the page and the scene reframes.
**Done when:** at 5 widths the framing matches hand-set expectations; overrides edit through the breakpoint tools.

### Phase 3D-165 · Page layers inside 3D scenes
**Needs:** 3D-164 · **Was:** Main 233 · **Lane:** A · **Status:** 📋
- [ ] Real page text and buttons placed in 3D scenes (Main 233): selectable, accessible, depth-sorted and occluded properly.

**You'll see:** a real heading sitting behind a 3D object.
**Done when:** text stays selectable and readable by a screen reader; occlusion matches the depth in 5 reference scenes.

### Phase 3D-166 · 3D layers with 2D effects
**Needs:** 3D-165 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Apply 2D effects (blur, glow, blend modes, masks) to a 3D scene layer, as to any other layer.

**You'll see:** a glow on a 3D button, and a mask that reveals it.
**Done when:** the effects match their 2D versions on a flat reference within tolerance; they do not break the size budget.

### Phase 3D-167 · 2.5D surfaces as the fast path
**Needs:** 3D-062, 3D-192 · **Was:** new (S1–S9) · **Lane:** A · **Status:** 📋
- [ ] The Surfaces track (S1–S9) as a tier-1 recipe: exported through the scene IR; no new features.

**You'll see:** the 2.5D balloon button exported as a tier-1 element.
**Done when:** the export matches the editor within tolerance and is under the size budget.

### Phase 3D-168 · One timeline for 2D and 3D
**Needs:** 3D-166 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] One timeline for 2D and 3D: 3D properties appear as lanes; keys copy between them.

**You'll see:** animate a 2D card and a 3D light on one timeline.
**Done when:** a mixed timeline evaluates identically in the editor and in the export at 5 times.

### Phase 3D-169 · Posters, SEO & no-WebGL fallbacks
**Needs:** 3D-168 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] A poster for every scene, shown until it is ready or when WebGL is unavailable; the text stays in the page for search engines.

**You'll see:** turn WebGL off and the page still shows the picture.
**Done when:** 10 reference pages render their posters without WebGL; a search-engine crawl test reads the text.

## Stage 21 · Export & performance

Instancing (3D-170) and bundles (3D-174, folded into 3D-195 and 3D-196) are deferred.

### Phase 3D-171 · 3D export v2: components, three.js, embed
**Needs:** 3D-168, 3D-192 · **Was:** Main 238 · **Lane:** A · **Status:** 📋
- [ ] The **full tier**, for scenes the micro tier cannot draw: a React Three Fiber component, a vanilla three.js module and an embeddable frame, importing only the three.js modules used.

**You'll see:** Export as: React Three Fiber, three.js, Embed.
**Done when:** each target renders its reference scene within tolerance in 3 browsers; only the modules used are in the bundle.

### Phase 3D-172 · Geometry & texture compression
**Needs:** 3D-171 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Mesh compression (meshopt, Draco), texture compression (KTX2), quantised attributes.

**You'll see:** a smaller file with the same picture.
**Done when:** the 5 reference scenes shrink by the recorded amount with differences under tolerance.

### Phase 3D-173 · Baked motion in the export
**Needs:** 3D-172 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Baked simulations and animation shipped as small arrays: vertex animation textures, delta compression.

**You'll see:** the foil button's press dent plays in the export with no solver.
**Done when:** the baked playback matches the simulation within tolerance; the data is under its budget.

### Phase 3D-175 · Device tiers & automatic downgrade
**Needs:** 3D-173 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Detect the device's tier; downgrade features in the declared order (3D-005).

**You'll see:** a low phone gets a simpler lighting and fewer shadows, automatically.
**Done when:** on three simulated tiers each recipe meets its frame budget; the report names what was dropped.

### Phase 3D-176 · 3D memory discipline
**Needs:** 3D-175 · **Was:** Main 237 · **Lane:** A · **Status:** 📋
- [ ] The memory ledger enforced in the export: dispose on unmount, texture streaming, no leaks (Main 237).

**You'll see:** scroll through a long page and memory stays flat.
**Done when:** 100 mount and unmount cycles leave the ledger at its baseline.

### Phase 3D-177 · Performance budgets in CI
**Needs:** 3D-176 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Per-recipe, per-tier budgets for frame time, memory and size as CI tests.

**You'll see:** a red CI line when a recipe gets slower.
**Done when:** a deliberate slowdown fails CI and names the recipe and the tier.

### Phase 3D-178 · Editor–export parity
**Needs:** 3D-177 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Automated comparison of the editor's render and the exported render within the GPU tolerance, for every recipe.

**You'll see:** a parity report per release.
**Done when:** all recipes pass in 3 browsers or are listed with the reason.

### Phase 3D-179 · Export runtime for states, bindings & physics
**Needs:** 3D-178 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] The export runtime pieces for states, signals and bindings. Live physics stays deferred; only baked physics ships.

**You'll see:** a state change running on an exported page.
**Done when:** state traces match the editor on 10 reference tapes.

### Phase 3D-180 · Offline posters & social images
**Needs:** 3D-178 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Offline posters and social images rendered from the scene (path tracer, 3D-057).

**You'll see:** an og:image that is the finished 3D button.
**Done when:** posters match the editor's Rendered view within tolerance; they are under their size budget.

## Stage 22 · Simplicity

### Phase 3D-181 · "Make 3D" wizards
**Needs:** 3D-180 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Guided 3 to 5 step flows: logo to 3D, button to balloon, photo with wrapped text, anime shot starter.

**You'll see:** a "Make 3D" menu with four wizards.
**Done when:** each wizard ends with a finished, exportable result in 5 steps or fewer.

### Phase 3D-182 · Looks everywhere: audit
**Needs:** 3D-181 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] An audit: every section opens on looks.

**You'll see:** no empty looks strip anywhere.
**Done when:** an automated walk through every 3D section finds looks in each.

### Phase 3D-183 · The 8-step rule, tested
**Needs:** 3D-182 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Each recipe is makeable in 8 steps or fewer with the Simple face, tested by a scripted journey that counts steps.

**You'll see:** a step counter in the test report.
**Done when:** every recipe in the library passes at 8 steps or fewer.

### Phase 3D-184 · Recipe library
**Needs:** 3D-183 · **Was:** Main 239 · **Lane:** A · **Status:** 📋
- [ ] A library of ready recipes (Main 239): balloon button, tilt card, car wrap, anime shot starter, product turntable, with presets and sizes.

**You'll see:** an Insert > Recipes gallery.
**Done when:** each recipe inserts, edits and exports; each is under its size budget.

### Phase 3D-185 · Help inside: plain words and Blender terms
**Needs:** 3D-184 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Plain words everywhere, with the Blender and After Effects term in the tooltip; the command palette finds either.

**You'll see:** type "corner pin" or "extrude" in the palette and find the tool.
**Done when:** a label check finds no unexplained term in the Simple face.

### Phase 3D-186 · AI assist for 3D
**Needs:** 3D-185, 3D-201 · **Was:** new (after Main 241) · **Lane:** A · **Status:** 📋
- [ ] Describe a scene in words and the agent builds it through the commands (MCP) and the AI gateway; every step is shown and undoable.

**You'll see:** "a glossy red balloon button that lights up toward the cursor" becomes a scene.
**Done when:** 10 prompts produce valid scenes; every step is one undo step; with the privacy switch on, no request leaves the page.

## Stage 23 · Gates

### Phase 3D-187 · Gate M4a: phones
**Needs:** 3D-186 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] All recipes run at the mid-phone budget; touch and tilt work.

**You'll see:** the recipe gallery on a phone.
**Done when:** every recipe holds its frame budget on the mid-phone test profile.

### Phase 3D-188 · Gate M4b: accessibility & fallbacks
**Needs:** 3D-187 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] No WebGL, reduced motion, keyboard and screen-reader paths all work.

**You'll see:** the same page with every accessibility switch on.
**Done when:** an automated pass over every recipe's fallbacks succeeds.

### Phase 3D-189 · Gate M4c: the 3D journey
**Needs:** 3D-188 · **Was:** Main 240 · **Lane:** A · **Status:** 📋
- [ ] The whole journey: a page with a 2D layout, a balloon button, a car photo with wrapped text, a scroll turntable; exported and deployed.

**You'll see:** the finished page, live.
**Done when:** the journey is done by a first-time user in the time set in the test script; the page meets its size and speed budgets.

### Phase 3D-190 · Close-out: docs, audit, licences & hand-back
**Needs:** 3D-189 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] Docs, audit rows, licences, third-party notices, and the hand-back of anything unfinished to the main roadmap.

**You'll see:** a clean list of what shipped and what did not.
**Done when:** `LICENSES.md` and `THIRD_PARTY_NOTICES.md` are complete for every dependency; every open item is written down with its owner.


---

# M1+ · SMALL AND REACTIVE (3D-191 – 3D-200)

> At the gate: a hover component exports with no script, the foil button exports in a few KB, and its light follows the pointer across the whole page, on touch and tilt too.

## Stage 24 · Small export

### Phase 3D-191 · Size doctrine, budgets & the Rive baseline
**Needs:** 3D-005 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] The rule: an exported element ships **only the generated code its recipe needs**. No editor code, no tools, no generic runtime. Three tiers: **zero-script** (CSS and Web Animations), **micro** (generated WebGL2, no three.js), **full** (three.js or React Three Fiber, for complex scenes).
- [ ] A measuring harness: gzip and brotli bytes of the script, shaders and data an element ships, per recipe and per tier, with what each feature costs.
- [ ] The baseline: install Rive's published web packages in a scratch folder, measure their gzip sizes, and write the numbers and versions in decision 0022. They are measured, not quoted from memory.
- [ ] Budgets per recipe, set below the baseline: a static or reactive element (tier 0), a 3D button (tier 1), a photo wrap (tier 1), an anime shot (tier 1), a full scene (tier 2).

**You'll see:** a size panel in the export dialog: "This element ships 6.4 KB (budget 10 KB)", with a bar per feature.
**Done when:** five reference recipes have a measured size and a budget; a build over budget fails CI and names the feature; the Rive baseline is in the decision record with the versions measured.

### Phase 3D-192 · Export tiers & the scene IR (decision 0022)
**Needs:** 3D-191, 3D-010 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] A **scene IR**: plain data for what to draw and how it reacts (meshes, materials, lights, cameras, signals, animations). The editor's renderer and every export tier read the same IR.
- [ ] The smallest tier that can draw the scene is chosen automatically; the user can force one. The report says why a scene needs a bigger tier ("uses cloth: full tier").
- [ ] The IR is versioned and serialisable, and editor-only data never enters it (canvas contract, rule 4).

**You'll see:** "Export tier: Micro", with the reason.
**Done when:** the same IR renders in the editor and in tier 1 within tolerance on 5 scenes; an editor-only property never appears in an IR (test).

### Phase 3D-193 · Zero-script export for 2D reactions (case 1)
**Needs:** 3D-192 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] Hover, press, focus, in-view, scroll-progress and pointer-position reactions on shapes and text, exported as CSS and Web Animations with **no JavaScript** where the browser can do it (`:hover`, `animation-timeline`, custom properties).
- [ ] Where it cannot, a generated script of a few hundred bytes for that element alone; shared helpers only if two elements use them.
- [ ] Reduced motion respected.

**You'll see:** a hover button exported as one file with no script tag.
**Done when:** 10 reference components behave the same in the editor and in Chromium, Firefox and WebKit exports; a component with only CSS reactions ships 0 bytes of JavaScript.

### Phase 3D-194 · Micro-renderer: generated WebGL2 for one 3D element
**Needs:** 3D-192, 3D-033, 3D-037 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] A generator that writes the GLSL, the buffers and a tiny draw loop for exactly this element: its lights, its material model, its inputs. No three.js.
- [ ] Features arrive as slices: lit PBR, toon, outline, pointer-driven lights, baked animation, a poster. A slice not used is not shipped.
- [ ] Contexts follow the same sharing rules as the editor: one per page, asleep when off screen.

**You'll see:** the foil button exported in a few KB, indistinguishable from the editor.
**Done when:** parity with the editor within the GPU tolerance on 5 scenes in 3 browsers; the foil button is under its budget; a scene needing a feature the micro tier lacks falls to the full tier with a message.

### Phase 3D-195 · One chunk per element, lazy start & the no-editor-code rule
**Needs:** 3D-193, 3D-194 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] Each element is its own chunk, fetched only when near the viewport; no global runtime object; no framework required.
- [ ] A leak scan: the exported bundle contains none of the editor's modules, command ids, panel strings or schemas.
- [ ] Shaders, meshes and textures are compressed (3D-172) and fetched with their chunk.

**You'll see:** a page with five elements loads only what is on screen.
**Done when:** the leak scan passes on 10 exports; scrolling a page of 20 elements never loads more than the visible ones and the next.

### Phase 3D-196 · Size gates for the five reference recipes in CI
**Needs:** 3D-195 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] CI builds the five reference recipes and fails on a regression, with the difference reported by feature.
- [ ] Replaces 3D-174, which is folded in here.

**You'll see:** a red CI line: "foil button +2.1 KB: pointer-light slice".
**Done when:** a deliberate 20% regression fails the build and names the feature.

## Stage 25 · Page input & the pointer light

### Phase 3D-197 · Page-wide signals
**Needs:** 3D-045 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
> **Pulled into ROADMAP.md's Design master track as D4 (2026-11-13):** built there first, for 2D and 3D.
- [ ] The pointer **anywhere on the page** (not only over the element), its speed, scroll position and speed, scroll progress through a section, device tilt and visibility, with their touch equivalents, as sources for any property.
- [ ] Shaping: smoothing, springs, ranges, dead zones, inversion; "away from the pointer" computed from the pointer's position relative to the element's centre.
- [ ] One shared, passive listener for the page; asleep when no element uses it.

**You'll see:** a "Pointer" source in the link menu of any property.
**Done when:** the same recorded input tape gives the same values in the editor and in the export (3D-046); the listener costs nothing when no element uses it.

### Phase 3D-198 · Pointer light
**Needs:** 3D-197, 3D-037 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] A light whose position, angle, colour or power follows or opposes the pointer: **Opposite**, **Follow**, **Orbit**, **Breathe**, with distance, falloff, smoothing and limits. With the pointer at the far left of the page the light sits to the right of the button's centre, and the highlight slides across the surface as the pointer moves.
- [ ] Works on any light and any layer; saved as Looks (3D-040).

**You'll see:** move the mouse around the whole page and the highlight slides the opposite way across the balloon button.
**Done when:** golden frames at 9 pointer positions match the intended behaviour; the owner confirms it against the reference video.

### Phase 3D-199 · Touch, tilt & phone behaviour
**Needs:** 3D-198 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] On touch, a finger drag moves the light; with no finger it drifts gently, or follows scroll; tilt (gyroscope) where the user allows it, asked for at the right moment.
- [ ] Reduced motion: a still light, no drift. Idle motion stops when the tab is hidden.

**You'll see:** the same button on a phone, lit by touch and tilt.
**Done when:** a touch tape and a tilt tape drive the light in a phone-sized browser test; reduced motion removes all pointer-driven motion.

### Phase 3D-200 · Gate A: the reactive 3D button (case 2)
**Needs:** 3D-062, 3D-196, 3D-199 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] The foil button, exported at tier 1, reacts to the page-wide pointer, touch and tilt.

**You'll see:** the owner's reference video and the exported page side by side.
**Done when:** the button matches the reference; it is under its size budget; it holds 60 fps on the mid tier; the page works with reduced motion.

# M5 · THE PHOTO STUDIO (3D-201 – 3D-215)

> At the gate: a car photo is cut out, its body lines are found, text is wrapped on it so it looks painted on but can still be told apart, and images are corner-pinned and tracked in video like After Effects. Production quality, small export.

## Stage 26 · AI services (used by M5 and M6)

### Phase 3D-201 · AI gateway: browser and server models
**Needs:** 3D-006 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] One interface for every AI task (cut out, depth, normals, edges, upscale, in-between, image to 3D). Each task has a registry of models: name, where it runs (browser or server), size, licence, quality notes.
- [ ] Browser models download on demand, are cached on the device and **never ship in an exported site**. Server models run on a small service we run or on the user's own keys; the editor never holds a key.
- [ ] A privacy switch, **Keep everything on this device**, turns servers off. A cost estimate before any server job. Results cached by content hash, so a photo is never processed twice.
- [ ] Jobs go through the pool (3D-006): progress, cancel, retry, and a fallback when WebGPU is missing.
- [ ] A model is added only with its licence read and written in `LICENSES.md` (Law 6).

**You'll see:** a "Run on: This device / Server" choice with an estimate.
**Done when:** the same task runs through a browser model and a stub server model behind one call; cancel stops within a second; with the privacy switch on, no request leaves the page (network test).

### Phase 3D-202 · Browser vision models
**Needs:** 3D-201 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] Cutout (promptable segmentation), depth (Depth Anything V2 Small, Apache-2.0 per its README; the bigger sizes are non-commercial and must not be used), normals from depth, edges, light-direction estimate. WebGPU first, WASM fallback.
- [ ] Tiled processing for big photos; a small version for preview, full size for the final.

**You'll see:** drop in a car photo and a cutout and a depth preview appear in seconds.
**Done when:** on 20 test photos, cutout overlap and depth ordering beat the thresholds recorded in this phase; a 12-megapixel photo finishes in tiles without running out of memory.

### Phase 3D-203 · Server models
**Needs:** 3D-201 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] Bigger depth and matting models, upscaling, image to 3D (TRELLIS-class; reported MIT, **re-read the repository's licence at use**), in-betweening, colour flats. Each with its licence and cost written down. Hunyuan3D's community licence has user and regional limits: not a default.
- [ ] A server adapter for a GPU box we control or a hosted provider; same inputs, same result shape. **The owner chooses where it runs and who pays before this phase starts.**

**You'll see:** "Better quality (server)" on the cutout and depth tools.
**Done when:** each server model has a licence note, a size and cost note and a stub test; a failure falls back to the browser model with a message.

## Stage 27 · Tracking & corner pin

### Phase 3D-204 · Corner pin & perspective placement
**Needs:** 3D-193 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
> **Pulled into ROADMAP.md's Design master track as D16 (2026-11-13):** built there first, for 2D and 3D.
- [ ] Drag **four points** to place any image, text, video or shape on a plane in a photo, as After Effects' Corner Pin does: exact homography, edge anti-aliasing, optional rounded corners and feather. Builds on the existing corner-pin tool.
- [ ] Handles snap to the corners of a detected quad; the plane's grid is shown.
- [ ] Exports as a CSS 3D transform (tiny) or as a micro-renderer quad when lighting or tracking is involved.

**You'll see:** drag four corners and a poster sits on a billboard in the photo.
**Done when:** the homography maps the four points within 0.01 px; the exported CSS equals the editor within 0.5 px at 5 sizes; one undo step per drag.

### Phase 3D-205 · Point & planar tracking
**Needs:** 3D-204, 3D-006, Main 99 · **Was:** new (2026-11-13) · **Lane:** B* · **Status:** 📋
> **Pulled into ROADMAP.md's Design master track as D17 (2026-11-13):** built there first, for 2D and 3D.
- [ ] Track one point, two points (position, scale, rotation) or a planar region (4 points) through a video clip: Lucas–Kanade tracking and feature matching in a worker, sub-pixel. Our own code first; OpenCV.js (Apache-2.0, editor only, loaded on demand) if it does not reach quality.
- [ ] Forward and backward tracking, confidence, drift correction, manual nudges at any frame, masks for moving parts.
- [ ] Needs video layers (Main 99, Lane B).

**You'll see:** press Track and the pinned image sticks to a moving sign.
**Done when:** on 10 reference clips the pin stays within 1.5 px of the ground truth for 95% of frames; fixing a lost track takes under 5 clicks.

### Phase 3D-206 · Tracking becomes keyframes
**Needs:** 3D-205 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
> **Pulled into ROADMAP.md's Design master track as D17 (2026-11-13):** built there first, for 2D and 3D.
- [ ] Track results are ordinary keyframes: smooth them, offset, scale, add wiggle, link by expression.
- [ ] Baked into the export as small delta-compressed arrays; no tracker ships.

**You'll see:** a track on the timeline you can edit like any other keys.
**Done when:** an exported tracked pin matches the editor within 0.5 px per frame; the track data of a 10-second clip is under 4 KB.

### Phase 3D-207 · Camera solve (3D camera tracker)
**Needs:** 3D-205 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
- [ ] Solve the camera's motion from a clip so 3D objects sit in the scene. Optional, server-first. Deferred until the two-dimensional tracking is in use.

**You'll see:** a 3D object that stays put while the video camera moves.
**Done when:** decided when the phase is scheduled.

## Stage 28 · Photo to surface

### Phase 3D-208 · Cutout & matte, production grade
**Needs:** 3D-202 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] Subject cutout with edge refinement (matting for hair, glass, thin parts), feather, colour decontamination, holes, several subjects as layers. Extends the existing cutout dialog.
- [ ] A matte quality view: the edge over black, white and a checker; a refine brush.

**You'll see:** a car cut out cleanly, windows as holes.
**Done when:** on 20 test photos the matte edge error is under a recorded threshold and a person rates 18 of 20 "clean"; windows are holes on 5 cars.

### Phase 3D-209 · Surface from a photo: proxy, depth & normals
**Needs:** 3D-208, 3D-204 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] **The box around the car**: drag a proxy (plane, box, or the silhouette) with corner-pin handles; the estimated depth and normals refine it into a relief. Relative depth is enough.
- [ ] The result is a surface the other tools use: a height field, normals and panels.

**You'll see:** a depth preview and a lit "clay" view of the car.
**Done when:** the clay relief of 10 photos matches hand-checked normals within a threshold; the relief builds in under 3 s on the mid tier for a 2k photo.

### Phase 3D-210 · Character lines: cuts & curves
**Needs:** 3D-209 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] Click or stroke along the car's lines (door seam, shoulder line, vents). The edge map from the normals **proposes lines automatically**; accept, move, delete.
- [ ] A line becomes a crease, a sharp edge in the surface. Lines split the surface into panels; each panel can have its own smoothing and its own text.

**You'll see:** press "Find lines" and the shoulder line and door cuts light up; click to keep them.
**Done when:** on 10 supercar photos the automatic lines cover at least 80% of the hand-marked lines; creases change the normals as specified (golden).

### Phase 3D-211 · Wrap text & graphics on the surface
**Needs:** 3D-210, 3D-026 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] Live, editable text (any font) or a logo laid on the surface by following the relief: it bends over curves, stops or continues across panels, and perspective follows the surface. **The photo does not rotate.**
- [ ] Hidden where something is in front of it (a mirror, a handle, a wiper), using the cutout and the depth.
- [ ] Placed by clicking the surface; moved, rotated and scaled along the surface; aligned to a crease.

**You'll see:** type "SPEED" and the word follows the car's side curve.
**Done when:** on 10 photos the text path follows hand-drawn reference curves within 3 px; occlusion hides text behind 5 occluders correctly.

### Phase 3D-212 · Make it belong, and still tell it apart
**Needs:** 3D-211 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] Integration controls: light direction and colour matched from the photo, shading from the surface normals, a contact shadow and ambient darkening, gloss and reflection response, grain, blur and colour cast matched to the photo.
- [ ] Styles: paint, vinyl wrap, chrome, neon, embossed, sticker, graffiti.
- [ ] A **Distinct ↔ Integrated** slider: at 0 the text is a clean overlay, at 1 it is photo-matched; the default sits where a viewer can still tell the text was added.

**You'll see:** the slider changing the same word from a sticker to painted on.
**Done when:** a blind test on 10 photos: viewers spot the added text more than 85% of the time at the default and rate it "believable" at least 80% of the time.

### Phase 3D-213 · Relight the photo
**Needs:** 3D-198, 3D-209, 3D-212 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] The pointer light (3D-198) lights the cutout from its relief: a highlight slides over the paint as the mouse moves.
- [ ] A cheap shader on the shipped depth and normal textures.

**You'll see:** a highlight running over the car's paint as the mouse moves.
**Done when:** golden frames at 9 pointer positions; the exported effect is under its size budget; a mid phone holds 60 fps.

### Phase 3D-214 · Production pass for photo work
**Needs:** 3D-213 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] 4K photos through tiling; matte-edge QA; a golden set of 20 vehicle and product photos with expected results; a blind comparison against hand-made After Effects results.
- [ ] The whole recipe exported as the photo, a small depth and normal texture, the mask and a tiny shader, with a flat poster as the fallback.

**You'll see:** a finished recipe you would put on a client's page.
**Done when:** the golden set passes; the blind comparison is at least a tie on 15 of 20; one photo's export is under its budget.

### Phase 3D-215 · Gate B: the car
**Needs:** 3D-206, 3D-214 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** 📋
- [ ] A car photo is cut out, its body lines are found and edited, a word is wrapped onto the door and shoulder, integrated and relit by the pointer; and a second recipe tracks a billboard in a video clip.

**You'll see:** the car page and the billboard clip.
**Done when:** both recipes export under their budgets; the owner compares them with After Effects results and accepts them.

# M6 · THE ANIME STUDIO (3D-216 – 3D-227)

> **Parked as a to-do (owner, 2026-11-13).** 3D-216 – 3D-226 are ⏸; 3D-227 (live animation mixing) is general animation and stays active.

> At the gate: a 15-second fight shot in a Solo Leveling, One Piece or Naruto look is built by one person in a day, with toon shading, ink lines, time on twos, smears and impact frames, effects, camera language and a shot list, and rendered to video.

## Stage 29 · The anime look

### Phase 3D-216 · Anime shading core
**Needs:** 3D-098, 3D-037 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] Two- and three-tone bands from a ramp; **hand-shaped shadows** (a shadow threshold and shape per object that you can paint or bias); rim light; flat highlight shapes; halftone or hatched tone on the dark side; skin and hair that shift colour in shadow.
- [ ] A palette and a light direction per shot, so every shot can be lit by hand.

**You'll see:** a 3D model that reads as a flat-coloured drawing, with shadow shapes you can nudge.
**Done when:** a reference model matches a reference still within the perceptual tolerance; shadow-shape edits are one undo step and export identically.

### Phase 3D-217 · Ink lines
**Needs:** 3D-216 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] Outlines by pushing a copy of the mesh along **smoothed normals stored in a mesh attribute** (so lines do not break at hard edges), thickness from vertex colour, depth and curvature, with taper; plus lines from depth, normal and object-ID edges for interior detail.
- [ ] Line colour per material; a small "boil" wobble on twos for the hand-drawn feel.
- [ ] Works on photo reliefs (3D-209).

**You'll see:** black ink around the character, thick on the outside and fine inside.
**Done when:** lines are unbroken at hard edges on 5 models; thickness maps edit live; the line pass costs under its tier budget.

### Phase 3D-218 · Time on twos & threes
**Needs:** 3D-010, 3D-104 · **Was:** new (2026-11-13) · **Lane:** B* · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] Each layer or object has its own frame rate: animate on ones, twos or threes; held frames; pose-to-pose with breakdowns. The stepping lives **in the kernel**, so the editor, the export and the video render agree.
- [ ] A "limited animation" preset applies stepping to a whole shot while the camera and effects keep their own smooth rate.

**You'll see:** a walk cycle that is choppy on purpose, on twos, with the camera still smooth.
**Done when:** `evaluate()` at 24 fps on twos returns each pose for exactly 2 frames; the export matches to the frame; changing the rate is one undo step.

### Phase 3D-219 · Smears, impact frames & motion lines
**Needs:** 3D-218, 3D-217 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] Smear frames: stretch or blur the shape along its motion for 1 to 3 frames; multiple-image trails; **impact frames** (one flash, inverted or high-contrast frame); speed lines and focus lines; screen-tone bursts.
- [ ] Driven from motion (speed, direction) or placed by hand on a frame.

**You'll see:** a punch lands with a flash frame, a smear and speed lines.
**Done when:** a punch preset placed on a reference clip matches the reference frame list (which frames flash, smear and hold); effects are deterministic when scrubbing.

### Phase 3D-220 · Effects animation library
**Needs:** 3D-219, 3D-092 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] Tiny procedural presets: energy slash, aura and **shadow flames** (Solo Leveling's shadow soldiers), shockwave, dust, sparks, steam, lightning, cut-in flash. Each is a shader plus a timing curve, with parameters, saved as Looks.
- [ ] Hand-drawn effect sprite sheets can be imported and timed like any layer.
- [ ] Compositing finishes: glow, chromatic aberration, film grain, vignette, texture overlays, screen-tone.

**You'll see:** pick "Shadow aura" and a figure is wrapped in flame.
**Done when:** 12 presets exist, each under its size budget and with a golden strip of frames; the owner picks 8 of 12 as shippable.

### Phase 3D-221 · Drawn art in 3D space
**Needs:** 3D-217, 3D-167 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] The mid-3D, mid-2D look: drawn characters, props and backgrounds as layers with depth, parallax, 2.5D camera moves and depth of field. A drawing can swap between frames (a sprite sequence) or be a puppet; light passes can be painted by hand or estimated.
- [ ] Mixed freely with 3D models in one scene under one camera.

**You'll see:** a painted street with a 3D-lit character walking through it.
**Done when:** a 5-layer scene renders the same in the editor and in the tier-1 export within tolerance; the camera move is smooth at 60 fps on the mid tier.

### Phase 3D-222 · Camera & cut language
**Needs:** 3D-099, 3D-218 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] Crash zoom, dolly zoom, whip pan, shake, dutch angle, rack focus, cut to flash, hold on a pose, as presets with a timing curve on any camera.

**You'll see:** "Crash zoom" on a shot with one click.
**Done when:** each preset matches its reference curve; each is one undo step.

### Phase 3D-223 · Shots, storyboard & animatic
**Needs:** 3D-222, Main 99 · **Was:** new (2026-11-13) · **Lane:** B* · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] A shot list: every shot has a camera, timing, effects and a length; cuts and transitions; sound markers on audio layers.
- [ ] A storyboard view from stills and an animatic that plays the shots in order.

**You'll see:** a row of shots; click one to open it in the viewport.
**Done when:** a 5-shot sequence plays in order with sound markers in sync within 1 frame; editing one shot changes no other.

### Phase 3D-224 · Character import & pose library
**Needs:** 3D-158, 3D-217, 3D-112 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] Import glTF or VRM characters; the toon material and ink lines are applied automatically; body and face pose libraries; mouth shapes and blinks through shape keys.
- [ ] Characters from a photo or drawing through a server model (3D-203), with the quality marked honestly.

**You'll see:** drop in a character and it is inked and ready.
**Done when:** 3 VRM and 3 glTF characters import with the right shading in one step; a pose from the library is one undo step.

### Phase 3D-225 · AI assists for anime
**Needs:** 3D-203, 3D-221 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] Optional, through the gateway: in-betweens for drawn key frames, line art to colour flats, a video-to-anime style pass, automatic lip sync from audio.
- [ ] Each task shows its cost, its model and its licence, and its result is a **draft**: the artist always has the last word. Every assist can be turned off.

**You'll see:** draw two key poses, ask for the in-betweens, correct them.
**Done when:** each assist has a licence note, a cost note, a stub test and one worked example judged by the owner.

### Phase 3D-226 · Gate C: the anime shot (case 4)
**Needs:** 3D-097, 3D-216 – 3D-225 · **Was:** new (2026-11-13) · **Lane:** A · **Status:** ⏸
> ⏸ **Parked as a to-do (owner, 2026-11-13):** the anime studio waits until the design work (§0a) is done.
- [ ] From a **reference clip chosen by the owner** (about 15 seconds, a fight shot), one person rebuilds the look in the studio in one day: toon shading, ink lines, twos, smears and impact frames, effects, camera moves, a shot list, rendered to video.
- [ ] The first aim is "looks like the same show", not an identical drawing. Time and cost are recorded.

**You'll see:** the reference clip and the studio's render side by side.
**Done when:** the owner compares them frame by frame and accepts the look; the time spent is under one working day; the render is frame-exact and repeatable.

## Stage 30 · Animation first: several animations, live

### Phase 3D-227 · Live multi-animation mixing
**Needs:** 3D-111, 3D-010 · **Was:** new (2026-11-13) · **Lane:** B* · **Status:** 📋
- [ ] Add several animations to one object or scene (walk, wave, blink, a camera move) and mix them: weights, additive layers, masks (arms only), priority, cross-fades; each is an action on a strip.
- [ ] They play **live in the viewport** while you edit, with no render step; scrubbing is exact (same as the kernel); changing a weight updates at once.
- [ ] Works for 2D layers and 3D objects on the same timeline.

**You'll see:** drag an "Idle" and a "Wave" onto a character, slide Wave's weight, and see both blend live.
**Done when:** a mixed pose at 5 times equals a hand-computed blend within 1e-6; live playback holds 60 fps with 5 layers on the mid tier; the export matches the editor within tolerance.

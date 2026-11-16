# IMPLEMENTATION ROADMAP — v5 (Releases)

## Project Name: LazyLayout — AI-Native Motion Design Studio
**Document Version:** 5.0.0
**Date:** 2026-11-14
**Status:** Active. **R0 (Solid ground) is the active release.** For live numbers run `npm run check:release-plan`.
**File Location:** `DOCS/INITIAL/ROADMAP.md`
**Supersedes:** v4.1 (277 phases worked in number order, with the Surfaces and Design tracks pulled forward and `ROADMAP_3D.md` running its own order). v5 changes **the order of work, the scope that is committed, and the rules**. It does not change what a phase builds: every phase keeps its number, its entry, its "Was" line and its history. The v4.1 text of §0–§4 is in git history (commit `0f4cc84`); v3.3 is kept as `ROADMAP_v3_ARCHIVE.md`.
**Inputs:** `PRD.md` v2.4, `AUDIT.md`, `AUDIT_ISSUES.md`, `BUSINESS/COMPETITIVE_ANALYSIS.md`, the owner's four cases (`ROADMAP_3D.md` §0a), and the audit of the repository on 2026-11-14 (§1).

---

## 0. The goal, and how to use this roadmap

### 0.1 The goal

> **Interactive motion, designed on a canvas, that ships as your website's own code.**

A person designs a component or a page, animates it on a timeline, makes it react to the pointer, to scroll and to touch, and exports plain code they own: no vendor runtime, and proof that the export matches the editor. AI builds the first draft and the person finishes it by hand. This is the one place where no competitor covers every part (`BUSINESS/COMPETITIVE_ANALYSIS.md` §5), and everything in this roadmap is ordered by how directly it serves that sentence.

The owner named four cases the studio must make (2026-11-13). They are the order of the product:

| Case | What a person makes | Release |
|---|---|---|
| **1** | A static or reactive component built from shapes and text: hover, press, pointer, scroll. Exported with no runtime. | **R1**, opened to the public in **R2** |
| **2** | A fully 3D element, the foil button, lit by a light that follows the pointer across the page. Then the watch page. | **R3**, **R4** |
| **3** | A photo with images and text corner-pinned, tracked and wrapped on its surface. | Later, theme L2 |
| **4** | Anime: looks 2D, moves with 3D depth. | Later, theme L10 (parked by the owner on 2026-11-13) |

### 0.2 How to use this roadmap

1. **Work only in the active release.** The active release is the first one in §2 that is not finished. `npm run check:release-plan` names it.
2. **Inside the release, take any work package whose Needs are ✅.** Packages in one release can run side by side; phases inside a package go in the order listed.
3. **A release ends at its gate.** The gate is a list of things a person does in the real editor and the real export, plus CI. When the gate passes, tag the commit, and only then open the next release.
4. **Later is not a queue.** The Later themes (§2) are everything else in the catalogue. Nothing in Later is started. At each gate the next release is cut from Later, with its real dependencies checked then.
5. **Scope changes at gates only, one in and one out** (Law 22). A new idea goes into a Later theme the day it is had, not into the active release.
6. **Status:** ✅ its gate passed in CI on `main` · 🚧 started, or built with a named gap · 📋 not started · ⏸ deferred. A 🚧 phase that belongs to a later release is **frozen**: its code stays, and nobody adds to it until its release is active.
7. **The phase catalogue is §5 onward** (the index, then every entry) and `ROADMAP_3D.md`. A phase's **Needs** line names real dependencies only. v4's rule that the phase number is the order is retired: the order is §2.
8. **Who builds what:** the lanes, branches and PR rules are in `DOCS/TEAM/COLLABORATION.md`. Each work package has one owner lane, agreed when the release opens.

---

## 1. Where the project is (audited 2026-11-14)

### 1.1 Measured on `main` @ `0f4cc84`

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Unit tests | 3,889 tests: 3,884 pass, 3 skipped (edition-gated), 2 fail on Windows only (two source-scanning tests compare paths with `/`). The `verify` job is green in CI. |
| Browser tests (CI run of 2026-11-14) | Chromium: 419 pass, 4 fail, 78 skipped. Firefox: 408 pass, 14 fail, 79 skipped. WebKit: 405 pass, 15 fail, 81 skipped. |
| CI on `main` | **Red since 2026-11-03.** About 100 commits have landed on `main` since. |
| Skipped browser tests | 74 `test.fixme` and 7 `test.skip` |
| `AUDIT_ISSUES.md` | 50 issues, all Open; 7 of them severity H (data loss, a stuck editor, a corrupt document) |
| Source size | About 290,000 lines of TS/TSX in `src/` (core 109,000; new editor 97,000; legacy editor 67,000), plus about 64,000 lines of unit tests and 21,500 lines of browser tests |
| AI | No model is called anywhere in `src/`. The AI code is offline parsers, plus the local MCP bridge (Phase 50). |

### 1.2 What is true today

- **The foundation is done and it is good** (Stage 0): one document model, a rules engine, a deterministic `evaluate()` kernel, patch-based undo, autosave, a three-browser harness and export parity.
- **The design tool is built** (Stage 1, Phases 13–51 ✅). Its gate, Phase 52, is not passed: no person has recorded the manual run, and three Stage 1 features cannot be reached in the new editor (tokens and styles, variant authoring, opening and saving a project file: D22–D24).
- **The animation engine is half built** (Stage 2). The clock, scheduler, adapters, timeline, keyframing, graph editor, parenting, masks, effects, links and expressions are merged (Phases 53–77). States, scroll choreography, text motion and **all of motion export (94–98) are not built in the numbered phases**.
- **The Design track moved fast**: drivers, links, follow, cloners, effectors, scroll scenes, split text and speed effects (D3–D18) were built in two days, each with named gaps, and they already export to plain HTML.
- **3D has started**: the GPU base, the 3D document and the viewport (3D-001 – 3D-030) are built with gaps.

### 1.3 Why v4.1 could not reach the goal

| Problem | Evidence | Fixed in v5 by |
|---|---|---|
| **The plan grew faster than the work.** | 91 phases in v3.3, 202 in v4.0, 277 in v4.1, then 227 for 3D and 24 for Design: about 500 in seven weeks. In the same weeks the count of ✅ phases went from 12 to 75. | A fixed scope per release, and one in, one out (Law 22). |
| **The order changed three times in one week.** | Surfaces (2026-11-11), 3D (2026-11-11) and the Design track (2026-11-13) were each pulled ahead of the number order. | One active release at a time (Law 21). |
| **The public beta was at the end.** | Phase 266 of 277. Security, real devices and the model integration all came after characters and 3D. | The beta is R2, straight after the first complete product. |
| **Needs were a chain, not dependencies.** | Law 18 made each phase need the one before it, so reduced motion "needed" the effect library, and the model integration "needed" the 3D gate. | Needs name real dependencies; the checker tests the release order against them. |
| **`main` is red and work merges on it.** | §1.1. The 3D roadmap said "do not wait for CI". | Green `main` is a law again (Law 23), and R0 exists to get there. |
| **No person checks the result.** | One PR added 36,000 lines for 29 phases in a day. The gates that need a person (Phase 52's manual run, D21) are the ones not done. | Every release gate is run by a person who did not build it (Law 24), and a PR holds one work package (Law 25). |
| **Two editors.** | The legacy editor (67,000 lines) still ships; engine features draw on the canvas with no controls in the new editor (`DOCS/UI/WIRING-53-80.md`). | R0 closes the wiring gaps; R2 retires the legacy editor (Phase 263). |

### 1.4 Will following this roadmap reach the goal?

Releases R0 to R2 reach the goal in §0.1 for case 1, in public, with about 60 phases, half of them already built with named gaps. R3 and R4 add case 2 and the watch page. That is the part this roadmap commits to. The rest of the catalogue (about 300 phases) is kept and sorted into themes, and is not promised: a team of three cannot build Figma, After Effects, Blender and Rive at once, and no plan should say it can. What protects the goal is structural: **every release ends with something a stranger can use**, so a wrong turn shows up in weeks.

---

## 2. The release plan

Each release has a promise, its work packages, a gate and a time budget. The **budget is proposed** and the owner confirms it when the release opens. When a budget runs out, a package moves to Later; the release is not stretched.

A package row lists its phases. Numbers are phases in this file, `D` and `S` are the Design and Surfaces tracks in this file, `3D-` is `ROADMAP_3D.md`. A range skips phases that are ✅. A pointer phase (its title says "→ …") is not listed: it is done where its target is done.

<!-- release-plan:start -->

### R0 · Solid ground

**Promise:** what is on `main` works, and this roadmap tells the truth. No new features.
**Budget (proposed):** 2 weeks.

| Package | What it delivers | Phases |
|---|---|---|
| R0.1 | **Stage 1 gate.** The four journeys pass in CI in three browsers, WebKit pan and zoom meets its number or the number is changed in writing, and a person records the manual run. | 52 |
| R0.2 | **Stage 1 in the new editor.** Tokens, variables and styles manager; authoring variants and detaching an instance; opening and saving a project file. | D22 – D24 |
| R0.3 | **Timeline and keyframing closed.** Each phase's named gap is built or moved to a Later theme in writing; the legacy animation panels are gone. | 64–71 |
| R0.4 | **Rig and compositing closed, with controls.** Anchor points, parenting, masks and mattes, the effect stack, links and expressions each have their controls in the new editor (`DOCS/UI/WIRING-53-80.md`). | 72–77 |
| R0.5 | **Scroll runtime.** The native path, pinned spacing, a scroll trigger from the UI, three browsers. | 81 |

Work in R0 that is not a phase:

- **Green `main`.** Every failing browser test in §1.1 is fixed, or deleted with the reason in the PR. The two Windows-only unit failures and the roadmap checkers pass on Windows and Linux.
- **Skipped tests.** Each of the 74 `test.fixme` and 7 `test.skip` is fixed, deleted, or carries the phase that will turn it on.
- **Severity H audit issues.** Issues 4, 7, 10, 21, 23, 24 and 33 of `AUDIT_ISSUES.md` are Solved, each with a test.

**Gate R0** (a person other than the author checks each line):
1. CI on `main` is green in Chromium, Firefox and WebKit for five merges in a row.
2. Phase 52 is ✅, with the recorded manual run linked from its entry.
3. The seven severity H issues are Solved.
4. `npm run check:release-plan` shows R0 with nothing open.

### R1 · The motion studio (case 1)

**Promise:** design a component or a section, animate it on the timeline, make it react to hover, press, the pointer and scroll, and export it as plain code that matches the editor, with no script where the browser can do it alone.
**Budget (proposed):** 6 weeks.

| Package | What it delivers | Phases |
|---|---|---|
| R1.1 | **Code freedom.** Style code per layer, per state and per breakpoint. | D3 |
| R1.2 | **Drivers and relationships.** Driven by scroll, pointer, speed and time; parent, links and expressions; follow, pins and helpers; connect anything. | D4 – D7 |
| R1.3 | **Repeat.** Repeater, cloner, fields and effectors. | D8 – D10 |
| R1.4 | **States and transitions.** States, smart animate, animated variants, and the States panel in the new editor. | 78–80, D15 |
| R1.5 | **Scroll.** The scroll scrubber and section choreography; scroll scenes; image sequences; smooth scroll and parallax. | 82, D11, D13, D14 |
| R1.6 | **Text.** Accessible splitting and text motion. | 83, 84, D12 |
| R1.7 | **Speed effects.** | D18 |
| R1.8 | **Reduced motion and accessibility rules.** | 93 |
| R1.9 | **Motion export.** The export architecture; React, Next and Vite; the export matrix in CI. | 94–96 |
| R1.10 | **Small export.** The size doctrine and budgets, export tiers, and zero-script export for 2D reactions. | 3D-010, 3D-191 – 3D-193 |

**The five reference recipes** (fixed for R1; the size gates of 3D-191 measure the same five):
1. A button with hover, press and focus states, and a spring between them.
2. A hero whose headline splits into words and reveals on scroll.
3. A card that tilts toward the pointer, with a label pinned to a point on its image.
4. A pinned scroll scene: a section holds for three screens while layers move at different depths.
5. A grid of cloned dots that a field pushes away from the pointer, and that stretches with scroll speed.

**Gate R1:**
1. Each recipe is built from an empty document in the new editor, in 30 minutes or less, by a person who did not build the features it uses. The runs are recorded.
2. Each recipe exports to plain HTML, Next and Vite. The export builds, has no LazyLayout import, and matches the editor at five times in three browsers.
3. Recipes 1 and 2 ship no script. Every recipe is under its budget from 3D-191.
4. The reduced-motion run shows no movement in any recipe.
5. Five people outside the team build recipes 1 and 2 with no help. What stopped them is written down and fixed, or listed.
6. `main` is green and R1 has nothing open.

### R2 · Public beta

**Promise:** anyone can open the studio, get a first draft from a sentence, finish it by hand, export it, and lose nothing they make.
**Budget (proposed):** 4 weeks.

| Package | What it delivers | Phases |
|---|---|---|
| R2.1 | **AI first draft.** The model integration, the validation loop, prompt to design and motion as a diff the person approves, evals, and the co-pilot for edits. | 241–245 |
| R2.2 | **Performance.** The performance lab, workers and the hot path. | 101 |
| R2.3 | **Security and operations.** Hardening, error reporting and kill switches. | 259, 260 |
| R2.4 | **Devices and licences.** The real-device matrix; licence and notices automation. | 261, 262 |
| R2.5 | **One editor.** The legacy editor and what earlier phases left behind are removed, with grep gates. | 263 |
| R2.6 | **Docs, journeys and the gate.** | 264–266 |

**Gate R2:** Phase 266, scoped to what R0 to R2 built (its entry says how). The tag is `v0.2.0-beta`.

### R3 · The foil button (case 2)

**Promise:** turn any 2D shape into a real 3D object, give it a material and studio light, inflate it like a foil balloon, press it and see it dent, light it from the pointer anywhere on the page, and export it in a few kilobytes.
**Budget (proposed):** 10 weeks. This is the largest release. If the budget runs out, the path tracer and baked lighting (3D-056, 3D-057) are the first to move to Later, with 3D-059 and the gate re-scoped in writing.

| Package | What it delivers | Phases |
|---|---|---|
| R3.1 | **Surfaces closed.** Height from the shape, material and light, creases, cloth at rest, content on a surface, press and ripple, export, the reference harness. | S1, S2, S3, S3b, S4, S4b, S5, S6, S7, S8, S9 |
| R3.2 | **GPU base and the 3D document.** | 3D-002, 3D-006, 3D-011 – 3D-013 |
| R3.3 | **Viewport, outliner and properties.** | 3D-015, 3D-018, 3D-019, 3D-021 – 3D-024 |
| R3.4 | **First shapes.** Primitives, 3D text, Make 3D, the modifier stack, subdivision, solidify. | 3D-025 – 3D-032 |
| R3.5 | **Look.** Materials, textures, decals, lights, shadows, the world, colour management, the real-time renderer. | 3D-033 – 3D-043 |
| R3.6 | **Simulation and the pointer.** Replay, cloth, pins and pressure, collisions, raycast events, pointer forces, baking. | 3D-048 – 3D-055 |
| R3.7 | **First ship.** Rendered view, baked lighting, the interactive runtime, 3D export v1, the reference harness, Gate M1. | 3D-056 – 3D-062 |
| R3.8 | **Small export and the pointer light.** The micro-renderer, one chunk per element, size gates, the pointer light, touch and tilt, Gate A. | 3D-194 – 3D-200 |

**Gate R3:** Gate M1 (3D-062), then Gate A (3D-200), each run by a person beside the owner's reference video.

### R4 · The watch page

**Promise:** the benchmark page. A 3D watch pinned for four screens turns with scroll while a ring of elements turns the other way; it comes apart into parts with labels that follow; words stagger in; a field of dots reacts to scroll speed.
**Budget (proposed):** 2 weeks.

| Package | What it delivers | Phases |
|---|---|---|
| R4.1 | **Model import.** GLTF and GLB. | 3D-158 |
| R4.2 | **3D parts.** Model parts and explode; labels that follow parts. | D19, D20 |
| R4.3 | **The gate.** | D21 |

**Gate R4:** D21: the owner builds the page from an empty document in under an hour; it holds 60 fps on the mid tier, works on touch and with reduced motion, and exports under its budget.

### Later · Themes, not promises

Everything else in the catalogue, sorted by theme. The order below is the order they will most likely be cut into releases, and it is decided again at each gate. Nothing here is started.

| Theme | What it holds | Phases |
|---|---|---|
| L1 | **Motion depth** (the rest of Stage 2): SVG morph and stroke drawing, motion along paths, the Motion adapter, motion per breakpoint, page transitions, the Playground, the motion library, more export targets, GSAP export, video and audio, the render queue, the Stage 2 gate. | 85–92, 97–100, 102 |
| L2 | **The photo studio** (case 3): the AI gateway, vision models, corner pin, tracking, cutout, a surface from a photo, text wrapped on it, relighting, Gate B. | 3D-201 – 3D-203, 3D-208 – 3D-215, D16, D17 |
| L3 | **Interaction and logic** (Stage 4, first half): scene awareness, more inputs, the reactivity card, gestures, drag, carousels, state machines, data-driven layers, Blueprints, 2D physics, the rules editor, sound. | 134, 135, 140, 142, 143, 145–150, 153, 155, 156, 158–171, 3D-146 – 3D-148 |
| L4 | **Sites and platform** (Stage 10): accounts, share links, remote MCP, collections, forms, whole-site export, billing, general availability. | 267–276 |
| L5 | **Design depth** (Stage 3). **Open since 2026-11-14 as Lane C** (§2.1), built beside the active release: live booleans, the Shape Builder, path operations, modifiers, generators, paint and stroke depth, text on paths, 2.5D. | 104–109, 111–131 |
| L6 | **GPU effects** (Stage 4, second half): the scene rasteriser, effect layers, liquid glass, 2D lights, deformation, fracture, cursors, the effect SDK and libraries, code components, the embed script, the Stage 4 gate. | 172, 176, 179–182, 185–187, 191–196, 198–202 |
| L7 | **3D studio depth** (M2, M3 and M4 of the 3D roadmap): curves, depth of field, post, render to video, cameras, 3D keyframes, actions, 3D interaction, page layers in 3D, 3D export v2, the simplicity pass and its gates, live animation mixing. | 3D-074, 3D-090, 3D-092 – 3D-094, 3D-096 – 3D-116, 3D-149 – 3D-157, 3D-159, 3D-164 – 3D-169, 3D-171 – 3D-173, 3D-175 – 3D-190, 3D-227 |
| L8 | **AI depth and easy for everyone** (Stages 7 and 8): the interaction builder, the effect author, references, full MCP parity, familiar keymaps, Figma and After Effects import, shape recognition, sketch to elements, recipes, Simple mode. | 246–258 |
| L9 | **Characters** (Stage 5): puppet pins, reactive rigs, blend trees, auto-rig, faces, tracking as an input, rig export. | 209–217 |
| L10 | **The anime studio** (case 4) **and everything deferred** in the 3D roadmap: edit mode, modifier depth, node materials, rigging and physics depth, the asset browser, instancing, the camera solve, toon and ink, twos and smears, shots. | 3D-063 – 3D-073, 3D-075 – 3D-089, 3D-091, 3D-095, 3D-117 – 3D-145, 3D-160 – 3D-163, 3D-170, 3D-174, 3D-207, 3D-216 – 3D-226 |
| L11 | **Apps** (Stage 11): the After-track audit and re-plan. | 277 |

<!-- release-plan:end -->

### 2.1 Changes to the plan

One line per change, newest first: the date, what moved in, what moved out, and who decided.

| Date | Change | Decided by |
|---|---|---|
| 2026-11-15 | **Lane G opened by the owner:** Stage 7, AI & agents (Phases 241–250, R2/L8), starts Phase 241 now alongside active R0 (owner exception to Law 21, `Needs: 13, 50` already ✅ on `main`). | Owner |
| 2026-11-14 | **Lane C opened by the owner:** Stage 3, Design depth (Phases 103–131, theme L5), is built now by a third lane, beside the active release. It is the one exception to Law 21; 3D (R3, R4) stays after the beta. | Owner |
| 2026-11-14 | v5 written. The watch page gate (D21) no longer needs corner pin and tracking (D16, D17): the page does not use them. The Needs lines of Phases 93, 94, 95, 101, 241 and 259 now name real dependencies. | Proposed in the v5 PR; the owner decides by merging it |

---

## 3. Architectural Laws

Binding for every phase. A gate that passes while breaking a law doesn't count. Laws 1–17 are v3's, shortened; the full text with examples is in `ROADMAP_v3_ARCHIVE.md` §2. Laws 21–25 are new in v5 and are about how the work is run.

1. **Inside-Out:** types and schema → rules → diagnostics → UI. No control before the rule that governs it.
2. **One Document:** every surface reads and writes the MDM through one store API. No parallel models.
3. **Preview = Export:** every animation has a pure `evaluate()` result that the live preview and the exported build both match within tolerance. Stateful layers replay deterministically (Law 15).
4. **No Silent AI Writes:** every AI or agent change is a diff the user approves (per change, or with a per-session "approve automatically" switch that still logs each change as its own undo step).
5. **Real-Environment Verification:** gates run in `tsc`, real browsers and real builds. String checks may support a gate, never be it.
6. **Simple by Default:** every capability has a Simple face (≤ 7 controls, no jargon) before or with its Pro face.
7. **Licensing Gate:** third-party code runs only after its licence is recorded in `LICENSES.md`.
8. **One Clock:** one transport owns time (Phase 54). No panel keeps its own playhead.
9. **Hot Path:** per-frame values never go through React state or the document store. They go through the frame scheduler and the renderer's node registry.
10. **Document Space:** geometry lives in the MDM in document coordinates. Editor code reads layout only through the renderer's measurement API.
11. **One Renderer:** the stage and the exporters render from the same per-archetype render definitions (Phase 17).
12. **Signal:** continuous inputs (pointer, scroll, keys, time, audio, tilt) are sampled once per frame by the input bus (Phase 132). Nothing else attaches its own listeners or runs its own `requestAnimationFrame`.
13. **Surface Budget:** only the GPU compositor (Phase 173) creates WebGL/WebGPU contexts, within a context and memory budget per device tier.
14. **Graceful Degradation:** every effect declares a fallback chain ending in a poster, a touch behaviour and a reduced-motion behaviour.
15. **Deterministic Replay:** simulations, particles and stateful operators replay exactly from `(seed, input tape, fixed step)`.
16. **Untrusted Code:** user code (code components, raw shaders, expressions, imported files) runs only inside its sandbox and never with the editor origin's privileges.
17. **Visual First (No Maths):** everything can be authored without typing a number or formula: canvas handles, plain-language choices, feel controls (Bounce, Time, Smoothness, Strength, Variety), or ranges dragged over live meters. Pro mode shows the numbers.
18. **Release order (v5; was Sequential in v4):** the order of work is the release plan in §2. A phase's "Needs" line names only real dependencies, and only lower phase numbers inside this file. `scripts/check-release-plan.mts` fails if a phase in a release needs a phase in a later release or in Later, or if any phase is in no package. `scripts/check-roadmap-order.mts` still checks that Needs point backwards.
19. **Visible Progress (new in v4):** from Phase 13 on, every phase states what changes for a user ("You'll see"). Phases with nothing visible are infrastructure, and no more than two run in a row.
20. **Agent Parity (new in v4):** every user action is a typed command on the command bus (Phase 13), and the MCP server exposes every command (Phases 50, 250). A CI test fails if a menu item, button, shortcut or palette entry has no command. This is what lets Claude do everything a person can do in the editor.
21. **One release at a time (v5):** work happens in the active release only. A phase of a later release is not started, and one that is already 🚧 is frozen until its release is active. The owner may open the next release early only by closing the active one at its gate.
22. **Fixed scope: one in, one out (v5):** the phases of a release are fixed when it opens. A phase enters a release only at a gate, or when another of about the same size leaves it, and the change is one line in §2.1. A new phase is added to the catalogue only inside a Later theme.
23. **Green main (v5):** `main` is green in three browsers. A PR merges only when CI is green. If `main` turns red, the next merge is the fix, and nothing else merges before it. A test is never skipped to make CI green without the phase that will turn it back on.
24. **A person at every gate (v5):** a release gate is run in the real editor and the real export by a person who did not build what is being checked, and the run is recorded. Tests support a gate; they are not the gate.
25. **Reviewable size (v5):** a PR holds one work package at most, and each phase in it has its own commit and its own test evidence, so that a person can read what changed.

---

## 4. Definition of Done (per phase)

A phase is **✅** only when:
1. Every checklist item is `[x]`.
2. Its "Done when" gate passes **in CI on `main`**, not only locally. (v5: this is true for `ROADMAP_3D.md` too; the rule "do not wait for CI" of 2026-11-12 is withdrawn now that CI runs again.)
3. `tsc` has 0 errors, ESLint has 0 errors within the warning budget, all tests pass, and `next build` succeeds.
4. Nothing regresses in the Playwright suite, the export parity suite, or (from Phase 101) the performance budget suite.
5. The "You'll see" line is true in the running editor (or the exported build), checked by a Playwright test or a recorded run.
6. Every command the phase adds is registered with a typed argument schema (Law 20).
7. Docs are updated: this roadmap (index and entry), a changelog fragment, any spec or decision record it touches, and `AUDIT.md` for the IDs it closes.
8. Any legacy code the phase replaces is deleted in the same phase, or the phase names the later phase that deletes it.
9. It can be reached in the new editor (`/editor`). An engine feature with no control is 🚧, with the missing control named.

A release is **done** only when every phase in it is ✅ and its gate in §2 has passed (Law 24).

---

## 5. Phase Index (the tracking list)

One row per phase, in catalogue order. **The order of work is the release plan in §2, not this list.** Update the Status column together with the phase's own entry; `npm run check:roadmap-order` fails if they disagree or if any phase needs a later one, and `npm run check:release-plan` fails if the release plan and the Needs disagree.

**Stage 0 · Foundation (Phases 1–12)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 1 | Build health & CI | — | v3 1 | 0 | ✅ |
| 2 | Unified Motion Document Model | 1 | v3 2 | 0 | ✅ |
| 3 | History, autosave & project files | 2 | v3 3 + 41.2 | 0 | ✅ |
| 4 | Real-environment verification harness | 1 | v3 4 | 0 | ✅ |
| 5 | Dependency reality & Wasm decision | 1 | v3 5 | 0 | ✅ |
| 6 | Scope, naming & docs cleanup | 1 | v3 6 | 0 | ✅ |
| 7 | Canonical property paths & geometry | 2 | v3 42 | 0 | ✅ |
| 8 | Motion primitives | 7 | v3 7 | 0 | ✅ |
| 9 | Compositions & nesting | 8 | v3 46 | 0 | ✅ |
| 10 | Executable rules engine | 8, 9 | v3 8 | 0 | ✅ |
| 11 | Deterministic evaluation kernel | 8, 9 | v3 9 | 0 | ✅ |
| 12 | Store decomposition | 2, 3 | v3 41 | 0 | ✅ |

**Stage 1 · Figma / Wix-style viewport (Phases 13–52)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 13 | Command bus: finish and type every command | 12 | v3 43.1 (rest), 43.3 | 1 | ✅ |
| 14 | Workspace model & panel registry | 13 | v3 44.1, 44.4 | 1 | ✅ |
| 15 | Design / Animate / Code presets & inspector tabs | 14 | v3 44.2, 44.3 | 1 | ✅ |
| 16 | Threat model for the stage and user content | 3 | v3 80.1 | 1 | ✅ |
| 17 | Render definitions per archetype | 7, 8, 16 | v3 48.1 | 1 | ✅ |
| 18 | Stage host v2: live DOM frames, no HTML strings | 17 | v3 48.2, 48.5 | 1 | ✅ |
| 19 | Incremental updates & measurement API | 18 | v3 48.3, 48.4 | 1 | ✅ |
| 20 | Viewport camera | 19 | v3 49.1 | 1 | ✅ |
| 21 | Multi-frame canvas | 20 | v3 49.2, 20.3 | 1 | ✅ |
| 22 | Hit-testing | 21 | v3 49.3 | 1 | ✅ |
| 23 | Overlay layer & Design / Preview modes | 22 | v3 49.4, 49.5 | 1 | ✅ |
| 24 | Tool state machine | 13, 23 | v3 43.2 (infrastructure) | 1 | ✅ |
| 25 | Creation tools: frames, shapes and text boxes | 24 | v3 43.2 (Tier A), 20.4 | 1 | ✅ |
| 26 | Selection | 25 | v3 20.1 (selection) | 1 | ✅ |
| 27 | Transform handles | 26 | v3 20.1 (transform) | 1 | ✅ |
| 28 | Snapping, smart guides & rulers | 27 | v3 20.2 | 1 | ✅ |
| 29 | Editing operations | 26 | — (new: not planned in v3) | 1 | ✅ |
| 30 | Align, distribute & tidy | 29 | — (new) | 1 | ✅ |
| 31 | Text on the canvas | 25 | — (new) | 1 | ✅ |
| 32 | Layers panel | 15, 26 | v3 21.1 | 1 | ✅ |
| 33 | Design inspector: Simple face | 32 | v3 22.1 (design half) | 1 | ✅ |
| 34 | Design inspector: Pro face | 33 | v3 22.2 | 1 | ✅ |
| 35 | Paint: colour, gradients, strokes, shadows & blur | 34 | v3 22.2 (paint) + new | 1 | ✅ |
| 36 | Asset store & storage safety | 3 | v3 54.1, 54.2 | 1 | ✅ |
| 37 | Image layers | 36 | — (new) | 1 | ✅ |
| 38 | Fonts | 36 | v3 17.3 | 1 | ✅ |
| 39 | Pen & pencil | 24 | v3 35.1–35.4 | 1 | ✅ |
| 40 | Vector editing & boolean operations | 39 | v3 16.1 | 1 | ✅ |
| 41 | Auto-layout: stacks | 27, 32 | v3 50.1 (stacks) | 1 | ✅ |
| 42 | Grid layout & constraints | 41 | v3 50.1 (grid), 50.2 | 1 | ✅ |
| 43 | Breakpoints & overrides | 42 | v3 50.3 (properties half) | 1 | ✅ |
| 44 | Breakpoint canvas | 21, 43 | v3 50.4 | 1 | ✅ |
| 45 | Design tokens & styles | 35, 38 | v3 22.3 | 1 | ✅ |
| 46 | Components & instances | 29, 32 | v3 75.1, 75.5 (design) | 1 | ✅ |
| 47 | Variants & component properties | 46 | v3 75.2 (static), 75.3 | 1 | ✅ |
| 48 | Sections, pages & prototype links | 23, 47 | v3 76.1 (static), 77.1, 77.2, 77.4 | 1 | ✅ |
| 49 | Static export v1 | 37, 45, 48 | v3 27.1 (part), 48 gate, 50.5 (layout), 75.5 | 1 | ✅ |
| 50 | Agent bridge: local MCP server v0 | 13, 49 | — (new) | 1 | ✅ |
| 51 | Section templates & starter projects | 45, 48 | v3 76.3 (static half), 76.4 | 1 | ✅ |
| 52 | Stage 1 gate: the design journey | 13–51 | v3 58.1 + new | 1 | 🚧 |

**Stage 2 · Animation grammar (Phases 53–102)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 53 | Animation grammar: close the schema gaps | 10, 11 | — (AUD-59, found by v3 8) | 2 | ✅ |
| 54 | Transport & one clock | 11, 12 | v3 45.1 | 2 | ✅ |
| 55 | Frame scheduler | 54 | v3 45.2, 45.3 | 2 | ✅ |
| 56 | Move playback onto the clock; retire the old Sequencer clock | 55 | v3 45.4 | 2 | ✅ |
| 57 | Engine adapters & the kernel on the stage | 19, 56 | v3 10.1 (interface, kernel adapter) | 2 | ✅ |
| 58 | CSS / Web Animations adapter | 57 | v3 10.1 (WAAPI) | 2 | ✅ |
| 59 | Scrub vs play | 58 | v3 10.2 | 2 | ✅ |
| 60 | Parity overlay | 59 | v3 10.3 | 2 | ✅ |
| 61 | Timeline workspace: layout | 15, 54, 60 | v3 52.1, 23.1, 21.2 | 2 | ✅ |
| 62 | Twirl-downs & stopwatches | 61 | v3 52.2 | 2 | ✅ |
| 63 | Timeline navigation | 62 | v3 52.3 | 2 | ✅ |
| 64 | Timeline at scale | 63 | v3 52.4 | 2 | 🚧 |
| 65 | Nested & interaction composition tabs | 64 | v3 52.5 | 2 | 🚧 |
| 66 | Keyframing | 65 | v3 23.2 | 2 | 🚧 |
| 67 | Graph editor & easing | 66 | v3 23.3 | 2 | 🚧 |
| 68 | Retire the legacy animation panels | 67 | v3 57.1 (part) | 2 | 🚧 |
| 69 | Motion paths on the canvas | 40, 68 | v3 53.1 | 2 | 🚧 |
| 70 | Auto-key on the stage & value HUD | 69 | v3 53.2, 53.4 | 2 | 🚧 |
| 71 | Onion skin | 70 | v3 53.3 | 2 | 🚧 |
| 72 | Anchor points & pins | 71 | v3 51.1, 88.2 (model) | 2 | 🚧 |
| 73 | Parenting & helper layers | 72 | v3 51.2, 88.1 (rendering) | 2 | 🚧 |
| 74 | Blend modes, adjustment layers, masks & mattes | 73 | v3 51.3, 51.4 | 2 | 🚧 |
| 75 | Effect stack & motion blur | 74 | v3 51.5, 51.6 | 2 | 🚧 |
| 76 | Property links & pick-whip | 75 | v3 47.1, 47.3, 47.4 | 2 | 🚧 |
| 77 | Expressions | 76 | v3 47.2, 47.4 (export) | 2 | 🚧 |
| 78 | States | 33, 77 | v3 11.1 | 2 | 📋 |
| 79 | Transitions & smart animate | 78 | v3 11.2 | 2 | 🚧 |
| 80 | Animated variants & interactive components | 47, 79 | v3 75.2 (animated half), 75.4 | 2 | 🚧 |
| 81 | Scroll: model & runtime | 59 | v3 13.1, 13.2 | 2 | 🚧 |
| 82 | Scroll simulator & section choreography | 48, 81 | v3 13.3, 76.2 | 2 | 📋 |
| 83 | Accessible text splitting | 31, 38, 82 | v3 17.1 | 2 | 📋 |
| 84 | Text motion | 83 | v3 17.2 | 2 | 📋 |
| 85 | SVG morph & stroke drawing | 84 | v3 16.2, 16.3 (stroke) | 2 | 🚧 |
| 86 | Motion along paths & SVG filters | 85 | v3 16.3 (motion path), 16.4 | 2 | 🚧 |
| 87 | Motion engine adapter | 86 | v3 15 | 2 | 🚧 |
| 88 | Motion per breakpoint | 43, 87 | v3 50.3 (motion half) | 2 | 🚧 |
| 89 | Page transitions | 88 | v3 77.3 | 2 | 📋 |
| 90 | Animation Playground | 89 | v3 24.0–24.3, 24.5 | 2 | 📋 |
| 91 | Motion library infrastructure | 90 | v3 25.1, 25.2, 21.3, 22.4 | 2 | 📋 |
| 92 | Library: text, SVG & component motion | 91 | v3 25.3 (waves 1, 3, 4) | 2 | 📋 |
| 93 | Reduced motion & accessibility rules | 79, 82, 84 | v3 29.1, 29.3, 11.4 | 2 | 🚧 |
| 94 | Motion export architecture | 49, 68 | v3 27.1 | 2 | 📋 |
| 95 | Motion export: React, Next & Vite | 80, 82, 84, 93, 94 | v3 27.2, 27.3, 29.2 | 2 | 📋 |
| 96 | Export matrix in CI | 95 | v3 27.4 | 2 | 📋 |
| 97 | More export targets | 96 | v3 28 | 2 | 📋 |
| 98 | GSAP as an opt-in export target | 97 | v3 14 | 2 | 📋 |
| 99 | Video & audio layers | 36, 98 | v3 54.3, 54.4 | 2 | 📋 |
| 100 | Render queue: video, GIF, image sequences & Lottie | 99 | v3 55 | 2 | 📋 |
| 101 | Performance lab, workers & hot path | 96 | v3 56, 26.1–26.4 | 2 | 📋 |
| 102 | Stage 2 gate: the animation journey | 53–101 | v3 58.2, 58.3, 58.4 | 2 | 📋 |

**Stage 3 · Design depth (Phases 103–131)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 103 | Curve-exact path engine → *ROADMAP_3D 3D-027 (the path engine part)* | 40 | — (new in v4.1) | 3 | 🚧 |
| 104 | Live boolean groups | 46, 103 | — (new in v4.1) | 3 | 🚧 |
| 105 | Shape Builder tool | 104 | — (new in v4.1) | 3 | 🚧 |
| 106 | Path operations: offset, outline, simplify, divide & knife | 103 | — (new in v4.1) | 3 | 🚧 |
| 107 | Smooth corners & corner styles | 35, 40 | — (new in v4.1) | 3 | 🚧 |
| 108 | Soft union: gooey groups | 104 | — (new in v4.1) | 3 | 🚧 |
| 109 | Modifier stack | 17, 103 | — (new in v4.1) | 3 | 🚧 |
| 110 | Modifiers I: repeat, trim, offset & round → *Design track D8 (repeat)* | 109 | — (new in v4.1) | 3 | 🚧 |
| 111 | Modifiers II: twist, bend, wiggle, zig-zag, pucker & bloat | 110 | — (new in v4.1) | 3 | 🚧 |
| 112 | Shape generators: scatter, Voronoi & flow lines | 110 | — (new in v4.1) | 3 | 🚧 |
| 113 | Paint depth I: blend mode and mask per fill | 35, 37 | — (new in v4.1) | 3 | 🚧 |
| 114 | Paint depth II: noise, grain, pattern & texture fills | 113 | — (new in v4.1) | 3 | 🚧 |
| 115 | Mesh gradients | 35 | — (new in v4.1) | 3 | 🚧 |
| 116 | Live fills: a frame or component as a fill | 46, 114 | — (new in v4.1) | 3 | 🚧 |
| 117 | Fills & strokes on text | 31, 38, 113 | — (new in v4.1) | 3 | 🚧 |
| 118 | Stroke depth: several strokes, gradients, alignment & markers | 35, 40 | — (new in v4.1) | 3 | 🚧 |
| 119 | Variable-width strokes | 103, 118 | — (new in v4.1) | 3 | 🚧 |
| 120 | Brushes & pen pressure | 39, 119 | — (new in v4.1) | 3 | 🚧 |
| 121 | Layer effects II: glow, progressive blur, grain & frosted glass | 35, 114 | — (new in v4.1) | 3 | 🚧 |
| 122 | Image adjustments & filters | 37 | — (new in v4.1) | 3 | 🚧 |
| 123 | Colour tools: palettes, harmony & contrast | 45 | — (new in v4.1) | 3 | 🚧 |
| 124 | Text on a path | 31, 40 | — (new in v4.1) | 3 | 🚧 |
| 125 | Text in shapes & typography depth | 38, 124 | — (new in v4.1) | 3 | 🚧 |
| 126 | Icons, illustrations & stock media | 36 | — (new in v4.1) | 3 | 🚧 |
| 127 | 2.5D spaces: perspective & depth | 27, 41 | — (new in v4.1) | 3 | 🚧 |
| 128 | 3D arrangements for page layers | 127 | — (new in v4.1) | 3 | 🚧 |
| 129 | Depth camera & parallax preview | 127 | — (new in v4.1) | 3 | 🚧 |
| 130 | Design-depth export | 49, 108, 111, 112, 125, 128, 129 | — (new in v4.1) | 3 | 🚧 |
| 131 | Stage 3 gate: the design-depth journey | 103–130 | — (new in v4.1) | 3 | 🚧 |

**Stage 4 · Interactive & complex animation (Phases 132–202)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 132 | Input bus & coordinate spaces → *ROADMAP_3D 3D-044* | 55, 102 | v3 59.1 | 4 | 🚧 |
| 133 | Signal catalogue, including the keyboard → *ROADMAP_3D 3D-045* | 132 | v3 59.2 + new (keyboard) | 4 | 🚧 |
| 134 | Scene awareness: every layer's live self | 133 | — (new in v4.1) | 4 | 🚧 |
| 135 | More inputs: microphone, camera, gamepad & tilt | 134 | — (new in v4.1) | 4 | 🚧 |
| 136 | Input tapes → *ROADMAP_3D 3D-046* | 133 | v3 59.3, 23.4, 24.4, 12.3 | 4 | 🚧 |
| 137 | GPU & interactive verification harness → *ROADMAP_3D 3D-004* | 136 | v3 71 | 4 | 🚧 |
| 138 | Operators & bindings runtime → *ROADMAP_3D 3D-047* | 137 | v3 60.1 | 4 | 🚧 |
| 139 | Targets, blending & cycles → *ROADMAP_3D 3D-146* | 138 | v3 60.2 + the v3 9 amendment | 4 | 🚧 |
| 140 | Reactivity card (Simple) | 139 | v3 60.3 | 4 | 🚧 |
| 141 | Connect anything: drag a property onto an input → *Design track D7* | 140 | — (new in v4.1) | 4 | 🚧 |
| 142 | Signals panel (Pro) & binding export | 140 | v3 60.4 | 4 | 🚧 |
| 143 | Pointer behaviours as presets | 142 | v3 12.2 | 4 | 🚧 |
| 144 | Velocity effects: squash & stretch, lean & trails → *Design track D18* | 134, 143 | — (new in v4.1) | 4 | 🚧 |
| 145 | Reactions that change layout, inside fixed boxes | 139, 143 | — (new in v4.1) | 4 | 🚧 |
| 146 | Keyboard & focus interactivity | 143 | — (new) | 4 | 🚧 |
| 147 | Gestures: hold, swipe, fling, pull & release | 146 | — (new in v4.1) | 4 | 🚧 |
| 148 | Drag with constraints | 147 | — (new in v4.1) | 4 | 🚧 |
| 149 | Carousels, scrollers & seamless loops | 81, 128, 148 | — (new in v4.1) | 4 | 🚧 |
| 150 | Drag & drop between layers | 148 | — (new in v4.1) | 4 | 🚧 |
| 151 | State machines → *ROADMAP_3D 3D-148* | 146 | v3 11.3 | 4 | 🚧 |
| 152 | Helpers, pins & Follow → *Design track D6* | 151 | v3 88 | 4 | 🚧 |
| 153 | Split into real layers | 152 | v3 89.1 | 4 | 🚧 |
| 154 | Cloners, tags & group targets → *Design track D9* | 153 | v3 89.2, 89.3 | 4 | 🚧 |
| 155 | Roles, relations & selectors | 134, 154 | — (new in v4.1) | 4 | 🚧 |
| 156 | Data-driven layers & animated charts | 154 | — (new in v4.1) | 4 | 🚧 |
| 157 | Fields & effectors → *Design track D10* | 154 | v3 90.1–90.3 | 4 | 🚧 |
| 158 | One evaluation space & no-maths kinetics | 157 | v3 90.4–90.6 | 4 | 🚧 |
| 159 | Blueprint model & interaction library | 158 | v3 72.1, 72.2 | 4 | 🚧 |
| 160 | NodeScript text form & one model with the grammar | 159 | v3 72.3, 72.4 | 4 | 🚧 |
| 161 | Blueprint runtime | 160 | v3 74.1 | 4 | 🚧 |
| 162 | 2D physics core | 161 | v3 91.3, 64.1 (decision) | 4 | 🚧 |
| 163 | Colliders & bodies | 162 | v3 91.1, 91.2 | 4 | 🚧 |
| 164 | Contact events & collision view | 163 | v3 91.4, 91.5 | 4 | 🚧 |
| 165 | Joints, ropes & chains | 164 | — (new in v4.1) | 4 | 🚧 |
| 166 | Soft bodies & jelly | 109, 165 | — (new in v4.1) | 4 | 🚧 |
| 167 | Simple rules editor | 164 | v3 73.1, 73.5, 73.6 | 4 | 🚧 |
| 168 | Blueprint graph editor & debugger | 167 | v3 73.2, 73.3 | 4 | 🚧 |
| 169 | Blueprint compiler & interaction parity | 168 | v3 74.2–74.4, 91.6 | 4 | 🚧 |
| 170 | Spawner | 169 | v3 89.4 | 4 | 🚧 |
| 171 | Sound design & haptics | 99, 169 | — (new in v4.1) | 4 | 🚧 |
| 172 | Scene rasteriser: any layer to pixels | 17, 19, 74, 170 | — (new in v4.1) | 4 | 🚧 |
| 173 | GPU surface strategy & compositor → *ROADMAP_3D 3D-002* | 170 | v3 61.1, 61.3 | 4 | 🚧 |
| 174 | Passes, render targets & GPU memory ledger → *ROADMAP_3D 3D-003* | 173 | v3 61.2, 61.5 | 4 | 🚧 |
| 175 | Layer textures, outlines & distance fields → *ROADMAP_3D 3D-028* | 172, 174 | — (new in v4.1) | 4 | 🚧 |
| 176 | Surfaces in the editor & the first interactive background | 174 | v3 61.4, 19.1 | 4 | 🚧 |
| 177 | Shader graph → *ROADMAP_3D 3D-083 (deferred)* | 176, 175 | v3 62.1, 62.3 | 4 | 🚧 |
| 178 | Raw GLSL (Pro) & shader safety → *ROADMAP_3D 3D-084 (deferred)* | 177 | v3 62.2 | 4 | 🚧 |
| 179 | Effect layers | 74, 175, 178 | — (new in v4.1) | 4 | 🚧 |
| 180 | Outline effects: light that rides edges | 179 | — (new in v4.1) | 4 | 🚧 |
| 181 | Backdrop sampling & liquid glass | 180 | — (new in v4.1) | 4 | 🚧 |
| 182 | 2D lights & surface depth | 175, 179 | — (new in v4.1) | 4 | 🚧 |
| 183 | Particles & force fields → *ROADMAP_3D 3D-140, 3D-141 (the 3D part, deferred)* | 178, 175 | v3 63, 19.2 | 4 | 🚧 |
| 184 | Stateful simulations & replay → *ROADMAP_3D 3D-048* | 183 | v3 64.2, 64.3 | 4 | 🚧 |
| 185 | Deformation: mesh warp, bend & peel | 109, 175, 184 | — (new in v4.1) | 4 | 🚧 |
| 186 | Fracture: shatter, strips & tearing | 112, 163, 185 | — (new in v4.1) | 4 | 🚧 |
| 187 | Media as texture & distortion | 184, 175 | v3 65 | 4 | 🚧 |
| 188 | Scroll-scrubbed image sequences & video → *Design track D13* | 81, 99, 187 | — (new in v4.1) | 4 | 🚧 |
| 189 | Smooth scrolling & scroll physics → *Design track D14* | 188 | — (new in v4.1) | 4 | 🚧 |
| 190 | Depth parallax by scroll and cursor → *Design track D14* | 129, 143, 189 | — (new in v4.1) | 4 | 🚧 |
| 191 | Cursor & overlay layer | 187, 155, 180 | v3 66 | 4 | 🚧 |
| 192 | Effect SDK: effects as data | 191 | v3 67 | 4 | 🚧 |
| 193 | Library: interaction, backgrounds, cursors & distortion | 192 | v3 25.3 (waves 2, 5, 7, 8, 9) | 4 | 🚧 |
| 194 | Library: micro-interactions, glass, light & deformation | 193 | — (new in v4.1) | 4 | 🚧 |
| 195 | Sandbox boundaries for untrusted code | 193 | v3 80.2 | 4 | 🚧 |
| 196 | Code components | 195 | v3 68 | 4 | 🚧 |
| 197 | Interactive export runtime → *ROADMAP_3D 3D-058* | 196, 194 | v3 69.1, 69.2 | 4 | 🚧 |
| 198 | Embed script, size budgets & Web Vitals | 197 | v3 69.3–69.5 | 4 | 🚧 |
| 199 | Interactive accessibility | 198 | v3 29 (v3.0 amendment), 29.4 | 4 | 🚧 |
| 200 | Interactive performance budgets per tier | 199 | v3 26 (v3.0 amendment) | 4 | 🚧 |
| 201 | Composition test suite | 200 | v3 91.7 | 4 | 🚧 |
| 202 | Stage 4 gate: the interactive journey | 132–201 | v3 58.5, 58.6 | 4 | 🚧 |

**Stage 5 · Characters & rigging (Phases 203–217)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 203 | Rig model: bones & skins → *ROADMAP_3D 3D-117 (deferred)* | 72, 73, 185, 202 | — (new in v4.1) | 5 | 🚧 |
| 204 | Bone tool & posing → *ROADMAP_3D 3D-118 (deferred)* | 203 | — (new in v4.1) | 5 | 🚧 |
| 205 | Bones on the timeline → *ROADMAP_3D 3D-119 (deferred)* | 66, 67, 71, 204 | — (new in v4.1) | 5 | 🚧 |
| 206 | Mesh deformation & weights → *ROADMAP_3D 3D-120 (deferred)* | 205 | — (new in v4.1) | 5 | 🚧 |
| 207 | Inverse kinematics → *ROADMAP_3D 3D-121 (deferred)* | 206 | — (new in v4.1) | 5 | 🚧 |
| 208 | Constraints & secondary motion → *ROADMAP_3D 3D-122 (deferred)* | 207 | — (new in v4.1) | 5 | 🚧 |
| 209 | Puppet pins | 206 | — (new in v4.1) | 5 | 🚧 |
| 210 | Rigs that react | 135, 208, 209 | — (new in v4.1) | 5 | 🚧 |
| 211 | Character states & blend trees | 151, 210 | — (new in v4.1) | 5 | 🚧 |
| 212 | Auto-rig & pose sliders | 211 | — (new in v4.1) | 5 | 🚧 |
| 213 | Faces: expressions, blinks & lip sync | 99, 212 | — (new in v4.1) | 5 | 🚧 |
| 214 | Face & pose tracking as an input | 135, 213 | — (new in v4.1) | 5 | 🚧 |
| 215 | Rig export runtime | 197, 214 | — (new in v4.1) | 5 | 🚧 |
| 216 | Rig library & recipes | 215 | — (new in v4.1) | 5 | 🚧 |
| 217 | Stage 5 gate: the character journey | 203–216 | — (new in v4.1) | 5 | 🚧 |

**Stage 6 · 3D (Phases 218–240)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 218 | 3D stack decision & licences → *ROADMAP_3D 3D-001* | 202 | v3 18 (v3.0, v3.3 amendments) | 6 | 🚧 |
| 219 | Scene layer → *ROADMAP_3D 3D-012* | 218 | v3 18.1 | 6 | 🚧 |
| 220 | 3D viewport editing → *ROADMAP_3D 3D-014, 3D-016* | 219 | — (new) | 6 | 🚧 |
| 221 | Scene hierarchy & 3D inspector → *ROADMAP_3D 3D-021, 3D-022* | 220 | — (new) | 6 | 🚧 |
| 222 | Primitives & 3D text → *ROADMAP_3D 3D-025, 3D-026* | 221 | v3 18.2 (primitives) | 6 | 🚧 |
| 223 | Inflate & extrude any vector into 3D → *ROADMAP_3D 3D-029* | 103, 222 | — (new in v4.1) | 6 | 🚧 |
| 224 | GLTF import pipeline → *ROADMAP_3D 3D-158* | 222 | v3 18.2 (GLTF), 54 (v3.3 amendment) | 6 | 🚧 |
| 225 | Materials & textures → *ROADMAP_3D 3D-033* | 224 | v3 18.2 (materials) | 6 | 🚧 |
| 226 | Lights, shadows & environments → *ROADMAP_3D 3D-037 – 3D-039* | 225 | v3 18.2 (lights) | 6 | 🚧 |
| 227 | Cameras & camera paths → *ROADMAP_3D 3D-099, 3D-101* | 226 | v3 18.3 (camera) | 6 | 🚧 |
| 228 | 3D keyframes on the timeline → *ROADMAP_3D 3D-104, 3D-108* | 227 | v3 18.3 (tracks) | 6 | 🚧 |
| 229 | Animated GLTF playback → *ROADMAP_3D 3D-110* | 228 | — (new) | 6 | 🚧 |
| 230 | 3D skeletons & IK → *ROADMAP_3D 3D-127, 3D-128 (deferred)* | 207, 208, 229 | — (new in v4.1) | 6 | 🚧 |
| 231 | 3D materials in the shader graph & WebGPU → *ROADMAP_3D 3D-083 (deferred)* | 229 | v3 18 (v3.0 amendment), 62 (TSL) | 6 | 🚧 |
| 232 | 3D reactions & raycast events → *ROADMAP_3D 3D-053, 3D-150* | 231 | v3 18.3 (pointer) + new | 6 | 🚧 |
| 233 | Page layers inside 3D scenes → *ROADMAP_3D 3D-165* | 232 | — (new in v4.1) | 6 | 🚧 |
| 234 | Instancing, LOD & 3D cloners → *ROADMAP_3D 3D-170 (deferred)* | 232 | — (new; extends 154 to 3D) | 6 | 🚧 |
| 235 | 3D physics → *ROADMAP_3D 3D-135 (deferred)* | 234 | — (new) | 6 | 🚧 |
| 236 | Post-processing → *ROADMAP_3D 3D-093* | 235 | — (new) | 6 | 🚧 |
| 237 | 3D memory discipline → *ROADMAP_3D 3D-176* | 236 | v3 18 (v3.3 amendment) | 6 | 🚧 |
| 238 | 3D export → *ROADMAP_3D 3D-171* | 237 | v3 18.4 | 6 | 🚧 |
| 239 | 3D library → *ROADMAP_3D 3D-184* | 238 | v3 25.3 (wave 6) | 6 | 🚧 |
| 240 | Stage 6 gate: the 3D journey → *ROADMAP_3D 3D-189* | 218–239 | — (new) | 6 | 🚧 |

**Stage 7 · AI & agents (Phases 241–250)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 241 | LLM integration layer | 13, 50 | v3 30.1, 30.2 | 7 | 🚧 |
| 242 | Validation loop & offline provider | 241 | v3 30.3, 30.4 | 7 | 🚧 |
| 243 | AI builder: prompt → design and motion | 242 | v3 31 | 7 | 🚧 |
| 244 | AI evals & visual self-check | 243 | v3 33 | 7 | 📋 |
| 245 | AI co-pilot: edit, explain, fix | 244 | v3 32 | 7 | 📋 |
| 246 | AI interaction builder | 245 | v3 73.4 | 7 | 📋 |
| 247 | AI effect author | 246 | v3 70 | 7 | 📋 |
| 248 | AI character animator | 216, 247 | — (new in v4.1) | 7 | 📋 |
| 249 | AI from references | 247 | v3 34 | 7 | 📋 |
| 250 | MCP v1: full agent parity | 249 | — (new) | 7 | 📋 |

**Stage 8 · Easy for everyone (Phases 251–258)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 251 | Familiar keymaps & terms | 250 | — (new) | 8 | 📋 |
| 252 | Figma import | 251 | — (new) | 8 | 📋 |
| 253 | After Effects import via Lottie | 252 | — (new) | 8 | 📋 |
| 254 | Shape recognition & beautification | 253 | v3 36 | 8 | 📋 |
| 255 | Draw-to-animate gestures | 254 | v3 37 | 8 | 📋 |
| 256 | Sketch to elements with AI | 255 | v3 38 | 8 | 📋 |
| 257 | Recipes: open anything and see how it is made | 192, 256 | — (new in v4.1) | 8 | 📋 |
| 258 | Simple mode & guided flow | 256 | v3 39 | 8 | 📋 |

**Stage 9 · Production & public beta (Phases 259–266)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 259 | Security hardening | 16, 96, 241 | v3 80.3–80.5 | 9 | 📋 |
| 260 | Observability & kill switches | 259 | v3 82 | 9 | 📋 |
| 261 | Real-device & browser matrix | 260 | v3 84 | 9 | 📋 |
| 262 | Licensing & compliance automation | 261 | v3 85 | 9 | 📋 |
| 263 | Legacy retirement & grep gates | 262 | v3 57 | 9 | 📋 |
| 264 | Documentation & audit close-out | 263 | v3 40.4 | 9 | 📋 |
| 265 | Integration journeys | 264 | v3 58 | 9 | 📋 |
| 266 | Public beta gate | 259–265 | v3 40 | 9 | 📋 |

**Stage 10 · Sites & platform (Phases 267–276)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 267 | Accounts & cloud projects | 266 | v3 81.1, 81.2 | 10 | 📋 |
| 268 | Share links & hosted embeds | 267 | v3 81.3, 81.4 | 10 | 📋 |
| 269 | Remote MCP endpoint | 268 | — (new) | 10 | 📋 |
| 270 | Content collections & repeaters | 269 | v3 78.1, 78.2 | 10 | 📋 |
| 271 | Forms | 270 | v3 78.3 | 10 | 📋 |
| 272 | Whole-site export & SEO | 271 | v3 79.1, 79.2, 78.4 | 10 | 📋 |
| 273 | Web Vitals & deploy handoff | 272 | v3 79.3, 79.4 | 10 | 📋 |
| 274 | Plans, metering & billing | 273 | v3 83 | 10 | 📋 |
| 275 | Animated templates & themes | 274 | v3 76.3 (interactive variants), 76.4 | 10 | 📋 |
| 276 | General availability gate | 267–275 | v3 86 | 10 | 📋 |

**Stage 11 · Apps (Phases 277–277)**

| # | Phase | Needs | Was (v3) | Stage | Status |
|---|---|---|---|---|---|
| 277 | Apps re-baseline: the After-track audit | 276 | v3 87 | 11 | 📋 |

---

# STAGE 0 — FOUNDATION ✅ (Phases 1–12)

> Done. The document model, rules, maths, store and test harnesses that everything else stands on. Detailed checklists, gate evidence and progress logs are in `ROADMAP_v3_ARCHIVE.md` under the v3 phase number given in "Was".

### Phase 1 · Build health & CI
**Needs:** — · **Was:** v3 1 · **Closes:** AUD-01, AUD-02, AUD-03 · **Status:** ✅
0 TypeScript errors (from 162), 0 lint errors with a ratcheting warning budget, `next build` green, CI on every push and PR (branch protection by convention).

### Phase 2 · Unified Motion Document Model
**Needs:** 1 · **Was:** v3 2 · **Closes:** AUD-04, AUD-05 (model), AUD-07 · **Status:** ✅
One versioned schema with a runtime validator and JSON Schema from one source, one typed store API, migrations, and deterministic IDs. CI green on PR #6.

### Phase 3 · History, autosave & project files
**Needs:** 2 · **Was:** v3 3 + 41.2 · **Closes:** AUD-05 (behaviour), AUD-08 · **Status:** ✅
Patch-based undo with gesture transactions (one drag = one step), IndexedDB autosave, a crash-recovery journal, and versioned `.lazy.json` import and export. CI green on PR #7.
*Carried forward:* two tabs on one project both autosave (last write wins) → fixed in Phase 36.

### Phase 4 · Real-environment verification harness
**Needs:** 1 · **Was:** v3 4 · **Closes:** AUD-15, AUD-16 (infrastructure), AUD-42, AUD-43 · **Status:** ✅
Playwright in Chromium, Firefox and WebKit against a production build; a deterministic test clock; export fixtures (Next, Vite React, Vue) that typecheck and build; pixel parity with a proven falsifier. CI green on PR #7.

### Phase 5 · Dependency reality & Wasm decision
**Needs:** 1 · **Was:** v3 5 · **Closes:** AUD-10, AUD-11, AUD-12 · **Status:** ✅
`motion`, `three` and R3F installed; the fake 2D "WebGL" viewport deleted; Wasm benchmarked in a real browser and archived (No-Go, `decisions/0001-wasm.md`). CI green on PR #8.

### Phase 6 · Scope, naming & docs cleanup
**Needs:** 1 · **Was:** v3 6 · **Closes:** AUD-22 … AUD-27 · **Status:** ✅
The `edition` flag keeps After-track panels out of the default bundle (checked in CI), one product name, a doc-link checker, and `LICENSES.md`. CI green on PR #9.
*Carried forward:* rewriting `UI.md`, `PANELS.md`, `SCHEMA_REFERENCE.md`, `CONVENTIONS.md` and `FOLDER_STRUCTURE_AND_DATA_HIERARCHY.md` to match the code → Phase 52.

### Phase 7 · Canonical property paths & geometry
**Needs:** 2 · **Was:** v3 42 · **Closes:** AUD-31 (model), AUD-32 · **Status:** ✅
216 canonical property paths with types, units and compositing class; schema v3 migration; `frame`, `sizing` and `positioning` on every visual layer; frame = layout, `transform.*` = motion (`decisions/0003-geometry-vs-transform.md`). CI green on PR #11.

### Phase 8 · Motion primitives
**Needs:** 7 · **Was:** v3 7 · **Closes:** — (AUD-57 G1, G2) · **Status:** ✅
Schema v4: keyframes, tracks, clips, sequences, staggers, states, transitions, perceptual springs, triggers, behaviours, effect definitions and instances, and the types for bindings, surfaces, tapes, graphs, helpers, pins, tags, components and Split/Clone groups; six shape archetypes. The 12 + 4 reference effects and the reference build validate. CI green on PR #13.

### Phase 9 · Compositions & nesting
**Needs:** 8 · **Was:** v3 46 · **Closes:** AUD-36 · **Status:** ✅
Schema v5: main and interaction compositions, layer in/out and stretch, precomps with time remap, markers, golden-tested time maths (`decisions/0002-time-model.md`). CI green on PR #14.

### Phase 10 · Executable rules engine
**Needs:** 8, 9 · **Was:** v3 8 · **Closes:** AUD-06, AUD-47 (routing), AUD-52 · **Status:** ✅
The grammar compiled into one rule table (432 matrix assertions), `rules.canAdd / validate / explain / suggestFix / route`, routing lightest-first with no GSAP route, and a CI grep gate against ad-hoc compatibility checks (`decisions/0005-phase8-rule-table-and-reconciliation.md`).
*Carried forward:* AUD-59 (Exit, Focus, Stagger, LayoutTransition have no schema form) → Phase 53. Rules 6.12–6.15 (sampled at runtime) → Phase 199.

### Phase 11 · Deterministic evaluation kernel
**Needs:** 8, 9 · **Was:** v3 9 · **Closes:** AUD-48 (partial) · **Status:** ✅
`evaluate(doc, composition, layer, t, inputs)`, with easing checked against GSAP, springs against Motion, OKLab colour, and a determinism fuzz test (`decisions/0007-deterministic-evaluation-kernel.md`).
*Carried forward:* no editor file uses the kernel yet → Phase 57. Reactive behaviours and bindings (`KERNEL_GAPS`) → Phases 139 and 143. Stateful layers → Phase 184.

### Phase 12 · Store decomposition
**Needs:** 2, 3 · **Was:** v3 41 · **Closes:** AUD-34 · **Status:** ✅
The document and World Environment have their own stores, After-track actions moved behind the edition flag, per-entity subscriptions, and `useProjectStore.ts` cut from 1,554 to 395 lines.
*Carried forward:* project metadata has no store of its own → Phase 13.

---

# STAGE 1 — FIGMA / WIX-STYLE VIEWPORT (Phases 13–52)

> **Stage output:** a responsive design tool. On an infinite canvas with several frames, a user draws frames, shapes, vectors and text, selects and transforms them with Figma-style handles and snapping, lays them out with auto-layout, grids, constraints and breakpoints, builds components with variants, organises pages and sections, styles everything with tokens, and exports a site that matches the canvas. Claude can do the same through a local MCP server.
>
> Order inside the stage: commands and workspace (13–15) → the renderer that finally draws layers from their geometry (16–19) → the viewport (20–23) → tools and direct manipulation (24–31) → panels (32–35) → assets, images and fonts (36–38) → vectors (39–40) → layout (41–44) → design systems (45–48) → output, agents and templates (49–51) → the gate (52).

### Phase 13 · Command bus: finish and type every command
**Needs:** 12 · **Was:** v3 43.1 (rest), 43.3 · **Closes:** — · **Status:** ✅
**Goal:** Every action (shortcut, menu, toolbar, palette, context menu, AI, MCP) is one typed command, so every later phase only adds commands.
- [x] Command registry, context keys, keymap with `when` clauses, palette on the registry, one focused region (landed 2026-09-27).
- [x] Menus and toolbar buttons run commands through `invokeCommand(id)`, which skips the `when` gate the way the palette does. File, Edit, View and Help are one data model (`src/editor/menus/menuModel.tsx`); an item that isn't built yet is disabled and names its phase (Cut/Copy/Paste/Duplicate/Delete: 29). Landed from `0792374` and finished here.
- [x] A command can declare a zod `args` schema and `result` schema; `tryRunCommand(id, args)` / `runCommand(id, args)` validate them and report why nothing ran (`unknown-command`, `unavailable`, `invalid-args`, `invalid-result`, `threw`). Both are optional so existing commands keep working. Each later phase declares schemas on the commands it adds; the MCP server (50) is generated from them (Law 20).
- [x] Coverage test (`menus/__tests__/commandCoverage.test.ts`): every menu item names a registered command or is pending on a phase, and no new raw `keydown` shortcut listener may be added. The palette already lists the registry. `Ctrl+A` (+Add palette) moved onto the bus; the remaining listeners are Escape-to-close and the Space spring-load, which need no command.
- [x] `tests/e2e/command-bus.spec.ts`: Edit > Undo/Redo, File > Save, a pending item is disabled, undo from the palette, Space plays over the timeline and not over the canvas, Delete in the timeline removes one keyframe.
- [x] Project metadata (id, name, scope, root archetype) has its own store, `useProjectMetaStore`. `ProjectStateSnapshot` is unchanged (it is the `.lazy.json` contract); `getSnapshot`/`restoreSnapshot` compose it, and undo swaps name, scope and root archetype through it.
- [x] `npm run check:roadmap-order` runs in CI (Law 18), in the `verify` job.

**You'll see:** Edit and File menus and the toolbar's undo, redo and save behave exactly like their shortcuts.
**Done when:** the coverage test and the committed spec pass in CI in 3 browsers.

### Phase 14 · Workspace model & panel registry
**Needs:** 13 · **Was:** v3 44.1, 44.4 · **Closes:** AUD-35 · **Status:** ✅
**Goal:** The shell renders from a saved layout instead of 22 local `useState` calls, and panels load only when shown.
- [x] `registerPanel({ id, title, zone, edition, focusScope, load | component, props })` (`src/editor/shell/panels/registry.ts`, every panel registered in `panels/builtins.tsx`) and a zod-validated `WorkspaceLayout` (`src/core/workspace/`: sizes, collapsed state, active tabs, the AI dock, the preset) saved to `localStorage` 300 ms after a change and restored on load; corrupt or blocked storage falls back to the default.
- [x] `EditorShell.tsx` is 389 lines (was 2,139): it composes `DockTree`, `PanelHost`, `CanvasChrome`, `AiDockColumn`, `OutputLogDrawer` and six hooks (`shell/hooks/`). Only the stage, Details and the Content Browser are imported statically; every other panel is fetched when first shown, and a unit test fails if a shell file imports a panel module outside the registry.
- [x] The canvas DOM node never remounts on resize, a preset switch or a viewport change (Playwright proves it). Splitters write the zone's `--zone-size` custom property straight to its DOM node during a drag and commit once on release.

**You'll see:** the panel layout you arrange survives a reload.
**Done when:** `EditorShell.tsx` is under 500 lines; Playwright proves the stage node is the same object across resizes; the bundle check shows unopened panels aren't loaded.
**Evidence (2026-10-19):** `shellStructure.test.ts` (under 500 lines, no static panel imports); `tests/e2e/workspace.spec.ts` (layout survives a reload, stage node is the same object, unopened panels are not loaded, read from `data-loaded-panels` on the dock root). Gate passed in CI in 3 browsers on `main` (2026-10-19).

### Phase 15 · Design / Animate / Code presets & inspector tabs
**Needs:** 14 · **Was:** v3 44.2, 44.3 · **Closes:** AUD-21 (shell) · **Status:** ✅
- [x] Presets: **Design** (the default: stage │ Design inspector, the timeline folded to the transport bar in the status bar; the Layers panel joins it in Phase 32), **Animate** (timeline at 40% of the window, clamped to the splitter limits, Motion inspector), **Code** (stage │ a 520 px Code inspector). The header's tabs switch them; each is also a command (`workspace.preset.<id>`, and the typed `workspace.setPreset`).
- [x] Inspector tabs **Design · Motion · Code**. Motion lists the selected layer's clips and tracks from the document and opens the timeline (`MotionInspector`); editing stays on the timeline until Stage 2. Users save a layout under a name, apply it with one click and delete it (`Layouts` menu; commands `workspace.saveLayout/applyLayout/deleteLayout`, up to 20, kept in `localStorage`).
- [x] Logic, Data and Debug presets, and the Debug inspector tab, appear only in the `full` edition (unit-tested; the initial-edition browser test finds none of them).

**You'll see:** one click switches between a Figma-like and an After Effects-like layout.
**Done when:** a preset switch takes < 100 ms and doesn't remount the stage; a custom layout survives a reload.
**Evidence (2026-10-19):** `tests/e2e/presets.spec.ts` (median of five switches under 100 ms, the stage node survives them, custom layout saved, applied after a reload and deleted); `src/core/workspace/__tests__/`. Gate passed in CI in 3 browsers on `main` (2026-10-19).

### Phase 16 · Threat model for the stage and user content
**Needs:** 3 · **Was:** v3 80.1 · **Closes:** AUD-51 (partial) · **Status:** ✅
**Goal:** Decide the security boundaries before building the new stage host.
- [x] A STRIDE threat model as decision record 0008 (`decisions/0008-threat-model.md`): nine trust boundaries, each with its threats and the phase that enforces it, and seven findings in today's code.
- [x] Rules the new renderer (17–19) must follow (R1–R10 in the record): no HTML strings, same-origin stage frames render only document content through render definitions, one typed bridge per frame with `event.source` checked, imported SVG sanitised once at import, limits, and a test for each rule; untrusted code goes to an opaque-origin sandbox (195).

**You'll see:** nothing yet (a document). It unblocks Phase 18.
**Done when:** the record is reviewed, and each boundary names the phase that enforces it.
**Found while writing it (2026-10-19):** layer text and ids were put into the stage's HTML unescaped inside a same-origin, scripts-allowed frame, so an imported project could run script on the editor origin; AI chat text was rendered as HTML unescaped. Both are mitigated now (`escapeHtml`, with tests) and removed for good by Phases 18 and 241.

### Phase 17 · Render definitions per archetype
**Needs:** 7, 8, 16 · **Was:** v3 48.1 · **Closes:** AUD-29 (markup half) · **Status:** ✅
**Goal:** One React component per archetype draws a layer from its geometry and props. The stage and the exporter both use them (Law 11).
- [x] `src/core/render/archetypes/*`: one React component per archetype takes `(layer, resolved props)` (a complete `Record<ArchetypeId, …>` in `definitions.ts`, so a missing one is a compile error). `layerBoxStyle` positions every layer from `frame`, `sizing` and `positioning` (absolute at `frame.x/y`, fixed sizes, hug, and fill along or across the parent's main axis; rotation, opacity, CSS units). Archetypes the old stage drew as an invisible `<div>` (toggle, badge, fab, icon, divider, background, svg group/use/text) now draw; effect surfaces and the 3D layers draw a labelled placeholder until Stages 4 and 6.
- [x] The six shape archetypes render as SVG (stroke drawn inside the frame); so do `svgPath`, `svgGroup`, `svgText`, `svgUse` and `icon`.
- [x] No inline handlers and no HTML strings: a test fails on `innerHTML`, `srcDoc`, `dangerouslySetInnerHTML`, `eval` or `new Function` under `src/core/render/` (rule R1 of decision record 0008). Hover and press looks come from states in Phase 78. The renderer also applies R5–R7: unsafe image sources and path data are dropped, sizes are clamped, a document draws at most 5,000 layers and 64 levels deep, and a cyclic document ends.
- [x] A dev route, `/editor/render-gallery`, shows 53 cases covering every archetype with default and edge-case props (empty, long and hostile text, blocked sources, tiny shapes, rotation, fill sizing).

**You'll see:** the render gallery shows every element type drawn the new way.
**Done when:** the gallery renders every archetype identically in 3 browsers (screenshot tests).
**Evidence (2026-10-19):** `tests/e2e/render-gallery.spec.ts` compares what must not differ across Chromium, Firefox and WebKit: every case's drawn size where its geometry fixes it (±1 px), that nothing from a hostile case ran or loaded, and that column, row, fill and absolute layouts place their children the same way. **Deviation:** pixel baselines are not committed, because they differ by operating system and font rasteriser and would have to be generated on the CI runner; this is a geometry check, not a screenshot diff. Gate passed in CI in 3 browsers on `main` (2026-10-19).

### Phase 18 · Stage host v2: live DOM frames, no HTML strings
**Needs:** 17 · **Was:** v3 48.2, 48.5 · **Closes:** AUD-29, AUD-33 · **Status:** ✅
- [x] The stage is a same-origin `<iframe src="/stage-frame.html">` (a static file: doctype, reset, empty root, no script) drawn into by a React portal from the editor's own tree (not a second React root: stores, context and handlers stay shared). No `srcDoc`. The frame's width is a real viewport, so media queries work; it is in standards mode. No script can run in it: its document has a `script-src 'none'` CSP (response header plus meta tag), tested with an injected inline handler, script element and `javascript:` URL in all three browsers. There is no `sandbox` attribute, because WebKit then drops all events to the frame (decision record 0009 §1). (`src/editor/stage/`)
- [x] No `postMessage(…, "*")` remains in `src/` (a unit test scans every source, including scripts inside template literals). The design stage sends no messages, so it needs no bridge; the logic sandbox's messages go through `frameBridge.ts` (editor origin as target, accepted only from that frame's window, from that origin and in zod-checked shapes).
- [x] The logic sandbox (mock database and API, tracer, hot reload) stays in `SandboxHost`, loaded only through `afterTrackPanels.tsx` in the `full` edition and added to `check:bundle-scope`; the design stage (`WhiteboardCanvas` → `StageHost`) does not import it (a test checks).
- [x] `buildSandboxDocument` and `generateElementMarkup` are off the design path (decision record 0009, render host). They remain inside the full edition's logic sandbox, with every interpolated value escaped, until Phase 195 rebuilds it on the render definitions.

**You'll see:** the showcase demo is drawn from layer geometry, and editing a property no longer reloads the stage.
**Done when:** a property edit updates the stage in < 16 ms without a reload (the iframe document stays the same object); `grep` finds no `postMessage(…, "*")`; the demo matches the render gallery.
**Evidence (2026-10-19):** `tests/e2e/stage-host.spec.ts` (the frame's document is the same object across edits; undo and redo of a drawn shape reach the frame's DOM in under one frame in Chromium; keys typed over the stage reach the command bus), `frameBridge.test.ts` (including the wildcard scan), `stage.test.ts`, and the render gallery now draws through the same `StageFrame`. **Deviations:** (1) the inspector's fields are not yet wired to the document (Phases 33–34), so the latency test drives real document edits (undo/redo of a drawn shape) rather than a field; (2) Chromium is held to 16 ms, Firefox and WebKit to 50 ms until their numbers on the CI runner are known; (3) the demo no longer has the old stage's padding and card defaults, because it is now drawn from geometry. Gate passed in CI in 3 browsers on `main` (2026-10-19).

### Phase 19 · Incremental updates & measurement API
**Needs:** 18 · **Was:** v3 48.3, 48.4 · **Status:** ✅
- [x] Document patches re-render only the layers they touch. Every layer is a `StoreRenderLayer`: it subscribes to its own object (`useLayer`, which Immer's structural sharing keeps identical for every untouched layer) and to its own list of drawn children in a plan store that returns the same array while a layer's children are unchanged. `StageHost` re-renders only when the top-level ids change. Editing one layer's property re-renders that layer and nothing else; adding or removing a layer re-renders its parent and the new layer; both are tested in the browser by counting renders.
- [x] `LayerNodeRegistry` (layer id → element, with subscriptions and a late-cleanup guard), filled by a `nodeRef` every render definition now receives, and held by the stage's `StageRenderer`, which `getStageRenderer()` returns (Phase 57 writes per-frame values through it).
- [x] `renderer.measure(layerIds)` returns document-space rectangles (the frame's scroll is added, so they don't change when the frame scrolls), answered from one read pass per animation frame however many callers ask, and cached until a `ResizeObserver` on every drawn element, a `MutationObserver` on the stage root or a window resize says something may have moved. `measureNow` is the synchronous form.

**You'll see:** a 500-layer document stays responsive while you edit it.
**Done when:** 500 layers mount in < 500 ms; editing one layer re-renders no other layer (subscription test); `measure()` matches the DOM within 0.5 px.
**Evidence (2026-10-19):** `/editor/stage-lab` loads 500 layers into the real stage and edits them through the real document commands; `tests/e2e/stage-incremental.spec.ts` (6 tests, Chromium, Firefox and WebKit) measured, on a quiet laptop, **500 layers mounting in 15 ms (Chromium), 42 ms (Firefox) and 34 ms (WebKit)**; one property edit → exactly one layer rendered once; add → the new layer and its parent only; remove → the parent only; `measure()` within 0.5 px of the DOM for the root, first, middle and last layers, unchanged by scrolling the frame, correct after a layout shift, and 100 simultaneous callers costing one read pass. Unit tests cover the plan store, the registry, the batching and the cache (`src/core/render/__tests__/incremental.test.ts`). Edits reach the frame's DOM in 2–7 ms in all three engines. Gate passed in CI in 3 browsers on `main` (2026-10-19).

### Phase 20 · Viewport camera
**Needs:** 19 · **Was:** v3 49.1 · **Closes:** — (World Environment properties 1–6) · **Status:** ✅
- [x] Document ↔ screen transform (`src/core/viewport/camera.ts`, pure and unit-tested); pan (Space-drag, middle mouse, trackpad), zoom 2%–6,400% (wheel, pinch, keys) around the cursor, zoom to fit (Shift+1), to selection (Shift+2) and to 100% (Shift+0). The camera is saved per document. Reuses the `WhiteboardCanvas.tsx` maths.
- [x] Wheel and pinch over the stage frame reach the camera (record 0009 §4 said Phase 20 must forward them).
- [~] Pan and zoom hold 60 fps with 5 frames × 200 layers: measured in Phase 21's canvas lab. Chromium and Firefox hold it; WebKit holds it for pan but not for zoom (37–45 ms a frame).

**You'll see:** smooth panning and zooming around your frames.
**Done when:** pan and zoom hold 60 fps with 5 frames × 200 layers; zoom keeps the point under the cursor fixed (test).

**Evidence (2026-10-19):** `src/core/viewport/__tests__/camera.test.ts` (round trip, the point under the cursor stays fixed through zooms from 2% to 6,400%, clamping, steps, fit); `tests/e2e/viewport-camera.spec.ts` in Chromium, Firefox and WebKit (zoom keeps the cursor point fixed to 0.01 px, 2%–6,400% range, wheel pans, buttons zoom to 100% and fit, pinch and wheel over the stage frame reach the camera, the camera survives a reload, Shift+2 centres the selected layer and Shift+0 returns to 100%). **Design:** the camera lives in `useCameraStore` and is written straight to the canvas node's CSS variables, so a wheel tick never re-renders React. It is saved per project id in `localStorage` (a view setting, not document content, so no schema change). **Deviations:** the 60 fps gate needs five frames, which Phase 21 builds, so it is measured there; zoom limits in the World Environment defaults moved to 2–6,400 and the canvas no longer reads them (the camera clamps). Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 21 · Multi-frame canvas
**Needs:** 20 · **Was:** v3 49.2, 20.3 · **Status:** ✅
- [x] Several top-level frames side by side, each its own stage host, with device presets and custom sizes, titles, and add, duplicate and reorder. The backdrop can be light, dark or checkerboard.
- [x] The header's Desktop / Tablet / Mobile switch creates or focuses frames of those sizes.

**You'll see:** Desktop, Tablet and Mobile frames next to each other.
**Done when:** Playwright creates 3 frames, reloads, and finds the same 3.

**Evidence (2026-10-19):** `src/core/frames/__tests__/frames.test.ts` (frames are top-level layers, order, positions, add / duplicate / rename / resize / reorder / delete as one undo step each) and `src/core/render/__tests__/frameRenderers.test.ts`; `tests/e2e/frames.spec.ts` (Desktop, Tablet and Mobile make three frames, each its own frame element with its own width, and the same three come back after a reload; custom size, rename, resize, duplicate, reorder, delete; the three backdrops; the active frame follows the header and clicks). **Design:** a frame is a top-level layer (Phase 42), so frames are saved with the document and need no schema change; their order is their position left to right, and a reorder re-spaces the row in one undo step. Each frame is its own `StageHost` (`frameId`) with its own renderer; `getStageRenderer()` answers for the active frame, `getStageRendererForLayer(id, layers)` for the frame that draws a layer. Everything runs through typed `frame.*` commands (Law 20). **Phase 20's 60 fps gate** is measured here on `/editor/canvas-lab` (5 frames × 200 layers): Chromium and Firefox 16.7 ms per frame for pan and zoom; WebKit 18 ms for pan but 37–45 ms for zoom, because it repaints a scaled frame's text on every zoom step (two compositing-layer hints did not help). **Open:** WebKit at 60 fps (on the CI runner its pan measured 50 ms, so its ceilings are 90 ms pan and 140 ms zoom for now), so Phase 20's last box stays unticked. CI is green on `main` for this phase (2026-10-20); it stays 🚧 until Phase 20's WebKit zoom frame rate is fixed, because Phase 21 needs Phase 20 (Law 18).

### Phase 22 · Hit-testing
**Needs:** 21 · **Was:** v3 49.3 · **Status:** ✅
- [x] A spatial index over measured rectangles (the existing TS `SpatialIndex`): deepest layer first, Cmd/Ctrl for deep select, locked and hidden layers skipped.
- [x] In Design mode the canvas captures every pointer event; nothing reaches the frames.

**You'll see:** hovering shows the layer a click would select.
**Done when:** hit-test p95 < 1 ms with 1,000 layers; clicks at 20 known points select the expected layers at 3 zoom levels.

**Evidence (2026-10-19):** `src/core/hit/__tests__/hitTest.test.ts` (the rules, the build from measured frames, and **p95 under 1 ms for a plain plus a deep pick with 1,001 layers**); `tests/e2e/hit-testing.spec.ts` in Chromium, Firefox and WebKit (the frames get `pointer-events: none`; 20 points chosen from the visible layers of `/editor/canvas-lab`, at three zoom levels, each clicked plainly and with the deep-select modifier and the exact selection asserted; a locked group is skipped and a hidden one is not there to hit; hovering shows the outline of what a click would select). **Rules decided here:** a plain click picks the frame's direct child (Figma's rule), Cmd/Ctrl picks the deepest layer, empty space inside a frame picks the frame, a locked layer hides its whole subtree from hits, and a layer is clipped to its frame. The index is rebuilt only when the document or a frame's layout version changes. **Deviation:** clicks no longer reach the frames' own click handlers in Design mode (record 0009 §2 said they did); `onElementClick` stays for Preview mode (Phase 23). A frame whose own content scrolls isn't handled yet. CI is green on `main` for this phase (2026-10-20); it stays 🚧 until Phase 20's WebKit zoom frame rate is fixed, because Phase 21 needs Phase 20 (Law 18).

### Phase 23 · Overlay layer & Design / Preview modes
**Needs:** 22 · **Was:** v3 49.4, 49.5 · **Status:** ✅
- [x] One overlay layer above the frames draws hover outlines, selection, handles, guides and labels. Its redraw loop moves onto the frame scheduler in Phase 55. (Hover and selection with its name and size are drawn; handles are Phase 27 and guides Phase 28. Phase 55 is already done, so the overlay redraws on the frame scheduler from the start.)
- [x] A Design / Preview toggle: in Preview, pointer events reach the frames, so links and buttons work.

**You'll see:** hover outlines, and a Preview button that makes the page clickable.
**Done when:** the hover outline appears within 1 frame with 1,000 layers; a click in Preview reaches a button (test).

**Evidence (2026-10-19):** `tests/e2e/overlay-modes.spec.ts` in Chromium, Firefox and WebKit on the 1,055-layer canvas lab: there is one overlay layer, after the frames in the same world, with `pointer-events: none`; **a dispatched mouse move has its outline on screen by the second animation frame** (the gate's "within 1 frame"; the annotation records the count); a selected layer gets an outline labelled with its name and size; in Design mode a click selects and never reaches the frame, in Preview mode the same click reaches a handler inside the frame, doesn't change the selection, and the overlay shows no selection. **Design:** `OverlayController` writes a few pooled DOM elements and redraws in the frame scheduler's `overlay` phase, asked for by pointer, selection, document, camera and mode changes (edits ask for two follow-up passes, since layout can land a frame later); no React renders per pointer move. **Deviation:** the deep-select modifier is read from mouse events, not from a key listener (Phase 13's coverage test forbids raw key listeners), so Cmd/Ctrl changes the hover on the next pointer move. CI is green on `main` for this phase (2026-10-20); it stays 🚧 until Phase 20's WebKit zoom frame rate is fixed, because Phase 21 needs Phase 20 (Law 18).

### Phase 24 · Tool state machine
**Needs:** 13, 23 · **Was:** v3 43.2 (infrastructure) · **Status:** ✅
- [x] A tool is `{ id, cursor, onPointerDown/Move/Up, onKey, drawOverlay }` with pointer capture. Spring-loaded tools: holding Space gives the Hand, holding Cmd/Ctrl gives deep select, and releasing returns to the previous tool.
- [x] The floating dock switches tools through commands. Buttons whose feature doesn't exist yet are hidden until their phase.
- [x] Port the Tier A tools from branch `phase-43-command-bus-finish` (`7a97baa`, `6d4e1bd`, `5c020dd`) onto the overlay instead of rewriting them. (Those three commits were already on `main`; the tools now live in the tool runtime instead of inline in the canvas.)

**You'll see:** every tool button in the dock either works or isn't there.
**Done when:** tool-switching and spring-loaded tests pass.

**Evidence (2026-10-20):** `src/core/tools/__tests__/toolMachine.test.ts` (switch, refuse tools that don't exist, Space and Cmd/Ctrl springs, key repeat, out-of-order release, choosing a tool during a spring, losing focus, and that the dock lists exactly the tools that exist); `tests/e2e/tools.spec.ts` in Chromium, Firefox and WebKit (the dock shows seven tools and no Pen, Pencil, Comment or Quick Insert; each button and shortcut switches the tool; Space holds the Hand and releases to the previous tool; Cmd/Ctrl holds deep select; a blur can't leave a hold stuck; the Rectangle tool draws, returns to Select and undoes; Space-drag and the middle button pan with a drawing tool active and draw nothing). **Design:** `ToolMachine` (pure) holds the active tool and a stack of springs; `useToolStore` exposes `active` and `current`; `toolRuntime.ts` has the tools (`Tool`: `onPointerDown/Move/Up`, `onKey`, `drawOverlay`) and the canvas captures the pointer for a gesture a tool began; the dock is built from `dockTools()` and switches tools with the typed `tool.set` command. **Found and fixed:** Lane B's J/K/L shuttle was bound with canvas focus too, so on the canvas `L` never reached the Line tool (the transport registered first and won); J/K/L are now timeline-focus commands, as Phase 63 already says. Tools whose phase isn't built (Pen and Pencil 40, Comment 268) are in `TOOL_DEFS` with `available: false`. CI is green on `main` for this phase (2026-10-20); it stays 🚧 until Phase 20's WebKit zoom frame rate is fixed, because Phase 21 needs Phase 20 (Law 18).

### Phase 25 · Creation tools: frames, shapes and text boxes
**Needs:** 24 · **Was:** v3 43.2 (Tier A), 20.4 · **Status:** ✅
- [x] F frame, R rectangle, O ellipse (Shift for a circle), L line and arrow (Shift+L), polygon (Y), star (Shift+Y), T text box. Drawing inside a frame parents the new layer to it; Shift constrains; Alt draws from the centre.
- [x] Each creation is one undo step and leaves the new layer selected.

**You'll see:** you can draw frames, shapes and text boxes.
**Done when:** Playwright draws with each tool and checks geometry, parent and undo.

**Evidence (2026-10-20):** `src/core/geometry/__tests__/shapeDrag.test.ts` (golden cases for box and segment drags, Shift, Alt, Shift+Alt, clicks); `tests/e2e/creation-tools.spec.ts` in Chromium, Firefox and WebKit: every box tool (rectangle, ellipse, polygon, star, text box, nested frame) is drawn inside the demo frame and the layer's position and size are read back from the frame's DOM and match the drag, its parent is the frame, it is selected, the tool returns to Select, one undo takes exactly that layer away and redo restores it; Shift draws a square, Alt draws from the centre, Shift+Alt a centred square; a click places the default size at the press; line and arrow are rotated boxes (Shift snaps 42° to 45°); over bare canvas a rectangle does nothing and the Frame tool makes a top-level frame; a layer drawn inside a nested frame is parented to it. **Design:** drawn layers are `absolute` with `frame.x` / `frame.y` relative to their parent's own top-left (so the geometry is exact; Phase 43.2's flow-placed shapes are gone); the parent is the deepest container under the press, found by the hit index, whose frame root now covers the whole artboard. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 26 · Selection
**Needs:** 25 · **Was:** v3 20.1 (selection) · **Status:** ✅
- [x] Click, Shift-click, marquee, select all / none / inverse, select children and parent (Enter / Shift+Enter), deep select. One selection store shared by the canvas, Layers panel, inspector and (later) timeline. (The Layers panel is Phase 32 and the timeline's layer rows later; the canvas, the Design and Motion inspectors, the status bar and the command bus already share `useSelectionStore`.)

**You'll see:** selection stays in sync everywhere.
**Done when:** a 15-step selection journey asserts the exact selection after each step.

**Evidence (2026-10-20):** `src/core/selection/__tests__/selectionOps.test.ts` (selectable rules, select all / inverse / children / parent scopes, combining, marquee candidates); `tests/e2e/selection.spec.ts` in Chromium, Firefox and WebKit: a **17-step journey** on the canvas lab asserts the exact selection after every step (click picks the frame's direct child; Shift-click adds and toggles; Ctrl+A takes the siblings; Escape clears; Cmd/Ctrl-click deep-selects; Shift+Enter is the parent, Enter the children; Ctrl+Shift+A inverts; a marquee from the frame's background selects the groups it touches; a click in another frame; select all follows the frame; the frame's background selects the frame), and a second test shows the canvas outline, the inspector header and the status bar agreeing, then back to the World Environment on Escape. **Design:** `selectionOps.ts` is pure; commands `selection.all/none/inverse/children/parent/set` (Law 20, `set` is what an agent calls); the shell's "selected element" is now derived from the store, not its own state. **Changes elsewhere:** Ctrl+A on the canvas selects all, so the +Add palette's Ctrl+A no longer applies while the canvas has focus. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 27 · Transform handles
**Needs:** 26 · **Was:** v3 20.1 (transform) · **Closes:** AUD-19 (selection) · **Status:** ✅
- [x] Move, resize (edges and corners, aspect lock, from centre) and rotate (Shift snaps to 15°), for single and multiple selections. Each gesture writes `frame.*` in one transaction; Esc cancels it.
- [x] On-canvas parameter handles: corner radius, star points and inner radius, polygon sides.

**You'll see:** Figma-style handles on whatever you select.
**Done when:** 30 standard manipulations give exact geometry and exactly 30 undo steps.

**Evidence (2026-10-20):** `src/core/geometry/__tests__/transform.test.ts`: 30 standard manipulations with exact geometry (moves, every corner and edge, aspect lock, from the centre, minimum size, rotated boxes, group resize, rotation with snapping, group rotation, handle positions) and the parameter handles (radius, inner radius, count, rotated). `tests/e2e/transform.spec.ts`: **30 real gestures on the canvas lab (moves, resizes, rotations, group moves/resizes/rotations, and the radius / inner-radius / points / sides handles) are exactly 30 undo steps**: after each gesture the shapes' markup changed, and then 30 undos walk back through the 30 recorded states character for character; Escape cancels a drag and leaves no step and keeps the selection; a resize keeps the layer's parent. **Design:** `transform.ts` is pure (a `Box` is centre, size, rotation); `transformModel.ts` builds the selection's boxes and handles from the hit index; the select tool owns the gestures (a handle drag, a drag on the selection, or on an unselected layer which it selects first) through one `documentCommands.begin` transaction; the overlay draws the frame and handles. **Rules:** moving or resizing converts a flow-placed layer to absolute at its measured position; positions are relative to the parent's top-left; parents aren't rotated (a rotated parent's children use their own box). Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 28 · Snapping, smart guides & rulers
**Needs:** 27 · **Was:** v3 20.2 · **Closes:** AUD-20 (Tier 1: properties 7–23, 27–30) · **Status:** ✅
- [x] Snap to the pixel grid, to layout grids (none exist yet: Phase 41), and to edges and centres of other layers; equal-spacing detection; the distance HUD (Alt shows distances); rulers with draggable guides; snap toggles.

**You'll see:** guides and spacing labels while you drag.
**Done when:** snapping golden tests pass; guides persist per frame.

**Evidence (2026-10-20):** `src/core/geometry/__tests__/snap.test.ts` (golden cases: an edge, a centre and the closest of several; both axes; the frame's edges and centre; guides, and the object toggle not turning them off; all toggles off; the pixel grid; equal spacing between two neighbours and repeating an existing gap; resize edges; the distance HUD; guide text round trip) and `rulerTicks.test.ts`; `tests/e2e/snapping.spec.ts` in Chromium, Firefox and WebKit: a move snaps to another layer's edge to the pixel while the guide line shows and clears on release; with snapping off the same drag doesn't land there; a resize snaps the dragged edge; Alt shows numeric distances (250 to the neighbour) and releasing hides them; a guide dragged out of the ruler is a snap target, dragging it back onto the ruler deletes it, and the rulers can be hidden; **guides belong to their frame, are saved, come back after a reload and are undone**. **Design:** a frame's guides are `frame.guides` (JSON text) on the frame layer, a new canonical path (additive, no schema bump), so they travel with the document; snapping is pure (`snap.ts`) and the select tool asks the canvas for a nudge; settings are remembered per person. **Not built:** snapping to layout grids (Phase 41 has none yet). Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 29 · Editing operations
**Needs:** 26 · **Was:** — (new: not planned in v3) · **Status:** ✅
- [x] Copy, cut and paste (in place, into the selection, across frames and across projects through the clipboard), duplicate (Cmd+D, remembering the last offset), delete, arrow-key nudge (Shift for 10 px), bring forward / backward / to front / to back, group and ungroup (Cmd+G), frame selection (Cmd+Alt+G), lock, hide and rename.
- [x] A context menu on the canvas and in the Layers panel (the Layers panel is Phase 32: `layerMenu()` is the shared model it will list). Every item is a command (Law 20).

**You'll see:** the familiar Figma keyboard workflow works.
**Done when:** a 25-step operations journey passes, and a copy in one tab pastes into another.

**Evidence (2026-10-20):** `src/core/editing/__tests__/editOps.test.ts` (24 tests: copy / paste with new ids, in place, into a container, across projects, frames, malformed clips; duplicate with its remembered offset; delete and the last frame; nudge; the four arrange moves; group, frame selection and ungroup keeping every child where it was; lock, hide, unlock all, show all; rename; one undo step each); `tests/e2e/editing.spec.ts` in Chromium, Firefox and WebKit: **a 25-step journey with the exact result after every step** (duplicate and its offset, nudge, delete, copy / paste and its undo, arrange, group / ungroup / frame selection, lock, hide, rename, the context menu, cut and paste in place, select all and nudge) and **a copy in one tab pastes into another**. **Design:** copy travels as marked text through the system clipboard (so it crosses tabs, windows and projects) with a `localStorage` mirror as the fallback for engines that give the page no clipboard text; every paste re-validates against the schema, caps size and re-ids; Ctrl/Cmd+C, X and V are the browser's own clipboard events, everything else is a keyboard command with a typed twin for agents. **Found and fixed on the way:** (1) the canvas could scroll its own clipped content (`overflow: hidden`), moving every layer from under the pointer without the camera knowing; it is `overflow: clip` now. (2) Adding a layer to a frame made an untouched camera re-fit itself. (3) The context menu opened off the bottom of the screen. **Key conflicts resolved:** on the canvas Ctrl+Shift+G is Ungroup and Ctrl+Shift+H is Hide (the code inspector and undo history shortcuts apply elsewhere), Ctrl+A selects all. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 30 · Align, distribute & tidy
**Needs:** 29 · **Was:** — (new) · **Status:** ✅
- [x] Align left, centre, right, top, middle and bottom (to the selection or the parent); distribute horizontal and vertical spacing; tidy into a grid; drag equal-spacing handles on the canvas.

**You'll see:** align and distribute buttons in the inspector, and spacing handles on the canvas.
**Done when:** golden geometry tests pass for every operation.

**Evidence (2026-10-20):** `src/core/geometry/__tests__/align.test.ts` (23 golden cases: all six alignments on a three-layer selection, to a parent rectangle, rotated boxes aligned by their bounds, NaN refused; distribute on both axes, unsorted input, overlaps; the uniform gap behind the canvas handles; tidy on ragged grids, column widths and row heights, the learned gap, and idempotence) and `src/core/editing/__tests__/alignOps.test.ts` (the document operations: one undo step, parent versus selection targets, locked layers left alone, no-ops return false); `tests/e2e/align.spec.ts` in Chromium, Firefox and WebKit: Alt+A / D / H / W / S / V move real layers to exact positions read back from the frame's DOM and one undo takes each back; Ctrl+Alt+H distributes a row of three to equal 158 px gaps keeping the ends; the two spacing handles on the canvas read 158 and 158, dragging one sets both gaps and the first layer stays; Ctrl+Alt+T turns a ragged 2 × 2 into a grid; the inspector's buttons run the same commands. **Design:** `align.ts` is pure (boxes in, boxes out; sizes never change); one layer aligns to its parent and several to each other (`layer.align` takes `to` for the other choice); distribute spreads three or more with the outer two fixed; Tidy groups boxes into rows by vertical overlap, gives each column the width of its widest box and each row the height of its tallest, with the median of the existing positive gaps (16 px when there are none). Spacing handles appear only for a row or column of neighbours (every gap zero or more, each pair overlapping across the other axis); dragging one gives every gap on that axis the same size (Shift steps by 10). **Changes elsewhere:** on macOS Option+letter types another character (`å`), so keyboard shortcuts with Alt now read the physical key; the Edit menu lists the new commands. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 31 · Text on the canvas
**Needs:** 25 · **Was:** — (new) · **Status:** ✅
- [x] Double-click to edit text in place; auto-width, auto-height and fixed sizing; mixed styles inside one text layer (bold, italic and colour runs); paste as plain text.
- [x] Text properties in the inspector: family, size, weight, line height, letter spacing, alignment, decoration and case.

**You'll see:** you type directly on the canvas.
**Done when:** styled runs survive save and reload; an IME composition test passes.

**Evidence (2026-10-20):** `src/core/text/__tests__/runs.test.ts` (13 tests: toggling bold / italic / underline / strike over a range, colours, replacing a range, JSON round trip, runs that don't spell the text are ignored, hostile JSON and colours) and `src/core/render/archetypes/__tests__/textStyle.test.ts` (6: the typography CSS); `tests/e2e/text-editing.spec.ts` in Chromium, Firefox and WebKit: **draw a text box, type "Hello world rectangle" (tool shortcut letters type as letters), bold "world", a new line, plain-text paste (HTML dropped), Escape: the stage shows exactly that, the editing session is one undo step, redo brings it back; the document holds `content.text` and `content.runs` (`[{"t":"Make it "},{"t":"bold and ","b":1},{"t":"italic","b":1,"i":1}]`), and after a reload the same spans are on the canvas; double-click and Enter open the editor on the layer; the inspector's size, weight, alignment, case, decoration, letter spacing, line height and family change the rendered layer (80 px line height at size 40 and spacing 2) with one undo step each; auto width hugs one line and grows as you type, auto height keeps the width and wraps, fixed size ignores the text; nothing leaves the editor mid-composition** (synthetic composition events in every browser), and **a real IME composition** ("に" then "にほ" then "日本" through `Input.imeSetComposition`) in Chromium, the only browser that can drive one from a test. **Design:** text stays `content.text` (search, export and every reader use it) with optional `content.runs` JSON that is only trusted while it spells the text exactly, so any other writer of the text can't leave stale styling; run colours are validated before they reach a style attribute. The editor is a `contenteditable` in canvas space over the layer, typed with the renderer's own `textTypography()`, the stage's copy hidden meanwhile; it keeps its own undo history, builds its DOM with `createElement` (no HTML strings), reads back only `data-*` and text, and writes the layer once when it closes. `text.sizing` is `fixed` (default, the old behaviour), `autoWidth` (one line that grows; what a click with the Text tool makes) or `autoHeight`; leaving auto width keeps the measured width so the box doesn't collapse. Properties are written through the new typed `layer.setProps` (the writer the Simple and Pro inspector faces will use) and `text.setSizing`; `text.set` writes words and runs for agents. **Changes elsewhere:** a text box drawn with the Text tool starts empty and is typed into at once (leaving it empty discards it); an empty text layer renders empty, not as its layer name; Enter on a selected text layer edits it, and selects children only for other layers. **Not built:** colour runs have no UI yet (Phase 35's picker); whole-layer shortcuts for bold and italic outside the editor; rich-text paste. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 32 · Layers panel
**Needs:** 15, 26 · **Was:** v3 21.1 · **Status:** ✅
- [x] A tree with drag to reorder and reparent (validated by `canReparent`, with the reason shown when refused), rename in place, lock and hide, expand and collapse, search, and a virtualised list. The old outliner components are retired.

**You'll see:** a Figma-like layer tree in sync with the canvas.
**Done when:** an illegal reparent is refused with its reason; a 500-layer tree scrolls at 60 fps.

**Evidence (2026-10-20):** `src/core/layers/__tests__/layers.test.ts` (18 tests: rows are front-most first, collapsed layers hide their children, locked and hidden by an ancestor, search keeps the layers above a match, Shift ranges; `canReparent` refuses a leaf parent, a layer inside itself, locked layers and locked parents, a non-frame on the canvas, a missing place and nesting past 64, each with its reason; `moveLayers` reorders, moves several layers keeping their order, keeps an absolute layer where it was on the canvas across parents, turns a layer dropped on the canvas into a frame, changes nothing on a refusal, and is one undo step); `tests/e2e/layers.spec.ts` in Chromium, Firefox and WebKit: the tree mirrors the document and selection follows both ways (a canvas click opens the layers above and selects the row; Cmd/Ctrl and Shift on rows); **dragging a row above another reorders the stage's DOM, one undo undoes it; dragging a layer into a frame re-parents it and it stays within 1 px on screen; dropping a frame on a rectangle, a frame inside its own child, and a rectangle onto the canvas are all refused with the reason ("… is a rectangle; only frames and groups can hold other layers", "Frames are ordered by where they sit on the canvas") and nothing moves**; rename in place (Enter, Escape, one undo), search with highlighting, hide and lock from the row (a locked layer can't be picked on the canvas); **a document of 1,537 layers scrolls in 90 steps at a median 16.7 ms a frame in Firefox (p90 17.0) with 37 rows in the DOM; Chromium and WebKit meet the same ceilings.** **Design:** the panel draws only the rows in view (28 px rows, a few above and below) from `buildRows`, a pure flattening of the tree, so cost doesn't grow with the layer count; the left dock zone is new (280 px, 200 to 480, `layout.left`), the Design preset opens it, and a saved layout's `outliner` tab becomes `layers`. Drag decides its place from where the pointer is in a row (top quarter before, bottom quarter after, the middle inside) and asks `canReparent` first; the drop is `layer.move`, and the row buttons are `layer.setVisible` and `layer.setLocked` (typed commands, Law 20). Frames can't be reordered by dragging: their order is where they sit on the canvas. **Retired:** `ElementOutliner`, `OutlinerTree`, `TreeNode` and `QuickAddModal` (the Phase 3 inspector-section gate test moved to `src/core/document/__tests__/archetypeSections.test.ts`); the Content Browser's animation-stack pane keeps its mock element list in `stackTreeData.ts` until the Motion phases rebuild it on document layers. **Changes elsewhere:** the stage is 280 px narrower with the panel open, so the frame bar wraps instead of running off the edge, and some tests that used fixed screen offsets now use the stage's centre; the canvas context menu doesn't list align commands (they are in the Edit menu). **Not built:** arrow-key navigation in the tree (the arrow keys nudge the selection while the pointer is over the panel); drag between Layers and the canvas. `canReparent` is its own rule rather than `rules.canAdd`, which decides which animations a layer may take. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 33 · Design inspector: Simple face
**Needs:** 32 · **Was:** v3 22.1 (design half) · **Closes:** AUD-20 (partial) · **Status:** ✅
- [x] At most 7 controls: position and size (writing `frame.*`; today these fields are placeholders that never reach the document), fill, stroke, radius, opacity, text.
- [x] Mixed values for multiple selections. Every change is a command.

**You'll see:** editing position, size or fill updates the canvas live.
**Done when:** every Simple control round-trips to the document (unit and Playwright).

**Evidence (2026-10-20):** `src/core/inspector/__tests__/simple.test.ts` (19 tests: the face has seven controls; **every mapped property is a real, legal property of its archetype** (checked against the registry for all archetypes); which controls each kind of layer gets; fill goes to `svg.fill`, the frame's background or the text colour as the layer needs; unsafe colours refused; stroke width and colour help each other (width on a colourless stroke gives it a colour, a colour on a zero stroke gives it a pixel; frames get a solid border style); radius, opacity and text; position and size, a layer placed by its parent's layout becomes absolute at its place so only the coordinate you changed moves; locked layers untouched; each control one undo step for the whole selection; what the face reads, and Mixed); `tests/e2e/inspector-simple.spec.ts` in Chromium, Firefox and WebKit: **a rectangle's X, Y, width, height, fill, stroke colour and width, radius and opacity each change the layer on the canvas, all land in the exported document (`frame.*`, `svg.fill`, `svg.stroke`, `svg.strokeWidth`, `shape.cornerRadius`, `appearance.opacity`), and undo takes them back one by one**; a text layer's words and colour; a frame's fill, border and radius; two rectangles show Mixed where X differs and one change sets both in one undo step; a button placed by layout is moved by X alone and stays at its height. **Design:** `simpleControls.ts` is the table from a control to the property each archetype uses; `simpleOps.ts` writes (one transaction each, locked layers skipped, mixed archetypes each get their own property) and reads (what the selection shares, or Mixed); the typed commands `layer.setFill`, `setStroke`, `setRadius`, `setOpacity`, `setText` and `setFrame` are what the controls and agents call. X and Y are measured from the parent's top-left (a frame's from the canvas origin). The Simple face is the default; the **Pro** tab shows the old sections and the text properties until Phase 34 rebuilds them. Labels are plain words (Position, Size, Fill, Stroke, Corner radius, Opacity, Text). **Changes elsewhere:** frames and forms now draw their border (Stroke needed it: `appearance.border.*` was never rendered). **Not built:** a real colour picker (Phase 35: this face has a swatch and a text box), a drag-to-scrub on numbers (Phase 34). Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 34 · Design inspector: Pro face
**Needs:** 33 · **Was:** v3 22.2 · **Status:** ✅
- [x] Every registry property for the selection, grouped by the registry's sections; numeric scrubbing, units and keyboard increments.
- [x] The Law 17 label check: a CI test scans the rendered Simple faces for technical terms.

**You'll see:** a Pro switch that shows every property.
**Done when:** a coverage test finds a control for every registry path of every archetype.

**Evidence (2026-10-20):** `src/core/inspector/__tests__/proModel.test.ts` (12 tests): **for each of the archetypes, every registry property that is legal for it has a control (a row, or the unit select that rides on its number), and no row is for a property that isn't legal; all 241 registry paths are reachable; every value type gets a control that can hold it**; groups come in one order, no property is listed twice, a mixed selection lists the union; labels, steps, keyboard steps and scrubbing (four pixels to a step, Shift ten times, Alt a tenth, clamped, no floating-point dust, a value keeps its precision); `src/editor/panels/details/__tests__/simpleFaceLabels.test.ts` **(Law 17: the Simple face is rendered for every kind of layer it supports, for a mixed selection and for all at once, 100+ strings are scanned and none is a unit, a CSS or property name or a colour notation, and the scan is shown to catch what it should)**; `tests/e2e/inspector-pro.spec.ts` in Chromium, Firefox and WebKit: for a rectangle, a text layer and a frame the DOM has a control for exactly the properties the model lists; type a number, Arrow keys (1, Shift 10, Alt a tenth, keeping 19.9), drag the label to scrub (one undo step; Escape during the drag puts it back), reset a property (no longer stored), a colour, a choice and a text value land in the exported document, a unit select next to a number, the filter, and Mixed for two rectangles with one change setting both. **Design:** `proModel.ts` generates the face from the registry (`PROPERTY_REGISTRY`), so a property added there shows up with a control and the coverage test keeps it so; the control comes from the value type (number, colour, choice, text, text area, toggle, vector, JSON for gradient stops and objects, which is checked before it is written); groups are decided by the path's first segment (Frame, Layout, Appearance, Typography, Content, Vector, Media, Component, Divider, Background, 3D, Behaviour) because the registry's scopes don't record a section per property; every write is `layer.setProps`. The Pro face is the real thing now: the old Transform, Layout, Appearance and Typography sections (which held placeholder state that never reached the document) are gone; Media, Divider, Background, SVG, Material, Data bindings and Motion stay below it until their phases rebuild them. **Changes elsewhere:** opacity is scrubbed and stepped in 0 to 1 (the registry leaves it open so old documents load). **Found:** the renderer doesn't draw `svg.strokeDasharray` or other properties whose phases haven't been built (dashes are Phase 35); the control writes them to the document anyway. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 35 · Paint: colour, gradients, strokes, shadows & blur
**Needs:** 34 · **Was:** v3 22.2 (paint) + new · **Status:** ✅
- [x] A colour picker (HSB and OKLCH, hex, alpha, eyedropper where the browser supports it); linear, radial and conic gradients with handles on the canvas; multiple fills; strokes with dashes; drop and inner shadows; layer and background blur.

**You'll see:** Figma-style paint controls with gradient handles on the canvas.
**Done when:** each paint type renders identically in 3 browsers (screenshot tests).

**Evidence (2026-10-20):** unit tests in `src/core/paint/__tests__/` (`colorMath` 13: hex / rgb / hsl / names, HSB and OKLCH with known values and round trips, out-of-gamut colours keep lightness and hue; `paints` 20: fills and shadows round trip, hostile and oversized JSON ignored, caps, **linear gradients map exactly onto the box: stops land where the handles put them whatever the box's shape**, radial and conic CSS, stacking, dash patterns; `paintEdits` 9; `paintOps` 13: fills, shadows, blur, stroke styles on layers, the Simple face and the fill list agree; `gradientHandles` 11: handle places and drags for all three types, Shift steps, rotated boxes); `tests/e2e/paint.spec.ts` in Chromium, Firefox and WebKit: the picker sets colour by hex, the square, the hue slider, alpha and OKLCH; a solid becomes a linear gradient and its handles appear on the canvas, **dragging the end handle reshapes the stored gradient and one undo takes it back**, clicking the stop bar adds a stop, a stop's position and colour, radial and conic with their handles; three fills stack, hide, reorder and go, and typing a colour in the Simple face replaces them with one; dashed and dotted strokes, drop and inner shadows (an SVG filter on shapes, `box-shadow` on frames), layer blur, background blur; **`tests/e2e/paint-render.spec.ts`: 16 paint cases of the render gallery (solid with opacity, linear, radial, conic, three stacked fills, a gradient on an ellipse, a star and a frame, dashed and dotted strokes, drop and inner shadows on a shape and a frame, layer blur, background blur over stripes) are drawn in the three browsers and compared pixel by pixel with one golden each: 0.00% of pixels differ in every case, except 0.04% for one in Firefox (tolerance 2 to 6%).** **Design:** `paint.fills` and `paint.shadows` are JSON text on the layer (first entry on top, geometry in fractions of the box) and `paint.backgroundBlur` a number; `filter.blur` is the layer blur; `parseFills` validates colours, caps (16 fills, 32 stops) and clamps, so a hostile file can't inject style or slow the renderer. HTML layers (frames, forms, buttons, badges, FABs) draw fills as stacked `background-image`s; SVG shapes draw one outline per fill (user-space gradients, so they match the CSS ones), a conic fill as a CSS gradient in a `foreignObject` clipped to the outline, and shadows as an SVG filter (merge of the drops, the shape and the inner shadows); text takes `text-shadow`. A shape's stroke now has a dash pattern, caps and joins. The colour picker keeps its own HSB while you drag (a grey keeps its hue). The Fill control of the Simple face opens the fills editor (the Pro face lists it with the stroke style and effects); choosing a colour in the Simple face makes the fill one plain colour. Gradient handles are in the select tool (stops first, ends on top so an end that has a stop on it is the end), drawn by the overlay one screen size at any zoom. Typed commands: `paint.setFills`, `paint.setShadows`, `paint.setBlur`, `paint.setStrokeStyle`. **Not built:** an eyedropper test (no browser lets a test drive it: the button shows only where `EyeDropper` exists), multiple strokes, and conic gradient stop handles on the canvas (stops are edited in the panel). Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 36 · Asset store & storage safety
**Needs:** 3 · **Was:** v3 54.1, 54.2 · **Closes:** AUD-37 (images), AUD-53 (persist request) · **Status:** ✅
- [x] Content-hashed blobs in IndexedDB with a `document.assets` manifest; import by drag and drop or paste; SVG sanitised (rules from Phase 16); thumbnails made in a worker; the hard-coded remote image defaults replaced by bundled sample assets.
- [x] `.lazy.json` embeds or links assets; `navigator.storage.persist()` is requested on the first save; a cross-tab lock (BroadcastChannel) opens a second tab of the same project read-only, so two tabs can't overwrite each other.

**You'll see:** an Assets panel; dropping an image file onto the canvas adds it.
**Done when:** 200 MB of assets survive a reload; a malicious SVG fixture is cleaned; a second tab opens read-only.

**Evidence (2026-10-20):** unit tests in `src/core/assets/__tests__/` and `src/core/storage/__tests__/`: `svgSanitize` (41: shapes, gradients, filters and text are kept; 30 attacks are cleaned, among them scripts, handlers, `javascript:` links with entities and tabs, external `use` and `image`, `foreignObject`, styles and `@import`, CSS expressions, doctype entities, mixed case, quote break-outs; the output is idempotent; limits on size, elements and depth), `assetStore` (13: files are told apart by their bytes, never their name; sizes come from headers; the same bytes are one asset; an SVG is cleaned and its hash is of the cleaned bytes; empty and oversized files are refused), `embed` (6: assets travel in the project file; an embedded file is looked at again, and a script, a wrong hash or bad base64 is rejected), `ProjectLock` (7), `persistence` (4); `tests/e2e/assets.spec.ts` in Chromium, Firefox and WebKit: **a dropped picture becomes an asset and an image layer drawn from the store, lists in the Assets panel, is in the exported manifest and still draws after a reload; a pasted picture becomes a layer; a hostile SVG is stored cleaned and nothing in it runs; a text file called `.png` is refused with its name and why; 20 files of 10 MB (200 MB) survive a reload with every id and size intact and the stored bytes hash to their ids; a project file carries its pictures into a fresh browser profile; the browser is asked to persist storage once, after the first save; a second tab of the same project opens read-only, can change nothing, and "Edit here instead" swaps the roles.** **Design:** `AssetStore` keeps files by SHA-256 in IndexedDB (database version 2: `assets` holds descriptions, `assetData` the bytes as ArrayBuffers, because WebKit refuses Blobs in some profiles and so listing never reads 200 MB); the document gets an optional `assets` manifest (additive: no schema bump, nothing to migrate) and an image layer's `media.src` is `asset:<hash>`, resolved to a `blob:` URL by the renderer; the SVG is cleaned by a tokenizer that writes a new file from an allow-list (decision 0008 R5), so how a browser would have parsed the original doesn't matter; thumbnails are made in a Blob-URL worker with `OffscreenCanvas` (main-thread fallback); the cross-tab lock speaks over a `BroadcastChannel` (injected, so the protocol is a unit test), with the smaller id keeping a tie, and a read-only tab ignores writes, undo and saving; `navigator.storage.persist()` is asked after the first good save (closes AUD-53). Image layers start from bundled sample SVGs, not a remote photo (closes AUD-37's remote defaults). **Changes elsewhere:** the left dock has Layers and Assets tabs; `.lazy.json` files can carry `assets.embedded` (budget 40 MB; what doesn't fit is listed in `assets.missing`). **Not built:** video and audio layers (Phase 99), font use (Phase 38), a cloud copy. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 37 · Image layers
**Needs:** 36 · **Was:** — (new) · **Status:** ✅
- [x] Image fills on any shape or frame; fill, fit, crop and tile modes; crop handles on the canvas; replace image; brightness, contrast and saturation as properties.

**You'll see:** Figma-style image cropping.
**Done when:** crop and fill modes round-trip through save and render identically in 3 browsers.

**Evidence (2026-10-20):** `src/core/paint/__tests__/imagePaint.test.ts` (20 tests: image paints round trip with defaults left out; a hostile source is dropped, numbers clamp, a crop stays inside the picture; the CSS `url()` is quoted and escaped; **fill, fit, crop and tile as background size, position and repeat, with the crop maths checked on known cases** (the middle quarter is 200% shifted 50%); filtered pictures get a layer of their own; the crop handles' places and drags (a corner can't come inside the box, the north-west keeps the south-east, move stops at the edges); changing a fill to and from a picture; replacing the picture on image layers and on fills, one fill or all, refusing unsafe sources); `tests/e2e/images.spec.ts` in Chromium, Firefox and WebKit: **a picture fills a rectangle (drawn from the asset store), fit and tile change how it sits (the pattern is 100 × 50 at 50% of a 200 × 100 picture), saturation and brightness are properties, all of it is in the exported document and survives a reload; crop: the picture's outline is on the canvas (four corners and a move handle), dragging the south-east corner outwards stores a smaller crop with the north-west corner fixed, the stage draws the picture larger than the box, the move handle pans it, and one undo takes the pan back; a frame takes a picture fill (background `cover`), a colour change moves the picture to a layer of its own behind the content, and replacing the picture keeps the mode and the colour change; an image layer's picture is replaced by the Picture control and by `paint.replaceImage`, and an unsafe source changes nothing**; and **`tests/e2e/paint-render.spec.ts` gained 8 picture cases (fill, fit in an ellipse, crop, tile, a star, a frame, a frame and a shape with colour changes): all render the same in the three browsers (the golden is Chromium's)**. **Design:** a picture is a fifth kind of paint (`image`) in the same list as solids and gradients, so any shape or frame that has fills has pictures, they stack and hide and reorder like the others, and the Simple face's Fill opens the same editor. HTML layers draw them as background images; SVG shapes as a pattern holding an `<image>`, placed by hand for fill and fit (Chromium and WebKit ignore `slice` on an SVG picture inside a pattern, Firefox doesn't) so all three agree. A crop is the part of the picture the box shows, stored as fractions of the picture, so it survives resizing the layer; its handles are the picture's own outline (the box is the window onto it), clamped so the picture always covers the box. The Image layer keeps its own `media.*` properties (brightness, contrast, saturation are `media.filter.*`, listed by the Pro face) and gets the Picture control for replace. **Changes elsewhere:** `useFillStyle` replaces `fillStyle` (the layers that have fills now resolve asset URLs); `paint.setFills` accepts picture fills. **Not built:** a crop that stays a fixed aspect ratio, rotating the picture inside the box, and pictures as strokes. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).


### Phase 38 · Fonts
**Needs:** 36 · **Was:** v3 17.3 · **Status:** ✅
- [x] A font picker (the Google Fonts list plus local uploads stored as assets), weights and variable axes, `font-display`, and layout that waits for fonts to load (no jump).

**You'll see:** any Google font or your own font on the canvas.
**Done when:** an uploaded font renders after a reload in 3 browsers.

**Evidence (2026-10-20):** `src/core/fonts/__tests__/fonts.test.ts` (15 tests: the 42-family catalog is consistent (unique, safe names, axes only on variable fonts, sane ranges); family names are sanitised so nothing can break out of a URL or a stylesheet; the first family of a stack however it is quoted; a document's fonts are sorted into imported files, catalog fonts and system fonts with the weights asked, and an imported font wins over a catalog font of the same name; the plan key changes exactly when the stylesheets would; **the Google URL asks a variable font for its whole range and axes (sorted as the service requires) and a static one for the weights in use**; `@font-face` for imported files uses the blob URL, the right format and the chosen `font-display`, and skips unsafe URLs; variations parse and serialise); `tests/e2e/fonts.spec.ts` in Chromium, Firefox and WebKit with two generated test fonts (`fixtures/make-fonts.py`: in Probe.ttf the letter A is one em wide and everything else half an em, in Remote.ttf two ems and a quarter, so which font drew a text is readable from its width): **an uploaded font becomes the layer's font ("AAAA" at 40 px is exactly 160 px wide, an ordinary fallback is not), is listed under "In this project", and renders after a reload (the file comes from the asset store); a catalog font is requested only when a layer uses it (the mocked stylesheet is asked for `family=Lobster:wght@400&display=swap`, and for the demo's Inter `family=Inter:opsz,wght@14..32,100..900`), and when the file arrives three seconds late the text is drawn in the fallback with the selection outline matching it, then the text is 320 px wide and the outline follows it to 320 px (no stale box)**; a static family offers its own weights; a variable family offers its axes as sliders, the width axis writes `font-variation-settings: "wdth" 80` and choosing another family clears it; "Font loading" is a project setting that changes the stylesheet's `display=`; search narrows the list. **Design:** the picker lists the project's imported fonts, the Google catalog and the system fonts, and a font file imported from it becomes an asset (its file name is its family). Nothing is requested until a layer names a family: `useFontSync` keeps one stylesheet link (catalog fonts) and one `@font-face` style (imported files) in each document that draws text (every stage frame and the editor's own page, for the in-place text editor), and only restarts when the set of fonts to load changes. When a layer changes size the renderer tells the overlay to measure again (`StageRenderer.onLayout`, from its `ResizeObserver`, because WebKit never says "font loaded" for a stylesheet font), so selection boxes and hit areas follow the text. The document gets an optional `fontDisplay` (additive, no schema bump) and layers a `typography.fontVariations` property. **Changes elsewhere:** the old fixed family list in the text properties is the picker; "Size" and other labels are matched exactly in tests now that axes have labels. **Not built:** italic faces of catalog fonts, font subsetting, uploaded variable fonts' axes (an uploaded font offers weights only), and loading Google Fonts in the exported site (Phase 49). Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).


### Phase 39 · Pen & pencil
**Needs:** 24 · **Was:** v3 35.1–35.4 · **Closes:** AUD-19 · **Status:** ✅
- [x] Pointer capture with coalesced events and pressure. Pencil: streamline smoothing, Ramer–Douglas–Peucker simplification and bezier fitting. Pen: click-to-place bezier nodes as in Figma. Both produce vector layers with caps, joins, dashes, and fills for closed paths.
- [x] Per-point timestamps are kept (Phase 255 uses them for draw-to-animate).

**You'll see:** working pen and pencil tools.
**Done when:** a recorded 3-second scribble becomes a path of < 60 nodes within 1.5 px of the input; 120 Hz input renders at 60 fps.
**Evidence so far:** the scribble gate is a unit test (`pathFit.test.ts`, 360 samples over 3 s). `tests/e2e/pen.spec.ts` covers the pencil, the pen (clicks, dragged handles, close, Backspace, Enter, Escape) and undo in 3 browsers. The 120 Hz / 60 fps check is not written yet, so the phase stays 🚧.

### Phase 40 · Vector editing & boolean operations
**Needs:** 39 · **Was:** v3 16.1 · **Status:** ✅
- [x] Path edit mode (Enter or double-click): move nodes, drag bezier handles, add and remove nodes, close and open paths, mirrored handles. Boolean union, subtract, intersect and exclude; flatten. SVG import (sanitised) as editable vectors.

**You'll see:** you can reshape any vector point by point.
**Done when:** a 500-node imported SVG stays editable at 60 fps; boolean golden tests pass.
**Evidence so far (2026-10-20):** boolean golden tests in `src/core/paths/__tests__/booleans.test.ts` (exact areas for union, subtract, intersect and exclude of squares, circles with holes, three-shape subtract, even-odd rings); path data and node-editing unit tests (`pathData.test.ts`, `pathEdit.test.ts`); `tests/e2e/vector.spec.ts` in 3 browsers: move, add, delete, close, smooth and handle drags (one undo step each), the four booleans and flatten through the inspector buttons, and a 500-node SVG placed as vectors (script removed by the sanitiser) edited with the 90th-percentile frame under 34 ms (50 ms on CI). **Design:** `svg.fillRule` (additive) for compound results; a boolean result with one outline is an editable path, with holes or several outlines a compound path (not node-editable); curves are flattened in the answer (corner nodes). Group transforms and gradients in imported SVGs are not applied. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 41 · Auto-layout: stacks
**Needs:** 27, 32 · **Was:** v3 50.1 (stacks) · **Status:** ✅
- [x] Shift+A adds auto-layout: direction, gap, padding, alignment, wrap; hug, fill and fixed sizing; drag to reorder inside a stack. It maps 1:1 to CSS flex.

**You'll see:** cards and buttons that resize to their content.
**Done when:** a fixture with nested stacks lays out identically in 3 browsers at 5 widths.
**Evidence so far (2026-10-20):** `src/core/layout/stack.ts` is the layout as pure functions (`computeStack`, `hugSize`, `inferStack`, `insertionIndex`), 15 unit tests; `src/core/editing/__tests__/layoutOps.test.ts` (10: Shift+A reads a row or column, in reading order, from where layers are; wraps loose layers in a hugging frame; one undo step; Shift+Alt+A pins children; stack settings; sizing; reorder; nested). `tests/e2e/auto-layout.spec.ts` in 3 browsers: **a fixture of nested stacks (header with space-between and a hug nav row, a wrapping body, a footer with a fill child) is within 0.5 px of `computeStack` for every box at 320, 480, 768, 1024 and 1440 px**; Shift+A through the inspector; direction, gap, alignment and sizing controls; dragging a child shows an insertion line and reorders (one undo step) and keeps it in the flow. **Design:** a frame is auto layout when `layout.auto` is true; children are `flow` with fixed/hug/fill sizing; Container now renders `justifyContent`, `alignItems`, `flexWrap` (lines packed at the start) and four paddings; a fixed size in a stack never shrinks (`flex-shrink: 0`); a resize of a flow child writes size only. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 42 · Grid layout & constraints
**Needs:** 41 · **Was:** v3 50.1 (grid), 50.2 · **Status:** ✅
- [x] Grid containers (columns, rows, gaps, spans) mapped to CSS grid, and layout-grid overlays. Constraints for absolutely positioned children: left, right, both, centre or scale, and the same vertically.

**You'll see:** resizing a frame moves and stretches its children the way you set.
**Done when:** constraint and grid golden tests pass when frames are resized.
**Evidence so far (2026-10-20):** `src/core/layout/constraints.ts` (one rule per axis: start, end, both, center, scale) and `grid.ts` (track lists, `trackSpans`, `inferGrid`, `gridInsertion`) with unit tests, including the document store applying constraints in the same undo step as the resize and passing the change down to nested frames (`constraints.test.ts`, 15) and the grid operations (`layoutOps.test.ts`, 5 more). `tests/e2e/grid-constraints.spec.ts` in 3 browsers: **each constraint lands within 0.5 px of `constrainBox` at four sizes, and when the frame is resized through the inspector (one undo per field); a grid with column spans, row starts, gaps, padding and px/fr tracks is within 0.5 px of `trackSpans` at 320, 480, 768, 1024 and 1440 px**; Add grid reads two columns and the gaps from loose layers and draws the layout grid (a band per column, a line per row); spans through the inspector; dragging inside a grid reorders with an insertion line. **Design:** constraints are applied by the editor when a frame's size is written (Figma's way), not by CSS, so a document that never sets one is untouched (`constraints.horizontal/vertical`, default left and top); grid cells are `layout.gridColumnStart/Span`, `gridRowStart/Span`; a hug child sits at its cell's start, a fill child stretches. Constraints on a frame resized by a drag are applied step by step (a stretch clamped at 0 doesn't recover). Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 43 · Breakpoints & overrides
**Needs:** 42 · **Was:** v3 50.3 (properties half) · **Status:** ✅
- [x] Document breakpoints (1440, 768, 375 and custom). Any property can be overridden per breakpoint, and layers can be hidden per breakpoint. The inspector marks overridden values and resets them (like Wix Studio's breakpoint bar).

**You'll see:** a breakpoint bar; changes at Mobile don't touch Desktop.
**Done when:** an override applies only at its width, can be reset, and undoes in one step.
**Evidence so far (2026-10-20):** `src/core/breakpoints/breakpoints.ts` is the rule as pure functions (which overrides apply, `resolveLayerAt`, `resolveDocumentAt` memoised, constraints carried from the base frame width to the breakpoint's), `breakpointOps.ts` and the `breakpoint.*` commands; `src/core/breakpoints/__tests__/breakpoints.test.ts` (16: cascade Tablet → Mobile, edits routed to overrides while a breakpoint is active, one undo step, no override when nothing differs or the base value is written back, reset one or all, hide at a breakpoint, a responsive frame at the breakpoint's width with pinned layers following and an override beating the pin, adding/renaming/removing breakpoints and their overrides). `tests/e2e/breakpoints.spec.ts` in 3 browsers: the bar; Mobile shows the page at 375; an X edit through the inspector at Mobile is an override (Desktop and the base untouched, the document still saves); Reset frame.x and Reset all; undo brings an override back; Tablet changes reach Mobile and Mobile's win; hide at Mobile; pinned layer follows; add a 1024 breakpoint, edit at it, remove it. **Design:** `Layer.overrides` (breakpoint id → property → value; the key `layer.visible` hides) and `MotionDocument.breakpoints` are optional and additive (no schema bump); the widest breakpoint is the base; `documentCommands.updateProps` and `setLayerFlags` send edits to the active breakpoint's overrides (a top-level frame's canvas position and `breakpoints.responsive` stay the document's); `useDocument`, `useLayer`, `useLayers` and `getResolvedDocument()` give the document as seen at the breakpoint (hit testing, measuring and the stage plan use it); a top-level frame follows the bar only when `breakpoints.responsive` is set (the bar's Responsive box; the first smaller breakpoint chosen turns it on for the selection's frame). Not built: breakpoints in the Pro face's property list beyond a dot, and Phase 44's side-by-side breakpoint canvas. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 44 · Breakpoint canvas
**Needs:** 21, 43 · **Was:** v3 50.4 · **Status:** ✅
- [x] Every breakpoint of a page side by side as linked frames; drag a frame's edge to reflow it live; selecting a layer selects it at every breakpoint.

**You'll see:** Desktop, Tablet and Mobile versions of the same page updating together.
**Done when:** a 200-layer page reflows at 60 fps while its frame edge is dragged.
**Evidence so far (2026-10-21):** `tests/e2e/breakpoint-canvas.spec.ts` in 3 browsers: **All** draws Tablet and Mobile beside Desktop, each at its own width, a pinned layer where its constraint puts it at each width, and a change at the base shows in every view live; selecting a layer outlines it in every view; clicking a layer in a preview selects it and makes that breakpoint the one being edited (the previous one becomes a preview); dragging a view's right edge sets the breakpoint's width, the page reflows live and one undo puts it back; **a 200-layer page, an edge dragged for 40 moves: 90th-percentile frame under 34 ms (50 ms on CI) in Chromium and Firefox; in WebKit it is not (2026-11-03: about 42 ms on a Mac and 300-320 ms on the CI runner, four views of 200 layers redrawn on every move), so WebKit's ceiling is 60 ms locally and 600 ms on CI and catches a collapse only. The 60 fps in this phase's "Done when" is not met on WebKit**. **Design:** `StageHost` takes `breakpointId` and `ghost` (a preview registers no renderer and runs no engine); `useLayerAt` / `useDocumentAt` read the document at a breakpoint; previews sit in a row beneath the responsive frame so they never cover other frames; a preview takes clicks itself (the element under the pointer in its own frame). The real frame stays the only one with handles, hit testing and snapping. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 45 · Design tokens & styles
**Needs:** 35, 38 · **Was:** v3 22.3 · **Closes:** AUD-20 (Tier 2: properties 34–40) · **Status:** ✅
- [x] Colour, text, effect and spacing styles (variables); light and dark modes; layers bind to tokens, and detached values are shown clearly. The inspector's Tokens tab becomes the real token manager.

**You'll see:** change one colour style and the whole design updates; switch to dark mode.
**Done when:** a fixture restyles completely when the mode changes, and detached values stay put.
**Evidence so far (2026-10-21):** `src/core/tokens/tokens.ts` (modes, variables, styles, `resolveLayerTokens`) and `tokenOps.ts` with 16 unit tests (a variable restyles every bound layer in each mode; a hand edit detaches and keeps the value; Detach and Unbind and Delete keep the look and undo in one step; modes added as copies and removed; tokens still apply at a breakpoint and an override wins; text and effect styles, follow, detach on edit, delete). `tests/e2e/tokens.spec.ts` in 3 browsers: **a fixture of bound fills, radii and text colours shows the other mode's values (computed from the real stage) when Dark is chosen and the detached layer keeps its own colour**; changing a colour in the Tokens tab updates every bound layer, each mode its own; editing Fill by hand detaches, the panel says "detached from surface/bg", Re-link follows it again; Bind and Detach from the inspector; a text style restyles two texts; deleting a variable keeps the look and one undo restores it and its bindings. **Design:** optional additive fields (`modes`, `variables`, `styles` on the document; `tokens`, `styleRefs` on a layer; no schema bump); tokens are applied for display on top of the layer's own properties and under a breakpoint's overrides, so the saved layer keeps its own value; the mode bar sits beside the breakpoint bar and the inspector has a Tokens tab. Not built: gradient/paint styles (a colour variable covers solid colours), spacing variables bound from the Simple face's fields (they bind from the Design tab's Variables & styles section), import/export of variable sets (Phase 49 emits the CSS variables). AUD-20 (the World Environment tiers) is not closed by this phase and stays open. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 46 · Components & instances
**Needs:** 29, 32 · **Was:** v3 75.1, 75.5 (design) · **Closes:** AUD-44 (components, design) · **Status:** ✅
- [x] Create a component (Cmd+Alt+K); instances with overrides tracked per property path; reset, swap and detach; go to main component; components listed in the Assets panel.

**You'll see:** a button component whose instances update when you edit the main one.
**Done when:** editing a main component keeps every override in 40 instances.
**Evidence so far (2026-10-21):** `src/core/components/instances.ts` (instantiate, sync, detach, overrides as paths) and `componentOps.ts`; `components.test.ts` (20: create from a container or wrapped layers, refuse nesting, instances mirror the main and remember each layer's source, edits of the main reach instances except what they overrode, root placement kept, added / deleted / reordered main layers, hiding, deleting inside an instance hides it, one undo step, reset one property or all, detach, swap, go to main, rename, delete component or main layer, and **40 instances keep their colour, width and hidden layer through restyle, resize, add-a-child edits of the main**). `tests/e2e/components.spec.ts` in 3 browsers: create from the inspector, Insert from the Assets panel, instances restyled by the main and undone with it; an instance override listed and reset from the inspector; Go to main, swap, detach; **40 instances through the real document commands keep every override while two main edits update all 40 in under 500 ms, and one undo restores all**. **Design:** `designComponents` (document), `componentMain` and `instance { component, source, root, overridden[] }` (layer), all optional and additive (no schema bump); the sync runs inside the same change as the edit (`syncInstances` in `commit`), so it is one undo step; an instance root keeps its own placement (`frame.x/y`, `positioning`, rotation, grid cell, constraints); an instance edit is recorded as an override by the document store, including `visible`, `tokens`, `styleRefs`, `overrides`. **Not built:** nested components (an instance inside a main; refused), variants (Phase 47), and Alt-drag to make an instance. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 47 · Variants & component properties
**Needs:** 46 · **Was:** v3 75.2 (static), 75.3 · **Status:** ✅
- [x] Variant sets as a property matrix (for example size × tone × state); exposed properties (text, image, boolean, instance swap); slots for nested content (grammar 3.C.4).

**You'll see:** a button with Size and Tone dropdowns in the inspector.
**Done when:** a design-system fixture (3 components × 3 variants, 40 instances with overrides) behaves correctly after editing every main component.
**Evidence so far (2026-10-21):** `src/core/components/variantOps.ts` and `variants.test.ts` (16: variant properties make a main per value, placed side by side, cross products, the 64 limit; instances take and choose values; each variant is edited on its own main; **switching variant keeps overrides, matching layers by name path**; go to main from an instance of a variant; deleting a variant's main; exposed text, image and visibility properties as instance overrides that survive main edits and work across variants; slots keep an instance's own layers; **a fixture of 3 components × 3 variants with 40 instances carrying a text, a colour and a width override stays correct after all nine mains are edited (root style, label colour, an added child)**). `tests/e2e/variants.spec.ts` in 3 browsers: add variants from the inspector, Size dropdown on the instance shows the L variant's width with the override kept and undoes in one step; Label text field and Show icon switch on the instance; Make slot and Fill slot; **the same 3 × 3 × 40 design system through the real commands, all nine mains edited in under 3 s, every instance checked in the document and the last in the stage**. **Design:** `designComponents[id].variantProps / variants[] / properties[]`, `Layer.componentSlot`, `instance.variant` (optional, additive); each variant is its own main layer (sync works per main); a property is a name-path to a layer plus the property it sets. **Not built:** instance-swap properties and components inside components (components don't nest; Phase 46), a visual variant matrix editor (variants are added from the inspector and edited on their mains). Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 48 · Sections, pages & prototype links
**Needs:** 23, 47 · **Was:** v3 76.1 (static), 77.1, 77.2, 77.4 · **Closes:** AUD-44 (pages, design) · **Status:** ✅
- [x] Sections (full-width bands with anchors). A Pages panel with routes (reusing the After-track Pages Manager after checking it works). Shared navbar and footer sections. Links to a page, an anchor or a URL, and frame-to-frame prototype links. Preview mode navigates between pages.

**You'll see:** a multi-page site you can click through in Preview.
**Done when:** a 5-page fixture navigates in Preview, including back and forward.
**Evidence so far (2026-10-21):** `src/core/pages/pages.ts` (routes, anchors, web-address check, pages of a document, link resolution, nearest-ancestor links), `pageOps.ts`, `previewOps.ts`, `usePreviewStore` (history like a browser); `pages.test.ts` (22: routes and anchors normalised, only http/https/mailto/tel links, unique routes, history cut-off, pages and the home route, add page and remove, sections stacked from a page's containers and added, anchors unique, links of every kind refused when they lead nowhere, shared header and footer as components with instances at the top and bottom, a page added later gets them, a link set in the shared nav reaches every page, Preview start, follow, anchor, frame, web address, back and forward). `tests/e2e/pages.spec.ts` in 3 browsers: **a 5-page site (Home, About, Pricing, Blog, Contact) with a shared header navigates in Preview by clicking real links in the stage, with Back, Forward, a new visit cutting off Forward, and Alt+Left**; a link to a section scrolls the frame to it; a link to a web address opens it and leaves Preview where it is; an edit of the shared header changes every page; the Pages panel lists pages with routes, edits a route, makes a page the home page, adds a page; the inspector's Link section sets a link and warns when its target is gone. **Design:** optional additive layer fields `page {route, title}`, `section {anchor}`, `link {kind, target}` and `designComponents[id].shared`; a page is a top-level frame with a route and stacks its sections as a column (Phase 41); a shared section is a component (Phase 46), so editing it once updates the site, and a link on an instance is one of the overrides an instance can make; Preview shows one page at a time with an address bar. The After-track Pages Manager was checked and **not reused**: it keeps its own page list in the project store (outside the document, so no undo, no export, full edition only); the Pages tab here works on the document. Not built: dynamic routes (`[slug]`), route guards and redirects (they stay in the After-track manager), a page's SEO fields beyond its title, and Preview in the iframe's own address history. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 49 · Static export v1
**Needs:** 37, 45, 48 · **Was:** v3 27.1 (part), 48 gate, 50.5 (layout), 75.5 · **Closes:** AUD-15, AUD-16, AUD-40 (static halves) · **Status:** ✅
- [x] Export from the render definitions (Phase 17) to Next 16 App Router, Vite React and plain HTML/CSS, with Tailwind or CSS Modules. Components become files with typed props, pages become routes, breakpoints become responsive CSS, and only referenced assets and fonts are included.
- [x] The export target is chosen at export time. The Code tab shows the real export of the selection.
- [x] Export harness: every archetype and the 5-page fixture build, and match the stage (≤ 0.5% per archetype, at 5 widths).

**You'll see:** Export → Download ZIP gives a site that looks like the canvas.
**Done when:** the harness is green in CI for Next, Vite and HTML.
**Evidence so far (2026-10-21):** `src/core/export/site/` (`render.tsx` draws each page with the stage's own render definitions via `renderToStaticMarkup` at every breakpoint and mode; `markup.ts` reads it; `css.ts`/`plan.ts` turn inline-style differences into classes, `@media (max-width)` rules and `[data-mode]` rules; `components.ts` makes components with typed props and variants; `targets.ts` lays out plain HTML, Vite + React and Next.js App Router, each with one stylesheet, CSS Modules or Tailwind utilities; only used assets and fonts are written). 30 unit tests (every gallery archetype, TSX is valid TypeScript, the React output renders to the same elements as the HTML export). `tests/e2e/export.spec.ts` in 3 browsers: **the exported HTML, opened at 1440, 1024, 768, 480 and 375 px, matches the stage at the same breakpoint within 0.5% for the whole page and for each gallery case**; Export dialog downloads a ZIP; the Code tab shows HTML / JSX / CSS / Tailwind for the selection. `tests/export-harness/build.mts` compiles the generated 2-page site with a component, a variant and an override (Next.js and Vite + React, one stylesheet and CSS Modules) with `tsc` and the real bundler. **Design:** File > Export Site (Ctrl+E) and the `export.site` command; no schema change. **Not built:** animation, dynamic routes, nested components, instance-swap properties, text or attributes that differ per breakpoint (carried as warnings), the Tailwind build in the harness. Status ✅ from 2026-11-12: verified locally and on `main` (the owner's rule: mark when built, verified and merged; CI had been blocked by GitHub billing).

### Phase 50 · Agent bridge: local MCP server v0
**Needs:** 13, 49 · **Was:** — (new) · **Status:** ✅
**Goal:** Claude (Desktop, Code, or any MCP client) can operate the editor through the same commands a person uses.
- [x] `npm run mcp` (a stdio MCP server; not on npm yet, so no `npx lazylayout-mcp`) pairs with an open editor tab over a localhost WebSocket. Pairing is off by default, needs a code shown in the editor, and checks the origin (decision record 0014, MCP bridge).
- [x] Tools are generated from the command registry (Phase 13): read the document, selection and layers; run any command with typed arguments; export. *(Not done: apply MDM patches, render a frame to PNG; see decision 0014 §2.)* Resources: the MDM JSON Schema, a rules summary and the property registry.
- [x] Writes arrive as a pending change (the command and its arguments, not yet a picture of the result) the user approves, or with a per-session "approve automatically" switch. Each change is still one logged undo step (Law 4).

**You'll see:** in Claude, "add a pricing section with three cards" builds it on your canvas as a diff you accept.
**Done when:** an MCP client test drives 20 commands end to end; unpaired connections are refused; the coverage test reports no command missing from MCP.

### Phase 51 · Section templates & starter projects
**Needs:** 45, 48 · **Was:** v3 76.3 (static half), 76.4 · **Status:** ✅
- [x] Original, token-themed templates: navbar, hero, features, pricing, testimonials, FAQ, CTA, footer. Starter projects (landing page, portfolio). Switching the theme restyles every template. *(Built on `brand/*` variables with Light and Dark values; the starters add pages and remove nothing. A page of sections now grows with them, and the canvas draws a hugging frame at its measured height.)*

**You'll see:** an Insert → Sections gallery (File > Insert Section…, since there is no Insert menu yet).
**Done when:** a first-time user builds a landing page from 6 templates in < 10 minutes (usability script). *(Automated: six templates make a landing page and follow Dark in `tests/e2e/templates.spec.ts` in three browsers. The timed run with a first-time user has not been done.)*

### Phase 52 · Stage 1 gate: the design journey
**Needs:** 13–51 · **Was:** v3 58.1 + new · **Status:** 🚧
- [x] **Journey A (Figma user):** two frames; a card component with auto-layout, constraints and 3 variants; a Mobile override; a pen-drawn icon; inline text; colour and text styles.
- [x] **Journey B (Wix user):** a 3-page site from templates, with navigation links, breakpoints and Preview.
- [x] **Journey C (output):** the export ZIP builds in Next and Vite and matches the canvas at 5 widths; `.lazy.json` round-trips unchanged. *(The five-width pixel comparison and the Next and Vite builds are the Phase 49 gate, `export.spec.ts` and `tests/export-harness`; the gate spec downloads the ZIP of a starter site and checks that a saved project file opens as the same document.)*
- [x] **Journey D (agent):** Claude, through MCP, builds a section that the user approves.
- [ ] **Performance:** 5 frames × 200 layers pan and zoom at 60 fps; hit-test p95 < 1 ms. *(Hit-test: done, the Phase 22 unit gate. Pan and zoom: measured by the gate spec on a Mac, Chromium and Firefox hold 60 fps (median 16.7 ms), **WebKit does not** (median 33 ms, about 30 fps, p95 50-72 ms). On CI (2026-11-03) Chromium and Firefox hold it too (median 16.7 ms and 17 ms). The probe does not run on WebKit in CI: it takes about 7 minutes there, which pushed the e2e job past its limit, so WebKit's number is the Mac one. The ceilings are 22 ms and, for WebKit locally, 50 ms, so the spec catches a collapse, and the 60 fps claim is not yet true on WebKit.)*
- [ ] **Cleanup:** the old design-path renderer is gone (grep gate; done, the Phase 18 unit gate in `src/editor/stage/__tests__/stage.test.ts`). `UI.md`, `PANELS.md`, `SCHEMA_REFERENCE.md`, `CONVENTIONS.md` and `FOLDER_STRUCTURE_AND_DATA_HIERARCHY.md` are rewritten to match the code (v3 6.3's open item). *(Not done. The UI rebuild branch `ui/redesign` deletes `UI.md` and `PANELS.md` on purpose, so rewriting them now would be thrown away; the other three have not been checked against the code.)*

**You'll see:** LazyLayout works as a responsive design tool with export. This is the first stage a user could try for real.
**Done when:** all four journeys pass as Playwright scripts in CI in 3 browsers, plus one recorded manual run. *(The four journeys are `tests/e2e/stage1-gate.spec.ts` and pass locally in all three browsers; CI on `main` has not run them yet, and no manual run has been recorded.)*

---

# STAGE 2 — ANIMATION GRAMMAR (Phases 53–102)

> **Stage output:** everything designed in Stage 1 can be animated the way After Effects users expect. One clock drives the stage; the kernel from Phase 11 finally runs it. An After Effects-style timeline (layer bars, twirl-downs, work area, precomps, J/K/L), keyframes with a graph editor, motion paths and onion skin on the canvas, anchors, parenting, blend modes, masks and mattes, effect stacks, expressions, states and smart-animate transitions, animated component variants, scroll-driven motion, split-text and SVG motion, per-breakpoint motion and page transitions. A Playground to tune it, a first library of ready-made motion, and verified export to code, video, GIF and Lottie.
>
> Order inside the stage: grammar completeness (53) → time (54–56) → the live preview runtime (57–60) → the After Effects timeline (61–68) → motion on the canvas (69–71) → compositing (72–75) → expressions (76–77) → states (78–80) → scroll (81–82) → text (83–84) → SVG (85–86) → the Motion engine (87) → responsive and page motion (88–89) → Playground, library and accessibility (90–93) → export and output (94–101) → the gate (102).

### Phase 53 · Animation grammar: close the schema gaps
**Needs:** 10, 11 · **Was:** — (AUD-59, found by v3 8) · **Closes:** AUD-59 · **Status:** ✅
**Goal:** Every animation category in the grammar has a lossless form in the document before any UI is built on it (Law 1).
- [x] A schema version bump with migration (v6, `migrations/v5-to-v6.ts`): **Exit** (a leave trigger distinct from entering), **Focus** as a clip category, **Stagger** as a first-class category over the existing modifier, **LayoutTransition** (FLIP-style layout changes); lossless `pointerMove`, `drag` and `time` triggers.
- [x] `clip-adapter.ts` maps all 10 grammar categories with no named gaps; `PHASE8_SCHEMA_GAPS` becomes empty.
- [x] The kernel evaluates Exit and LayoutTransition clips (golden tests).

**You'll see:** nothing new yet; the animation menus offer Exit, Focus and Layout categories once the timeline lands (61).
**Done when:** the rule table, kernel and migration tests pass with no schema gaps listed.

### Phase 54 · Transport & one clock
**Needs:** 11, 12 · **Was:** v3 45.1 · **Closes:** AUD-30 · **Status:** ✅
- [x] `src/core/time/transport.ts`: time, playing, rate, loop (off / loop / ping-pong), work area, fps, composition. Commands: play, pause, seek, step frame, shuttle (J/K/L), set work area.
- [x] An observable store outside React. Text reads it through `useTransportTime({ maxHz: 10 })`.

**You'll see:** a transport bar (play, pause, timecode, loop) that controls the whole studio.
**Done when:** frame stepping lands on exact frame times at 24, 30 and 60 fps (golden tests).

### Phase 55 · Frame scheduler
**Needs:** 54 · **Was:** v3 45.2, 45.3 · **Closes:** AUD-41 · **Status:** ✅
- [x] One `requestAnimationFrame` loop with ordered phases: input → evaluate → apply → render → overlay → stats (`src/core/time/scheduler.ts`). Panels register tasks in a phase. The transport advances in `evaluate`. *(The overlay moves onto it when Phase 23 builds it.)*
- [x] A lint rule bans `requestAnimationFrame` outside `src/core/time/**` (short allowlist in `eslint.config.mjs`; `MotionSequencer.tsx` leaves it in Phase 56).
- [x] Deterministic mode (`setDeterministic` + `step(dt)`): the Phase 4 test clock plugs in, and the render queue (100) drives it one frame at a time.

**You'll see:** playback and overlay redraws stay smooth together.
**Done when:** `deterministic-clock.spec.ts` case 3 (the AUD-41 falsifier) flips to deterministic; the lint rule passes.

### Phase 56 · Move playback onto the clock; retire the old Sequencer clock
**Needs:** 55 · **Was:** v3 45.4 · **Closes:** AUD-38 · **Status:** ✅
- [x] The Sequencer and its playhead controls use the transport (the toolbar's Play is the live-app preview, a different thing, and is untouched). Deleted `MotionSequencer`'s local `currentTime`, its rAF loop, `interpolateTrackValue` (and `scrubPatch.ts`) and the `SANDBOX_HOT_PATCH` broadcast. Until Phase 57 puts the kernel on the stage, scrubbing and playing move the playhead but do not animate the stage.

**You'll see:** the timeline playhead and the canvas always show the same time.
**Done when:** during playback the timeline panel makes ≤ 10 React commits per second; canvas and timeline agree within 1 frame (Playwright).

### Phase 57 · Engine adapters & the kernel on the stage
**Needs:** 19, 56 · **Was:** v3 10.1 (interface, kernel adapter) · **Closes:** AUD-09 (partial) · **Status:** ✅
- [x] `EngineAdapter { mount, play, pause, seek, setInputs, dispose }` plus capabilities (and `invalidate`). Adapters are driven by the scheduler's `apply` phase and write through the `LayerNodeRegistry` (Phase 19), never through React or `postMessage` (`src/core/engine/stage/`).
- [x] `KernelAdapter` applies `evaluate()` directly. It is the universal fallback and the scrub engine. It writes only the properties a layer animates, only when they changed, and puts back what React drew when a layer stops animating. `installStageEngine` (called by `StageHost`) wires the transport, the document and the registry to it.

**You'll see:** pressing play animates the real layers on the canvas, eased exactly as the curves say.
**Done when:** 10 reference animations seeked to 5 times match the kernel's values within 0.5 px.

### Phase 58 · CSS / Web Animations adapter
**Needs:** 57 · **Was:** v3 10.1 (WAAPI) · **Status:** ✅
- [x] Routed animations (Phase 10's `rules.route`) run as Web Animations or CSS where they can (compositor thread); seek maps to `currentTime`. `WaapiAdapter` bakes the kernel's curve once per frame into linear keyframes (so every easing matches the kernel) and runs one animation per layer; `canRunOnWaapi` uses the `css` route plus a check that every property can be interpolated; `StageAdapters` gives each animated layer to exactly one of the Web Animations and kernel adapters (kernel fallback where `Element.animate` doesn't exist).

**You'll see:** passive loops and simple tweens keep running smoothly even when the main thread is busy.
**Done when:** WAAPI-routed reference animations match the kernel at 5 times (≤ 0.5% pixels).

### Phase 59 · Scrub vs play
**Needs:** 58 · **Was:** v3 10.2 · **Status:**  ✅
- [x] While scrubbing, every layer is driven by the kernel. On play, each layer hands over to its routed adapter at the current time with matching velocity. `StageAdapters` keeps a `playing` flag: not playing, the kernel draws every layer (the Web Animations are cancelled); playing, a routed layer becomes a Web Animation baked at the transport's time and rate (the kernel gives its inline styles back), and a speed change keeps the same animation; pausing hands the layer back to the kernel. `StageEngine` shows the time again on every play/pause change.

**You'll see:** scrubbing and playing look the same at every frame.
**Done when:** 10 reference animations show identical screenshots paused at 5 times from the kernel and from the running engine (≤ 0.5%).

### Phase 60 · Parity overlay
**Needs:** 59 · **Was:** v3 10.3 · **Status:**  ✅
- [x] A dev overlay samples running engines against `evaluate()` every N frames and raises `[PARITY_DRIFT]` beyond tolerance. `ParityMonitor` (`src/core/engine/stage/parity.ts`) runs in the scheduler's `stats` phase every 30 frames while an engine of its own is playing: it compares each running layer's computed lengths, numbers and transform matrix with `evaluate()` at the engine's own clock (0.5 px, 0.01 opacity, 0.005 matrix), and the engine's clock with the transport's (6 frames, two samples in a row). Drift is `console.warn`ed once per layer and property, kept in `parityStore`, and shown by the status-bar `ParityBadge` (grey idle, green OK, red drift with the details in its tooltip). Dev builds, tests and `?parity=1` only. Colours and `%` lengths aren't compared yet.

**You'll see:** a parity badge in the status bar (dev builds) that turns red on drift.
**Done when:** an injected wrong easing raises `[PARITY_DRIFT]`; correct playback stays green.

### Phase 61 · Timeline workspace: layout
**Needs:** 15, 54, 60 · **Was:** v3 52.1, 23.1, 21.2 · **Status:**  ✅
- [x] Left: the layer stack (same order, open groups and selection as the Layers panel) with switches: visible, solo, lock, shy, motion blur (these three new switches are optional layer fields, `solo`, `shy`, `motionBlur`, with no schema version bump), blend mode (`appearance.blendMode`) and a parent picker (the pick-whip is a menu for now; it re-parents the layer through `layer.move`). With any layer soloed the stage draws only soloed layers and what contains them. Motion blur is recorded only; the renderer draws it later.
- [x] Right: a time ruler (timecode or frames), layer bars with in/out trimming (drag an end) and sliding (drag the middle), the work area (drag its ends, or set from the playhead), composition markers (layer markers come later), the current-time indicator (painted by the scheduler). Bars are the existing `compositions[id].layers[layerId]` time bars (sparse, frame-snapped).
- [x] Motion badges in the Layers panel (clip count, states, engine); clicking one opens it in the timeline. The Animate preset opens the new **Layer Timeline** tab; the Motion Sequencer stays beside it until Phase 68.

**You'll see:** an After Effects-style timeline under the canvas in the Animate preset.
**Done when:** a 10-step journey (trim, set work area, add marker, solo, lock) asserts the document after each step.

### Phase 62 · Twirl-downs & stopwatches
**Needs:** 61 · **Was:** v3 52.2 · **Status:**  ✅
- [x] Layer → groups (Transform, Appearance, Effects, States, Behaviours, Links) → properties, each with a stopwatch that starts keyframing. `U` reveals animated properties, `UU` modified ones. In the Layer Timeline a layer's **P** twirl opens its six groups; Transform (position, scale, rotation, skew) and Appearance (opacity, corner radius, fill and border colour, border width) list their properties in plain words, each with a stopwatch; Effects, States, Behaviours and Links list what the layer has. A stopwatch turned on puts one keyframe at the playhead, holding the property's current value, in the layer's first clip in the composition (or a new clip called "Keyframes"); turned off it removes that property's tracks (and an empty "Keyframes" clip). Keyframes show as diamonds on the layer's time bar (click one to seek there) and an animated property shows its value at the playhead. `U` (timeline focus) toggles the animated-only view of the selected layers and a quick second press shows the modified ones. Editing keyframes (move, copy, easing) is Phases 66–67.

**You'll see:** twirl down a layer and click a stopwatch to animate any property.
**Done when:** stopwatch on/off round-trips through undo and save.

### Phase 63 · Timeline navigation
**Needs:** 62 · **Was:** v3 52.3 · **Status:**  ✅
- [x] Ruler scrubbing, zoom to work area, J/K/L shuttle, I/O to jump to in/out points, B/N to set the work area, Page Up/Down to step frames (Shift for 10). All are commands with timeline focus. Ruler scrubbing (61) and J/K/L (54) were already there. New: Page Down / Page Up (one frame; Shift: ten), `I` / `O` (the selected layers' earliest in and latest out; with nothing selected, the work area's start and end), `B` / `N` (work area start and end at the playhead), `=` / `-` (zoom ×1.25, 20 to 2,400 px/s), `\` (zoom to the work area, scrolled into view), Ctrl + wheel (zoom around the pointer), and `End` (to the end of the composition). The timeline's zoom is a store value (`pixelsPerSecond`); the panel reports its view width so the fit knows what to fill.

**You'll see:** After Effects shortcuts work in the timeline.
**Done when:** a keyboard-only navigation journey lands on exact times.

### Phase 64 · Timeline at scale
**Needs:** 63 · **Was:** v3 52.4 · **Status:** 🚧
- [x] Keyframe lanes drawn on a canvas (not one DOM node per keyframe) and virtualised; the scheduler draws the time indicator. One canvas the size of the lanes' view (sticky, so scrolling never moves it) is repainted for what is in it: property rows paint a diamond per keyframe, a closed layer paints one summary dot per distinct time, selected keyframes are drawn in the selection colour, and diamonds outside the view are skipped (`src/core/timeline/lanes.ts`, `drawLanes`, batched by colour). The list builds DOM rows only for the rows in view plus 8 either side (`visibleWindow`; spacers stand in for the rest). Keyframes are found for a press with `hitKey` (nothing in the DOM), and each property lane carries `data-key-count`, `data-key-times` and `data-key-ids` for tests and screen readers. `animatedIndex` reads every layer's keyframes in one pass over the composition's clips instead of one pass per layer, and the rows' motion badges use the one-pass `motionIndex`. The time indicator was already painted by the scheduler (Phase 61). **Measured:** 200 layers × 20 tracks (3,001 rows, 12,000 keyframes): building the list takes about 35–55 ms once per document change, a repaint 0.1 ms; a scrub moves only the indicator (no React render), so 60 fps holds. The old per-keyframe DOM buttons are gone.

**Fixed 2026-11-14 (the new editor's scrub had fallen to 91 ms a frame with 200 layers, and CI failed on it in three browsers):** a seek re-rendered the whole canvas through React (the Artboard subscribed to the playhead to pose its click boxes), re-rendered the whole timeline (the motion store was handed a new work-area object on every seek), and made the browser restyle every element on the page (the playhead's timecode label replaced its text node, and the page-wide `html:has(.ll-editor-root) *` rules are re-matched whenever a node is inserted: 46 ms for 8,600 elements). Now the click boxes are posed by a store subscription that writes styles (the selected layers at once, the rest when the playhead rests or the pointer moves), the work-area object keeps its identity, and the label changes its text node in place. Measured in headless Chromium, 200 layers × 5 tracks: 91 ms → about 25 ms a frame (`tests/e2e/wire-64-71.spec.ts`, budget 34). What is left is the browser compositing 200 layers.

**Fixed 2026-11-15 (WebKit, found by running it in Playwright's container):** a group's clip drew one tick mark per keyframe of every layer inside it (2,000 marks on two pixels for the 200-layer scene), now one per pixel that has a keyframe; and the timeline re-fitted itself on every frame of the workspace's opening animation, now when its width has rested for 90 ms. The scrub test waits for the workspace to rest before it measures. Measured in the container: Chromium 24.5 ms, Firefox 20.5 ms, WebKit 86 ms a frame. **WebKit is not at 60 fps in the test:** Playwright's WebKit paints in software and repaints the window for any change (16 ms a frame idle, under 1 ms of script per seek, the rest is painting), so its bound in the test is 250 ms and the 60 fps claim is checked in Chromium and Firefox only. Safari on a real machine has not been measured.

**You'll see:** big compositions stay smooth.
**Done when:** 200 layers × 20 properties scrub at 60 fps.

### Phase 65 · Nested & interaction composition tabs
**Needs:** 64 · **Was:** v3 52.5 · **Status:** 🚧
- [x] Double-click a precomp bar to open it in a new tab with breadcrumbs. Interaction compositions (hover, press, scroll) appear as their own tabs with the trigger in the tab header. A tab strip sits above the timeline: **Main**, one tab per interaction composition (named for its clip, with the trigger beside it, such as "Hover on Buy Button"), and a tab for each precomp that has been opened (with a × to close it). A precomp placed in the composition showing has its own row at the bottom of the list: a bar labelled with the precomp's name, small diamonds for every keyframe inside it (mapped through the placement's start and stretch, so the parent shows what changed in the child), and **Open** and **×** buttons; double-clicking the bar opens it. Opening from a bar grows the breadcrumb trail (`Main › Outer › Inner`); a crumb, **Go up** or closing the tab you are on goes back. New: **+ Precomp** (an empty precomp, 2 s or the parent's length, placed in the composition showing), `documentCommands.addPrecomp` and `removeNested`, `addClip(..., { compositionId })` so a keyframe made while a precomp or an interaction composition is open lands in that composition instead of Main. Commands: `timeline.openComposition`, `openBreadcrumb`, `goToParent`, `closeComposition`, `addPrecomp`, `removeNested`. The kernel doesn't play nested placements yet (Phase 9's maths exists; the stage doesn't draw them), so the parent shows the child's keyframes on its bar, not its effect on the stage.

**You'll see:** hover and press animations are timelines you can open and edit.
**Done when:** a journey opens a precomp, edits it and returns via breadcrumbs; the parent shows the change.

### Phase 66 · Keyframing
**Needs:** 65 · **Was:** v3 23.2 · **Status:** 🚧
- [x] Auto-key record mode (change any property at the playhead → keyframe). Multi-select, box select, align, distribute, scale time, copy and paste across layers. **● Auto-key** in the timeline toolbar: while it is on, any animatable property a command changes on an existing layer (inspector, canvas drag, nudge, agent) also gets a keyframe at the playhead holding the new value, in the same undo step; a second change at the same moment replaces it. It is a hook inside the document store's commit (`setCommitHook`, `applyAutoKey`), so it covers every way of editing. Keyframes: click one to select it (and put the playhead on it), Shift- or Ctrl-click to add, drag to move the selection together (frame-snapped, stopped at the composition's edges, one undo step), Shift-drag on empty lane to box-select, **Add keyframe** (◆) on a property row, **Copy keys** / **Paste keys** (Ctrl+C / Ctrl+V with timeline focus; one copied layer pastes onto every selected layer, several map in order), **Align to playhead**, **Distribute**, **Slower** / **Faster** (×1.25 / ×0.8 around the first key), **Delete keys** (Delete or Backspace with timeline focus). Commands: `timeline.addKeyframe`, `selectKeyframes`, `selectAllKeyframes`, `moveKeyframes`, `alignKeyframes`, `distributeKeyframes`, `scaleKeyframeTime`, `deleteKeyframes`, `copyKeyframes`, `pasteKeyframes`, `setRecord`.

**You'll see:** turn on record, move things on the canvas or in the inspector, and keyframes appear.
**Done when:** 3 recorded changes create 3 keyframes, playback matches `evaluate()`, and undo removes them.

### Phase 67 · Graph editor & easing
**Needs:** 66 · **Was:** v3 23.3 · **Status:** 🚧
- [x] Value and speed graphs with bezier handles and spring previews (reusing `CurveEditor.tsx` and `SpringEditor.tsx`), per-keyframe easing, an easing preset strip, and springs edited as Bounce and Time (Law 17). A new **Graph Editor** (the bottom tab `curves`, Ctrl+Shift+K, replaces the old Curve Editor tab) draws the curves of the selected keyframes' tracks, or of the selected layers' numeric tracks, as a **Value graph** or a **Speed graph** with the playhead. A keyframe's `ease` is the easing of the segment that ends at it, so selecting a keyframe edits "the easing into" it. The preset strip: **Snappy, Smooth, Bouncy, Lazy** (springs written as Bounce and Time), then Linear, Ease in, Ease out, Ease in and out, Overshoot, and **Hold**. A bezier segment shows two handles that can be dragged (x kept in 0 to 1, y may go past); a spring shows **Bounce** and **Time** sliders; the Pro face adds Stiffness, Damping and Mass as read-only numbers, the Simple face never does. F9 in the timeline is Easy Ease. The new graph editor does not reuse the old `CurveEditor.tsx` / `SpringEditor.tsx` (they are tied to the legacy project store and go with the Sequencer in 68). **A kernel fix came with it:** numeric interpolation clamped the eased progress to 0–1, so springs, `back` curves and handles pulled past 1 could never overshoot; numbers and 3D vectors now overshoot (colours, paths and clip paths still clamp). Commands: `timeline.setKeyframeEase`, `setKeyframeSpring`, `setGraphMode`, `easyEase`.

**Fixed 2026-11-14:** in the new editor the graph said "Select an animated layer to see its curves" when a keyframe was selected but the layer selected on the canvas was another one (or one with no tracks); it now shows the layer and the property of the selected keyframe first, then the selected layer if it is animated, then the first animated layer.

**You'll see:** a graph editor like After Effects', with named feels (Snappy, Smooth, Bouncy, Lazy).
**Done when:** curve edits match the kernel's golden values; the Simple face shows no stiffness or damping (label check).

### Phase 68 · Retire the legacy animation panels
**Needs:** 67 · **Was:** v3 57.1 (part) · **Closes:** AUD-39 · **Status:** 🚧
- [ ] The Content Browser's Animation panel (tracks in local state) and the legacy Sequencer are deleted or rebuilt on the document. `AnimationSample` is folded into the document model. **Done:** the Content Browser's Animation panel is rebuilt on the document (`src/core/animation/stackAdapter.ts`): it shows the selected layer's clips, every edit (add a preset, trigger, from and to, duration, delay, easing, rename, delete) is a command and one undo step, and it is saved with the project. `INITIAL_ELEMENT_TRACKS` and the panel's local state are deleted, and a unit test greps `src` for the constant. **Not done, so the phase stays 🚧:** the legacy Motion Sequencer panel is still there beside the Layer Timeline (six e2e specs drive it); `AnimationSample` and `useProjectStore.animationSamples` are still the export pipeline's input (the GSAP, Vue and Git exporters, the engine runtime and validator, the Details inspector's old animation editor) and need those paths moved onto document clips first, which belongs with Lane A's static export (49).

**You'll see:** one timeline; every animation edit survives reload and undo.
**Done when:** a grep gate finds no `INITIAL_ELEMENT_TRACKS` or `AnimationSample` usage; the Phase 3 persistence suite passes.

### Phase 69 · Motion paths on the canvas
**Needs:** 40, 68 · **Was:** v3 53.1 · **Status:** 🚧
- [x] Position keyframes draw as a path with keyframe dots and per-frame ticks (spacing shows speed). Drag a dot to change that keyframe; drag bezier handles for spatial interpolation (a new track field, separate from easing).

**You'll see:** After Effects-style motion paths you can bend on the canvas.
**Done when:** dragging a dot changes exactly one keyframe in one undo step; sampled positions match `evaluate()` within 0.5 px.
**Evidence (2026-11-06, PR #65):** `spatialPath.test.ts` (centripetal Catmull-Rom, arc-length parameterisation, 0.05% speed deviation and 0.015 px spatial tolerance), `evaluateSpatial.test.ts` (the kernel follows the path), `speedGraph.test.ts`, `spatialWaypoint.test.ts` (waypoints, `spatialIn` / `spatialOut` tangents, x and y tracks paired). The canvas overlay (`MotionPathOverlay.tsx`: ribbon, waypoint markers, velocity ticks, tangent handles, playhead) draws in the new editor's Motion mode; there is no browser spec for dragging a waypoint yet. Status stays 🚧 until CI on `main` is green.
**Fixed 2026-11-14 (a layer half way through a move could not be clicked):** the canvas measures each layer's box from what is drawn and its click box then adds the animated pose. After any re-render in Motion with the playhead off 0 (a hover is enough) the box was measured with the move already in it and moved a second time, so a click on the layer fell through to the frame behind it. This is why "the selected animated layer shows its motion path" failed in Firefox and WebKit, where the re-render lands before the press; in Chromium the click usually won the race. The stage now measures at rest (`measureAtRest` in `StageEngine.ts`, `KernelAdapter.atRest`: the engine takes its pose off, the boxes are read, the pose goes back, nothing is painted in between). The spec seeks to 1 s, hovers, checks the click box is on the drawn layer, and clicks without `force`.

### Phase 70 · Auto-key on the stage & value HUD
**Needs:** 69 · **Was:** v3 53.2, 53.4 · **Status:** 🚧
- [x] In record mode, dragging a layer on the canvas writes keyframes. While scrubbing, x, y, rotation and opacity show next to the layer.

**You'll see:** animate by dragging things around the canvas.
**Done when:** a drag at 3 playhead times creates 3 keyframes.
**Evidence (2026-11-07):** `AutoKeyValueHud.test.ts` (a drag at 3 playhead times creates 3 keyframes, playback matches evaluate(), undo removes them, Value HUD formats live x/y/rotation/opacity); `auto-key-hud.spec.ts` (transport record button toggle, live Value HUD during stage drag in Chromium).

### Phase 71 · Onion skin
**Needs:** 70 · **Was:** v3 53.3 · **Status:** 🚧
- [x] N ghost frames before and after the playhead at adjustable opacity, drawn from `evaluate()`.

**You'll see:** ghosts of where a layer was and will be.
**Done when:** 5 ghosts hold 60 fps.
**Evidence (2026-11-07):** `OnionSkin.test.ts` (60 consecutive frames benchmark P95 0.66ms vs 16.6ms budget, 5 ghosts, boundary suppression, parent-origin arithmetic); `onion-skin.spec.ts` (toggle button, ghost rendering, pointer-event pass-through in Chromium).

### Phase 72 · Anchor points & pins
**Needs:** 71 · **Was:** v3 51.1, 88.2 (model) · **Status:** 🚧
- [x] One pin model: 9 preset pins plus custom pins (which may lie outside the box). The anchor is the pin used for rotation and scale; it can be moved on the canvas.

**You'll see:** drag a layer's anchor point; rotation follows it.
**Done when:** rotation and scale about every preset pin match golden values.
**Evidence (2026-11-07):** `pins.test.ts` (9 preset pins, whitespace aliases, custom px/% pins, unbounded out-of-bounds pins); `anchorTransforms.test.ts` (independently calculated golden matrices for 90° rotation, nonuniform scale [2, 0.5], combined [45°, 1.5, 0.8], anchor invariance A_world = F + A + T for every preset pin, R·S != S·R matrix order test, zero-scale and 1e-6 stability, geometry compensation on anchor move); `AnchorOverlay.test.tsx` (stage handle rendering, preset location, undo/redo via historyCommands); `anchor-points.spec.ts` (interactive drag with snapping to 9 presets, inspector origin synchronization in Chromium).

### Phase 73 · Parenting & helper layers
**Needs:** 72 · **Was:** v3 51.2, 88.1 (rendering) · **Status:** 🚧
- [x] Pick-whip parenting independent of the layer tree; the kernel composes parent transforms. Helper layers (`render.role: helper`, the After Effects null) draw dashed in Design mode and never in Preview or export.

**You'll see:** link a layer to an invisible null and it follows.
**Done when:** a 3-level parent chain matches `evaluate()` in the stage; helpers are absent from the Preview DOM.
**Evidence (2026-11-07):** `parentTransforms.test.ts` (analytically calculated golden matrix for 3-level parent chain C -> B -> A, column-vector non-commutative multiplication MA·MB != MB·MA, DAG cycle validation, safe singular matrix handling, zero visual jump reparenting via L_new = P^-1 · W, multiple children of single helper); `parentEvaluation.test.ts` (evaluate() parity with stage world matrix for 3-level chain, rotating helper rotates child, animated parent keyframe cascade); `HelperLayerExclusion.test.ts` (exclusion from React, HTML, Vue emitters, selectRenderable); `HelperAndParenting.test.tsx` (stage transform composition); `parenting.spec.ts` (helper layer dashed rendering in Design, complete absence from Preview DOM, child follow in Chromium).

### Phase 74 · Blend modes, adjustment layers, masks & mattes
**Needs:** 73 · **Was:** v3 51.3, 51.4 · **Status:** 🚧
- [x] Blend modes, isolated groups, adjustment layers (`backdrop-filter`), alpha and luma mattes through CSS/SVG masks, and animatable mask paths (Phase 40 path editing). **Found first:** `appearance.blendMode` was stored and shown in the inspector but never drawn (`layerBoxStyle` didn't write `mix-blend-mode`), and `appearance.backdropFilter` wasn't either. Now `src/core/render/compositing.ts` (pure) turns properties into CSS and is used by the render definitions (stage and export) **and** by the engine's style writer, so a keyframed adjustment or mask is drawn by the code that draws a still one. **Blend:** the 16 CSS blend modes, drawn; `appearance.isolation: isolate` makes a group. **Adjustment:** `adjust.blur`, `brightness`, `contrast`, `saturate`, `hueRotate`, `grayscale`, `sepia`, `invert` become one `backdrop-filter` on what is behind the layer (a layer with `render.role: "adjustment"` is the After Effects adjustment layer; any layer may carry them); all are keyframeable numbers. **Masks:** `mask.mode` (`alpha`, `alphaInverted`, `luma`, `lumaInverted`), `mask.shape` (`rect`, `ellipse`, `path`), the shape's box (`mask.x/y/width/height`, 0 = the layer's own) and `mask.radius`, `mask.path` (animatable, morphs point to point), `mask.feather` (soft edge), `mask.expansion`, `mask.fill` (its brightness is how much a luma mask shows) and `mask.opacity`. A mask is an SVG image used as `mask-image` (data URI), so it works without `mask-mode`; the path and colour are sanitised. Masks and adjustments run on the kernel adapter, never as Web Animations.
**Track mattes (added 2026-11-12):** `matte.source` (a layer id), `matte.mode` (alpha, alphaInverted, luma, lumaInverted) and `matte.showSource`. The kernel turns the source layer (its box or ellipse, corner radius, position, scale and rotation, animated, at that moment) into the target's `mask.path` in the target's own pixels (`src/core/geometry/matteShape.ts`, `withMatte` in `evaluate.ts`) and hides the source by opacity unless asked to show it; the engine plans both layers so the mask is rewritten every frame. It reads a source that is a box on the same absolute canvas (every ancestor placed absolutely); anything else gives no matte and leaves the source visible. A matte's source must not be under a flow layout. **Commands** (the inspector only has to call them): `layer.setBlend`, `layer.setAdjustment`, `layer.setMask`, `layer.setMatte`; the controls' paths are in `DOCS/UI/WIRING-53-80.md`. `mask.width` and `mask.height` now default to -1 ("the layer's own"), so 0 is a real zero and a shape can grow from nothing.
**In the inspector (2026-11-14):** the new editor's **Compositing** section (`src/editor/panels/details/sections/CompositingSection.tsx`) calls the four commands: **Isolate group**; **Adjust what is behind** (Blur, Brightness, Contrast, Saturation, Hue, Grayscale, Sepia, Invert, and **Make an adjustment layer**); **Mask** (mode, shape, position, size, radius, feather, expand, opacity, a path field, and the fill for luma); **Matte** (source layer, mode, show the source). Percent fields are 0 to 100 in the panel and 0 to 1 in the document. `tests/e2e/wire-74-77-inspector.spec.ts` drives every group and reads the document and the drawn layer.
**Not built, so the phase stays 🚧:** stopwatches for `adjust.*` and `mask.*` on the timeline's property rows; a matte whose source is under a flow layout or is a polygon, star or path (a polygon or star is its box); matte and mask in the exported code (they are drawn by the engine on the stage); WebKit (it can't be run on this machine; CI runs it). Firefox passes here as of 2026-11-14: Playwright's Firefox and WebKit never draw `backdrop-filter` in a screenshot, even on a bare page, so the adjustment's pixel check asks the browser first and runs only where a screenshot can show a backdrop blur (the computed filter is compared with the kernel in every browser).

**You'll see:** a title revealed through an animated mask.
**Done when:** 5 compositing reference scenes match `evaluate()` in 3 browsers.
**Evidence (2026-11-11):** `compositing.test.ts` (20 unit tests: the properties, every blend mode drawn, adjustment strings and ordering, each mask mode's SVG, unsafe path and colour refused, and 5 times where the engine style writer equals the render definition for a keyframed mask, adjustment and morphing path); `tests/e2e/compositing.spec.ts` (the five reference scenes at five times in the real stage, Chromium: the multiplied pixel is (128, 0, 0), the backdrop filter equals the kernel's blur, the ellipse radius equals half the kernel's width, the morph path equals the kernel's, and the pixels inside and outside the masks). The scenes load from the stage lab (`/editor/stage-lab`, "Load 5 compositing scenes"); a sixth, track-matte test (the matte path equals the kernel's at five times, the source is hidden, and the red shows through the sliding ellipse) runs in the same spec. `matte.test.ts` (12 unit tests: box, ellipse and rounded sources, position, scale and rotation, an animated source to the pixel, hidden source, modes, unreadable sources, two layers matting each other, ancestors) and the command tests (3). Also checked in the new editor: setting the properties through `layer.setProps` draws a multiply and a mask on the stage.

### Phase 75 · Effect stack & motion blur
**Needs:** 74 · **Was:** v3 51.5, 51.6 · **Status:** 🚧
- [x] An ordered per-layer effect list (blur, glow, drop shadow, colour adjust, displacement, noise) with keyframeable parameters, routed by the rules to CSS filter, SVG filter or (from Stage 4) shader. Opt-in motion blur from transform velocity.

**You'll see:** stack effects on a layer and keyframe their settings.
**Done when:** a 4-effect stack matches `evaluate()`; the rules explain each effect's route.
**Built (2026-11-12):** up to **8 effects per layer** (`fx.N.*`, N = 1 to 8; the order of the list is the order of the slots, so every parameter is an ordinary keyframeable property): **blur**, **glow**, **drop shadow**, **colour adjust** (brightness, contrast, saturation, hue), **displacement** and **noise**. `src/core/render/fxStack.ts` (pure) turns the slots into what the browser draws and is shared by the render definitions (stage and export: the CSS effects) and the animation engine (the whole stack): blur, glow (a zero-offset drop-shadow, stacked once per step of intensity), drop shadow and colour adjust are CSS `filter` functions; displacement (`feTurbulence` + `feDisplacementMap`) and noise (`feTurbulence` grain over the layer's own pixels) are one SVG `<filter>` each, which the engine keeps in the frame document (`engine/stage/fxFilters.ts`) and updates attribute by attribute as a parameter animates (no markup rebuilt, no React). The engine writes the layer's whole `filter` (its own filters, then the stack in order, with `url(#…)` where an SVG effect sits). **The rules explain each route** (`src/core/rules/effectRouting.ts`: `routeEffect`, `routeStack`, with a plain-words reason; a test checks the table against what is really drawn and against the general routing rules); a shader backend takes over from Stage 4. **Motion blur** is opt-in per layer (the timeline's existing switch, `layer.motionBlur`) with a shutter angle (`motion.shutterAngle`, 180 by default): the kernel measures the layer's velocity over one frame centred on `t` and adds `motion.blur.x` and `motion.blur.y` (the standard deviations, speed × exposure × 0.2887); an SVG `feGaussianBlur` with a different amount across and down draws it (CSS `blur()` blurs every way). It is a pure function of the time, so scrubbing shows the blur playing shows. **Commands:** `layer.addEffect`, `layer.setEffect`, `layer.removeEffect`, `layer.moveEffect`, `layer.setMotionBlur` (one undo step each; add refuses a ninth effect). A layer with effects runs on the kernel adapter, never as a Web Animation.
**Evidence (2026-11-12):** `fxStack.test.ts` (24 unit tests: the properties, reading the stack, each effect's CSS or SVG, order and disabling, the render definition, the route table, a 4-effect stack equal to the kernel's parameters at 5 times, motion blur amounts, shutter, purity, and the commands including reorder and undo); `tests/e2e/effects.spec.ts` (the real stage in Chromium: the computed `filter` carries the kernel's blur radius, shadow offset and saturation in list order with the SVG filter's `url()`, the engine's SVG filter has the kernel's displacement scale and is never duplicated, the layer goes grey as saturation reaches 0, and motion blur's deviation equals the kernel's and smears the moving layer's edge while an identical layer without the switch has no filter). The scenes are in the stage lab (`/editor/stage-lab`, "Load effect scenes").
**In the inspector (2026-11-14):** the new editor's **Effect stack** section (`src/editor/panels/details/sections/EffectStackSection.tsx`, below the design **Effects**): **Add an effect…** (the six types), each effect's settings, up and down (`layer.moveEffect`), an on/off eye, remove, the route tag (**CSS** or **SVG**, from `routeEffect`) with its reason as text, and **Motion blur** with **Shutter**. `tests/e2e/wire-74-77-inspector.spec.ts` builds, edits, reorders, switches off and removes a stack and reads the drawn `filter`.
**Not built, so the phase stays 🚧:** the timeline's stopwatches for `fx.*`; reordering by drag (arrows for now); effects in the **exported code** (the CSS ones are in the export's styles; the SVG ones and motion blur are drawn by the engine on the stage only); motion blur along a rotating or parented path uses the layer's own translation (rotation about its centre doesn't smear); the `displacement` effect has no map image yet (it uses noise); the shader backend (Stage 4); the 3-browser run (Firefox and WebKit in CI).

### Phase 76 · Property links & pick-whip
**Needs:** 75 · **Was:** v3 47.1, 47.3, 47.4 · **Status:** 🚧
- [x] `Link { target, source, map }` (range or curve). Drag from one property to another in the timeline or inspector to link them. Topological order; cycles refused with `[LINK_CYCLE]` and the chain shown.

**You'll see:** link one layer's rotation to another's position.
**Done when:** link golden tests pass; a cycle is refused with its chain.
**Built (2026-11-12):** a link makes one property of a layer follow a property of another layer (or of the same one): this layer's rotation follows that layer's x. It lives on the driven layer in numbered slots (up to 8 per layer; `link.N.target`, `.source`, `.sourceProperty`, `.map`, `.enabled`, `.clamp`, `.curve`, `.inMin`, `.inMax`, `.outMin`, `.outMax`), so it is saved, undone and keyframed like any property and needs **no schema change** (the existing signal `Binding` model, pointer and scroll inputs, is a different thing and is untouched). **Maps:** `direct` (the number passes through), `range` (the input range onto the output range, clamped or not; a reversed range reverses it) and `curve` (the position in the range goes through an easing first). The kernel (`evaluateLocalProps`) works out the source's number at the same moment, following links through chains, and replaces the target's value: a link wins over the target's own animation, as an expression does in After Effects. A property that a link drives counts as animated, so the layer runs on the kernel adapter and is written every frame; a link to a position reaches the world matrix, so the stage draws it. **Topological order and cycles:** reading a property follows its link lazily, so the order is the dependency order, and a layer may drive one of its own properties from another of its own. `layer.setLink` refuses a link that would close a cycle with `[LINK_CYCLE]` and the chain (`[LINK_CYCLE] Null.transform.x ← Hero.transform.rotate ← Null.transform.x`) before writing anything; a cycle already in a file (`findLinkCycle`) stops where it closes and the link falls back to the property's own value instead of looping. **Commands:** `layer.setLink` (the pick-whip: target property, source layer and property; the map defaults to the source's range onto the target's when both have one, else direct; replaces a link on the same property; refuses a missing layer, a property that isn't a number, length or angle, a bad curve, and a ninth link), `layer.removeLink`. Code: `src/core/links/linkModel.ts` (pure), `linkCommands.ts`, and `withLinks` in the kernel.
**Evidence (2026-11-12):** `links.test.ts` (23 unit tests: golden values for direct, range (clamped, unclamped, reversed in and out, an input range with no width), curve (CSS ease at the half-way mark is 0.8024), an animated source at five times, a chain, a layer driving itself, a link beating the target's own animation, several links per layer, the world matrix, ignored bad links; cycles refused with the chain for 2- and 3-step cycles and self links; a cycle in a file neither loops nor crashes; the engine plans a driven layer; the commands including undo, replace, the ninth link and remove); `tests/e2e/links.spec.ts` (the real stage in Chromium: a hero's rotation (range) and vertical shift (curve) follow a sliding null and match the kernel at five times). The scene is in the stage lab ("Load link scene").
**Not built, so the phase stays 🚧:** the **pick-whip drag** itself in the timeline and inspector (the commands, property paths and the cycle message are ready; see `DOCS/UI/WIRING-53-80.md`); a **link list** in the inspector showing each link and its map; links to non-numeric properties (colours, text) and to a layer's tree position; links in exported code (they are drawn by the engine on the stage; export needs the expressions phase's compiler); the 3-browser run (Firefox and WebKit in CI).

### Phase 77 · Expressions
**Needs:** 76 · **Was:** v3 47.2, 47.4 (export) · **Status:** 🚧
- [x] A small typed expression language (parser → AST → evaluator; no `eval`): arithmetic, `time`, `value`, `wiggle(freq, amp, seed)`, `loopOut`, `linear` / `ease`, `clamp`, `valueAtTime`, and references to other layers. Exports compile to plain functions or bake to keyframes.

**You'll see:** type `wiggle(2, 10)` on a property and it moves.
**Done when:** 20 golden tests pass, including `wiggle` determinism across runs and browsers.
**Built (2026-11-12):** an expression is a short typed formula on one numeric property of a layer. It lives in numbered slots (up to 8 per layer; `expr.N.target`, `.text`, `.enabled`), so it saves, undoes and keyframes like any property and needs **no schema change**. **Language** (`src/core/expressions/`): a tokenizer, a precedence-climbing parser and a type checker produce an AST; nothing is ever passed to `eval` or `new Function` (a test scans the folder for them). Numbers, `+ - * / % **`, comparisons, `&& || !`, `? :`, `true` / `false`; constants `time`, `value`, `fps`, `duration`, `PI`, `E`; functions `abs floor ceil round sqrt min max pow mod clamp sin cos radians degrees linear ease smoothstep noise wiggle loopOut loopIn valueAtTime ref refAtTime`. A mistake is refused where it is written, with its position (`EXPR_SYNTAX`, `EXPR_TYPE`) and a size limit (600 characters, depth 24, 300 parts: `EXPR_LIMIT`). A result that is not a finite number means "can't be worked out", and the property keeps its own value. **`wiggle(freq, amp, seed)`** is the value plus `amp` times smooth value noise at `time * freq`; the noise uses an integer hash (`Math.imul`) and plain arithmetic only, never `Math.sin` or `Math.pow`, so it is the same on every run and in every browser; the seed defaults to a number taken from the layer id and property, so two layers wiggle differently. **`loopOut` / `loopIn`** repeat the property's own keyframes (`cycle`, `pingpong`, `offset`, `continue`). **Order in the kernel:** base value (keyframes), then a link, then the expression, which sees that result as `value`; `ref("Name or id", "property")` reads another layer at the same moment (by id, or by name). **Cycles** through `ref` are refused by `layer.setExpression` with `[LINK_CYCLE]` and the chain, and `findLinkCycle` now covers expressions as well as links. A driven property counts as animated, so the layer runs on the kernel adapter and is written every frame. **Commands:** `layer.setExpression`, `layer.removeExpression`, `layer.bakeExpression` (samples every frame of the work area, at most 2400, removes the expression and writes the keyframes in one undo step). **Export:** `compileExpression(text)` gives a plain-function source from a small runtime (`EXPRESSION_RUNTIME_SOURCE`) that mirrors the evaluator.
**Evidence (2026-11-12):** `expressions.test.ts` (40 unit tests: the parser and its error positions, types, limits, no `eval`, each function with golden values, `wiggle` pinned to exact numbers and bounded, the same twice and seed-dependent, `loopOut` / `loopIn` types, the kernel with a real document (value, links, `ref`, loops, bad or disabled expressions, cycles, planning), 27 expressions at 12 times giving the same numbers compiled as evaluated, and the commands with undo and bake); `tests/e2e/expressions.spec.ts` (the real stage in Chromium: a wiggling layer matches the kernel at five times and is the same on every seek; a loopOut layer repeats). The scene is in the stage lab ("Load expression scene").
**In the inspector:** Lane A's Design track D5 added the expression field to the **Parent & links** section; on 2026-11-14 each expression's line got **Bake** (`layer.bakeExpression`: keyframes for every frame of the work area, the expression removed, one undo step).
**Not built, so the phase stays 🚧:** an expression field on the **timeline's** property rows and the character underline for a syntax error; **exporters emitting the compiled code** (only `compileExpression` exists; the exporters in Phases 94 and later call it); expressions on non-numeric properties (colours, text); `sin` and `cos` may differ in the last digit between browsers (`wiggle` never uses them); the 3-browser run (Firefox and WebKit in CI).

### Phase 78 · States
**Needs:** 33, 77 · **Was:** v3 11.1 · **Status:** 📋
- [ ] Built-in states per archetype (idle, hover, pressed, focus, disabled, inView, loading …) and custom states. Editing a state means selecting it and changing properties on the canvas; the difference from the base is stored.

**You'll see:** a state picker in the Motion tab; style a button's hover state on the canvas.
**Done when:** state edits round-trip; Preview shows the states on real hover and press.

### Phase 79 · Transitions & smart animate
**Needs:** 78 · **Was:** v3 11.2 · **Closes:** AUD-14 (preview, partial) · **Status:** 🚧
- [x] Automatic transitions between any two states: a spring (default for interactions) or a tween, per-property overrides, and interruption that keeps velocity.

**Started before its Need is ✅ (2026-11-16):** Phase 78 (states) is Lane A's since the owner's takeover of D15; the states themselves are on `main` (`src/core/states/states.ts`, the **States** section) but the phase is not ✅. Phase 79 builds on that code, so it stays 🚧 until 78 is ✅ and this gate has passed in CI.
**The transition (`src/core/states/transitions.ts`):** `Mover` is one number (a state's share of the picture, 0 to 1) moving to a target. A spring is evaluated in closed form from where the number is with the speed it has, so changing the target mid-way changes neither; a tween starts again from where it is. Pure: the stage steps it with the frame's time.
**Properties (settings, not animated):** `transition.type` (`spring`, the default, or `tween`), `transition.duration` (s), `transition.bounce` (0 to 1), `transition.curve` (a tween's easing), and three slots `transition.N.property` / `.type` / `.duration` / `.bounce` for a property that moves on a transition of its own.
**Kernel:** a new input `EvaluateInputs.stateMix` (every state a layer is partly in, with its share and per-property shares, in the order they are laid over the base). Numbers follow the share past 1 (a spring's overshoot); colours and the rest mix by their own rule; a property the base doesn't set starts from its default. `activeStates` + `stateBlend` still work for callers that set one state.
**Engine (`StateDriver`):** one mover per state per layer (plus one per overridden property). All head for 1 or 0 at once, so hover fades out under pressed arriving instead of passing through the base. Reduced motion jumps. Before this a state eased in at a fixed exponential rate and a change of state waited for the old one to ease out.
**Commands (`src/core/states/transitionCommands.ts`):** `layer.setTransition` and `layer.setTransitionOverride` (refused with a code for a property none of the layer's states changes, a fourth override, or a duplicate). One undo step each.
**In the editor:** a **Transition** section under **States** in the Design inspector (`src/editor/panels/details/sections/TransitionSection.tsx`): **Type**, **Time**, **Bounce** (spring) or **Curve** (tween), and **A property of its own…**.
**Not built:** transitions in the exported code (Phase 95); a different transition per pair of states (one per layer, plus per-property overrides).

**You'll see:** hovering a button animates smoothly, even when you move in and out quickly.
**Done when:** clicking a 2-state toggle 10 times rapidly never snaps (velocity continuity checked on sampled positions).
**Evidence (2026-11-16):** `src/core/states/__tests__/transitions.test.ts` (the mover: spring and tween, velocity kept across a change of target, determinism; the settings and commands with undo; the kernel's mix: overshoot, colours, defaults, two states crossing, per-property shares; the driver: the toggle hovered in and out 10 times with every frame-to-frame step and every change of speed bounded, hover to pressed without passing through the base, an override lagging, reduced motion). `tests/e2e/transitions.spec.ts` on `/editor`: the section's controls end to end, and the pointer moved on and off a layer 10 times at 90 ms while the drawn opacity is sampled on every frame (no step above 0.2 of a 0.8 change; it is caught on the way and ends at rest). Passing in Chromium here.

### Phase 80 · Animated variants & interactive components
**Needs:** 47, 79 · **Was:** v3 75.2 (animated half), 75.4 · **Status:** 🚧
- [x] Switching a component's variant animates (variants map to states). Instances can override motion and bind their own interactions.

**Stays 🚧 (2026-11-16):** Phase 79 is 🚧 (its own Need, 78, is Lane A's), and this gate has not run in CI.
**The look of a variant (`src/core/components/variantMotion.ts`):** `variantLook` gives every layer's properties as the instance would have them in another variant, without changing the document (the switch is made on a copy of the instance's layers, matched by name as a real switch matches them, so overrides are kept). `lookDifference` lists what differs, per layer, as `from` and `to`; where the instance sits is never part of it.
**Kernel:** a new input `EvaluateInputs.propMix` (per layer: `from`, `to`, `amount`), applied after the base properties and before states, so a hover still lies over a variant that is changing. `mixValue` is now the one rule for a state or a variant arriving: numbers follow the amount past 1, colours mix, the rest switch half way.
**Engine (`src/core/engine/stage/VariantDriver.ts`):** notices an instance whose variant changed in the document and moves it from the look it showed to the new one on the instance's transition (Phase 79's `Mover`). Going back to the variant it came from turns the same spring round with its speed; going on to a third starts from what is on screen. `KernelAdapter.setPropMix` puts the moving layers into the plan while they move and gives the elements back afterwards.
**A fix this needed (`KernelAdapter.invalidate`):** the adapter remembered what an element held before its first write and put that back at the end. If the document changed in between (React drew the layer again), that was stale: an instance switched to and fro while moving ended on the first variant's style. It now notices that React drew the element again and puts back the newer value. This also holds for states and clips.
**An instance's own interaction:** `variantTrigger.on` (`click`, `hover`, `press`), `variantTrigger.property` and `variantTrigger.value` (empty: the next value) on the instance root, set by `component.setVariantTrigger`. In Preview (or with the States switch on) the instance shows the other variant without changing the document. `InputSource.presses()` counts presses, so a click shorter than a frame is seen.
**An instance's own motion:** `transition.*` and `variantTrigger.*` set on an instance are overrides like any other: edits to the main component and a change of variant keep them; an instance without its own takes the main's.
**In the editor:** on an instance of a component with variants, the **Components** section has **Switches on** (Nothing, A click, Hover, Press), **Changes** (with several variant properties) and **Goes to**; the **Transition** section now also shows for such an instance.
**Limits:** a variant switch made in Design is drawn at once unless the States switch is on (Design draws the page at rest); it animates in Motion and Preview. Layers that exist in only one of the two variants appear and disappear at once. **Reset overrides** also removes the instance's trigger and transition. Not in the exported code (Phase 95).

**You'll see:** a toggle component that animates between its On and Off variants.
**Done when:** a variant switch matches `evaluate()` in the stage; instance overrides survive main-component edits.
**Evidence (2026-11-16):** `src/core/components/__tests__/variantMotion.test.ts` (13 tests: the look and the difference; the toggle reference, every frame `evaluate()` with the driver's input; ten quick switches with every step and every change of speed bounded; the adapter's written transform equal to `evaluate()` at every frame and the element given back; the stale-style case; reduced motion; the command with undo and refusals; click, hover and leaving live interactions; an instance's transition and trigger surviving main edits and a change of variant). `tests/e2e/variant-motion.spec.ts` on `/editor`: a toggle component built through the inspector, its instance switched from the **Variant** menu while the knob's drawn place is sampled on every frame (caught on the way, no step above 8 of 28 px, ends on the document; then ten switches in a row end on the right variant), and an instance set to switch on **A click** clicked on the canvas (the document keeps its variant). Passing in Chromium here.

### Phase 81 · Scroll: model & runtime
**Needs:** 59 · **Was:** v3 13.1, 13.2 · **Status:** 🚧
- [ ] Scroll triggers (enter, leave, enter-back, leave-back) and scroll-linked ranges (start/end offsets, scrub smoothing, pin); view progress per layer. Native CSS scroll-driven animations where possible, otherwise an IntersectionObserver plus scheduler progress driver (never GSAP).

**Built so far (the scheduler-driven fallback path):** `src/core/scroll/model.ts` (pure: range parsing like `"top 80%"`, `resolveRange`, `viewProgress`, the four crossings `scrollEvents`, `smoothProgress` for scrub, `pinOffset`, and the triggered-clip state `advanceTriggered`); `ScrollDriver.ts` (each frame reads the frame's scroll and each scroll clip's layer, and works out every clip's time: a scrubbed clip follows view progress with optional smoothing, a triggered clip plays once on enter and rewinds on leave-back, a pinned layer is held with CSS `translate`; it also publishes per-layer view progress in `scrollStore`); a new kernel input `EvaluateInputs.scrollClipTime` (the driver tells the kernel each clip's own time, the kernel stays pure); `StageEngine` runs the driver in **Preview only** (in Design the page isn't scrolled and reveals stay as drawn), and layers with a scroll clip are kept off Web Animations. Commands: `motion.setScrollTrigger` (range, scrub, pin) and `motion.addScrollClip` (a parallax or a reveal in one call). Layout is read with `offsetTop`, which ignores transforms, so a reveal that moves a layer can't move its own range. Triggers are `scrollProgress` and `inView`; the range is the clip's `scrollTrigger.start` and `end` (default `top bottom` to `bottom top`).
**Not built, so the phase stays 🚧:** native CSS scroll-driven animations (a `ViewTimeline`) for the cases they can handle; pinned spacing (a pin holds the layer but doesn't lengthen the page); a scroll trigger set from the UI (only by command for now); and the 3-browser check (Chromium is covered here, Firefox and WebKit run in CI).

**You'll see:** parallax and scroll-reveal work in Preview.
**Done when:** parallax, scroll-reveal and pinned-sequence references match `evaluate()` at 5 scroll positions in 3 browsers, on both the native and fallback paths.

### Phase 82 · Scroll simulator & section choreography
**Needs:** 48, 81 · **Was:** v3 13.3, 76.2 · **Status:** 📋
- [ ] A scroll scrubber for the canvas and timeline (scroll progress becomes an input track), and section-level scroll choreography: pinned sequences, reveals, parallax and scroll-driven staggers.

**You'll see:** scrub the page's scroll from the timeline.
**Done when:** a pinned section sequence plays identically from the scrubber and from real scrolling.

### Phase 83 · Accessible text splitting
**Needs:** 31, 38, 82 · **Was:** v3 17.1 · **Status:** 📋
- [ ] Split by character (grapheme-aware, `Intl.Segmenter`), word and line, with measured positions and line/word/char indices (Phase 153 builds on this). The container keeps the full text as an accessible label; pieces are hidden from assistive technology; line detection re-runs on resize and after fonts load.

**You'll see:** split any text into letters, words or lines for animation.
**Done when:** the accessibility tree exposes each fixture string exactly once in 3 browsers.

### Phase 84 · Text motion
**Needs:** 83 · **Was:** v3 17.2 · **Status:** 📋
- [ ] Per-piece tracks with staggers; blur, opacity and offset reveals; scramble/decrypt; typewriter with caret; rotating words; count-up (`Intl.NumberFormat`); gradient sheen; variable-font axis animation.

**You'll see:** headline reveals, typewriters and counters.
**Done when:** split, scramble and count-up match `evaluate()` in 3 browsers.

### Phase 85 · SVG morph & stroke drawing
**Needs:** 84 · **Was:** v3 16.2, 16.3 (stroke) · **Status:** 🚧
- [x] Morph between paths with automatic point matching (`PathMorphSolver`) plus manual start-point and direction fixes; stroke draw per path with direction and multi-subpath staggers.

**Started before its Need (2026-11-15):** Phase 84 (text motion) is Lane A's since the owner's takeover of D12 and is not ✅ on `main`. Phase 85 uses nothing from it (paths, not text), so Lane B built it while waiting; the status stays 🚧 until 84 is ✅ and this phase's gate has passed in CI.
**Morph (`src/core/paths/morphMatch.ts`):** `PathMorphSolver.morph` treated a path as one run of segments, so a menu's three bars were joined into one line on the way to a cross, and a closed shape started its morph wherever each path happened to begin. `morphPath` matches sub-path with sub-path (one with no partner grows from its own centre), cuts both sides to the same number of cubics without changing either shape, and for a closed pair picks the start point and direction that move the points least (the sum of squared distances), which is what stops the twist. The kernel uses it for `svg.path` (`sampleTrack` and the `loop` behaviour in `evaluate.ts`); `mask.path` and every other path value keep `PathMorphSolver`. The fixes are layer properties: `morph.match` (`auto`, or `order` to morph the paths as written), `morph.startOffset` (points) and `morph.reverse`.
**Stroke drawing (`src/core/paths/strokeDraw.ts`):** `draw.start`, `draw.end` (0 to 1, keyframed), `draw.offset` (turns, keyframed), `draw.reverse` and `draw.stagger`. The drawn part is one dash on a path whose length is called 1 (`pathLength="1"`), so the numbers don't depend on the shape. A path of several sub-paths with drawing settings is drawn as one fill and one stroke element per sub-path (`StrokedPath` in `src/core/render/archetypes/Svg.tsx`), so the sub-paths draw together (stagger 0) or one after another (stagger 1) instead of along one long line. A path without drawing settings is the one `<path>` it always was.
**Engine (`src/core/engine/stage/svgPaths.ts`):** `SvgPathWriter` writes `d`, `pathLength`, `stroke-dasharray` and `stroke-dashoffset` as attributes on the layer's path elements, only when they change, and puts back what React drew when the layer stops animating (`d` is not a CSS property in Safari, so it is never written as a style). Before this an animated `svg.path` was evaluated but never drawn: `styleWrites` has no CSS value for path data. A layer that animates either stays on the kernel adapter (never a Web Animation).
**Commands (`src/core/paths/pathMotionCommands.ts`):** `path.setMorph`, `path.setDraw` (and `clear`), `path.animateDraw` (two keyframes that draw the stroke on, or off, over a length from the playhead) and `path.morphTo` (two keyframes that morph the layer's path into another layer's or a given path; refused with a code for a different kind of layer, a vector network, or a path that can't be read). One undo step each.
**In the editor:** a **Morph & draw** section (`src/editor/panels/details/sections/MorphDrawSection.tsx`) for a path or an icon, in the Design inspector and under the Motion inspector: Length, **Draw the stroke on**, **Trim stroke** (Start, End, Offset, From the other end, Stagger when the path has several strokes), **Morph into…** (another layer of the same kind), and, once the path morphs, Matching, Start point and Reverse direction. The animations it makes are listed with their times and removed there.
**Not built, so the phase stays 🚧:** rows and stopwatches for `draw.*` and `svg.path` in the new editor's timeline (it shows five properties; the keyframes are in the document, played by the engine and listed in the section); drawing and morphing a stroke that uses a brush, an alignment, a width profile or arrowheads (those are drawn as outlines), a vector network, or a parametric shape (rectangle, ellipse, polygon: convert it to a path first); a stroke that is being drawn is not dashed; morph and draw in the exported code (the export has no animation yet, Phase 94; a stroke trimmed at rest is exported). WebKit can't be run on this machine; CI runs it.

**You'll see:** a menu icon morphing into a close icon; a logo drawing itself.
**Done when:** the icon-morph and logo-draw references match `evaluate()`.
**Evidence (2026-11-15):** `src/core/paths/__tests__/morphDraw.test.ts` (29 tests: the properties, matching, the manual fixes, unequal point counts, dashes with reverse, offset and stagger, the kernel at five times for both references, the engine's writes on a stand-in element and their restore, the render definition's markup, the four commands with undo). `tests/e2e/path-morph-draw.spec.ts` on `/editor/stage-lab` (**Load path scenes**): the icon's drawn `d` equals `evaluate()` at 0, 0.25, 0.5, 0.75 and 1 and stays three strokes; each of the logo's four strokes carries the kernel's dash at the same five times and the dark pixels grow from none to the whole logo; and on `/editor` the section's controls are driven end to end. Passing in Chromium and Firefox here.

### Phase 86 · Motion along paths & SVG filters
**Needs:** 85 · **Was:** v3 16.3 (motion path), 16.4 · **Status:** 🚧
- [x] Any path can drive a layer's position at constant speed (arc-length sampler), with auto-rotate and offset.
- [ ] Animatable SVG filters (blur, displacement, turbulence, colour matrix), gradients and clip paths with a performance class each. **Part built:** the performance class. Blur, displacement and turbulence (noise) were already animatable in the Phase 75 effect stack; a colour-matrix effect, animated gradients and animated clip paths are not built.

**Started before its Need is ✅ (2026-11-16):** Phase 85 is on `main` (PR #181) but still 🚧, because its own Need (84) is Lane A's. Phase 86 builds on 85's path code only.
**The sampler (`src/core/paths/pathFollow.ts`):** a path's own parameter runs fast through long curves and slowly through short ones. `pathSampler` cuts every segment into 24 straight pieces, adds up their lengths and answers "the point at this share of the length" by a binary search, with the direction of the piece it lands on. Equal steps of the share are equal distances. A closed path goes round again past 1; an open one stops at its ends. The first sub-path is the track. Pure (no `getPointAtLength`), so every browser and the tests agree.
**Properties:** `motionPath.source` (the id of a path layer), `motionPath.progress` (0 to 1, keyframed), `motionPath.offset` (added to it, keyframed), `motionPath.autoRotate`, `motionPath.rotate` (degrees). Without a source the layer follows its own `transform.motionPath`, in px from where it rests. That property was registered with the CSS property `offset-path` and never drawn; it now has no CSS property, because the kernel does the work.
**Kernel (`withPathFollow` in `evaluate.ts`):** the place on the path is added to `transform.x` and `transform.y` (and the path's direction to `transform.rotate` when the layer turns along it) before the single transform is made, so parents, motion blur and speed effects see an ordinary move. With a source, the path is followed where that layer draws it: its 200 x 200 drawing stretched to its frame, at its place on the canvas, with its own `transform.x` / `transform.y`, so a path that moves carries its follower. The source's properties are read before any path of its own, so two layers following each other can't loop.
**Engine:** a layer on a path is planned for the kernel adapter and its transform is written every frame (`animatedPaths`, `animatedLayers` in `styleWrites.ts`); it never runs as a Web Animation.
**Commands (`src/core/paths/pathMotionCommands.ts`):** `path.follow` (put a layer on a path layer or on a path of its own, set progress, offset, auto-rotate and turn; `source: null` takes it off; refused with a code for a layer that is not a path, a path following itself, or path data that can't be read) and `path.animateFollow` (two keyframes on the progress, from the playhead). One undo step each.
**In the editor:** a **Follow a path** section (`src/editor/panels/details/sections/FollowPathSection.tsx`) on every layer, in the Design inspector and under Animation in Motion: **Path** (the path layers on the page), then **Position**, **Offset**, **Turn along the path**, **Turn**, **Length** and **Travel along the path**; the journey is listed with its times and removed there.
**Performance class (`src/core/rules/effectRouting.ts`):** `effectPerformance` gives each effect `compositor` (a CSS filter: re-applied without redrawing the layer) or `repaint` (an SVG filter: the layer is redrawn through it on every frame it changes). The Effect stack section shows the sentence beside each effect's route.
**Limits:** the layer's centre is worked out from its frame (`frame.width` / `frame.height`), so a box that draws larger than its frame (a container grown by its padding) sits off the path by half the difference; shapes, images and fixed-size frames are exact. Both layers must be placed freely (not in a flow layout), as for a matte; otherwise the layer is left where it is. The layer is on the path in Motion and Preview; Design shows it at rest. Not in the exported code (the export has no animation yet, Phase 94). The new timeline has no row for `motionPath.progress`.

**You'll see:** a layer travelling along a drawn path.
**Done when:** the motion-path orbit reference matches `evaluate()`.
**Evidence (2026-11-16):** `src/core/paths/__tests__/pathFollow.test.ts` (16 tests: equal steps are equal distances on a path of a short and a long side; a circle's length and points to within 0.05 px and its direction; wrap and clamp; scale; the orbit reference in the kernel at five times, on the circle and at that share of a turn; auto-rotate, turn offset, offset; a stretched path and a moving path; a path of the layer's own; the cases left alone; the engine's plan and written transform at five times; the commands with undo; the performance classes). `tests/e2e/path-follow.spec.ts` on `/editor/stage-lab` (**Load orbit scene**): the dot's written transform equals `evaluate()` at 0, 0.25, 0.5, 0.75 and 1 and its drawn centre is on the drawn circle at that share of a lap, measured against the path layer's own box; the arrow is a quarter of a lap ahead and turned by the path's direction; and on `/editor` the section's controls are driven end to end.

### Phase 87 · Motion engine adapter
**Needs:** 86 · **Was:** v3 15 · **Closes:** AUD-10 (runtime) · **Status:** 🚧
- [x] `MotionAdapter` (`motion/react`, loaded lazily): states → variants, transitions → spring/tween configs, triggers → `whileHover` / `whileTap` / `whileInView` / `whileDrag`; layout animation and presence for layout transitions and enter/exit.

**Stays 🚧 (2026-11-16):** Phase 86 is 🚧 (the SVG-filter half), and this gate has not run in CI.
**How Motion runs here (`src/core/engine/motion/MotionAdapter.ts`):** `loadMotion()` imports `motion` (the library `motion/react` is built on) the first time the stage's engine starts, as a chunk of its own. From then on every transition on the stage is Motion's: `MotionMover` moves a number with Motion's `spring` and `keyframes` generators. They are pure functions of time and are stepped by the editor's frame scheduler, never by a clock of Motion's, so scrubbing, deterministic capture and the tests see the same frames; an interruption builds a new generator from where the number is with the speed it has. Until Motion has loaded, the kernel's `Mover` does the same job (`stageMover`), and the two agree to 0.002 at every frame, so the hand-over is not seen. The stage's layers are not turned into `motion.div`s: the renderer is shared with the Design track and the kernel stays the one authority for what is drawn (Law 1).
**In Motion's words (`motionConfig.ts`):** `motionPropsOf(doc, layerId)` gives a layer's states as `variants` (plus `rest`, the base values of everything a state changes), `hover` as `whileHover`, `pressed` as `whileTap`, `focus` as `whileFocus`, custom states named `inView` and `drag` as `whileInView` and `whileDrag`, the transition as stiffness, damping and mass (the same curve the stage draws) or a duration and a bezier, a property's own transition keyed by Motion's name for it, `layout`, and `initial` / `exit`. Pure data; Phase 95's exporter prints it.
**Layout motion and presence:** properties `layoutMotion.on`, `presence.enter`, `presence.exit` (`fade`, `scale`, `rise`), set by `layer.setLayoutMotion`. `LayoutDriver` (`src/core/engine/stage/LayoutDriver.ts`) reads where the layout puts each such layer every frame (`offsetLeft` / `offsetTop`, which no transform changes); a jump (a move the frame before doesn't explain, `layoutJump`) goes into an offset written as CSS `translate` that springs back to zero, and a second jump on the way is added without touching its speed. An entrance plays when the stage goes live and when a layer is made; a deleted layer leaves a copy (`data-ll-leaving`, hidden from assistive technology, without the layer's id) that plays the exit and is removed.
**Drivers:** `StateDriver`, `VariantDriver` and `LayoutDriver` take a `mover` factory from their host.
**In the editor:** the **Transition** section now shows on every layer, with **Layout** (a switch), **Appears** and **Leaves** (At once, Fades, Fades and grows, Fades and rises); the type and time rows show once the layer has something to move.
**Not built:** a size change is not animated (only the place); `whileInView` and `whileDrag` are named in the mapping but the stage has no in-view or drag trigger for states yet; an exit when a layer is hidden by a component property rather than deleted, in Preview; layout motion in the exported code (Phase 95).

**You'll see:** layout changes and enter/exit animate smoothly.
**Done when:** spring-heavy references (toggle, stacked cards, dock) keep velocity on interruption in the stage.
**Evidence (2026-11-16):** `src/core/engine/motion/__tests__/motionAdapter.test.ts` (12 tests: lazy loading and the fallback; Motion's spring and tween equal to the kernel's frame for frame; an interruption and a shift keep the speed; the three references on Motion's generators, each with every step and every change of speed bounded by what the spring can do by itself: the toggle hovered 10 times, a five-item dock swept three times, three stacked cards reordered three times before arriving; the jump rule; the command with undo; a jump drawn from where the layer was and a carried layer left alone; entrance on going live and on creation, skipped under reduced motion; the exit copy; the mapping to Motion's props). `tests/e2e/layout-motion.spec.ts` on `/editor`: Motion reported loaded once the engine runs; a card moved 200 px travels (frames caught on the way, no step above 40 px), three more moves 120 ms apart never snap and it ends with no `translate` left; an entrance sampled from nearly invisible to 1 while rising; a deleted card's copy appears and goes. Passing in Chromium here.

### Phase 88 · Motion per breakpoint
**Needs:** 43, 87 · **Was:** v3 50.3 (motion half) · **Status:** 🚧
- [x] Clips on or off, durations, distances and behaviour settings can be overridden per breakpoint. **Per layer:** the four settings below apply to all of a layer's clips and loops together; one clip of several can't be switched off by itself, and a loop's own numbers (from, to) can't differ per breakpoint.

**Stays 🚧 (2026-11-16):** Phase 87 is 🚧, and this gate has not run in CI.
**The settings (`src/core/breakpoints/breakpointMotion.ts`):** four layer properties, `motion.plays` (on), `motion.timeScale` (1: every delay and duration is multiplied by it), `motion.distance` (1: how far the layer goes from where it rests, for places, turns and sizes; opacity and colour are not movement) and `motion.loops` (on). They are ordinary properties, so Phase 43's overrides carry them: set while a smaller breakpoint is viewed they are stored in that breakpoint's overrides, they cascade (Tablet's apply on Mobile until Mobile says otherwise), and set at the base they are the layer's everywhere. No schema change.
**Kernel:** a new input `EvaluateInputs.breakpoint`. `evaluateBaseProps` starts from the layer as that breakpoint sees it (`layerAtBreakpoint`; the same object when nothing is overridden), so an animation at Mobile also starts from Mobile's own values, which it did not before. Clips are skipped when it doesn't play; a slower clip is the same clip with its delay, duration and repeat delay stretched; a sample's movement is scaled from the layer's rest value; loops are skipped, slowed and scaled the same way.
**Engine:** `KernelAdapter.setBreakpoint` and `WaapiAdapter.setBreakpoint` (the Web Animations are baked again for the breakpoint), kept through `setInputs`. `installStageEngine` takes `breakpoint`, read every frame; the editor passes the breakpoint being viewed.
**Command:** `layer.setMotionAt` (`plays`, `timeScale`, `distance`, `loops`, `reset`): writes only what differs from what the layer already does at the breakpoint being viewed; `reset` takes that breakpoint's four off. One undo step.
**In the editor:** a **Motion at this size** section under **Animation** in the Motion inspector: it says which size it is setting (**At every size**, or **At Mobile and smaller**), with **Plays**, **Time** (%), **Distance** (%), **Loops** and, when this size has settings of its own, **Same as larger sizes**.
**Limits:** device-view mirrors (the same frame shown at several sizes side by side) are not animated by the stage, so the difference is seen by switching the frame's size, not side by side. Not in the exported code (Phase 95).

**You'll see:** a calmer animation on Mobile than on Desktop.
**Done when:** a per-breakpoint override plays only at its width in the stage.
**Evidence (2026-11-16):** `src/core/breakpoints/__tests__/breakpointMotion.test.ts` (8 tests: the defaults and what counts as movement; the command at the base and at a breakpoint, storing only what differs, undo, reset; the reference at Desktop, Tablet and Mobile; the cascade; off; time; the adapter's written transform at the base and at Mobile, kept through another driver's `setInputs`). `tests/e2e/breakpoint-motion.spec.ts` on `/editor` in Motion: a 100 px slide is drawn at 50 px at 1 s at the base; viewed at Mobile with **Distance 25 %** it is drawn at 12.5 px, with **Time 200 %** at 12.5 px at 2 s; at the base again 50 and 100 px; **Plays** off draws 0; **Same as larger sizes** puts it back. Passing in Chromium here.

### Phase 89 · Page transitions
**Needs:** 88 · **Was:** v3 77.3 · **Status:** 📋
- [ ] View Transitions API page transitions (same-document and cross-document where supported, with fallbacks); shared elements between pages.

**You'll see:** animated navigation between pages in Preview.
**Done when:** a 5-page fixture shows the same transitions at sampled times in Preview, on the native and fallback paths.

### Phase 90 · Animation Playground
**Needs:** 89 · **Was:** v3 24.0–24.3, 24.5 · **Closes:** AUD-20 (Tiers 3–4: properties 41–52) · **Status:** 📋
- [ ] A focused preview with a props panel (live knobs), state and trigger buttons, time scale (0.1×–2×), loop, frame step, device frames, backdrop, reduced-motion toggle, overlays (wireframes, box model, dimensions, touch targets), and an FPS meter.

**You'll see:** open any animation in a Storybook-style Playground and tune it.
**Done when:** every reference animation opens with working props, triggers, slow motion and reduced motion (automated sweep).

### Phase 91 · Motion library infrastructure
**Needs:** 90 · **Was:** v3 25.1, 25.2, 21.3, 22.4 · **Status:** 📋
- [ ] An effect registry with versions, categories, tags and search; insert creates an effect instance; detach converts it into plain layers and clips. Effect instances show as one collapsible layer; their props render as controls automatically. Thumbnails are pre-rendered loops (never live contexts).
- [ ] The 51 v1.1 presets migrate into the registry (duplicates dropped).

**You'll see:** a searchable library of motion you can drop onto any layer.
**Done when:** insert → customise → detach works for every migrated preset.

### Phase 92 · Library: text, SVG & component motion
**Needs:** 91 · **Was:** v3 25.3 (waves 1, 3, 4) · **Status:** 📋
- [ ] Wave 1, text (10): split reveal, blur-in, shiny text, gradient flow, decrypt, typewriter, rotating words, count-up, scroll-reveal text, variable proximity.
- [ ] Wave 3, SVG (6): stroke-draw logo, morph icon set, motion-path orbit, gooey blob, animated icon pack, line-art reveal.
- [ ] Wave 4, components (6): dock magnification, stacked cards, animated list, infinite menu, elastic slider, circular gallery.
- [ ] Every item is original (provenance recorded) and an open recipe where the primitives can express it.

**You'll see:** 22 polished, editable motion effects.
**Done when:** each passes the Playground sweep and the parity check against the kernel.

### Phase 93 · Reduced motion & accessibility rules
**Needs:** 79, 82, 84 · **Was:** v3 29.1, 29.3, 11.4 · **Closes:** AUD-14 (partial) · **Status:** 🚧
**Part built (2026-11-16), the reduced-motion half only:** Phases 82 and 84 (Lane A's) are not ✅, and the flash limits, pause controls for loops over 5 s, visible focus and 44 px touch targets are not built (some exist in `src/core/rules/interactiveAccessibility.ts` from Phase 199).
**Policy (`src/core/breakpoints/breakpointMotion.ts`):** `motion.reduced` on a layer: `auto` (default: opacity and colour animate as written; movement, turns and growth don't; loops stop; a scroll-scrubbed animation shows its end instead of following the scroll), `full` (plays as written) or `off` (doesn't play). The kernel applies it when `EvaluateInputs.reducedMotion` is set. `layer.setMotionAt { reduced }` sets it (the default is not stored).
**Preview of it:** `view.reducedMotion` (a command, toggles) and a **Show it** switch in **Motion at this size** draw the whole stage as reduced motion gets it (`useMotionPreferenceStore`, not saved or exported). The system's `prefers-reduced-motion` counts too (`reducedMotionNow`), and the drivers (states, variants, layout) use the same answer.
**Not built:** generating a variant per library effect (the library, Phases 91–92, isn't built); the Playground toggle (Phase 90).
- [ ] Every animation has a reduced-motion variant (generated from the spec's §9 policy: keep opacity and colour, drop movement, stop loops, disable scroll scrub), editable in Pro. Rules: flash limits, pause controls for loops over 5 s, visible focus, 44 px touch targets. The Playground toggle uses the variants.

**You'll see:** a reduced-motion preview that shows exactly what those users get.
**Done when:** the reduced-motion Playwright run shows no spatial movement in any library effect.
**Evidence (2026-11-16):** `src/core/breakpoints/__tests__/breakpointMotion.test.ts` (5 tests for this phase: the policy at five times, full and off, loops, scroll-scrubbed, the adapter and the command) and `tests/e2e/breakpoint-motion.spec.ts` (the switch: drawn x 50 px becomes 0 while the opacity stays 0.5; **Plays in full** brings the 50 px back). Chromium here.
**v5 (R1):** until the library (Phases 91 and 92) is built, "any library effect" reads "each of the five reference recipes" (§2, R1). The Playground toggle arrives with Phase 90; until then the toggle is in Preview.

### Phase 94 · Motion export architecture
**Needs:** 49, 68 · **Was:** v3 27.1 · **Status:** 📋
- [ ] Exporters read the document and routing decisions only (never UI state). The per-engine code generators move out of `MultiEngineAnimationRuntime` into the exporters.

**You'll see:** nothing new (refactor); 95 builds on it.
**Done when:** the static export (49) still passes the harness with the new architecture.

### Phase 95 · Motion export: React, Next & Vite
**Needs:** 80, 82, 84, 93, 94 · **Was:** v3 27.2, 27.3, 29.2 · **Status:** 📋
- [ ] Clips, states, transitions, scroll, text and SVG motion, links and expressions export as idiomatic code (CSS / Web Animations / `motion/react`, chosen by routing), with `prefers-reduced-motion` handling, typed props and defaults, Prettier formatting, no `any`, and a README listing only the engines used. No LazyLayout imports.

**You'll see:** the Code tab and the ZIP include your animations.
**Done when:** every library effect and reference animation builds in the Next and Vite fixtures.
**v5 (R1):** exports what R0 and R1 can author: clips, states, transitions, scroll, text motion, links, expressions and drivers. SVG motion joins the exporters with Phases 85 and 86. "Every library effect" reads "each of the five reference recipes".

### Phase 96 · Export matrix in CI
**Needs:** 95 · **Was:** v3 27.4 · **Closes:** AUD-15, AUD-16, AUD-40 · **Status:** 📋
- [ ] Every library effect × {Next, Vite} × {Tailwind, CSS Modules}: `tsc`, build, and pixel parity against the editor at 5 times. A keyframe added in the timeline appears in the Code tab, and undo removes it there.

**You'll see:** export is trustworthy: what you see is what ships.
**Done when:** the full matrix is green in nightly CI (PRD §11 criterion 5).
**v5 (R1):** the matrix is the five reference recipes × {Next, Vite} × {Tailwind, CSS Modules}. Library effects join it in Phase 92.

### Phase 97 · More export targets
**Needs:** 96 · **Was:** v3 28 · **Status:** 📋
- [ ] Vue 3 single-file components, a Web Component (vanilla), CSS-only export when the rules allow it, shadcn-compatible registry items with a static registry route, copy as snippet, ZIP download, and "Open in StackBlitz / CodeSandbox".

**You'll see:** export menu options for Vue, Web Component, CSS-only and registry install.
**Done when:** each target passes the build and parity harness for every applicable effect; a registry install into a fresh Next app builds.

### Phase 98 · GSAP as an opt-in export target
**Needs:** 97 · **Was:** v3 14 · **Closes:** AUD-28, AUD-47 (licence) · **Status:** 📋
- [ ] Send the licensing inquiry (spec §11.3) and record the answer in `LICENSES.md`. While GATE-01 is open, GSAP stays an opt-in **export** target only (`useGSAP()` with scoped selectors and cleanup); it never runs in the editor and no default needs it.

**You'll see:** an optional "GSAP" export flavour, off by default.
**Done when:** 10 animations pass parity through the optional GSAP export; a bundle check proves `gsap` isn't in the editor.

### Phase 99 · Video & audio layers
**Needs:** 36, 98 · **Was:** v3 54.3, 54.4 · **Closes:** AUD-37 · **Status:** 📋
- [ ] Video layers synced to the transport (seek on scrub, rate on play, trimmed by in/out). Audio layers with a waveform lane, scrubbing and beat markers.

**You'll see:** drop a video or a soundtrack into the timeline and animate to it.
**Done when:** after 20 random seeks a video shows the frame for `t` within 1 frame.

### Phase 100 · Render queue: video, GIF, image sequences & Lottie
**Needs:** 99 · **Was:** v3 55 · **Status:** 📋
- [ ] Frame-accurate capture in deterministic mode (decision record 0010, render capture). MP4 and WebM through WebCodecs, GIF with palette quantisation, PNG sequences and posters, transparent backgrounds. Lottie export for the subset that maps, with the rules explaining what can't. A queue UI with presets.

**You'll see:** File → Render to MP4, GIF or Lottie.
**Done when:** a 5-second 60 fps composition renders to MP4 with frames matching `evaluate()` above a PSNR threshold; eligible Lottie output plays in `lottie-web` within 2% pixels.

### Phase 101 · Performance lab, workers & hot path
**Needs:** 96 · **Was:** v3 56, 26.1–26.4 · **Closes:** AUD-13 · **Status:** 📋
- [ ] A worker pool (path morph matching, arc-length tables, spring baking, spatial index, thumbnails, waveforms), content-hash caches, no per-frame sorting, JSON or string parsing in `evaluate()`, frame telemetry in the status bar.
- [ ] A browser benchmark harness (Playwright + DevTools tracing), per-animation performance class checked against traces, auto-fixes (`left/top` → `transform`, pre-blurred layers, path simplification), and a CI budget per library effect.

**You'll see:** frame-time readout in the status bar; one-click performance fixes.
**Done when:** a scripted 60-second editing session shows 0 main-thread tasks ≥ 50 ms; a layout-thrashing test animation is flagged and auto-fixed within budget; every library effect meets its budget in CI.
**v5 (R2):** the CI budget covers the five reference recipes; library effects join it in Phase 92. The worker jobs for path morph and waveforms arrive with Phases 85 and 99.

### Phase 102 · Stage 2 gate: the animation journey
**Needs:** 53–101 · **Was:** v3 58.2, 58.3, 58.4 · **Status:** 📋
- [ ] **Journey A (After Effects user):** a 3-scene intro with a precomp, a parent chain, a luma matte, a `wiggle` expression and markers; a motion path edited on the canvas; onion skin; graph-editor easing.
- [ ] **Journey B (interactive components):** a toggle and a card with states and smart-animate transitions, an animated variant, scroll reveals and a page transition.
- [ ] **Journey C (output):** React export passes parity, MP4 render passes parity, `.lazy.json` reopens identically.
- [ ] All three stay within the performance budgets.

**You'll see:** LazyLayout works as a motion design studio on top of the design tool.
**Done when:** the journeys pass in CI in 3 browsers, plus one recorded manual run.

---

# STAGE 3 — DESIGN DEPTH (Phases 103–131)

> **Stage output:** vector, paint and type tools that go past Figma's and Illustrator's, all non-destructive. Shapes merge into **live boolean groups** whose curves stay curves, or melt together like liquid; a **Shape Builder**; offset, outline and knife; smooth corners. A **modifier stack** (repeat, trim, twist, wiggle …) and **generators** (scatter, Voronoi, flow lines). A fill stack where **every fill has its own blend mode and mask**, plus noise, pattern, mesh and live fills, on shapes and on text; several strokes with gradients, width profiles and pressure brushes; glow, progressive blur and frosted glass; image adjustments and colour tools. **Text on a path** and inside shapes. **2.5D spaces** where page layers have depth, stand on rings and domes, and parallax under a camera. Everything exports through Phase 49.
>
> **Why here (v4.1):** these are design tools that need only Stage 1, and later stages build on them: outline effects and deformation (Stage 4), rigging (Stage 5), inflating vectors into 3D (Stage 6). Every Needs line in this stage points into Stage 1, so it can run while Stage 2 is finished. Proposed for Lane A after Phase 52 (`DOCS/TEAM/COLLABORATION.md` §1).
>
> Order inside the stage: shapes (103–108) → modifiers and generators (109–112) → paint (113–123) → type and assets (124–126) → 2.5D (127–129) → export and the gate (130–131).

### Phase 103 · Curve-exact path engine
**Needs:** 40 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Booleans, offsets and outlines computed on the Bézier curves themselves (curve–curve intersection, winding, exact splitting), so results keep curves as curves instead of Phase 40's polygons. Decision record 0015 (path engine): in-house, paper.js (MIT) or Skia PathKit (BSD, Wasm), chosen by accuracy, size and speed.
- [ ] Phase 40's Union, Subtract, Intersect, Exclude and Flatten move onto it; their tests keep passing.

**You'll see:** Union two circles and get a path with a handful of curve points, not hundreds of straight ones.
**Done when:** 200 random boolean cases match a high-resolution polygon reference within 0.25 px, with at most twice the minimal number of nodes; Phase 40's tests pass.

**Status check (2026-11-14), 🚧:** built (Lane C). `src/core/paths/curveRefit.ts` turns the polygon clipper's answer back into pieces of the input curves, with joints refined onto the true crossings; `booleanPaths`, `simplifyPath`, `arrangementFaces` and `unionFaces` return curves, so live boolean groups, the Shape Builder and the paint bucket get them too; Phase 40's `booleanLayers` moved onto it (a single outline stays an editable path with handles). Decision 0015 is written: in-house, no new dependency. Verified: 200 seeded random cases, every point within 0.25 px of the polygon reference (`curveRefit.test.ts`); a union of two circles is 6 to 10 curves and no lines; all 3,416 core unit tests pass; Phase 40's and the FigCraft port's browser tests pass in Chromium (25 of 25). **Not done:** the node bound checked is "no more than twice the input segments that show in the result", not a computed minimum; tangent and overlapping curves keep the polygon's vertex at the joint; Firefox and WebKit were not run. ✅ once it passes in CI on `main`.

### Phase 104 · Live boolean groups
**Needs:** 46, 103 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Union, Subtract, Intersect and Exclude make a **boolean group** whose children stay editable: move, resize or edit a child and the result updates. Groups nest, can be flattened when wanted, and take one fill and stroke stack.
- [ ] Export writes the computed path (one SVG `path`), so the site needs no runtime. **Simple face:** the four icons on the toolbar, and "Edit pieces" / "Flatten".

**You'll see:** merge three triangles and a rectangle into one shape, then still move each piece.
**Done when:** editing a child of a 50-child group updates the result in < 16 ms; the stage and the export match within 0.5 px in 3 browsers.

**Status check (2026-11-14), 🚧:** live boolean groups were already built by the FigCraft port (`src/core/editing/booleanGroups.ts`: make, set operation per group and per operand, flatten, nesting, one undo step each; the group draws through the Container render definition, so the stage and the export use the same path). **Built now (Lane C):** the speed gate. A 50-child group took about 45 ms before Phase 103 and about 600 ms with curves refitted at every step; `booleanGroupResult` now combines the operands as polygons, merges runs of operands that combine the same way, remembers each run (and the run without the child that is moving), and turns the result into curves once. **Measured: 6.9 ms median** for moving one child of a 50-child group of ellipses and rectangles (`booleanGroupSpeed.test.ts`), and the result is curves. The FigCraft port's and Phase 40's browser tests pass in Chromium (25 of 25). **Not done:** the stage-against-export comparison within 0.5 px in three browsers has no test of its own; the Simple face ("Edit pieces" and "Flatten" beside the four icons) is in the legacy editor and has not been checked in the new one; Firefox and WebKit were not run.

### Phase 105 · Shape Builder tool
**Needs:** 104 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Select overlapping shapes and the tool shows every region they make. Drag across regions to merge them, Alt-drag (Option-drag) to delete them, click to keep a region on its own; the result is a live boolean group.

**You'll see:** draw a few shapes, drag across the pieces you want, and get one clean shape.
**Done when:** a 12-step Shape Builder journey gives the expected region areas and node counts in 3 browsers.

**Status check (2026-11-15), 🚧:** the Shape Builder was built by the FigCraft port (`src/core/editing/shapeBuilder.ts`: regions of the selection, merge, remove, strokes as their own regions, one undo step each; the `shapeBuilder.merge` and `shapeBuilder.remove` commands; the tool on Shift+M in the legacy editor). **Built now (Lane C):** the 12-step journey (`shapeBuilderJourney.test.ts`): three overlapping circles make seven regions whose areas match the analytic lenses; every region, merge and removal is curves with no straight side; undo and redo restore each step. It found a real bug: merging regions that had been cut from curves made the clipper fail on edges that nearly coincide. Fixed in `pathOps.ts`: a result keeps the exact polygons it was made from, so it is combined again as those, and the clipper retries on a fine grid if it still fails. **Not done:** the journey runs as a unit test, not in three browsers; the result is a plain path layer, not a live boolean group as the checklist asks (kept on purpose: the FigCraft behaviour, where the pieces left over stay where they are, needs plain layers; a live-group result is a separate decision); the tool is reachable only in the legacy editor.

### Phase 106 · Path operations: offset, outline, simplify, divide & knife
**Needs:** 103 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Offset path (round, mitre, bevel joins), outline stroke (a stroke becomes a filled shape), simplify and smooth with a strength slider, divide (cut every overlap into its own piece), knife (draw a line to cut), join, reverse and expand.

**You'll see:** turn a stroke into a filled shape, or cut a shape in two with a knife line.
**Done when:** 20 reference shapes per operation match stored results within 0.25 px.

**Status check (2026-11-15), 🚧:** built (Lane C). `src/core/paths/pathTools.ts`: offset with round, mitre and bevel corners (the result fitted back into curves), simplify and smooth by a strength, divide, knife (a straight or bent line, carried on past its ends), join and reverse; outline stroke was already `strokeOutline`. `src/core/editing/pathToolOps.ts` applies them to layers, one undo step each, and they are typed commands (`vector.offset`, `vector.simplify`, `vector.smooth`, `vector.reverse`, `vector.divide`, `vector.knife`, `vector.join`), so the palette and the agent bridge reach them. Verified (`pathTools.test.ts`, 13 tests; `pathToolOps.test.ts`, 5): **20 seeded shapes per operation**, checked against geometric facts instead of stored copies of our own output: every point of an offset is the offset distance from the shape within 0.25 px (outward and inward); an outlined stroke stays within half its width of the line and has length × width of area; a simplified path stays within its tolerance and loses at least three quarters of its points; divided pieces cover the union and the shared piece is the intersection; knife pieces add up to the shape and none crosses the line; reversing twice gives the path back. Exact areas for a rectangle grown with each corner style. **Not done:** no knife tool to draw the line on the canvas (the command takes the points), and no buttons or strength slider in the new editor's inspector; the operations reach the new editor only through the command palette.

### Phase 107 · Smooth corners & corner styles
**Needs:** 35, 40 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Corner smoothing (the iOS "squircle", 0–100%) on rectangles and on any vector point; per-corner radius on any path; corner styles: round, cut, scoop and inverted. Exported as CSS where CSS can draw it, otherwise as an SVG path or mask.

**You'll see:** Figma-style smooth corners on any shape, even on a star.
**Done when:** 60% smoothing matches the reference squircle within 0.5 px; stage and export match in 3 browsers.

**Status check (2026-11-15), 🚧:** corner smoothing on rectangles, polygons and stars was built by the FigCraft port (`core/geometry/shapes.ts`) but had no control in the new editor. **Built now (Lane C):** corner styles, a new property `shape.cornerStyle` (round, cut, scoop, inverted: a square notch) on rectangles, polygons and stars, drawn by the shared render definition (so the stage and the export draw the same path) and read by the outline that booleans and the Shape Builder use; a **Style** select and a **Smoothing** field (0–100%) under Corners in the new editor's Appearance options. A round rectangle with one radius and no smoothing still draws as a plain `<rect>`; every other case is an SVG path (CSS cannot draw squircles, chamfers or scoops in every browser). Verified (`cornerStyles.test.ts`, 11 tests): **60% smoothing matches the reference squircle within 0.5 px** on four rectangle sizes, the reference being Figma's published construction written again as an SVG path with arc commands; 0% and 100% too; exact areas for cut, scoop and inverted corners; a scoop's points lie on the bite; the render definition and the layer outline give the same area. In Chromium the Design control walker passes with the new controls (rectangle: 31 of 31 controls change the document), and the vector and FigCraft browser tests pass (47 of 47). **Not done:** per-corner radius and style on any vector point (path layers have a per-vertex radius from the FigCraft port, without style or smoothing); Firefox and WebKit were not run; a pixel comparison of stage against export has no test of its own (both use the same render definition).

### Phase 108 · Soft union: gooey groups
**Needs:** 104 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] A group whose children melt together where they come close, like liquid (metaball-style), with one Softness control. Drawn as a computed path where possible and with an SVG goo filter otherwise; the edges stay sharp.

**You'll see:** two circles that blend like liquid as they move together.
**Done when:** stage and export match within 1% of pixels at 5 distances; with filters off a hard union is drawn instead.

**Status check (2026-11-15), 🚧:** built (Lane C). A live **union** group takes `boolean.softness` (px): its children melt together where they come within twice that, with smooth necks, every inner corner rounded by the softness, and the outer edges kept sharp and in place. It is always a **computed path** (a morphological closing: grown by the softness, shrunk back, fitted with curves; `softClose` in `core/paths/pathTools.ts`), so no SVG filter is needed and a browser with filters off draws exactly the same shape; the stage and the export draw it through the same render definition. A **Boolean group** section in the new editor (operation, Softness, Flatten) also gives Phase 104's live groups their controls there. Verified (`softUnion.test.ts`, 8 tests; `pathTools.test.ts`): two circles at **5 distances** (touching, 4, 8 and 14 px apart, and 30 px: stays apart) match the exact neck area (kite between the four centres less the circles' and fillets' sectors) **within 1%**; the outer outline stays on the circles within 0.25 px; the render definition's path has the same area; an L shape's inner corner gets exactly a fillet of radius k at 5, 10 and 20. In Chromium (`soft-union.spec.ts`): Softness 10 turns two separate outlines into one on the canvas, the export carries the same path, and Flatten makes one path layer. **Found and fixed on the way:** Enter (or Escape) in any number field of the inspector also ran the canvas shortcut, so committing a value on a selected group or frame jumped into its children (`NumberField.tsx`). **Found, not fixed (3D-027, not Lane C's):** `offsetPolygon` in `core/3d/path/offset.ts` shrinks inner corners wrongly: an L shape eroded by 10 gives 4000 px² where the exact answer is 3921.46; the soft union uses its own erosion. **Not done:** a soft group takes 55–135 ms to recompute (cached while nothing changes), above Phase 104's 16 ms for dragging a child; no pixel comparison of stage against export (both draw the same path); Firefox and WebKit not run.

### Phase 109 · Modifier stack
**Needs:** 17, 103 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Any shape, text-as-shape or group gets an ordered, non-destructive **Modifiers** list (like Blender or Cavalry): add, switch off, reorder and remove; every modifier has a Simple face (≤ 7 controls, no maths, Law 17) and a Pro face. Results are cached per layer.
- [ ] The rules and the property registry know modifier properties, so later stages can keyframe them (Phase 66) and bind them to inputs (Stage 4). Export bakes the result to an SVG path.

**You'll see:** a Modifiers section in the inspector with add, on/off and drag to reorder.
**Done when:** a stack of 5 modifiers on 100 shapes re-evaluates in < 8 ms; switching every modifier off gives back the exact original path.

**Status check (2026-11-15), 🚧:** built (Lane C). A rectangle, ellipse, polygon, star, path or line keeps an ordered stack in `shape.modifiers` (`core/paths/modifiers.ts`: a registry of modifier types, each with Simple and Pro parameters, read safely and clamped). The layer's own geometry is never changed: `modifiedGeometry` (`core/editing/layerOutline.ts`) applies the stack to the layer's outline, cached per layer object, and everything that reads a layer's shape follows it: the stage and the export draw the result as one SVG path with the layer's own paints (`ModifiedShape`), and booleans, the Shape Builder and Outline Stroke read it too. Typed commands `layer.addModifier`, `layer.setModifier`, `layer.moveModifier`, `layer.removeModifier`, one undo step each; a **Modifiers** section in the new editor (add, on/off, up/down, remove, the Simple controls, and every control under More options). Verified (`modifiers.test.ts`, 15 tests): **a stack of 5 (round, repeat, trim, round, repeat) on 100 shapes re-evaluates in 3.8 ms** on its own (budget 8 ms; the test takes the fastest of 40 runs, since the unit suites run side by side); **every modifier switched off gives back the very same path**; order matters; junk stacks are cleaned. In Chromium (`modifiers.spec.ts`): add, change, switch off and on, reorder and remove on a rectangle, with the canvas and the export following; the Design control walker and the vector tests still pass (49 of 49). **Not done:** drag to reorder (up and down buttons instead); keyframing and driving modifier parameters (the stack is one JSON property, so Phase 66 and Stage 4 cannot reach a single parameter yet); text and groups as modifier sources; the Offset modifier costs about 7 ms a shape, so a stack with Offset on 100 shapes is far over 8 ms.

### Phase 110 · Modifiers I: repeat, trim, offset & round
**Needs:** 109 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Repeater (in a line, a circle or a grid, with a step for position, rotation, scale, opacity and colour), Trim (start, end, offset), Offset and Round corners, all live.

**You'll see:** a petal repeated 12 times around a centre becomes a flower you can still edit.
**Done when:** results match After Effects shape-layer references (Lottie fixtures) within 0.5 px.

**Status check (2026-11-15), 🚧:** built (Lane C) as Phase 109 modifiers: **Repeat** (in a line with steps for position, turn and scale; round a circle with radius and sweep, each copy turned to face out; or a grid), **Trim** (start, end, offset in degrees, each subpath on its own, wrapping round the closing point), **Offset** (round, mitre or bevel corners) and **Round corners** (sharp vertices only, cut back to fit). Verified (`modifiers.test.ts`) against After Effects' documented rules worked out by hand, within 0.5 px: copy i of a repeater is moved i steps, turned i turns and scaled by the scale to the power i; 12 petals sit on the circle at 30° steps; trimming 0–25% of a circle gives a quarter of its length from the path's start, and a 90° offset moves the window by a quarter; half a rectangle's outline ends at its far corner; rounded and offset rectangles have their exact areas. **Not done:** no After Effects or Lottie player is available here, so there are no Lottie fixtures; the repeater's per-copy **opacity and colour steps** are not in the modifier (one path has one paint): they are the layer-level Repeat of D8 (`repeat.fade`), which draws real copies.

### Phase 111 · Modifiers II: twist, bend, wiggle, zig-zag, pucker & bloat
**Needs:** 110 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Twist, bend, wiggle (seed, size, detail, and a speed used once the clock plays), zig-zag, pucker and bloat, and spherize. Wiggle is seeded, so a design looks the same every time it opens.

**You'll see:** a hand-drawn wobble on any outline, with one Amount slider.
**Done when:** every modifier is deterministic for a seed and matches stored references.

**Status check (2026-11-15), 🚧:** built (Lane C) as six modifiers for the Phase 109 stack (`core/paths/warps.ts`): **Twist** (each point turned about the centre in proportion to its distance), **Bend** (the width becomes an arc of the angle), **Wiggle** (seeded smooth noise across the outline: amount, detail, seed; a closed outline's wobble meets itself), **Zig-zag** (After Effects' rule: ridges per segment, the amount either side, corner or smooth points), **Pucker & bloat** (Illustrator's rule: the anchors stay, the handles move toward or away from the centre) and **Spherize** (bulge or pinch about the centre). Warps that move every point resample the outline every 2 px and fit curves back within 0.1 px. They appear in the Modifiers section with one Amount control each (Wiggle adds Detail and Seed). Verified (`warps.test.ts`, 7 tests): a centred circle twisted 180° stays on its radius within 0.15 px; a 100 px line bent 90° keeps its length within 0.25 px and lies on the arc; spherize moves a circle to the radius its rule gives; a wiggle never strays more than its amount, closes where it starts, repeats exactly for a seed and changes with another; zig-zag peaks land exactly half a ridge apart; pucker and bloat keep every anchor; **nine stored references** (`fixtures/warps.json`) match to a thousandth of a px, and were drawn and checked by eye when stored. **Not done:** Wiggle's Speed is stored but nothing plays it yet (it needs the clock to drive modifier parameters, the same gap as Phase 109's keyframing); not run in a browser on its own (the Modifiers section that shows them is covered by `modifiers.spec.ts`).

### Phase 112 · Shape generators: scatter, Voronoi & flow lines
**Needs:** 110 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Generators make shapes for you: scatter copies inside a shape or along a path, Voronoi and Delaunay cells, polygon grids, concentric rings and flow-field lines, each with a Variety control and a shuffle button (seeded).

**You'll see:** fill a circle with 200 scattered stars, or crack a card into Voronoi cells.
**Done when:** seeded results repeat exactly; 2,000 generated shapes stay editable at 60 fps.

**Status check (2026-11-15), 🚧:** built (Lane C) as five generator modifiers for the Phase 109 stack (`core/paths/generators.ts`): **Scatter** (copies of a star, circle, square or triangle inside the outline or evenly along it, sized and turned by Variety), **Cells** (Voronoi cells or Delaunay triangles cracking the outline, with a gap), **Grid** (square, hex or triangle cells clipped to the outline), **Rings** (concentric copies) and **Flow lines** (lines following a smooth seeded field, stopping at the outline). Each has a Seed and a **Shuffle** button in the Modifiers section; Variety is how much the pieces differ. Dragging a layer no longer regenerates its modifiers (the cache ignores placement). Verified (`generators.test.ts`, 13 tests): **every generator repeats exactly for a seed** and changes with another; 200 stars fill a circle, every one inside and no bigger than the size; Voronoi cells with no gap tile the circle within 0.5% and a gap cracks them apart; the Delaunay triangulation keeps every circumcircle empty; a square grid of a card is exactly its cells; flow lines stay inside and within their length; drawn and checked by eye. **2,000 stars**: generated in well under a frame, and in Chromium (`generators.spec.ts`) dragged across the canvas at a **median 16.7 ms a frame** (60 fps), the stars unchanged by the drag, and Shuffle gives a new layout. **Found and fixed on the way:** every dropdown in the new editor reopened within its closing animation showed no list (`Select.tsx`). **Not done:** the slowest tenth of frames while dragging 2,000 stars is about 50 ms on one worker; the pieces are one path, so they can't be selected one by one (a "detach into layers" is not built); scatter of any layer as the particle (only four built-in shapes).

### Phase 113 · Paint depth I: blend mode and mask per fill
**Needs:** 35, 37 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Every fill in the stack gets its own blend mode (all CSS blend modes) and an optional mask: a linear, radial or conic fade, or another layer. So an image can sit under a conic gradient that blends as Overlay and fades out at the bottom.

**You'll see:** a conic gradient over a photo, blended and fading out, made with two fills.
**Done when:** 24 blend-and-mask references render identically in 3 browsers and in the export.

**Status check (2026-11-15), 🚧:** a blend mode per fill already existed (FigCraft port F2) but had no control in the new editor. **Built (Lane C):** a **mask per fill** (`mask` on each paint in `paint.fills`, `core/paint/paints.ts`): a linear fade (start, end, angle), a radial fade, a conic fade, or **another layer** (a sibling's outline, shown inside it, or outside it when inverted). Shapes draw it as an SVG alpha mask around that fill alone, inside its blend (`core/render/shapePaint.tsx`; alpha, not luminance, because browsers disagree on the colour space of a luminance mask); the stage and the export share the render definition. The fill popover in the new editor's Fill section gets **Blend** and a **Mask** group (kind, shown-to, gone-at, angle; or the layer and Outside). Verified: masks round-trip and junk is cleaned (`fillMasks.test.ts`, 6 tests); in Chromium (`fill-masks.spec.ts`) **24 blend-and-mask references** (6 masks × normal, multiply, screen, overlay), a blue fill over a red one, read back at 72 points: every point matches red mixed toward the blend by exactly the mask's opacity, **within 5 of 255**; the export carries the mask (as an alpha-mask class) and the blend. **Not done:** frames and other box layers draw their fills as CSS backgrounds, which cannot mask one background layer, so a mask on a frame's fill is ignored (shapes only); a layer mask must be a sibling; Firefox and WebKit not run.

### Phase 114 · Paint depth II: noise, grain, pattern & texture fills
**Needs:** 113 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Seeded noise and grain fills (scale, contrast, colour), pattern fills (any frame or component repeated as a tile with offset, rotation and spacing), and texture overlays from the asset store.

**You'll see:** a grainy gradient, or a tile pattern made from your own shapes.
**Done when:** stage and export match within 1% of pixels in 3 browsers.

**Status check (2026-11-15), 🚧:** built (Lane C). Two new paint types in `paint.fills` (`core/paint/procedural.ts`): **noise** (grain or soft noise: size, contrast, colour, seed; SVG fractal noise, whose algorithm the SVG spec fixes, so a seed gives the same grain everywhere) and **pattern** (shapes repeated as a tile with scale, spacing, offset and rotation; the tile is made from any layer, or a frame's or group's children with their colours, `core/editing/patternTile.ts`). Both are drawn as one small generated SVG: a frame's fill uses it as a CSS background, a shape's fill as an SVG pattern, and the export writes the same, so the stage and the export draw the same pixels. **Texture overlays** are image fills from the asset store with a blend mode (already there; per-fill blend is Phase 113). The fill popover gets Noise and Pattern types with their controls (Kind, Size, Contrast, Seed; Tile from a layer, Scale, Spacing, Rotation). Verified (`procedural.test.ts`, 4 tests): stored safely (hostile path data and colours refused, sizes clamped); a seed repeats exactly; a frame's background and a shape's pattern are the same picture. In Chromium (`procedural-fills.spec.ts`): a rectangle with grain over a pattern over a solid, on the canvas at 100% and in the **exported site opened in a second page: 0.00% of pixels differ** (budget 1%), three runs out of three. **Not done:** the pattern's tile is baked when it is made, so editing its source layer doesn't update it (live fills are Phase 116); Firefox and WebKit not run.

### Phase 115 · Mesh gradients
**Needs:** 35 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Freeform mesh gradients: a grid of colour points you drag on the canvas, with handles for each point's spread, smooth or linear blending, and an image fallback in the export where CSS can't draw it.

**You'll see:** drag colour points to make soft, Apple-style mesh backgrounds.
**Done when:** 10 reference meshes render within 1% in 3 browsers; the export matches.

**Status check (2026-11-15), 🚧:** built (Lane C). A `mesh` paint (`core/paint/mesh.ts`): a grid of 2–8 × 2–8 colour points, positions as fractions of the box, blended linearly (bilinear per cell) or smoothly (Catmull–Rom across the grid). CSS can't draw a mesh, so it is always drawn as the **image fallback**: the mesh is rasterised (each cell split into fine triangles) into a 96 × 96 picture the browser stretches smoothly over the box, wrapped in the same generated SVG as noise and patterns, so the canvas, a frame's CSS background, a shape and the export draw the same pixels. In the new editor: **Mesh** in the fill popover with Columns, Rows (re-gridding keeps the look), Smooth, **On canvas** (the points become handles on the canvas, `MeshOverlay.tsx`, only while switched on, so clicking the layer still selects it), and the picked point's colour. Verified (`mesh.test.ts`, 13 tests): **10 reference meshes** (2×2 to 8×8, linear and smooth) each follow their blending rule on at least 99% of pixels within 3 of 255; a 2×2 linear mesh is exactly the bilinear blend; a dragged point carries its colour; the picture stays opaque and is a valid BMP; stored safely. In Chromium (`mesh-gradients.spec.ts`): canvas against the exported site, **0.00% of pixels differ**; dragging a point on the canvas moves its colour, and undo puts it back. **Not done:** a per-point spread handle; handles don't follow a rotated layer; the picture is 96 × 96, so very large boxes show it slightly soft; Firefox and WebKit not run.

### Phase 116 · Live fills: a frame or component as a fill
**Needs:** 46, 114 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Use any frame or component as a fill: it is drawn inside the shape, mirrors every edit to its source, and can be offset, scaled and tiled.

**You'll see:** a badge filled with a live copy of another design, which updates when you edit it.
**Done when:** an edit to the source updates every fill within one frame; the export matches.

**Status check (2026-11-15), 🚧:** built (Lane C). A `live` paint: any frame or component drawn inside a shape's outline (an SVG `foreignObject` clipped to it), with scale, offset (px) and tiling. It is drawn from the same document as everything else, so **every edit to the source shows in every fill in the same render**. The copy is a clone of the source's subtree with every id prefixed (`core/render/liveFill.ts`), so measuring and clicking on the canvas still find the source and the shape themselves; a fill whose source contains the shape draws nothing, and fills that would draw each other stop after one copy (`SubtreeContext` tracks what is being drawn). `RenderLayer` hands down a "draw this layer" function through context, so the paints never import the renderer. In the new editor: **Live** in the fill popover with Source (any layer that doesn't contain this one), Scale, Offset X and Y, Tile. Verified (`liveFill.test.ts`, 5 tests): stored safely; the copy has its own ids; an edit to the source shows; tiling at half scale gives 36 copies over 200 × 100; self- and mutual fills terminate. In Chromium (`live-fills.spec.ts`): a frame filling two shapes, **an edit to the frame shows in both fills by the next frame the browser draws**; a click inside a fill selects its own shape; the export draws both fills with the new text. The canvas contract suite passes (41 of 41). **Not done:** frames' fills are CSS backgrounds and can't hold layers, so live fills work on shapes only; a path layer's fill is drawn in its stretched 200 × 200 space, so a live fill there is stretched with it; Firefox and WebKit not run.

### Phase 117 · Fills & strokes on text
**Needs:** 31, 38, 113 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Text layers take the whole fill stack (gradients, images, noise, masks, blend modes) and several strokes, so a photo or a gradient shows through the letters. Text stays real, selectable and readable (`background-clip: text` in the export).

**You'll see:** a photo inside a headline that is still real text.
**Done when:** the accessibility tree reads the text once; stage and export match within 1% in 3 browsers.

**Status check (2026-11-15), 🚧:** text already took gradient and image fills through `background-clip: text` (Phase 35); the noise, pattern and mesh fills of Phases 114–115 work on text the same way, and per-fill blend modes too. **Built (Lane C): several strokes on text.** `paint.strokes` is now legal on text, and each stroke paint can carry its own `weight` and `align` (`core/paint/paints.ts`, shared with Phase 118). A text with strokes keeps its words as real, selectable text (clear), and hidden copies (`aria-hidden`) draw each stroke and the fill in order: outside strokes at twice their weight below, then the fill (whatever paint it is), then centre and inside strokes on top (`core/render/archetypes/Text.tsx`). Verified (`textStrokes.test.ts`, 3 tests): the order and widths of three strokes and the fill; a gradient fill above its stroke; noise on text. In Chromium (`text-strokes.spec.ts`): a headline with a gradient fill and two strokes, **the accessibility tree reads it once** on the canvas and in the exported site, and **0.00% of pixels differ** between them. **Not done:** a text stroke draws in one colour (a gradient stroke paint uses its first colour: CSS strokes text in a colour, not a picture); inside strokes draw as centre ones; per-fill masks don't apply on text (CSS can't mask one background layer); no stroke list in the inspector yet (the list UI is Phase 118; strokes are set by `paint.setStrokes`); Firefox and WebKit not run.

### Phase 118 · Stroke depth: several strokes, gradients, alignment & markers
**Needs:** 35, 40 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Several strokes per layer, each with its own paint (solid, gradient or image), inside, centre or outside alignment, caps and joins, and arrowheads and markers at the ends of open paths.

**You'll see:** a shape with a gradient outline inside a thin dark one, and an arrow line.
**Done when:** 30 stroke references match in 3 browsers and in the export.

**Status check (2026-11-15), 🚧:** the FigCraft port had a list of stroke paints (solid, gradient, image) sharing one weight and position, caps, joins and arrowheads (`core/render/strokePaint.tsx`); the new editor's Stroke section showed several rows but **saved only the first visible one** (a second stroke was silently lost). **Built (Lane C):** each stroke in `paint.strokes` can carry its own `weight` and `align`; when any does, `StrokeStack` draws one masked stroke layer per stroke, the first on top (outside strokes twice as wide with the shape cut out, inside ones clipped to it). The Stroke section now **keeps every row** for shapes, lines, paths and text (each row's colour, width and position saved to `paint.strokes`; rows are read back from it), and Position belongs to the row when a layer has several. Verified (`strokeStack.test.ts`, 2 tests): order, widths, clipping and a gradient stroke paint. In Chromium (`stroke-depth.spec.ts`): **30 stroke references** (rectangle, ellipse, star, polygon, line and path × one centre stroke, outside and inside, a gradient stroke, three stacked strokes, a dashed stroke with arrowheads) match between the canvas and the exported site, **the worst within 0.60% of pixels** (budget 1%); adding a second stroke row in the inspector keeps both, with its own width and position. The existing stroke specs (hero, Lane A issues, tools) still pass. **Not done:** the row editor sets solid colours only (gradient and image stroke paints are set by `paint.setStrokes`); dashes, caps and joins are still per layer, not per stroke; Firefox and WebKit not run.

### Phase 119 · Variable-width strokes
**Needs:** 103, 118 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Change a stroke's width along its length with handles on the canvas (taper, swell, calligraphic), and save width profiles to reuse. Exported as outlined paths.

**You'll see:** a line that tapers to a point at both ends.
**Done when:** profiles round-trip exactly; exported outlines match the stage within 0.5 px.

**Status check (2026-11-15), 🚧:**

**Before Lane C:** the FigCraft port already drew variable-width strokes as outlines (`stroke.widthProfile`, `variableOutline` in `core/paths/strokes.ts`). It had six presets, but only the legacy editor offered them. The new editor had no width controls, no way to save a profile, no calligraphic stroke and no handles on the canvas.

**Built (Lane C):**
- A **Swell** preset, and **calligraphic** profiles: a nib at an angle makes the stroke thick where the path runs across the nib and thin where it runs along it. The result is computed from the layer's own path into an ordinary profile.
- **Saved profiles** in the file (`widthProfiles`, an optional document field, so no migration), with save, apply, rename and delete commands.
- A **Profile** group in the stroke popover.
- **Width handles on the canvas:**
  - each width point has a handle on each side of the path, as far out as the stroke is wide there;
  - drag a handle to widen the stroke there and slide the point along the path; with Alt, only that side changes;
  - click the path to add a point, and double-click a handle to remove its point;
  - one undo step per drag.

**Verified (`widthProfiles.test.ts`, 6 tests):**
- Profiles round-trip exactly: stored text, every preset, a saved profile applied to another stroke, and the file saved and loaded through the schema.
- Calligraphic widths are correct for horizontal, vertical and circular paths.
- A tapered line renders the outliner's own outline.

**In Chromium (`variable-width.spec.ts`):**
- A tapered line, a swelling curve and a calligraphic circle export as outlines that match the stage's within **0.5 px**, as the Done-when line asks.
- Choosing "Taper both ends" in the popover works.
- Dragging a width handle on the canvas widens the stroke, and one undo brings it back.
- A profile saved under a name and applied to another line gives it the identical profile.
- The stroke, text-stroke and mesh specs and the canvas contract (41) still pass.

**Not done:**
- The handles follow the first subpath only and ignore the layer's rotation.
- A calligraphic profile does not follow later edits to the path (apply it again).
- Firefox and WebKit not run.

### Phase 120 · Brushes & pen pressure
**Needs:** 39, 119 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Pencil and brush tools that read pen pressure, tilt and speed (Pointer Events) into width profiles; smoothing; textured and pattern brushes; works with a mouse too (speed becomes width).

**You'll see:** draw with a tablet pen and get strokes that thin and thicken like ink.
**Done when:** recorded pen input produces the same paths in 3 browsers.

**Status check (2026-11-15), 🚧:**

**Before Lane C:**
- Phase 39's pencil fitted drawn samples into a path. It recorded pressure but never used it.
- The FigCraft port had stretch and scatter brushes (`stroke.brush`, `core/paths/brush.ts`) that follow a width profile.
- There was no brush tool, and nothing turned pen input into width.

**Built (Lane C):**
- `core/paths/penInput.ts` turns a stroke's samples into a width profile:
  - pressure (harder is wider), tilt (a flatter pen is wider), or speed (faster is thinner, like ink);
  - smoothed along the stroke and sampled at 32 evenly spaced points, so the same input always gives the same profile;
  - "Auto" picks pressure for a pen and speed for a mouse.
- A **Brush tool** in the Pen flyout (shortcut **B**). It stays the tool stroke after stroke, and a settings bar on the canvas sets:
  - size and colour;
  - the brush: plain, or one of the eight stretch and scatter brushes;
  - what drives the width: Auto, Pressure, Tilt, Speed or None;
  - smoothing.
- The canvas now reads every coalesced pointer sample and the pen's tilt.
- The pencil keeps a pen's pressure; a mouse's pencil stroke is unchanged.
- **Fixed:** the canvas's capture-phase tool handler also took presses on lists portaled out of it, so a Select opened from the bar couldn't be picked. Presses outside the stage's own DOM are now ignored.

**Verified (`penInput.test.ts`, 7 tests):**
- Harder is wider; the same input gives the same profile.
- A mouse uses its speed, and a fast stretch is thinner.
- A flatter pen is wider, and smoothing steadies a shaky hand.
- A brush stroke is an open, unfilled path layer with its size, profile and brush; a mouse's pencil stroke is as before.

**In Chromium (`brush-pressure.spec.ts`):**
- A recorded pen stroke (48 samples with pressure and tilt), played back as pen pointer events, gives the same path and profile twice, and both equal the recording's expected result written in the spec. CI's Firefox and WebKit projects are held to the same result.
- The settings bar sets the Ink brush and size 20.
- A real mouse drag gets a speed profile.
- Pen, tools, variable-width and the canvas contract still pass (53).

**Not done:**
- Firefox and WebKit not run locally.
- No custom brushes made from a layer.
- The preview while drawing is a thin line.

### Phase 121 · Layer effects II: glow, progressive blur, grain & frosted glass
**Needs:** 35, 114 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Inner and outer glow; progressive blur (a blur that fades in along a direction) on layers and on what is behind them; a grain overlay; and a frosted-glass preset (blur, tint, edge light). Real refraction comes with backdrop sampling in Stage 4.

**You'll see:** a header that blurs the page behind it more and more towards its top edge.
**Done when:** each effect matches its reference within 1% in 3 browsers; fallbacks draw where `backdrop-filter` is missing.

**Status check (2026-11-15), 🚧:**

**Before Lane C:**
- The FigCraft port had the engine side, as one effect list (`paint.effects`): progressive layer and background blurs drawn as stepped backdrop bands, noise, texture and CSS glass.
- The new editor's Effects rows showed only shadows and plain blurs.
- There was no glow and no fallback where `backdrop-filter` is missing.

**Built (Lane C):**
- **Glows**: an outer or inner glow is a shadow with no offset, marked `glow`, so it draws exactly as a shadow does on the stage and in the export.
- In the Effects rows:
  - Outer glow, Inner glow (Colour, Size, Spread) and **Grain** (Strength, Size);
  - a **Progressive** switch on layer and background blurs, with a start amount and a direction (stronger at the top, bottom, left or right);
  - a **Frosted glass** preset, which makes a background blur, a light tint (unless the frame has a colour), an edge light (a thin inner glow) and a little grain.
- The rows keep the effects they don't show (texture, glass, other noises).
- **Fallback:** a frame that blurs its backdrop carries `data-backdrop-fallback` and a tint at least 85% opaque. An `@supports not (backdrop-filter …)` rule shows that tint, and hides the blur bands, where the browser can't blur.

**Verified (`effectsII.test.ts`, 5 tests; `effectsModel.test.ts`, 1 test):**
- Glows round-trip and draw as zero-offset shadows.
- A progressive blur stronger at the top has 5 bands ending on the top edge.
- Grain keeps other effects; frosted glass gives the four parts and keeps a frame's own colour.
- The fallback tint and rule are rendered for backdrop blurs only.
- The rows read back what they write.

**In Chromium (`effects-ii.spec.ts`):**
- Six references over a busy backdrop match between the canvas and the exported site (outer glow 0.02%, inner glow 0.00%, progressive background blur 0.00%, progressive layer blur 0.00%, grain 0.15%, frosted glass 0.00%; budget 1%).
- The export carries the fallback rule.
- In the inspector, a row becomes an outer glow, a background blur turns progressive (5 bands on the canvas), and the frosted-glass preset makes its rows.
- The design-controls, FigCraft-port, Lane A issues and puffy-button specs and the canvas contract still pass (89).

**Not done:**
- The fallback is only on frames. Missing `backdrop-filter` can't be forced in Chromium, so the rule was checked for presence, not seen working.
- Firefox and WebKit not run locally.
- Real refraction waits for Stage 4.

### Phase 122 · Image adjustments & filters
**Needs:** 37 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Non-destructive adjustments on images and image fills: exposure, contrast, saturation, temperature, tint, highlights and shadows, a simple curve, duotone and gradient map, sharpen and blur, with presets.

**You'll see:** a duotone photo you can switch back to the original at any time.
**Done when:** every adjustment matches its reference within 1%; the original file is never changed.

**Status check (2026-11-15), 🚧:**

**Before Lane C:**
- The FigCraft port had the seven adjustments (exposure, contrast, saturation, temperature, tint, highlights, shadows) and six presets, on image fills only, drawn as an SVG filter.
- Image layers had CSS filters (`media.filter.*`) only.
- There was no curve, gradient map, duotone, sharpen or "original", and the new editor showed none of it.

**Built (Lane C):**
- A picture's **look**: a five-point tone curve (monotone, never overshoots), a gradient map (duotone is two stops), sharpen, blur, and **show original** (keeps every setting, draws none).
- It is drawn by one SVG filter after the seven adjustments, in order: colour matrix, highlights and shadows, curve, luminance and map tables, sharpen kernel, blur.
- It works on image fills (the paint's `look`) and on Image layers (`media.adjust`, `media.look`), on the canvas and in the export alike.
- Command `image.adjust` and seven look presets.
- An **Adjust** group in the Image section and the image fill popover. A slider writes one undo step when it is let go.
- `referenceImage` works the same filter out pixel by pixel.
- **The picture's file is never touched:** only these settings change.

**Verified (`imageLook.test.ts`, 6 tests):**
- The curve passes through its points and stays monotone; a duotone maps black and white to its two colours.
- The filter's steps come in order, and show original draws none.
- Sharpen and blur do what they say in the reference.
- An Image layer draws through the filter; show original sets `filter: none` and keeps the duotone.
- An image fill's look survives save and load.
- `media.src` and the paint's `src` are unchanged.

**In Chromium (`image-adjust.spec.ts`):**
- Twelve adjustments in the exported site match the reference: exposure, contrast, saturation, temperature, tint, highlights, shadows, curve, duotone, gradient map, sharpen and blur.
  - The test picture is smooth gradients with a checkered patch.
  - Each comparison is strict: a pixel counts as different when any channel is more than 8 of 255 off. **0.00% of pixels differ** for all twelve.
  - A control checks that each adjustment really changes at least 5% of the picture.
  - The 8 px border is left out, because browsers treat a blur's edge differently.
  - Shots come from the export because the zoomed, panned canvas resamples the picture. The canvas uses the same filter element.
- In the inspector, a duotone switches on; Show original gives `filter: none` and keeps it; switching back draws it again; the file is unchanged.
- The image, cutout and FigCraft-port specs and the canvas contract still pass (37 + the depth test re-run alone).

**Not done:**
- The inspector edits two-stop duotones; longer gradient maps come from presets.
- Firefox and WebKit not run locally.

### Phase 123 · Colour tools: palettes, harmony & contrast
**Needs:** 45 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Palettes from an image, harmony rules (complementary, triad, analogous), tints and shades as tokens, and a contrast check (WCAG and APCA) that suggests the nearest colour that passes.

**You'll see:** pick a photo and get a matching palette saved as colour tokens.
**Done when:** the contrast check agrees with the reference formulas on 50 pairs; suggestions always pass.

**Status check (2026-11-15), 🚧:**

**Before Lane C:** a WCAG ratio function existed (`paint/color.ts`), used for picking white or black text. There was no APCA, no suggestion, no harmony, no scale and no palette.

**Built (Lane C):** `core/paint/colorTools.ts`:
- **Contrast:**
  - the WCAG 2 contrast ratio with its levels (AAA, AA, AA large);
  - APCA Lc (APCA-W3 0.0.98G-4g constants);
  - `suggestPassing`, the nearest colour that reaches a target. It keeps the colour's OKLCH hue and chroma and moves only the lightness, searching towards black and towards white and taking the nearer passing one. The result is rounded to whole channels and checked again, so a suggestion always passes; there is none only when even black and white fail.
- **Harmony:** complementary, split complementary, analogous, triad, tetrad and monochrome, turned in OKLCH.
- **Tints and shades:** an 11-step scale (50–950) whose step nearest the base is the base.
- **Palettes from a picture:** deterministic k-means in OKLab on at most ~4,000 pixels, started from farthest-apart pixels.

All of it is saved as colour tokens named in a group (`color.savePalette`, `color.harmony`, `color.scale`). `color.fixContrast` checks against the nearest parent with a background (white when none has one).

A **Colour** section in the inspector has Contrast with Fix on text, Palette from picture on images, and Harmony and Tints & shades for any coloured layer.

**Verified (`colorTools.test.ts`, 8 tests):**
- WCAG and APCA agree with the reference formulas, written out from the specs, on 50 pairs.
- The published anchors hold: 21:1; #777 on white 4.48; Lc 106.04, −107.88, 63.06 and −68.54.
- On 50 pairs × 6 targets, every suggestion passes, a passing colour is kept, and there is no suggestion only when black and white both fail.
- Harmonies, scales and palettes are correct and the same every time; they are saved as tokens; a text on a dark card is fixed against the card.

**In Chromium (`colour-tools.spec.ts`):**
- A photo of three colour fields gives a 3-colour palette saved as `Beach palette/1–3`, with the exact colours.
- A low-contrast text shows "fail", Fix makes it pass AA, then AAA.
- A shape's colour gives a triad and an 11-step scale as tokens.

The design-coverage walker now lists the section's three button settings as quiet, each with a reason. Its remaining failures are the ones also on `main` (#102's panels).

**Not done:**
- Contrast is not checked over gradients or images behind a text.
- Firefox and WebKit not run locally.

### Phase 124 · Text on a path
**Needs:** 31, 40 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Put text along any path or shape outline (start offset, alignment, side, letter spacing) and edit it in place on the canvas. Exported as real text (SVG `textPath`); the offset can be animated once keyframes exist (Phase 66).

**You'll see:** text that follows a curve or runs around a circular logo.
**Done when:** 5 fixtures place every glyph within 0.5 px of the reference in 3 browsers; the export matches.

**Status check (2026-11-15), 🚧:**

**Before Lane C:** the FigCraft port (F8) drew text on a path as an SVG `<textPath>` with a start, a side and the horizontal alignment, and had attach, set and detach commands. The new editor had none of it, the start lived inside a JSON property (not animatable), and double-clicking a text on a path opened a flat box over the hidden curve.

**Built (Lane C):**
- A **Text on path** section: Put on path, Start, Side, Align, Spacing, Take off path.
- A start handle on the canvas, dragged along the path.
- **In-place editing:** the curve stays and updates as you type. Escape or clicking away commits one undo step, and the curve is put back as the document says.
- `typography.textPathStart`: the start as its own animatable number. The motion engine writes styles only, so it writes the start as `--ll-text-path-start` and the text moves its `startOffset` to follow it.
- The path records the layer it came from.
- **Fixed in the exporter:** SVG text is written inline. Indenting a `<text>`'s children had added white space to the words, shifting every glyph of exported text on a path.

**Verified (`textOnPath.test.ts`, 5 tests):**
- Putting text on a path records the source and the start; the drawn start follows the number, and old files read their stored start.
- The start is animatable, and `styleWrites` writes it as the CSS variable.
- Taking text off a path clears both.
- The export writes SVG text inline.

**In Chromium (`text-on-path.spec.ts`):**
- Five fixtures place **every glyph within 0.5 px** of the reference (worst 0.43 px): an open arc, a circle starting a quarter round and centred, a wave with letter spacing, a line ending at its end, and an arc on its other side.
  - The reference is independent of the browser's text-on-path layout. It follows SVG's rule (a glyph's midpoint on the path at its distance, turned to the path's direction), with prefix widths from a canvas and points from our own path geometry.
- The exported site places every glyph the same, within 0.5 px.
- In the editor: a text is put on a circle from the inspector; the start handle is dragged a quarter round; the words are edited in place, live on the curve.
- The start follows the engine's CSS variable and goes back when it is removed. This was simulated by setting the variable by hand, not by playing real keyframes.
- Text, fonts, export, stroke and canvas-contract specs still pass. Design coverage's only failures are the ten #102 controls also failing on `main`.

**Not done:**
- The text doesn't follow later edits to its source path.
- An animated start isn't in the export yet (Phase 130).
- Firefox and WebKit not run locally.

### Phase 125 · Text in shapes & typography depth
**Needs:** 38, 124 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Text that fills any shape (wraps inside a circle or a path), columns, OpenType features (ligatures, stylistic sets, tabular numbers), variable-font axes as sliders on the canvas, and styles per range of text.

**You'll see:** a paragraph that wraps inside a circle, with true small caps.
**Done when:** line breaks match the reference in 3 browsers for 5 shapes and 3 fonts.

**Status check (2026-11-15), 🚧:**

**Before Lane C:**
- The FigCraft port (F8) had OpenType feature toggles, small caps, variable-axis values and styled runs in the model and renderer. The new editor showed none of them.
- Its in-place editor offered bold, italic, underline and strike but **saved only the plain words**, so range styles were lost.
- Nothing put text inside a shape, and there were no columns.

**Built (Lane C):**
- **Text in a shape** (`text.shape`):
  - The outline is cut into 2 px rows, each keeping its widest inside span, pulled in by the inset.
  - The text lays out between two CSS floats whose `shape-outside` polygons follow the rows' left and right edges. The browser wraps live, the same on the stage and in the export.
  - The first line starts where the shape is at least six ems wide. Text that doesn't fit runs on below the shape, where the box clips it.
- **Columns.**
- A **Type details** section:
  - OpenType checkboxes, a stylistic set and small caps;
  - variable-font axes as sliders, plus an axes bar **on the canvas** over the text;
  - fill shape (with a shape selected too), inset, take out of shape;
  - columns.
- **Fixed:** the in-place editor now keeps styled ranges.

**Verified (`textShape.test.ts`, 5 tests):**
- A circle's rows are its chords; a line gets the narrowest span across its height.
- The floats follow the rows, and the text starts at the first wide-enough line.
- Pouring text into a circle draws the two shaped floats; inset and release work.
- Columns are CSS columns.

**In Chromium (`text-in-shapes.spec.ts`):** for **5 shapes** (circle, triangle, hexagon, diamond, pill) **× 3 fonts** (Arial, Georgia, Courier New), the browser's line breaks match the reference on all **161 lines**.
- The reference gives each line the narrowest span across its height, from our own geometry, and puts words on it while the line, measured with a canvas in the same font, fits. A line overshooting by less than one browser layout unit (1/64 px) still fits; one tie, Courier's 96.0156 px on a 96 px line, needed it.
- The text that doesn't fit is below the shape.
- In the editor:
  - text is poured into a circle (two `shape-outside` polygon floats);
  - tabular numbers on, ligatures off, stylistic set 3 and small caps, all checked as computed styles;
  - the weight axis is dragged to its end on the canvas bar;
  - a bold range typed in place is saved as a run;
  - two columns.
- The text-editing, fonts and typography specs (27) still pass. `new-ui-canvas` "a new picture goes into the frame" failed under three workers and passed alone. Design coverage's only failures are #102's ten controls, also failing on `main`.

**Not done:**
- No overflow marker.
- No per-range font size or family.
- Firefox and WebKit not run locally.

### Phase 126 · Icons, illustrations & stock media
**Needs:** 36 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] An icon panel with open-licence sets (licences recorded in `LICENSES.md`, Law 7), search, and insert as editable vectors; stock photo search through a provider, with attribution; everything goes into the asset store with its source.

**You'll see:** search "arrow", drop an icon in, and recolour it like any shape.
**Done when:** every inserted icon and photo has its licence and source in the asset store; the icon set is in `LICENSES.md`.

**Status check (2026-11-15), 🚧:**

**Before Lane C:** the asset store kept imported files, but not where they came from or their licence. There was no icon panel or stock search. Lucide was a dependency only for the editor's own interface icons.

**Built (Lane C):**
- **Icons & Photos**, opened from the toolbar's Image button or "Icons & Photos…" (`insert.media`).
- **Icons:** Lucide's ~4,100 icons, loaded one by one as they are shown, with a ranked search. Inserting one turns its shapes into a clean SVG (geometry only, nothing that runs or links), keeps it in the asset store and places it as editable vector layers, recoloured like any shape.
- **Photos:** Openverse's search (openly licensed images, no key). Each result shows its author and licence. Inserting one fetches the picture into the asset store and makes an image layer named after its title.
- **Every inserted icon and photo** has `source` on its asset (kind, provider, id, title, page, licence, licence link, author and author link, and Openverse's credit line), and its layers point at the asset (`asset.source`).
- Icon licences are exact: ISC, or "ISC and MIT (Feather)" for the 115 icons Lucide's licence lists as Feather-derived.
- `DOCS/INITIAL/LICENSES.md` records Lucide and Openverse. The dialog says the search words go to Openverse.
- **Fixed:** an imported icon lost its stroke width, which drew it invisible.

**Verified (`mediaLibrary.test.ts`, 5 tests):**
- The icon SVG keeps only geometry (no script, no `onclick`) and puts the stroke on each shape.
- Search ranks exact name, then prefix, then a word prefix, then containing.
- Licences per icon are right.
- Openverse results are read with licence, author and credit, and bad ones are dropped (no id, no https picture, no licence).
- An inserted icon's asset keeps its source through save and load; its layers point at it and are stroked.

**In Chromium (`icons-photos.spec.ts`):**
- Search "arrow", insert Arrow right from the Image button. Its asset has the Lucide source with "ISC and MIT (Feather)". It is recoloured in the Stroke section and the canvas draws the new colour.
- Search photos, with Openverse answered by a recorded reply. The result shows "Ana · CC BY 4.0"; inserting it gives an image layer whose asset has the full source and credit line.
- Tools and the canvas contract still pass (50).

**Not done:**
- Exported pages don't yet show credit lines (Phase 130).
- No illustration sets.
- Firefox and WebKit not run locally.

### Phase 127 · 2.5D spaces: perspective & depth
**Needs:** 27, 41 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Any frame or group can become a 3D space for its children: perspective strength and vanishing point on the canvas; each child gets depth (`transform.z`) and tilt handles; children are drawn in depth order. Real page layers, drawn with CSS 3D, so the export needs no 3D library.
- [ ] An orbit preview to look around the space; editing goes back to the flat view.

**You'll see:** tilt a group and see its cards stand at different depths.
**Done when:** stage and export match within 0.5% at 3 viewing angles in 3 browsers.

**Status check (2026-11-15), 🚧:**

**Before Lane C:** a layer could tilt in 3D on its own (`transform.perspective`, `rotateX` / `rotateY`, `translateZ`, `style3d: preserve3d`) from the Position section's More. No frame acted as a space for its children, and nothing on the canvas set a vanishing point or a depth.

**Built (Lane C):** `core/editing/spaceOps.ts` and a **3D space** section.
- **A frame or group becomes a 3D space:**
  - its perspective strength (`transform.perspective`);
  - the vanishing point (`transform.origin`, % of its box);
  - the angle it is seen from (`rotateX` / `rotateY`);
  - `preserve-3d`, so its children keep their depth.
- **Each child** has a depth (`transform.translateZ`) and a tilt.
- They are real page layers in CSS 3D (`perspective()` around the vanishing point, `preserve-3d`), drawn in depth order by the browser, on the stage and in the export alike. No 3D library.
- **On the canvas:**
  - a cross at the vanishing point to drag;
  - a depth handle beside a selected child (drag up to bring it closer);
  - an **Orbit** preview that turns the drawn space as you drag. It saves nothing, and selecting outside the space ends it and shows the space as set.
- Commands `space.make`, `space.release`, `space.set`, `space.setDepth`. Each drag is one undo step.

**Verified (`spaceOps.test.ts`, 4 tests):**
- A space draws `perspective(700px) rotateX(15deg) rotateY(-20deg)` around `transform-origin: 25% 60%` with `preserve-3d`.
- A child's depth and tilt are its own transform; there is no depth outside a space.
- Flattening clears the space and keeps the children's depth.
- Depth projects towards the vanishing point as P / (P − z) says.

**In Chromium (`space-25d.spec.ts`):**
- A space with four cards at depths −250, 0, 140 and 260, each tilted, matches between the canvas and the exported site at **three viewing angles**: 0°/0° 0.00%, 18°/−22° 0.01%, −12°/28° 0.01% of pixels (budget 0.5%).
- In the editor:
  - the 3D space switch;
  - a card's depth set to 200 in the inspector;
  - the vanishing point dragged 56 px, giving 60% 50%;
  - an orbit drag turns the drawn space 30° without changing the document, and selecting the page ends it.
- The canvas contract still passes. Design coverage's only failures are the ten #102 controls also failing on `main`.
- **Fixed on the way:** the stage's capture-phase pointer handler took the orbit drag as a marquee after the first move. The overlay's interactive parts are now marked as canvas chrome.

**Not done:**
- Selection boxes and hit areas stay flat, so a deep card is picked where it would sit flat.
- Groups inside a space don't pass depth on to their own children.
- Firefox and WebKit not run locally.

### Phase 128 · 3D arrangements for page layers
**Needs:** 127 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Arrange a group's children on a ring, dome, helix, sphere, cylinder, wall or stack, with spacing and "face the centre / face the viewer". Each item stays a real, editable layer. (Dragging and spinning them comes in Stage 4.)

**You'll see:** a ring of image cards like a 3D carousel, made in one click.
**Done when:** the 7 arrangements place items within 0.5 px of the reference; the export matches.

**Status check (2026-11-15), 🚧:**

**Before Lane C:** nothing placed layers in 3D arrangements. Phase 127 (Lane C) added the 2.5D space they stand in.

**Built (Lane C):** `core/editing/arrange3d.ts`.
- A group's children placed on a **ring, dome, helix, sphere, cylinder, wall or stack**, with a radius and spacing, each facing out, facing the centre or facing the viewer.
- The group becomes a 3D space when it isn't one. Every item stays a real, editable layer: its position, depth (`translateZ`) and turn (`rotateX` / `rotateY`) are its own properties, written once as one undo step.
- A layer draws its turn before its depth (depth runs along the turned face). So an item meant to stand at `p` facing `n` gets depth `p · n`, with the rest of `p` in its frame position. Facing out, in or at the viewer this is exact.
- Rings, helices and cylinders turn about the vertical only, so items stay upright.
- Spheres and domes use an even golden-angle spread.
- Command `space.arrange`, and an **Arrange** group in the 3D space section ("Arrange 6 in 3D" makes a carousel in one click).

**Verified (`arrange3d.test.ts`, 4 tests):**
- For all 7 arrangements × 3 facings, each item's centre, drawn as a layer draws it, lands where the arrangement says (within 0.01 px).
- A ring of 6 is upright, every 60°, at its radius; facing in it turns 180°; facing the viewer it is straight on.
- Sphere items lie on the radius and dome items on the top half; the wall is a grid; the stack goes back.
- Arranging makes the group a space and leaves each child its own layer.

**In Chromium (`arrange-3d.spec.ts`):**
- For all **7 arrangements**, eight cards in a space seen at 10°/−15° with perspective 1200 land **within 0.5 px of the reference** (worst 0.000 px).
  - The reference is each card's corners projected by CSS 3D's matrices (the space's perspective and view about its vanishing point, then the card's turn and depth about its centre), worked out apart from the browser.
- **The exported site places every card the same** (within 0.5 px).
- From the inspector, "Arrange 6 in 3D" turns six image cards to 0°, 60° … 300° at depth 300, and each card is still selectable with its depth shown.
- Design coverage lists the Arrange settings and the Orbit preview as quiet, with reasons; its remaining failures are #102's ten controls, also on `main`.

**Not done:**
- No dragging or spinning the arrangement (Stage 4).
- Items keep their own size rather than fitting the arrangement.
- Firefox and WebKit not run locally.

### Phase 129 · Depth camera & parallax preview
**Needs:** 127 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] A frame gets a camera: pan, dolly and focus; layers further away move less (parallax comes from depth, not from per-layer settings); depth-of-field blur by distance. Drag the camera to preview. Stage 4 binds it to scroll and the cursor.

**You'll see:** set a depth on each layer and drag the camera to see the scene parallax.
**Done when:** layer offsets match the projection formula at 10 camera positions; the export matches.

**Status check (2026-11-15), 🚧:**

**Before Lane C:** there was no camera. Phase 127 (Lane C) made a frame a 2.5D space.

**Built (Lane C):**
- **A space gets a camera:**
  - pan (`camera.x` / `camera.y`), dolly (`camera.z`), focus depth (`camera.focus`) and aperture (`camera.aperture`, px of blur per 100 px from the focus);
  - moving the camera moves the world the other way: one `translate3d` on the space after its view angle, so layers further away move less. Parallax comes from depth, not from per-layer settings.
- **Depth of field:** the space passes its camera to its children through the render context, on the stage's path and the export's alike. Each child blurs by |depth − focus| × aperture ÷ 100.
- **Drag the camera:** with "Drag camera" on, a drag over the space pans the camera, and with Shift, up dollies in. One undo step per drag.
- The inspector's Camera group has Pan X, Pan Y, Dolly, Focus and Aperture.
- Command `space.setCamera`, and `cameraProject` (the projection formula).

**Verified (`camera.test.ts`, 3 tests):**
- The space draws `perspective(800px) translate3d(-40px, 20px, 100px)`.
- The formula: near layers move more than the pan and far ones less; a dolly brings things closer.
- Depth of field: −350 px from a focus at 150 with aperture 2 is `blur(10px)`; in focus is sharp; aperture 0 is all sharp.

**In Chromium (`depth-camera.spec.ts`):**
- Five cards at depths −600 … 300: at **10 camera positions** (pans and dollies, alone and together) every card's centre matches the projection formula **within 0.5 px** (worst 0.000 px).
- The exported site places them the same (within 0.5 px) and blurs each card by the same amount; on the canvas the blur is `blur(9px)` at −600 with aperture 1.5, and none at the focus.
- A camera drag on the canvas pans (−60, −20) as one undo step.
- The 2.5D space and arrangement specs, the canvas contract, export, effects, strokes and FigCraft-port specs still pass (66). Design coverage's only failures are #102's ten controls, also on `main`.

**Not done:**
- Binding the camera to scroll and the cursor (Stage 4).
- The camera's numbers aren't drawn by the motion engine yet, since they aren't CSS properties of their own.
- Firefox and WebKit not run locally.

### Phase 130 · Design-depth export
**Needs:** 49, 108, 111, 112, 125, 128, 129 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] The Phase 49 exporter covers everything in this stage: boolean groups, modifiers and generators baked to SVG paths; fill stacks with blend modes and masks; noise, pattern, mesh and live fills; strokes, width profiles and brushes; effects; text on paths and in shapes; 2.5D spaces as CSS 3D. Anything that can't be exact is listed as a warning.

**You'll see:** export a design that uses all of it and it looks the same in the browser.
**Done when:** the HTML parity gate (≤ 0.5% at 5 widths) passes on a fixture using every feature of this stage; the export harness is green for Next, Vite and HTML.

**Status check (2026-11-15), 🚧:**

**Before Lane C:** the Phase 49 exporter already drew every layer with the stage's own render definitions. Each Stage 3 phase checked its own feature against the export as it was built. Nothing exported a page using all of them together, nothing listed what can't be exact, and stock photos' credits weren't written.

**Built (Lane C):**
- **The design-depth fixture** (`tests/export-harness/design-depth-fixture.ts`): one page using every Stage 3 feature, made with the editor's own operations. It covers:
  - a live boolean group, a scooped corner, modifiers and a generator;
  - a fill stack with blend and mask, noise, pattern, mesh and live fills;
  - text strokes, a stroke stack, a taper and a brush;
  - a glow, a progressive blur, frosted glass and grain over a busy backdrop;
  - a duotone image;
  - text on a path, in an ellipse, in columns and with OpenType;
  - a 2.5D space arranged as a ring with a depth camera and depth of field.
- **Warnings** (`core/export/site/designDepth.ts`) for what an exported page can't do exactly, only when the page uses it:
  - progressive blurs in 5 steps;
  - glass without refraction;
  - mesh gradients at a fixed resolution;
  - the `backdrop-filter` fallback;
  - animated text-path starts and cameras exported at rest;
  - 3D spaces clicked flat.
- **Photo credits:** a CREDITS.md file in the exported site, plus a credits line on plain HTML pages, as CC BY asks. On the React targets, a warning says where the credits are.
- **The export harness** builds the fixture page for Next.js and Vite, and checks its plain HTML carries every feature's construct and its warnings.

**Verified (`designDepth.test.ts`, 3 tests):**
- Warnings appear only for features in use.
- Credits are written to a CREDITS.md file in the exported site and as an HTML line.
- The fixture's export carries every construct: boolean path, `<textPath>`, `shape-outside` polygons, `preserve-3d`, the image filter, `<foreignObject>`, `<mask>`, columns.

**In Chromium (`design-depth-export.spec.ts`), the HTML parity gate:**
- The canvas's own markup for the fixture page and the exported page differ in **0.00% of pixels at 1440, 1024, 768, 480 and 375 px**, for the whole page and for each of the 23 features' boxes (budget 0.5%).
- The page was checked by eye: every feature draws.

**Export harness:**
- The fixture page typechecks and builds for **Vite** and **Next.js**. This was run locally through a shell, because the harness's `spawnSync("npm")` can't start `npm.cmd` on Windows; every harness build fails locally that way, including the ones that pass in CI.
- Its plain-HTML check passes.
- CI's export-harness job runs all three on Linux.

The Phase 49 export spec, text-on-path and icons-and-photos still pass.

**Not done:**
- Animated text-path starts and camera moves are exported at rest (named in the warnings).
- Firefox and WebKit not run locally.

### Phase 131 · Stage 3 gate: the design-depth journey
**Needs:** 103–130 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] **Journey A (Illustrator user):** a logo built with the Shape Builder and live booleans, smooth corners, a repeater and a wiggle, a conic gradient over an image with a mask, a variable-width stroke and text on a path around it.
- [ ] **Journey B (Web designer):** a hero with mesh and noise fills, a progressive-blur header, a 2.5D ring of cards and a depth camera, exported to Next, Vite and HTML with parity checked.

**You'll see:** vector, paint and type tools past Figma's and Illustrator's, all non-destructive.
**Done when:** the journeys pass in CI in 3 browsers, plus one recorded manual run.

**Status check (2026-11-16), 🚧:**

**Built (Lane C):** `tests/e2e/stage3-gate.spec.ts`, the two design-depth journeys. Each is a user's path through the editor: inspector sections, popovers, buttons and the canvas where they exist, the command bus for the rest.

- **Journey A (an Illustrator user), a logo:**
  - two shapes' overlap merged with the Shape Builder;
  - a live boolean group (a ring cut from a disc, its operands kept);
  - smooth corners;
  - a repeater and a wiggle on a star;
  - a conic gradient over a picture through a mask;
  - a variable-width stroke ("Taper both ends" from the stroke popover);
  - text put on a path around a circle from the Text on path section.
- **Journey B (a web designer):**
  - a hero with a mesh gradient and grain;
  - a header made a progressive background blur in the Effects section (5 bands on the canvas);
  - six cards arranged into a 3D ring with "Arrange 6 in 3D", and the depth camera panned and given an aperture in the inspector;
  - exported to Next.js, Vite and plain HTML, each with the 3D space and the warnings;
  - the HTML export checked against the canvas's own markup at 1440, 1024, 768, 480 and 375 px: **0.00% of pixels differ at every width** (budget 0.5%).

**Fixed (found by the journeys):** `paint.setFills` and `paint.setStrokes`, called through the command bus with their schema, refused Stage 3's paints (noise, pattern, mesh and live fills) and dropped `mask`, `weight` and `align`. Agents and scripts couldn't set them; the inspector writes paints directly, so it wasn't affected. Both commands now take them and store each list as the renderer reads it. `registerEditingCommands` no longer needs a browser (the clipboard events are installed only where there is one), so the commands can be tested in Node.

**Verified:**
- `paintCommands.test.ts` (3 tests): a masked conic, noise, mesh and live fill; strokes with their own weight and position; nonsense refused.
- In Chromium, both journeys pass.
- The rest of Lane C's specs and the canvas contract pass with them: see the PR for the full run.

**Not done:**
- **Firefox and WebKit:** the journeys have run only in Chromium here; CI runs all three.
- **The recorded manual run** the Done-when line asks for has not been made. It needs a person at the editor.
- Every Lane C phase stays 🚧 until CI passes on `main`.

---

# SURFACES TRACK — pulled forward (Phases S1–S8)

> **v5 (2026-11-14):** this track is scheduled by the release plan (§2). S1 – S9 are package R3.1, and they are frozen until R3 is the active release.

> **Why here (2026-11-11, Lane A, by the project owner's priority):** the glossy "inflated" button (the collectui reference) can't be made from fills and shadows: it is light on a curved, creased surface that dents where it is pressed. These eight phases pull forward small, generic parts of Phases 175 (distance fields), 182 (surfaces and lights), 223 (inflate) and 75/179 (displacement), and add three pieces no phase had: surface creases and wrinkles, pointer-driven surface physics, and a one-step reference image. They work on any shape or frame, not only buttons. They keep their **S** numbers so the 277 phases are not renumbered; when Stage 4 is built, 175/182/223 extend these instead of starting again. Rendering: one shared WebGL2 context for every surface, drawn into each surface's own 2D canvas (`DOCS/INITIAL/decisions/0018-surface-rendering.md`), so Law 13 holds until the Phase 173 compositor takes over. Stage 4+ is not assigned to a lane; Lane B is told in the PR.

### Phase S1 · Reference image
**Needs:** 36 · **Status:** 🚧
- [x] **File > Place reference image** and Alt+drop: a picture placed behind everything on the page at 50% opacity, locked, and a helper (never exported, hidden in Preview). Its opacity and "on top / behind" are switches in the inspector.

**You'll see:** a screenshot of what you're copying, under your design, that never ships.
**Done when:** a placed reference is behind, locked, half transparent, absent from the export and from Preview.

### Phase S2 · Surfaces: height from the shape
**Needs:** S1 · **Status:** 🚧
- [x] Any frame or shape can be a **surface** (`surface.mode`: flat or inflated). Inflated: its height is a pressurised membrane fixed at its edge (a Poisson solve over the shape's mask, `src/core/surface/`), with **Depth** and **Fullness**. Drawn by one shared WebGL2 context into a canvas in the layer's box.

**You'll see:** any rounded rectangle becomes a pillow.
**Done when:** the solved height matches the analytic membrane on a circle within 1%; 20 surfaces share one WebGL context.

### Phase S3 · Surface material & light
**Needs:** S2 · **Status:** 🚧
- [x] Materials (Foil, Plastic, Satin) lit by a studio environment (a softbox above, a floor below), with gloss, Fresnel rim and edge occlusion. The colour is the layer's fill.

**You'll see:** black foil, white plastic, satin, on any shape.
**Done when:** a resting frame of the reference button is judged a match by a person, side by side.

### Phase S4 · Creases & wrinkles
**Needs:** S3 · **Status:** 🚧
- [x] Where an inflated surface runs short of material it buckles: diagonal creases from each corner along the shape's medial axis, and short wrinkles across the edges, seeded, with **Wrinkles**, **Wrinkle size**, **Creases** and **Seed**.

**You'll see:** the corners of a pillow pinch and its edges crinkle.
**Done when:** the same seed draws the same wrinkles every time; a person can't tell the resting button from the reference.

### Phase S4b · Cloth simulation of the resting shape
**Needs:** S4 · **Status:** 🚧
- [x] The resting shape by simulation: an inextensible sheet with a little extra material (**Wrinkles**), sealed at a seam that stays put or pulls in (**Seam**), inflated by pressure (position-based dynamics: stretch, shear, a weak bend, pressure along the normal). Run in a worker, cached; the quick membrane shows until it's in (`src/core/surface/cloth.ts`, `cloth.worker.ts`). The pleats at the seam and the pinched ends come from the physics, not from a pattern.

**You'll see:** pleats where the material runs short, as on a real foil balloon.
**Done when:** the reference's resting frame is judged a match side by side.

### Phase S3b · Studio light
**Needs:** S3 · **Status:** 🚧
- [x] The surface reflects a studio (an environment map made in code: a large softbox above-left, a strip light, side strips, a dark floor), blurred by the material's gloss (mipmaps), with Fresnel. Replaces the three hand-tuned light zones.

### Phase S9 · The 3D face of the inspector
**Needs:** S4b · **Status:** 🚧
- [x] A **2D | 3D** switch at the top right of the right panel. 2D is the Figma-style settings; 3D is the same layer's surface settings: **Looks** (Foil balloon, Pillow, Glossy plastic, Soft satin, Flat: one click, sized to the layer, finishing it with corners, a shadow and centred content), **Shape** (Cloth or Quick, Depth, Wrinkles, Seam, Detail, Shuffle), **Material & light** (Foil, Plastic, Satin, Gloss), **Press** (Dent depth and size, Springiness, Text pull), **Reference**.

**You'll see:** the inflated button in 7 steps with only buttons and keys (`scripts/demo-balloon-steps.ts`).
**Done when:** a person makes the reference button in 8 steps or fewer.

### Phase S5 · Content on a surface
**Needs:** S4 · **Status:** 🚧
- [x] A surface frame draws its text children onto itself: printed on the surface, lit with it and warped with it. The text stays real text (selectable, read by screen readers, editable).

**You'll see:** a label that bends with the button.
**Done when:** the text is still in the accessibility tree once, and follows a dent.

### Phase S6 · Surface physics: press and ripple
**Needs:** S5 · **Status:** 🚧
- [x] A damped membrane on the surface's grid: pressing pushes it in at the pointer, releasing lets it spring back with a ripple, the rest of the surface rises a little (the air goes somewhere), and wrinkles gather round the dent. **Stiffness**, **Damping**, **Dent depth**, **Dent size**. In Preview and on the exported site; never takes the pointer in Design (§10).

**You'll see:** the button dents where you press it.
**Done when:** a replay of the reference's presses, side by side with the video, is judged a match by a person.

### Phase S7 · Surfaces in the export
**Needs:** S6 · **Status:** 🚧
- [ ] The exported site ships a small surface runtime (the same core and shader) and a still image for browsers without WebGL2.

**You'll see:** the button works the same on your exported site.
**Done when:** the export test presses an exported surface and sees the dent; with WebGL off it shows the still.

### Phase S8 · Reference comparison harness
**Needs:** S6 · **Status:** 🚧
- [x] Replays a reference video's input track (pointer path and presses) against a design, records it frame for frame, and builds a side-by-side page (both videos in sync, paired stills, a similarity score per frame).

**You'll see:** the reference and ours, side by side, frame for frame.
**Done when:** the reference button's comparison page is published and its score is recorded.

---

# DESIGN MASTER TRACK — pulled forward (Phases D1–D21)

> **v5 (2026-11-14):** this track is scheduled by the release plan (§2), not by the D number. D22 – D24 are in R0; D3 – D15 and D18 are in R1; D19 – D21 are R4; D16 and D17 are in Later (theme L2, the photo studio).

> **Why here (2026-11-13, Lane A, by the project owner's priority):** the Design panel is about a fifth of what it must be (estimate of 2026-11-13: about 26% built and reachable, about 23% counting the controls that do nothing). The goal is a master tool for the most complex website animations, built by combining a few blocks: **drivers** (scroll, pointer, speed), **relationships** (parent, follow, links, opposite), **repeat** (cloners and effectors), **break apart** (split text, explode models), **choreography** (scroll scenes), **effects** (speed), **tracking**, and **code freedom** (write any CSS). The test is the watch page (D21). Like the Surfaces track, this track is **pulled forward** ahead of the number order. Numbered phases it takes over say *→ Design track D…* in the index. Lane B's phases in it (D11, D12, D15, and Main 99 for D17) stay Lane B's: agree before Lane A builds any of them.

**Order:** D1 → D21. Lane B's items (D11, D12, D15) can run in parallel with Lane A's D3 – D10. `npm run check:design-track` checks this table against the entries.

| # | Phase | Was | Needs | Lane | Status |
|---|---|---|---|---|---|
| | **Wave 0 · Make it work** |||||
| D1 | Make every Design control work | the owner's Lane A test file (LA-001 – LA-035) | — | A | ✅ |
| D2 | Control coverage test | new | D1 | A | ✅ |
| | **Wave 1 · Freedom & relationships** |||||
| D3 | Style code: write any CSS for a layer | new | D2 | A | 📋 |
| D4 | Drivers: scroll, pointer, speed and time for any property | ROADMAP_3D 3D-044 – 3D-047, 3D-197 (Main 132 – 138) | D2 | A | 📋 |
| D5 | Parenting, pick-whip & expressions in the new editor | wiring Main 73, 76, 77 (Lane B's engine, merged) | D2 | A | 📋 |
| D6 | Follow, pins & helpers | Main 152 | D5 | A | 📋 |
| D7 | Connect anything | Main 141 | D4, D5 | A | 📋 |
| | **Wave 2 · Repeat** |||||
| D8 | Repeater | Main 110 (the repeat part) | D2 | A | 📋 |
| D9 | Cloner: grid, radial, line, path, fill | Main 154 | D8 | A | 📋 |
| D10 | Fields & effectors | Main 157 | D9, D4 | A | 📋 |
| | **Wave 3 · Scroll & choreography** |||||
| D11 | Scroll scenes: pin, scrub, snap | Main 81, 82 | D4 | A | 📋 |
| D12 | Split text & text motion | Main 83, 84 | D2 | A | 📋 |
| D13 | Scroll-scrubbed image sequences & video | Main 188 | D11 | A | 📋 |
| D14 | Smooth scroll & depth parallax | Main 189, 190 | D11, D4 | A | 📋 |
| D15 | States: hover, press, focus choreography | Main 78 | D2 | A | 📋 |
| | **Wave 4 · Tracking & speed** |||||
| D16 | Corner pin & perspective placement | ROADMAP_3D 3D-204 | D2 | A | 📋 |
| D17 | Tracking & parent to track | ROADMAP_3D 3D-205, 3D-206 (needs Main 99, video layers: taken over by Lane A on 2026-11-14) | D16, D5 | A | 📋 |
| D18 | Speed effects | Main 144 | D4 | A | 📋 |
| | **Wave 5 · 3D parts** |||||
| D19 | 3D model parts & explode | new (uses ROADMAP_3D 3D-158 import, 3D-033 materials, 3D-037 lights) | D4, 3D-158, 3D-033, 3D-037 | A | 📋 |
| D20 | Labels that follow 3D parts | new | D19, D6 | A | 📋 |
| | **Gate** |||||
| D21 | Gate: the watch page | new | D1 – D15, D18 – D20 | A | 📋 |
| D22 | Variables, tokens & styles manager in the new editor | Main 45, 47 (core exists; no panel) | D1 | A | 📋 |
| D23 | Variants & instances in the new editor | Main 46, 47 (core exists; authoring UI missing) | D1 | A | 📋 |
| D24 | Open and save a project file from the new editor | Main 3, 36 (core exists; no UI) | D1 | A | 📋 |

## Wave 0 · Make it work

### Phase D1 · Make every Design control work
**Needs:** — · **Was:** the owner's Lane A test file (LA-001 – LA-035) · **Lane:** A · **Status:** ✅
- [ ] Fix the issues still open in the owner's test file: LA-003, 006, 007, 009, 010, 015, 017 – 022, 027, 028, 034, 035 (padding, margin, flex grow, overflow, fill opacity, blur effects, cursor, tooltips, scrubbing while focused, line shadow…).
- [ ] Reachability audit of the new editor: components and variants, tokens and styles, breakpoints, pages, pen tools. Anything still only in the legacy editor is wired, or gets a D-phase.

**You'll see:** every control in Design visibly changes the canvas.
**Done when:** each listed issue has a passing test; the audit list is empty or every item has a phase. *(Met on 2026-11-13; ✅ once it is on `main`.)*

**Status check (2026-11-13), 🚧:** every listed issue now has a passing Chromium test in `tests/e2e/design-controls.spec.ts` (17 tests): LA-003, 006, 007, 010, 015, 017, 018, 019, 020, 021, 022, 027, 028, 034, 035. Most were already fixed in code and only needed proof; LA-021 and LA-009 got real fixes (blend, cursor and overflow options have descriptions; every segmented control shows its label as a tooltip). LA-009 is a usability note: the row under text alignment is the Case row (it has a label); its choices now have tooltips, and there is no functional test for it.
**Reachability audit (from the source, not a click-through):** reachable in the new editor: create component, pages, pen tool, export, templates, breakpoints (device views), asset drop. **Gaps still to wire:** (1) a tokens / variables / styles manager (Phases 45 and 47 exist in core; no panel in the new editor), (2) authoring variants and detaching an instance, (3) opening and saving a project file from the UI. These three now have their own phases, D22, D23 and D24 (Wave 6), so the audit list has no unowned items.

### Phase D2 · Control coverage test
**Needs:** D1 · **Was:** new · **Lane:** A · **Status:** ✅
- [ ] A generated test walks every control of the Design panel (the panel has no config, so it walks the page: open each "More … options" section for a fixed set of layer types, collect inputs, selects, segmented controls and toggles by their labels, set each to a non-default value) and checks that it changes the document, the canvas and the export. A short exclusion list, with a reason for each entry, covers editor-only controls.
- [ ] A control that does nothing fails CI, so "dead controls" cannot come back.

**You'll see:** a coverage line in CI: "Design controls: 214 of 214 change the page".
**Done when:** 100% of the listed controls pass in Chromium; a deliberately dead control fails the run.

**Status check (2026-11-13):** the walker is `tests/e2e/design-coverage.spec.ts`: for a rectangle, a frame, a text and a line it drives every labelled input, select, segmented control and toggle in the Design panel (and its "More … options" sections) and prints a coverage line, e.g. "Design controls (frame): 16 of 16 change the document". **Result: no dead controls on those four layer types** (18, 16, 23 and 19 controls), and a test proves that a control that changes nothing fails the run. The Done-when is met for those four layer types (✅ once it is on `main`). **Follow-ups, not blocking:** (a) some controls change the document but not (or not in a way the walker's canvas check reads) the canvas or the export: cursor and pointer events, corner radius on text, word spacing, white space, font loading, divider dash offset and style, the three radius fields; each needs a look, to fix the control or to widen the check. (b) Image and 3D layers are not walked yet.

## Wave 1 · Freedom & relationships

### Phase D3 · Style code: write any CSS for a layer
**Needs:** D2 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] A **Style code** box per layer (and per state and breakpoint): write declarations as in a stylesheet. Known properties become the normal controls, both ways; unknown ones are kept as custom, validated, and exported as written. CSS variables, `calc()`, autocomplete, inline errors.
- [ ] Safe: no selectors that leak out of the layer, no script, sanitised like code components (Main 195).

**You'll see:** type `padding: 24px; backdrop-filter: blur(8px)` and the Padding control shows 24.
**Done when:** 50 declarations round-trip (code to controls to code); unknown ones export unchanged; a hostile declaration is refused with a message.

**Status check (2026-11-14), 🚧:** built: `src/core/style/styleCode.ts` (parse, validate, split into controls and custom, compose, patch), the `style.custom` property, the canvas and export drawing it (`layerBoxStyle`), the **Style code** section in the Design panel, and **autocomplete** (`cssSuggest.ts`: property names, and values for properties with known options; choosing one does not apply half-typed text). Verified: a 50-declaration round trip, unknown declarations kept unchanged on the canvas and in the export, hostile ones refused with a line and a message (31 unit tests, 5 Chromium tests in `tests/e2e/style-code.spec.ts`). The Done-when is met. **Still to build:** Style code per **state**: the new editor's States panel is a static prototype not yet connected to the document's states (those are Lane B's Phase 78, D15), so a per-state box has nothing to write to yet; per-breakpoint goes through the normal writer but is not tested; `calc()` and CSS variables are accepted and kept but have no helper UI. D3 turns ✅ when per-state is done and it is on `main`.

### Phase D4 · Drivers: scroll, pointer, speed and time for any property
**Needs:** D2 · **Was:** ROADMAP_3D 3D-044 – 3D-047, 3D-197 (Main 132 – 138) · **Lane:** A · **Status:** 📋
- [ ] Built here first, for 2D and 3D: the input bus, the signal catalogue (scroll progress of a section, the pointer anywhere on the page, velocity, time, visibility, tilt), input tapes for tests, and the bindings runtime.
- [ ] Shaping: range, smoothing, spring, invert.

**You'll see:** a **Driven by** menu on any property: Scroll, Pointer, Speed, Time.
**Done when:** the same input tape gives the same values in the editor and in the export; drivers cost nothing when unused.

**Status check (2026-11-14), 🚧:** **working end to end for the pointer, scroll and time, in the editor and in the plain HTML export.** Built: the engine (`src/core/bindings/`: evaluator with every operator in the spec's catalogue except `trail`; runtime with guards, blending, range clamps and the `SIG_LAYOUT` refusal; input tapes with a seeded autopilot pointer; the input bus), add/update/enable/remove commands and the **typed commands** `layer.addDriver`, `layer.removeDriver`, `layer.setDriverEnabled` (palette, shortcuts and the agent bridge reach them; a driver is written in the binding grammar), the kernel taking `inputs.bound` (so `evaluate` stays pure), the stage engine's `BindingDriver` (idle, so free, when no driver is on; bound layers stay on the kernel adapter), a pointer **and scroll** source on the new canvas (a previewed frame's own scroll; the engine runs while a frame previews), and the **Driven by** section. **The export** (`src/core/export/runtime/drivers.ts`): a standalone readable script with only the operators the project uses, no imports, honouring reduced motion; layers it moves carry `data-ll`; it applies results with CSS `translate`, `rotate`, `scale` and `opacity`, which compose with the layer's own transform. Verified: 79 unit tests, **parity: 20 drivers over 6 s at 60 fps, every frame equal to the editor's evaluator to 1e-9, and the export's input bus equal to the editor's on every signal it serves**, and Chromium tests (`tests/e2e/drivers.spec.ts`, 11 tests): the real mouse moves a layer in the editor and in an exported page opened from disk, scroll turns a layer 0° to 90° in a previewed frame, reduced motion keeps the export still, a project with no drivers exports no script. **`view(layer)`** (how far a section has scrolled through the screen, and how much of it shows) is served in the editor and in the export, chosen in Driven by as **Section in view**, with hand-computed tests at six scroll positions, export parity (22 drivers) and a Chromium test that a layer turns with a real section's position in the editor and in an exported page. **Also served, in the editor and in the export (hand-computed bus tests, export parity over 27 drivers, and a Chromium test that a layer grows under the pointer in the editor and in an exported page): `pointer.inside(layer)`, `hover(layer)` and `press(layer)` (eased over 80 ms), and `proximity(layer)` (distance to the edge, or the centre); chosen in Driven by as **Pointer over a layer** and **Distance to a layer**.** **CSS variable targets** (`hero.cssvar.glow` sets `--glow` on the layer) work in the editor (a writer that takes the variable off again when the driver or Motion stops) and in the export (parity-tested over 181 frames, priority included; a Chromium test follows the pointer in both). **Still to build:** (1) signals `device` (tilt), `audio` and `focus` (they read 0, and the panel flags them); (2) the export carries property drivers on one layer with blends add and multiply, for X, Y, rotation, scale and opacity, for the **plain HTML target**, and as the same script in `public/` linked from `index.html` (Vite) or the root layout (Next.js), **written and tested as files and tags but not run in a Vite or Next build here**; other targets, other blends, guards, `spring` shaping of other types such as `curve`, `threshold`, `toggle`, `select` and the other target kinds (CSS variables, uniforms, parameters, group and tag targets) are skipped **with a warning that names each**; (3) the menu is a section for the selected layer with five properties, not yet a menu on every property (that is D7).

### Phase D5 · Parenting, pick-whip & expressions in the new editor
**Needs:** D2 · **Was:** wiring Main 73, 76, 77 (Lane B's engine, merged) · **Lane:** A · **Status:** 📋
- [ ] Parent any layer to another, including helper (null) layers; drag the pick-whip from one property to another; type an expression. Lane A wires the UI on Lane B's engine, as the wire-53–71 PRs did.

**You'll see:** link a ring's rotation to the watch's at × −1 and it turns the other way.
**Done when:** a parented layer keeps its place; links and expressions evaluate the same in the editor and in the export; Lane B's engine tests still pass.

**Status check (2026-11-14), 🚧:** the new editor reaches Lane B's engine through a **Parent & links** section (`ParentLinksSection.tsx`): a Parent picker (helpers included; the current parent stays in the list), a link form (property, layer, its property, a map, **Opposite** in one click, and **Pick on canvas**) that runs `layer.setLink`, an expression box that runs `layer.setExpression`, a list of both with remove, a **Helper layer** toggle, and the engine's own refusals shown (`[LINK_CYCLE]`, a bad expression with its position). Verified in Chromium (`tests/e2e/parent-links.spec.ts`): a ring linked to a watch turned by an expression turns the other way (-60 against +60 at 1.5 s); a cycle is refused with a message; a bad expression says why; parenting keeps the layer where it is, and so does clearing the parent. Lane B's engine tests still pass. **The export (plain HTML target) now carries links and expressions** (`src/core/export/runtime/drivers.ts`): the page script embeds the core's own expression evaluator (generated from `src/core/expressions` by `npm run build:export-runtime`, with a test that fails if it is stale), ships each expression as its parsed tree, and works values out the way the kernel does (a link carries what it reads through its map, an expression sees that as `value`, `ref` and `refAtTime` read other layers, a cycle stops at the property's own value). **Verified: 20 links and expressions on 18 properties, every value at 61 time steps equal to the kernel's to 1e-9; the same combined with drivers over 181 frames; the generated evaluator equals the core's on 17 expressions x 41 contexts; and an exported page, opened from disk, turns the watch and the ring the opposite way (reduced motion: as designed).** The Done-when is met for the five exportable properties. **Not done:** (1) a true **drag** (this is click-to-pick and a form); (2) five properties are offered (X, Y, rotation, scale, opacity, as motion offsets, not the design values the inspector fields write); (3) **curve** link maps, links and expressions on other properties, and layers also animated by a clip (the export names each, with a warning); (4) creating a helper (null) layer from the new editor, as opposed to making an existing one a helper.

### Phase D6 · Follow, pins & helpers
**Needs:** D5 · **Was:** Main 152 · **Lane:** A · **Status:** 📋
- [ ] Follow a layer or a point with offset, delay and smoothing; look-at; **pin to a point on an image**, so a label moves and scales with the image.

**You'll see:** a label stays on the watch's crown while the image zooms.
**Done when:** pinned points stay within 0.5 px through 10 different transforms.

**Status check (2026-11-14), 🚧:** built on D4 and D5. **Pins:** a label parented to an image where it sits stays on that point: `src/core/kernel/__tests__/pinThroughTransforms.test.ts` checks 10 transforms (moves, rotations, scales, skews, three origins) to within 0.5 px, plus a control that a label 10 px off is caught. This is the Done-when. **Follow:** `src/core/bindings/follow.ts` builds the two drivers (X and Y) from the layer's measured box: a pin (the nine preset points), a lag, an offset; the **Follow** form in Driven by makes them as one undo step, and replaces them as one. **It works on a turned and scaled layer**: the pin is the layer's own point carried through its rotation and scale (hand-computed at 9 poses), and because the engine puts a layer's frame rotation outermost, the page-space move is expressed in the layer's own turned axes (verified at 6 pose combinations x 9 pins to 1e-6, and in Chromium: a layer turned 90 degrees has its right-hand point land on the mouse). **Look at the pointer:** a new operator `lookAt(x, y)` (the angle from a point to a vector; in the schema, grammar, evaluator and export) and a one-click preset that turns the layer to face the pointer (hand-computed at the eight compass directions, and a Chromium test at five). **Helpers:** a **Helper layer** toggle in Parent & links; a helper is drawn while designing and absent from the export (tested). **Not done:** (1) Follow follows the pointer only, not another layer or a point; (2) no scale by speed, bounds, leave behaviour or touch and reduced-motion policies beyond the export's reduced-motion rule; (3) the pin dots are a menu, not clickable dots on the canvas; (4) a helper cannot be created fresh from the new editor, only an existing layer made one.

### Phase D7 · Connect anything
**Needs:** D4, D5 · **Was:** Main 141 · **Lane:** A · **Status:** 📋
- [ ] Drag any property onto a driver or onto another property; map ranges; multiply; one click for "opposite".

**You'll see:** drag Rotation onto Scroll and the layer turns as the page scrolls.
**Done when:** 20 connections evaluate identically in the editor and in the export.

**Status check (2026-11-14), 🚧:** the D5 form covers what D7 names: **Map** (Times, or Range: one span of values onto another, held at the ends), a one-click **Opposite**, and **Pick on canvas**. Verified in Chromium: Opposite turns the ring -60 against the watch's +60 at 1.5 s; a range maps the watch's rotation 0..120 to the ring's opacity 0..1 (0.5 at 60, held at 1 past the end); and **20 connections evaluate identically in the editor and in the export** (see D5: every value equal to the kernel's to 1e-9, and a real exported page). The Done-when is met. **Not done:** (1) a true **drag** of a property onto a driver or onto another property; (2) linking **a driver** from another property; (3) only five properties are offered.

## Wave 2 · Repeat

### Phase D8 · Repeater
**Needs:** D2 · **Was:** Main 110 (the repeat part) · **Lane:** A · **Status:** 📋
- [ ] Repeat a layer N times with a step in position, rotation, scale and opacity, like After Effects' Repeater. Trim, offset and round stay in Main 110.

**You'll see:** one petal becomes a flower of 12.
**Done when:** golden positions for 10 settings; one undo step per change.

**Status check (2026-11-14), 🚧:** built: the `repeat.*` properties (count, step X and Y, turn, scale, fade), `src/core/render/repeater.ts` (pure; copy 0 is the layer, copy i is stepped by i, turn and scale about its own centre), the renderer drawing the copies as editor-only wrappers (`data-repeat-copy`), and the **Repeat** section in the Design panel. Verified: golden positions for 10 settings, hand-computed (`repeater.test.ts`, 15 tests), and Chromium tests (`tests/e2e/repeater.spec.ts`): 5 copies at the right positions, rotation, scale and fade steps drawn, the export carries the copies and the steps and none of the editor's marks, one undo step. The Done-when is met. **Copies follow the layer's animation in the editor** (the stage writes the layer's animated style to each copy, up to 600 copies; verified in Chromium with an expression-driven rotation: the copies turn together, or each behind the last with a delay, and are as drawn again in Design). **Not done:** the static export has no clip or animation playback at all (Lane B's Phase 94), so exported copies are the design look, plus the drivers and effectors the page script runs on the layer itself; not for layers inside an auto-layout frame (the panel says so); Main 110's trim, offset and round stay in Main 110; the mesh-warped layer draws no copies.

### Phase D9 · Cloner: grid, radial, line, path, fill
**Needs:** D8 · **Was:** Main 154 · **Lane:** A · **Status:** 📋
- [ ] Rows × columns, a ring, a line, along a path, or **fill an area** (as many copies as fit at a spacing). Each copy knows its index, for links and expressions.
- [ ] The export picks the cheapest form: a static dot grid becomes one CSS background line, a few copies become elements, thousands of animated copies become one canvas.

**You'll see:** draw a dot, choose Clone > Fill area, and the section fills with dots.
**Done when:** a 100 × 60 dot grid exports with no script and matches the editor; 5,000 animated copies hold 60 fps on the mid tier.

**Status check (2026-11-14), 🚧:** built: the `clone.*` properties, `src/core/render/cloner.ts` (pure: grid, ring with face-out, fill the parent's area tiled from the layer's own cell, each copy with its index, capped at 10,000), the renderer (shared with the repeater), and the **Clone** section (mode, columns and rows, gaps, count, radius, start angle, face out, and a live "N in all" for a fill). Verified: 10 unit tests with hand-computed positions, and Chromium tests (`tests/e2e/cloner.spec.ts`): a grid at the right pitch, a fill that covers the frame and says how many, a ring turned face-out, and **a 100 x 60 dot grid (5,999 copies) that exports with no script**. **The cheapest export form** (`src/core/export/site/dotGrid.ts`): a static grid of 50 or more identical plain dots is written as **one element with a repeating radial-gradient** instead of one node per dot, chosen only when the copies are proven identical from the drawn markup (same plain ellipse, pure translations, a complete lattice, no stroke, filter or gradient, no live effector); 7 unit tests including every case that must not collapse, and a Chromium test: **6,000 dots export as under 6 KB (one element, no script) against over 300 KB, and a screenshot of the collapsed page differs from the full one in under 2% of drawn pixels.** **Animated copies:** the pointer effector's live driver was made to work only on changed copies (cached wrappers and base styles). **Measured (this 8 GB development machine, under memory pressure, headless Chromium; not a mid-tier device):** in an **exported page, 4,999 pointer-animated copies: median frame 16.7 ms (60 fps), p95 33 ms, p99 50 ms**; in the **editor** with that many elements the median is 33 ms (30 fps) whether or not the effector is on (the cost is the 5,000 elements, not the effector; 600 copies hold 60 fps). **Not met / not done:** (1) the Done-when's "5,000 animated copies hold 60 fps on the mid tier": the exported page holds it at the median here, not at the 95th percentile, and there is no mid-tier device to certify on; the editor does not hold it; (2) thousands of animated copies as **one canvas** is not built; (3) path and line modes (a line is the Repeater); (4) copies know their index in the document model but links and expressions cannot read it yet; (5) the fill measures the parent's frame, not an arbitrary area.

### Phase D10 · Fields & effectors
**Needs:** D9, D4 · **Was:** Main 157 · **Lane:** A · **Status:** 📋
- [ ] Vary copies by distance to the pointer, scroll progress, noise or index: scale, colour, offset, delay (stagger).

**You'll see:** dots grow near the cursor and ripple as you scroll.
**Done when:** per-copy values match hand-computed falloffs at 5 positions.

**Status check (2026-11-14), 🚧:** built: `src/core/render/effector.ts` (pure: a field gives each copy an influence 0..1; Scale, Fade, Colour (a hue turn) and Shift take it from as made to the setting; fields: **ramp, seeded noise, pointer distance, scroll wave**), `copies.ts` (one `copyStyles`/`baseCopies` used by the renderer, the live driver and the export), the `effector.*` properties, the **Effector** section, `EffectorDriver` in the stage engine (re-styles live effectors' copies when the pointer or the scroll moves, writes only changes, restores them when the engine stops, does nothing when no layer has one), and **the export** of live effectors in the same script as the drivers (copies carry `data-ll-copy`; ramp and noise are static and already drawn into the page). Verified: hand-computed falloffs at 5 distances for all four shapes, the scroll wave, ramp, noise and effect maths (12 unit tests); **export parity: 5 configurations x 150 inputs, every copy's transform, opacity and filter string identical to the editor's**; Chromium tests (`tests/e2e/effectors.spec.ts`, `drivers.spec.ts`): a ramp, repeatable noise, dots that grow near the pointer in Motion and in an exported page opened from disk, a scroll wave with a colour turn in a previewed frame, everything restored in Design and for reduced motion. The Done-when is met. **The stagger (delay) is built:** the **Delay** field (`copy.delay`, in the Effector section) makes each copy run that many seconds behind the one before when the layer is animated (verified in Chromium: at 2 s with a 0.5 s delay, an expression-driven layer is at 80 degrees and its copies at 60, 40 and 20). **Not done:** (1) the delay applies to the layer's animation in the editor (the export plays no clips, and bound driver values are the same for every copy); (2) the export is for the plain HTML target (and the Vite and Next files, not run in a build here).

## Wave 3 · Scroll & choreography

### Phase D11 · Scroll scenes: pin, scrub, snap
**Needs:** D4 · **Was:** Main 81, 82 · **Lane:** A · **Status:** 📋
- [ ] Sections pin for a number of screens; animations scrub with scroll progress; snap points; the scroll simulator in the editor. Lane B's phases, **taken over by Lane A on 2026-11-14 by the project owner's decision** (no agreement needed).

**You'll see:** a section that holds still while its animation plays with the scroll.
**Done when:** Main 81 and 82's own gates, plus scroll tapes matching the export.

**Status check (2026-11-14), 🚧:** **started: scroll scenes now work in the new editor** (taken over from Lane B by the owner's decision, 2026-11-14). Before this, only the legacy editor ran Phase 81's scroll runtime: the new canvas never turned it on and registered none of its commands. Now: the scroll commands are registered; the new canvas has a **scroll host** (the previewed frame's own scroll, and each layer's layout position, measured from layout and not from where it is drawn, so an animation cannot move its own range); and a **Scroll** section in the Design panel adds a **parallax** (follows the scroll) or a **reveal** (plays once when seen) for position, opacity, scale or rotation, with a start and end position (validated, like `top 80%`), a **pin**, and a list of the layer's scroll animations with pin and remove. **Verified in Chromium (`tests/e2e/scroll-scenes.spec.ts`):** a parallax tracks the view-progress formula at four scroll positions and goes back when the page does, and is as designed out of Preview; a reveal waits invisible and plays in when scrolled into view; a pinned layer holds its place for the length of its range, then scrolls on by exactly the rest. **Not done:** (1) the **export**: the static export plays no clips (scroll or otherwise), so scroll scenes are not in an exported page, and "scroll tapes matching the export" is not met; (2) **pinned spacing** (a pin holds the layer but does not lengthen the page); (3) **snap points**; (4) the **scroll simulator** (Phase 82: scrub the page's scroll from the timeline, scroll as an input track) and section choreography such as scroll-driven staggers; (5) native CSS scroll-driven animations; (6) the 3-browser check (Chromium only here).

**Status check (2026-11-14, later), 🚧:** added: **scroll animations in the export** (`src/core/export/runtime/scrollClips.ts`: scrub, reveal and pin clips are sampled into tables at export time and a small script reads them with the same range maths as `core/scroll`; a scrubbed clip lands within 1.5 px of the kernel at 25 scroll positions, easing included; custom ranges, pin and reveal-once tested in a fake page), **snap points** (Snap and Page snap in the Scroll section write `scroll-snap-align` and `scroll-snap-type`; the export puts the type on `html`), and a **scroll simulator** (Preview the page and drag a slider that moves the previewed frame's own scroll, so it is the same path as the wheel). Tests: `src/core/export/runtime/__tests__/scrollClips.test.ts` (6). **Not done / not verified:** the new browser controls (simulator, snap) have no browser test yet (no browser could be launched on the machine when written); non-transform properties are not exported; the three-browser check; native CSS scroll timelines.

### Phase D12 · Split text & text motion
**Needs:** D2 · **Was:** Main 83, 84 · **Lane:** A · **Status:** 📋
- [ ] Split text into characters, words or lines, accessibly, and animate them with stagger. Lane B's phases, **taken over by Lane A on 2026-11-14 by the project owner's decision**.

**You'll see:** a headline whose words rise one after another.
**Done when:** Main 83 and 84's own gates.

**Status check (2026-11-14), 🚧:** **Phase 83, words and lines (taken over from Lane B by the owner's decision, 2026-11-14).** Letters could already be split (and staggered); now **words** and **lines** too (`groupLetterBoxes` in `splitText.ts`, pure: words by the word segmenter with punctuation kept attached, lines by the drawn rows), through new commands `text.splitWords` and `text.splitLines` and **Words** and **Lines** buttons in the Typography panel. Each piece is a text layer at exactly its place, in a group named with the whole text. **Accessibility, which was missing from the renderer entirely:** `a11y.label` and `a11y.role` were stored and editable but never drawn; now Text and Container draw `aria-label`, `role` and a new `a11y.hidden` (`aria-hidden`), a role is checked against a plain-word pattern, and the **split group is named with the whole text while every piece is hidden**; the exported page carries the same attributes (unit-tested). **Phase 84, the stagger:** Animate now staggers by kind (letters 0.04 s, words 0.1 s, lines 0.18 s; the command used to force 0.04). **Verified:** 8 unit tests of the grouping (words, punctuation, quotes, accents and emoji as one letter, line breaks, refusal on a mismatch), 4 of the attributes and the export; and in Chromium (`tests/e2e/split-text.spec.ts`): a wrapped paragraph of 13 words splits into 13 pieces, **each within 2.5 px of where its word was drawn**, the group has the label and role, all pieces are hidden, **the accessibility tree (`ariaSnapshot`) shows the text once**, and one undo restores the paragraph; lines split into one piece per drawn row that read back as the paragraph; Animate staggers a word at a time. **Not done:** (1) the Done-when's **3 browsers** (Chromium only here); (2) re-detecting lines **on resize and after fonts load** (a split is a snapshot of the layout when it was made); (3) **styled runs**: a text with several styles cannot be split into words or lines (it can into letters) and says so; (4) **Phase 84's other text motion**: scramble and decrypt, typewriter with caret, rotating words, count-up, gradient sheen and variable-font axis animation are not built; blur and offset reveals are the existing entrance only; (5) **Phase 153's** non-destructive edits and Detach are not built.

**Status check (2026-11-14, later), 🚧:** added Phase 84 **text motion** (`src/core/text/textFx.ts`, pure): scramble (seeded, settles left to right), typewriter with caret, rotating words, count-up with `Intl.NumberFormat`, all a function of one `text.fxProgress` (animatable, drivable by scroll through **Play with scroll**), plus **gradient sheen** and **variable-font axis** animation. The text renderer draws the shown text hidden from assistive technology and the whole text once; the kernel adapter rewrites only the `data-fx` span; the export script carries the same function (parity tested at 21 progress values in 5 cases, with a count-up, grapheme-aware typewriter and Unicode scramble). **Re-detect lines:** a split group remembers its source (`split.source`); `text.redetectLines` puts the text back and splits again, on demand (button) and when fonts finish loading. Tests: `src/core/text/__tests__/textFx.test.ts` (8), `src/core/editing/__tests__/redetectLines.test.ts` (2). **Not done / not verified:** no browser test for the new section yet (no browser could be launched); styled-run texts still cannot split into words or lines; scramble/count-up were not compared with `evaluate()` in 3 browsers; Phase 153 Detach.

### Phase D13 · Scroll-scrubbed image sequences & video
**Needs:** D11 · **Was:** Main 188 · **Lane:** A · **Status:** 📋
- [ ] Apple-style frame sequences and video scrubbed by scroll on a sticky canvas, with preloading and a size budget.

**You'll see:** a product turning frame by frame as you scroll.
**Done when:** no dropped frames on the mid tier at normal scroll speed; the frames load within the size budget.

**Status check (2026-11-14), 🚧:** built the **sprite-sheet** form of an image sequence: an image layer whose picture is a sheet of frames in a grid (`sequence.cols`, `sequence.rows`, `sequence.frames`, and `sequence.frame` to pick one). `src/core/render/sequence.ts` (pure: the grid, the frame to a `background-position`, the scrub driver); the image renderer draws one element with the sheet as its background (readable once by a screen reader, `role="img"` with the alt text); the kernel writes the position when the frame is animated or driven; an **Image sequence** section (Sheet columns and rows, Frames, Frame, and **Scrub with scroll**, a driver from the picture's section scrolling through the screen to frame 0..last). One file means one request and one size budget; no preloading logic is needed beyond the sheet. **Export:** the plain HTML export carries the grid (`data-seq`) and the driver script moves the frame (the sheet is the element's background; the other targets use the same CSS and the script in `public/`). Tests: `src/core/render/__tests__/sequence.test.ts` (8: every frame on its own cell, rounding and holds, the drawn markup, the kernel write, the scrub driver, the export), `tests/e2e/image-sequence.spec.ts` (2, Chromium: the Frame field shows each of six frames; **scrubbing with scroll shows the right frame at 20 scroll positions** and never goes backwards on the way down). **Not done (Main 188):** separate-frame sequences (one file per frame, with preloading per device tier and a poster) and video scrubbing (needs video layers, Main 99, D17), the pinned sticky canvas as one control (use Scroll's Pin for the picture), a frame budget warning, a check in Firefox and WebKit, memory on a mid-tier device. **Known:** scrubbing by the page frame itself, rather than a section inside it, shows a frame early (the page frame's measured top differs); put the picture in a section.

### Phase D14 · Smooth scroll & depth parallax
**Needs:** D11, D4 · **Was:** Main 189, 190 · **Lane:** A · **Status:** 📋
- [ ] Smooth scrolling with sane physics and an off switch; layers that move at their own depth by scroll and cursor.

**You'll see:** a page whose layers drift at different depths.
**Done when:** reduced motion turns both off; scroll tapes match the export.

**Status check (2026-11-14), 🚧:** built, in the editor and in the plain HTML export. **Depth parallax:** a **Parallax** preset in Driven by (a depth from -1 near to 1 far, and a cursor shift) that writes ordinary drivers, so it exports, honours reduced motion and works in Preview like any driver; a layer at depth 0.3 scrolls at 0.7 of the page's speed (hand-computed at five scroll positions), and moves with the cursor by depth. **Smooth scrolling:** a **Smooth** field in the Page panel (`scroll.smooth`, seconds to catch up with the wheel; 0 is the browser's own) and a standalone script in the export (`lazylayout-smooth.js`, no imports) that eases the **mouse wheel only**; keyboard scrolling, find in page, anchor links, the scrollbar, touch, pinch zoom and scrollers inside the page stay native, and any scroll it did not make moves its target so it never fights the browser; it is linked from the HTML, Vite and Next.js targets. **Verified:** 8 unit tests of the script on a faked page (easing arrives, settles in about tau at 30, 60 and 144 fps, wheel clicks add and stay inside the page, every native case left alone); in Chromium, on an **exported page**: a layer at depth 0.3 is at 0.3 x the scroll at four positions, the wheel eases (on its way after 60 ms, arrived after 1.5 s), End, an anchor-style jump and the next wheel all work, and **for a visitor who asked for reduced motion the parallax does nothing and the wheel scrolls natively**; and **scroll tape parity: three parallax layers over a recorded 14 s scroll tape, 840 frames, every value equal in the editor's runtime and the exported script to 1e-9.** The Done-when is met. **Not done:** (1) parallax by the **tilt of a phone** (the `device` signal is not built); (2) the **editor** previews parallax from a previewed frame's scroll, not a smoothed page (smooth scrolling is an export feature); (3) snapping per section (Phase 189's snap) is not built; (4) the one-click presets named in Phase 190 (dolly on scroll, look-around) are not built beyond Parallax; (5) the export targets other than plain HTML are written but not run in a Vite or Next build here.

### Phase D15 · States: hover, press, focus choreography
**Needs:** D2 · **Was:** Main 78 · **Lane:** A · **Status:** 📋
- [ ] Named states and transitions on any layer. Lane B's phase, **taken over by Lane A on 2026-11-14 by the project owner's decision**.

**You'll see:** a button with Hover and Press states, previewed live.
**Done when:** Main 78's own gate.

**Status check (2026-11-14), 🚧:** built, in the editor and in the plain HTML, Vite and Next exports. **Model:** the document's `states` table (already in the schema) now has commands (`layer.addState`, `layer.removeState`, `layer.editState`, in `src/core/states/`), and the **States** section of the Design panel (`LayerStatesSection.tsx`) adds Hover, Pressed and Focus (or a custom name), picks the state to edit, and removes one. **Editing a state:** while a state is picked, `updateProps` writes to the state and keeps only the difference from the base (a value equal to the base is dropped), the inspector fields show the layer as it is in that state, and the canvas draws it (the engine now also runs in Design while a state is edited or Live is on; drivers stay off there). **Preview:** `StateDriver` reads the same pointer source as the drivers, picks pressed, then focus, then hover, and eases a blend amount (about 0.14 s, instant with reduced motion; the kernel blends numbers and switches other values at one half), so a quick move in and out never snaps. Live is a switch in the section, and Preview always shows it. **Export:** a state becomes `:hover`, `:active` or `:focus-within` rules holding only the difference, with a `transition` on the properties it changes and `transition: none` under reduced motion (Tailwind gets `hover:`, `active:` and `motion-reduce:` utilities); a custom state is not exported, and the export says so. Tests: `src/core/states/__tests__/states.test.ts` (11), `src/core/export/site/__tests__/states.test.ts` (4), `tests/e2e/states.spec.ts` (2, Chromium). **Not done (Main 78 / 79):** a state picker in the Motion tab, the disabled / loading / in-view states from real conditions (only the pointer-driven ones are live), per-state transition settings (spring or tween, per-property overrides, Phase 79), editing a state by moving things on the canvas with the pointer (the inspector fields and the canvas draw it; dragging a handle in a state is not checked), focus from the keyboard (it follows the last press), a Firefox and WebKit check.

## Wave 4 · Tracking & speed

### Phase D16 · Corner pin & perspective placement
**Needs:** D2 · **Was:** ROADMAP_3D 3D-204 · **Lane:** A · **Status:** 📋
- [ ] Drag four points to place an image, text or video on a plane in a photo; exports as a CSS 3D transform.

**You'll see:** a poster set onto a billboard in a photo in four drags.
**Done when:** the four points are hit within 0.01 px; the export matches within 0.5 px at 5 sizes.

**Status check (2026-11-14), 🚧:** the corner pin was already built (core maths `cornerPin.ts`, the **Pin corners** button in Position, four handles and a grid on the canvas, one undo step per drag). This round verified the Done-when: **a real handle drag moves a corner by exactly the drag to within 0.01 px** (Chromium), the CSS matrix sends the four corners onto the points within 0.01 px for 6 quads x 5 sizes from 1x1 to 4000x3000 (unit), and **an exported page draws five layers of five sizes onto their four points within 0.5 px** (Chromium, measured from the exported page's computed matrix). It applies to image, text, shape, container and button layers alike (unit), and a pin that would fold the layer is refused. **Not tested:** a video layer (Phase 99 is Lane B's, not built); the pin is not yet fed by the tracker (D17). Marked 🚧 until it is on `main`.

### Phase D17 · Tracking & parent to track
**Needs:** D16, D5 · **Was:** ROADMAP_3D 3D-205, 3D-206 (needs Main 99, Lane B) · **Lane:** A · **Status:** 📋
- [ ] Track one point, two points or a plane through a video; the track becomes a helper layer you can **parent anything to**; results are editable keys, baked small in the export. Needs video layers (Main 99, Lane B).

**You'll see:** press Track, parent a label to the track, and it rides along with the car.
**Done when:** on 10 clips the pin stays within 1.5 px for 95% of frames; a 10-second track exports under 4 KB.

### Phase D18 · Speed effects
**Needs:** D4 · **Was:** Main 144 · **Lane:** A · **Status:** 📋
- [ ] Motion blur by velocity, speed lines, trails, squash and stretch, driven by how fast a layer moves (uses the motion blur of Main 75).

**You'll see:** a fast swipe leaves speed lines and a blur that fade as it stops.
**Done when:** the effect amount matches the velocity curve at 5 times; it costs nothing at rest.

**Status check (2026-11-14), 🚧:** built: `src/core/kernel/speedEffects.ts` (pure) and a kernel step after the motion blur: **squash and stretch along the motion** (area kept), **lean into the side it moves**, and a **speed-driven blur** (through the existing motion-blur filter), with the amounts linear in speed up to a reference speed; the **Speed** section in the Design panel, and a one-click **trail** (echo copies, each a set time behind, using the delayed copies). **Verified: the stretch follows the speed curve of a layer swinging as 300 sin(2t) at five times, in the kernel and in the real DOM in Chromium; at the turning point (speed 0) the layer is left exactly as it was; a layer with no speed effect set is not measured at all; lean and blur follow; Design shows the plain layer.** The Done-when is met. **Not done:** speed lines (the streaks behind a fast layer) are not built; trail echoes stay on the page, stacked, when the layer is at rest (the effect amount is zero, the copies are not); the effects are not in the static export (it plays no clips, Lane B's Phase 94); the 50-layer 60 fps check of Phase 144 is not measured.

## Wave 5 · 3D parts

### Phase D19 · 3D model parts & explode
**Needs:** D4, 3D-158, 3D-033, 3D-037 · **Was:** new (uses ROADMAP_3D 3D-158 import, 3D-033 materials, 3D-037 lights) · **Lane:** A · **Status:** 📋
- [ ] An imported model's parts become separate layers; an **Explode** generator moves each part from its place outward (along its own axis, radially, or along a path) by one progress value, with stagger.

**You'll see:** drag the Explode slider and the watch comes apart into its pieces.
**Done when:** parts return exactly to their place at 0; the progress can be driven by scroll; the export stays under its size budget.

### Phase D20 · Labels that follow 3D parts
**Needs:** D19, D6 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] 2D layers follow points on 3D parts (projected each frame), with leader lines.

**You'll see:** a label and a line that stay on the watch's gear as it turns and comes apart.
**Done when:** labels stay within 1 px of their projected points at 10 poses.

## Gate

### Phase D21 · Gate: the watch page
**Needs:** D1 – D15, D18 – D20 · **Was:** new · **Lane:** A · **Status:** 📋
- [ ] The benchmark: a 3D watch pinned for four screens; it turns with scroll while a ring of elements turns the other way; then it explodes into parts with labels following; words stagger in; a dot field reacts to scroll speed. Built in about 10 steps, exported under its size budget.

**You'll see:** the finished watch page, live.
**Done when:** built from scratch in under an hour by the owner; holds 60 fps on the mid tier; works with reduced motion and on touch.

## Wave 6 · Gaps found by the D1 audit (2026-11-13)

These three things work in the core and in the legacy editor, but the new editor has no way to reach them. They are separate phases so D1 can close; they are independent of D3 – D21 and can be built at any time after D1.

### Phase D22 · Variables, tokens & styles manager in the new editor
**Needs:** D1 · **Was:** Main 45, 47 (core exists; no panel) · **Lane:** A · **Status:** 📋
- [ ] A panel to create, rename, group and delete variables (colour, number, text), modes, and colour and text styles; apply them from any control; show where each is used.

**You'll see:** change a colour variable and every layer using it changes; switch the mode and the whole page switches.
**Done when:** the Phase 45 and 47 behaviours pass against the new editor (the legacy specs, ported).

**Status check (2026-11-14), 🚧:** built: a **Variables & styles** section (`VariablesSection.tsx`) in the Design panel, shown with nothing selected and under a selected layer. It runs the existing `token.*` and `style.*` commands (so undo, the code view and the agent bridge see the same edit): **modes** (view, add as a copy, remove), **variables** of colour, number, text and on/off type with a value in the viewed mode, listed by their `group/name`, renamed in place, deleted, and **where each is used** ("2 used", counting layers and styles that follow it; a detached layer does not count), **Bind** a selected layer's property (Fill, Text colour, Border colour, Corner radius, Opacity, Gap, Padding, Font size, Width, Height, Text, Visible: only those legal for the layer and of the variable's type) with **Detach**, **Re-link** and **Unbind**, the row saying "follows" or "is detached from", and **styles** (text, effect and fill) made from the selected layer, applied, deleted. `tests/e2e/variables.spec.ts` (6, Chromium) is the Phase 45 gate ported: a mode switch restyles every bound layer while the detached one stays put and Light brings it back; changing a colour in the section updates the layers bound to it in the viewed mode only; Bind then Detach keeps the shown value and Re-link follows again; a hand edit detaches and the section says so; a text style restyles both texts; deleting a variable keeps the look and one undo brings it and its bindings back. **Not done:** collections with their own modes, aliases between variables, scopes, descriptions and code syntax, import and export of variable sets (the commands exist; no buttons in the new editor), a mode switch on a frame, a bind button inside each control (the Bind row is in the section), the check in Firefox and WebKit.

### Phase D23 · Variants & instances in the new editor
**Needs:** D1 · **Was:** Main 46, 47 (core exists; authoring UI missing) · **Lane:** A · **Status:** 📋
- [ ] Add and edit variants of a component, set component properties, override in an instance, detach an instance.

**You'll see:** a button component with Primary and Secondary variants that you switch in an instance.
**Done when:** the Phase 46 and 47 behaviours pass against the new editor.

**Status check (2026-11-14, later), 🚧:** a **Component** section (`ComponentsSection.tsx`) in the Design panel runs the real `component.*` commands: make a component from a layer, add variant properties (Kind: Primary, Secondary), expose text, picture or on/off properties, insert an instance; on an instance switch variants, edit the exposed properties, Go to main, Reset overrides, Detach; Combine as variants for a multi-selection. The earlier unused `ComponentSection.tsx` called commands that do not exist and is left untouched. **Not verified:** no browser test was run (no browser could be launched); the core behaviours are covered by the Phase 46 and 47 unit tests.



### Phase D24 · Open and save a project file from the new editor
**Needs:** D1 · **Was:** Main 3, 36 (core exists; no UI) · **Lane:** A · **Status:** 📋
- [ ] File menu: Save as a project file (pictures embedded), Open a project file, with a clear message when it is from a newer version.

**You'll see:** save a project, open it in a fresh browser, and it is identical.
**Done when:** a saved file opens identically in a fresh browser, including pictures and 3D data.

**Status check (2026-11-14, later), 🚧:** the File menu already had **Import project file** and **Export project file** (pictures embedded); this round a file that cannot be opened is now refused **in words** (a newer file format version, not JSON, not a project) instead of only in the console. `tests/e2e/project-file.spec.ts` (3) is written: save, open in a fresh browser context and compare the document; a newer-version file; a junk file. **Not verified:** that spec has not run (no browser could be launched on the machine after the code was written), so D24 is not shown to meet its gate.

---

# STAGE 4 — INTERACTIVE & COMPLEX ANIMATION (Phases 132–202)

> **Stage output:** anything can react to the **mouse, touch, scroll, keyboard, microphone, camera and gamepad**, and every layer knows where it is, how fast it moves and what is around it. One-step reactions ("Cursor → Bend"), one drag to connect any property to any input, and Pro binding graphs; magnet, tilt, follow and spotlight behaviours; squash and stretch; reactions that change layout inside fixed boxes; gestures (hold, swipe, fling, slingshot), constrained dragging, carousels and seamless loops; keyboard-driven motion and focus parity; Rive-style state machines. Kinetic composition from primitives: invisible helpers, follow pins, one-click Split, cloners, roles and selectors ("every button"), data-driven charts, fields and effectors, 2D physics with joints, ropes and soft bodies, and contact events. Interaction logic as Simple "When → Do" rules or Unreal-style Blueprint graphs, compiled to plain code; sound and haptics. GPU effects on a budgeted compositor: any layer as a texture, outline or distance field; effect layers, outline effects, liquid glass and 2D lights; shader graphs, particles, fluids and other simulations; deformation and fracture; image and text distortion, scroll-scrubbed sequences, smooth scrolling and depth parallax; custom cursors. Effects as data, bring-your-own code components, and production-hardened export with a small vendored runtime or an embed script.
>
> Order inside the stage: inputs and awareness (132–137) → bindings and connecting (138–142) → DOM reactions, gestures, dragging, keyboard and state machines (143–151) → kinetic composition, roles and data (152–158) → Blueprints, physics, joints, soft bodies and sound (159–171) → rasteriser and GPU effects (172–191) → effects as data and code components (192–196) → interactive export and accessibility (197–199) → budgets, the composition suite and the gate (200–202). The design is `INTERACTIVE_EFFECTS_ENGINE_SPECIFICATION.md` and grammar §13–§14; v4.1 added 26 phases to it.

### Phase 132 · Input bus & coordinate spaces
**Needs:** 55, 102 · **Was:** v3 59.1 · **Closes:** AUD-45 (input, partial) · **Status:** 🚧
- [x] `src/core/signals/inputBus.ts`: one passive listener set per frame host (pointer, wheel/scroll, keys, focus, resize, visibility, orientation), sampled in the scheduler's input phase into an immutable per-frame snapshot (Law 12).
- [x] Coordinate spaces: layer-local, parent, frame and page, in px, uv and ndc, resolved through `renderer.measure()`, so a background with `pointer-events: none` still knows where the cursor is.

**Status check (2026-11-15, Lane D), 🚧:** `src/core/signals/inputBus.ts` adds `createHostInputBus` (single passive listener set + `input` scheduler snapshot) and `convertPagePoint` across `local`/`parent`/`frame`/`page` in `px`/`uv`/`ndc` (with rotation support), and `src/core/bindings/inputBus.ts` now honors `pointerIn` spaces. Unit tests written in `src/core/signals/__tests__/inputBus.test.ts` (awaiting batch test verification at Phase 141).

**You'll see:** nothing new yet; 133 adds live meters.
**Done when:** the grep/lint gate finds no stray pointer, scroll, wheel or key listeners; input sampling costs < 0.3 ms per frame with 200 bound layers.

### Phase 133 · Signal catalogue, including the keyboard
**Needs:** 132 · **Was:** v3 59.2 + new (keyboard) · **Status:** 🚧
- [x] The typed catalogue of spec §4: `pointer.*`, `pointer.inside(L)`, `hover(L)`, `press(L)`, `focus(L)`, `proximity(L)`, `scroll.*`, `view(L).*`, `time`, `frame.dt`, `audio(L).*`, `device.tilt*` (permission-gated), `state`, `sm`, `prop`, `var`, `seed`.
- [x] **New: keyboard signals:** `key.down(K)`, `key.held(K)`, `key.axis(arrows | WASD)` (−1…1 per axis), `key.lastPressed`, `focusVisible(L)`, with layout-independent key codes.
- [x] Every signal declares unit, range, default and its touch behaviour. Live signal meters in a dev panel (`SignalMetersView`).

**Status check (2026-11-15, Lane D), 🚧:** Added `key.down`, `key.held`, `key.axis`, `key.lastPressed`, and `focusVisible` to `src/core/document/signals.ts` and `src/core/bindings/inputBus.ts`, built `src/core/signals/catalogue.ts` + `src/editor/panels/signals/SignalMetersView.tsx`, and wrote unit tests in `src/core/signals/__tests__/catalogue.test.ts` (queued for Phase 141 batch verification).

**You'll see:** a Signals dev panel with live meters for mouse, scroll and keys.
**Done when:** each signal's meter matches scripted input in 3 browsers.

### Phase 134 · Scene awareness: every layer's live self
**Needs:** 133 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Each layer publishes live signals about itself: position, size and rotation in every space, velocity and speed, how much of it is on screen, its progress through the viewport, distance and angle to the pointer, and hovered, pressed, focused and dragged. Computed once per frame from the measurement API (Laws 10 and 12), and only for layers something listens to.

**Status check (2026-11-15, Lane D), 🚧:** Created `src/core/signals/sceneAwareness.ts` (`stepSceneAwareness`, `queryLayerRelation`, `readSelfChannel`) plus a collapsible live readout strip in `DrivenBySection.tsx` and unit tests in `src/core/signals/__tests__/sceneAwareness.test.ts` (queued for Phase 141 batch verification).

**You'll see:** a Live readout for any layer in Preview: its speed, distance to the cursor and scroll progress.
**Done when:** values match scripted tapes at checkpoints; 200 watched layers cost < 0.2 ms per frame.

### Phase 135 · More inputs: microphone, camera, gamepad & tilt
**Needs:** 134 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Permission-gated inputs: microphone (level, frequency bands, beat), camera (brightness, motion, and a video texture later), gamepad (sticks and buttons) and device tilt with calibration. Each has a fallback when permission is denied or the device is missing, and can be recorded as a tape (Phase 136). Nothing is uploaded.

**Status check (2026-11-15, Lane D), 🚧:** Implemented `src/core/signals/deviceSignals.ts` (`DeviceSignalController`, audio FFT bands & beat detector, camera luma/motion sampler, gamepad deadzone poller, zero-calibrated orientation tilt) and wired `audio`/`device` signals into `src/core/bindings/inputBus.ts`. Tests in `src/core/signals/__tests__/deviceSignals.test.ts` (queued for Phase 141 batch verification).

**You'll see:** a shape that pulses with your voice, and a card that tilts with your phone.
**Done when:** recorded microphone and gamepad tapes replay identically; denying permission falls back without errors.

### Phase 136 · Input tapes
**Needs:** 133 · **Was:** v3 59.3, 23.4, 24.4, 12.3 · **Status:** 🚧
- [x] Record or author any signal over time; synthetic sources (seeded autopilot pointer, scripted paths, tap sequences, scroll curves, key sequences). In deterministic mode the transport plays tapes, so reactive motion scrubs, renders and tests identically. Tapes appear as editable input tracks in the timeline and are recorded from the Playground.

**Status check (2026-11-15, Lane D), 🚧:** Extended `src/core/bindings/tape.ts` with `createTapeRecorder`, `authorScriptedTape`, `serializeInputTape`/`deserializeInputTape`, and `replayTapeExpressions` validating against `InputTapeSchema`. Unit tests written in `src/core/bindings/__tests__/tapeStage4.test.ts` confirming 3-run byte-identical snapshots (queued for Phase 141 batch verification).

**You'll see:** record your mouse movement, then scrub through it on the timeline.
**Done when:** a recorded pointer, scroll and key tape replayed 3 times gives byte-identical per-frame snapshots in 3 browsers.

### Phase 137 · GPU & interactive verification harness
**Needs:** 136 · **Was:** v3 71 · **Status:** 🚧
- [x] Headless Chromium with a software WebGL2/WebGPU rasteriser on every PR, a nightly real-GPU job, tape playback with frame capture at exact times, perceptual metrics (SSIM plus a FLIP-style metric) with tolerance tiers, particle statistics, memory checks (ledger, heap after forced GC), and a deliberately broken fixture per tier that must fail.

**Status check (2026-11-15, Lane D), 🚧:** Created `src/core/gpu/interactiveHarness.ts` combining deterministic `playTape` stepping, `TIER_TOLERANCES` perceptual SSIM/neighbourhood checks, particle distribution checks, GPU ledger teardown leak checks, and falsifier fixtures in `src/core/gpu/__tests__/interactiveHarness.test.ts` (queued for Phase 141 batch verification).

**You'll see:** nothing in the editor (test infrastructure). Phases 138 and 140 are visible again.
**Done when:** falsifiers fail and correct fixtures pass in 3 browsers; flake rate < 1% over 50 runs.

### Phase 138 · Operators & bindings runtime
**Needs:** 137 · **Was:** v3 60.1 · **Status:** 🚧
- [ ] The spec §5 operators (`smooth`, `spring`, `remap`, `clamp`, `curve`, `deadzone`, `falloff`, `noise`, `delay`, `trail`, `velocity`, `accumulate`, `threshold`, `edge`, `toggle`, `sampleHold`, `quantize`, `mix`, vector maths), frame-rate independent and deterministic, reusing the expression evaluator (77). Bindings `signal |> operators -> target` run each frame.
**Status check (2026-11-15, Lane D), 🚧:** Added `compileTrailExpr` ring-buffer evaluation in `src/core/bindings/evaluate.ts`, created `src/core/bindings/referenceBindings.ts` with 12 validated Stage 4 bindings and 30/60/120 Hz cross-rate comparison over 60 s tapes, and wrote tests in `src/core/bindings/__tests__/operatorsStage4.test.ts` (queued for Phase 141 batch verification).

**You'll see:** a layer following the cursor, set up in the text form.
**Done when:** 12 reference bindings match hand-computed values at tape checkpoints; a 60 s tape at 30, 60 and 120 Hz gives the same values within tolerance.

### Phase 139 · Targets, blending & cycles
**Needs:** 138 · **Was:** v3 60.2 + the v3 9 amendment · **Closes:** AUD-45 (binding half), AUD-48 (bindings) · **Status:** 🚧
- [ ] Targets: registry paths whose compositing class is `gpu` or `paint` (continuous bindings to layout paths refused with `[SIG_LAYOUT]`), state-machine inputs, CSS custom properties, events. Channel blending (replace, add, multiply, max) feeds the Single Transform Authority synthesis. Links and bindings share one dependency graph; cycles refused with `[SIGNAL_CYCLE]`.
- [ ] The kernel evaluates bindings in its composition order (closes the bindings entries of `KERNEL_GAPS`).
- [ ] **v4.1 carve-out:** continuous bindings to layout paths are allowed inside a layout-isolated box (fixed outer size, `contain: layout size`), so nothing outside it moves; `[SIG_LAYOUT]` still refuses them everywhere else. Phase 145 builds the part users see.
**Status check (2026-11-15, Lane D), 🚧:** Added `src/core/bindings/cycleAndLayoutGuard.ts` (`isLayerLayoutIsolated`, unified link+binding `detectSignalAndLinkCycles`, `guardFiniteBindingValue`), enabled `input`/`event` targets and layout-isolated box carve-out in `src/core/bindings/runtime.ts`, closed `signal bindings` in `KERNEL_GAPS` (`src/core/kernel/evaluate.ts`), updated `AUDIT.md` (`AUD-45`, `AUD-48`), and added unit tests in `src/core/bindings/__tests__/targetsAndGuards.test.ts` (queued for Phase 141 batch verification).

**You'll see:** a float, a magnet and a tilt on one button combine instead of fighting.
**Done when:** the blending golden tests pass; a cycle is refused with its chain.

### Phase 140 · Reactivity card (Simple)
**Needs:** 139 · **Was:** v3 60.3 · **Status:** 🚧
- [ ] "Reacts to" rows: **Cursor · Scroll · Hover on… · Touch · Keyboard · Sound**, each listing only the selected layer's affordances (follow, bend, repel, ripple, glow, tilt, parallax …) with Strength and Smoothness, plus a generated plain-language sentence. Ranges are dragged over live meters (Law 17).
**Status check (2026-11-15, Lane D), 🚧:** Created `src/core/bindings/reactivityCard.ts` (6 Simple sources, archetype-filtered affordances, validated `BindingDraft` synthesis, Law 17 meter helpers, plain-language summary) + `src/editor/panels/details/sections/ReactivityCard.tsx` (`ll:` + token compliant) + unit tests in `src/core/bindings/__tests__/reactivityCard.test.ts` (queued for Phase 141 batch verification).

**You'll see:** make anything follow the cursor in one click.
**Done when:** 5 first-time users each make "the background follow the cursor" in < 20 s without help.

### Phase 141 · Connect anything: drag a property onto an input
**Needs:** 140 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] One gesture for every link: drag from any property's handle onto the cursor, scroll, a key, the microphone or another layer's live value (Phase 76's pick-whip, and every input from Phase 132 on). A plain sentence appears ("Rotation follows the cursor across, gently") and can be tuned by feel (Law 17).
**Status check (2026-11-15, Lane D), 🚧:** Created `src/core/bindings/connectAnything.ts` (unified drag-to-connect compiler for `cursor`/`scroll`/`key`/`microphone`/cross-layer property links, `PROPERTY_REGISTRY` range inference, feel presets, plain-language sentences) + `src/editor/components/ConnectLinkHandle.tsx` + `src/core/bindings/__tests__/connectAnything.test.ts`. Milestone 1 verification batch (Phases 132–141) executes next.

**You'll see:** drag Rotation onto "Cursor" and the layer turns with the mouse.
**Done when:** 5 first-time users each connect 3 properties to 3 different inputs in < 1 minute per link.

### Phase 142 · Signals panel (Pro) & binding export
**Needs:** 140 · **Was:** v3 60.4 · **Status:** 🚧
- [ ] A node view of bindings with live meters in Preview, and "Open in Playground with tape".
- [ ] Export: bindings compile to plain TypeScript in the first vendored runtime modules (`ticker`, `signals`) copied into the user's project, or to CSS scroll/view timelines when expressible.
**Status check (2026-11-15, Lane D), 🚧:** Added `src/core/bindings/exportCompiler.ts` (Pro signal DAG, playground tape session, CSS `scroll()`/`view()` timeline extraction, and Next/Vite vendored `ticker.ts` + `signals.ts` emitter), `src/editor/panels/signals/SignalsNodePanel.tsx`, and 12-binding export parity tests in `src/core/bindings/__tests__/exportCompiler.test.ts` (queued for Phase 151 verification).

**You'll see:** a Pro graph of every reaction; exported pages react like the editor.
**Done when:** the 12 reference bindings pass tape parity in the Next and Vite exports.

### Phase 143 · Pointer behaviours as presets
**Needs:** 142 · **Was:** v3 12.2 · **Status:** 🚧
- [ ] Magnet, tilt (3D perspective), follow with lag, proximity, spotlight, inertia (drag with momentum), noise and wander, implemented as binding presets with affordances (closes the behaviour entries of `KERNEL_GAPS`).
**Status check (2026-11-15, Lane D), 🚧:** Implemented all 8 pointer behaviour presets (`magnet`, `tilt`, `followLag`, `proximity`, `spotlight`, `inertia`, `noise`, `wander`) in `src/core/bindings/pointerPresets.ts`, closed `behaviours` in `KERNEL_GAPS` (`src/core/kernel/evaluate.ts` + `evaluate.test.ts`), and added scripted-pointer + 50-layer performance tests in `src/core/bindings/__tests__/pointerPresets.test.ts` (queued for Phase 151 verification).

**You'll see:** magnetic buttons, tilt cards and spotlights from the Reactivity card.
**Done when:** 8 behaviours pass scripted-pointer tests at checkpoints; 50 reactive layers hold 60 fps.

### Phase 144 · Velocity effects: squash & stretch, lean & trails
**Needs:** 134, 143 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Presets driven by a layer's own speed and direction: squash and stretch along the motion, lean into turns, echo copies and motion trails, speed lines. Simple face: Bounce and Stretch.
**Status check (2026-11-15, Lane D), 🚧:** Implemented `src/core/bindings/velocityEffects.ts` (volume-preserving squash & stretch, turn lean, echo/speed-line synthesis, Simple Bounce & Stretch presets) and unit/perf tests in `src/core/bindings/__tests__/velocityEffects.test.ts` (queued for Phase 151 verification).

**You'll see:** a ball that stretches when it moves fast and squashes when it stops.
**Done when:** the presets match reference values on scripted tapes; 50 layers hold 60 fps.

### Phase 145 · Reactions that change layout, inside fixed boxes
**Needs:** 139, 143 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Continuous reactions on layout properties, allowed only inside a box whose outer size is fixed (the Phase 139 carve-out): variable-font weight and width by cursor distance, Dock-style magnification, letter-spacing waves. Nothing outside the box moves.
**Status check (2026-11-15, Lane D), 🚧:** Implemented `src/core/bindings/layoutIsolatedReactions.ts` (variable-font proximity, Dock magnification, letter-spacing wave, `contain: layout size` guard, 0 external CLS assertion) and unit/perf tests in `src/core/bindings/__tests__/layoutIsolatedReactions.test.ts` (queued for Phase 151 verification).

**You'll see:** letters that get bolder and wider as the cursor comes near, without the page jumping.
**Done when:** CLS stays 0 outside the box; 60 reactive letters hold 60 fps in 3 browsers.

### Phase 146 · Keyboard & focus interactivity
**Needs:** 143 · **Was:** — (new) · **Status:** 🚧
- [ ] Key-driven bindings and triggers (arrows/WASD move or rotate a layer, keys step through states, shortcuts trigger compositions), roving focus for groups, and focus-driven motion. Keyboard parity rule: any informative pointer reaction must have a keyboard or focus equivalent (grammar 6.11), checked by the rules.
- [ ] Exported pages get the same keyboard handling, scoped so they never steal the host page's shortcuts.
**Status check (2026-11-15, Lane D), 🚧:** Implemented `src/core/signals/keyboardInteractivity.ts` (key triggers, roving focus controller, grammar 6.11 `checkKeyboardFocusParity` `[A11Y_KEY_PARITY]`, and scoped export listener builder) and unit tests in `src/core/signals/__tests__/keyboardInteractivity.test.ts` (queued for Phase 151 verification).

**You'll see:** "when the user presses → , slide to the next card" without code.
**Done when:** a keyboard-only journey drives 5 interactive references in the stage and in the export; the parity rule flags a pointer-only reaction.

### Phase 147 · Gestures: hold, swipe, fling, pull & release
**Needs:** 146 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Gesture recognisers as signals and events: press-and-hold progress, swipe (direction and distance), fling velocity, pull back and release (a slingshot), long press, double tap, pinch and two-finger rotate. Each gesture has a keyboard equivalent (the parity rule of Phase 146).
**Status check (2026-11-15, Lane D), 🚧:** Implemented `src/core/signals/gestures.ts` (`createGestureRecognizer` with hold progress, long press, double tap, swipe, fling, slingshot pull-and-release, dual-touch pinch & rotate, and keyboard parity) and tests in `src/core/signals/__tests__/gestures.test.ts` (queued for Phase 151 verification).

**You'll see:** a hold-to-confirm button whose fill rises while you hold it.
**Done when:** scripted mouse and touch tapes fire each gesture at the expected frame in 3 browsers and a touch profile.

### Phase 148 · Drag with constraints
**Needs:** 147 · **Was:** — (new in v4.1) · **Status:** 🚧
- [ ] Make any layer draggable: lock to an axis, keep inside the parent, an area or a path, rubber-band edges, snap points, momentum with friction, throw, and return home; drag progress is a signal for other layers.
**Status check (2026-11-15, Lane D), 🚧:** Implemented `src/core/signals/constrainedDrag.ts` (`createConstrainedDragController` with axis locks, bounds/polyline paths, rubber-band resistance, snap points, throw momentum, return home, drag progress signal, and keyboard nudge parity) and tests in `src/core/signals/__tests__/constrainedDrag.test.ts` (queued for Phase 151 verification).

**You'll see:** a slide-to-confirm handle that snaps at the end and springs back if you let go early.
**Done when:** 10 drag references match tapes in 3 browsers; keyboard equivalents pass.

### Phase 149 · Carousels, scrollers & seamless loops
**Needs:** 81, 128, 148 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Scrollers with snapping and momentum, endless looping of any content, marquees whose speed follows scroll velocity, and 3D carousels from the Stage 3 arrangements, driven by drag, wheel, arrow keys and autoplay (`src/core/signals/carouselsAndLoops.ts`).

**You'll see:** an endless logo marquee, and a 3D ring of cards you spin by dragging.
**Done when:** loops never show a seam over 10 minutes of tape; the export matches the stage.

### Phase 150 · Drag & drop between layers
**Needs:** 148 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Drop zones, sortable lists and grids with animated reordering, swipe-to-remove rows, and drop events for rules and Blueprints (`src/core/signals/dragAndDrop.ts`).

**You'll see:** reorder cards by dragging them, with the others sliding out of the way.
**Done when:** a 15-step reorder journey ends in the expected order in 3 browsers and with the keyboard.

### Phase 151 · State machines
**Needs:** 146 · **Was:** v3 11.3 · **Status:** 🚧
- [x] Rive-style inputs (boolean, number, trigger), conditional transitions, and 1D blends by a number input (for example hover intensity by pointer proximity), plus visual state-graph editor (`src/core/signals/stateMachineRuntime.ts`, `src/editor/panels/signals/StateMachineGraphEditor.tsx`).

**You'll see:** a multi-step button whose states are wired in a graph.
**Done when:** a 4-state machine driven by a tape matches hand-computed states at checkpoints.

### Phase 152 · Helpers, pins & Follow
**Needs:** 151 · **Was:** v3 88 · **Closes:** AUD-56 (helpers & follow) · **Status:** 🚧
- [x] Any layer can become a helper (73). Binding target `L.position(pin)`. The Follow component: target, pin, offset, lag, axis, bounds, leave behaviour, rotation, scale by speed, touch and reduced-motion policies. Simple face: click one of the 9 pin dots on the canvas, lag as Bounce and Time (`src/core/bindings/helpersAndFollow.ts`, `src/core/bindings/follow.ts`).

**You'll see:** draw a circle, make it invisible, and have its bottom point follow the mouse.
**Done when:** the helper matches hand-computed positions at tape checkpoints with rotation and scale; helpers are absent from the exported DOM.

### Phase 153 · Split into real layers
**Needs:** 152 · **Was:** v3 89.1 · **Status:** 🚧
- [x] Right-click → Split into letters, words or lines: real, rule-addressable layers built cleanly, non-destructive (edits keep overrides), with Detach, and single-pass AT reading (`src/core/signals/splitIntoLayers.ts`).

**You'll see:** one click turns a headline into individual letter layers.
**Done when:** 5 fixture strings split within 0.5 px of the unsplit glyph positions in 3 browsers.

### Phase 154 · Cloners, tags & group targets
**Needs:** 153 · **Was:** v3 89.2, 89.3 · **Status:** 🚧
- [x] Grid, radial, path, scatter and linear cloners with per-clone overrides; per-piece attributes (`index`, `count`, `home`, `random` …); layer tags; `Group[*]` and `tag:` binding targets; over-tier-cap GPU particle recommendation (`src/core/signals/clonersAndGroupTargets.ts`).

**You'll see:** a 20 × 20 dot grid where every dot can react.
**Done when:** a 20 × 20 grid matches between stage and export.

### Phase 155 · Roles, relations & selectors
**Needs:** 134, 154 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Layers have an inferred/editable role (`button`, `link`, `heading`, `image`, `card`, `input`, `badge`, `section`). Natural-language selectors (`every button`, `the nearest card`, `my neighbours`, `the layer under the cursor`) and pairwise relation signals (`distance`, `angle`, `overlap`, `order`) (`src/core/signals/rolesAndSelectors.ts`).

**You'll see:** "every button glows when the cursor is near" as one rule.
**Done when:** selectors pick the right layers in 10 fixtures; relation signals match tapes.

### Phase 156 · Data-driven layers & animated charts
**Needs:** 154 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Bind clones and properties to a table (CSV or JSON, or a content collection from Phase 270): bar, line, area, pie and donut charts made from shapes, with animated transitions when data changes (`src/core/signals/dataDrivenCharts.ts`).

**You'll see:** paste a CSV and get a bar chart built from your own shapes that animates when a number changes.
**Done when:** 5 chart references match the data exactly; the export renders the same chart.

### Phase 157 · Fields & effectors
**Needs:** 154 · **Was:** v3 90.1–90.3 · **Closes:** AUD-56 (fields) · **Status:** 🚧
- [x] Fields (`circle`, `box`, `capsule`, `ownShape`, `pathStroke`, `linear`, `noise`) with inner and outer radius and falloff; effectors (`keepOut`, `push`, `attract`, `swirl`, `transform`, `style`, `lookAt`, `jitter`) with strength, spring home and blending; hard Keep-Out constraint; gizmo heat maps (`src/core/signals/fieldsAndEffectors.ts`).

**You'll see:** letters that flee a circle and spring home.
**Done when:** the reference build (effector form) never draws a letter inside the circle at any tape checkpoint and springs every letter home within 0.5 px.

### Phase 158 · One evaluation space & no-maths kinetics
**Needs:** 157 · **Was:** v3 90.4–90.6 · **Status:** 🚧
- [x] Fields and targets evaluate in the top-level frame's space using full world transforms (Law 10), so nested, rotated and scaled parents interact correctly; "Stay inside" boundaries; Simple faces (`Reach`, `Gap`, `Edge` Hard/Soft, `Strength` Gentle/Clear/Strong, `Variety` with `Shuffle`) (`src/core/signals/worldSpaceKinetics.ts`).

**You'll see:** kinetics work inside rotated cards, set up without numbers.
**Done when:** the reference build passes inside a rotated, scaled card; the label check passes for every kinetic Simple face; 400 letters hold 60 fps.

### Phase 159 · Blueprint model & interaction library
**Needs:** 158 · **Was:** v3 72.1, 72.2 · **Closes:** AUD-50 (model), AUD-45 (cross-element) · **Status:** 🚧
- [x] `document.graphs`: event graphs, functions, macros, typed variables, custom events, exec and data pins, plus rule validation (pin types, latent placement, bounded loops) and standard interactive library (`src/core/nodescript/interactionLibrary.ts`).
- [x] Standard library: pointer, hover, focus, **key**, drag, view, scroll-crossing, breakpoint, mount, marker, state change, variable change, threshold, timer, overlap, and hit events; flow control; cross-element, state, sound, physics, and kinetic actions.

**You'll see:** nothing new until 167 adds the editors (model work).
**Done when:** grammar §10 and §13.8 examples and 10 cross-element interactions validate as graphs.

### Phase 160 · NodeScript text form & one model with the grammar
**Needs:** 159 · **Was:** v3 72.3, 72.4 · **Status:** 🚧
- [x] Integrated existing `src/core/nodescript/` lexer, parser, serializer, and `Interaction` namespace (`src/core/nodescript/interactionBridge.ts`). Every Simple binding and Simple rule compiles to a canonical `BlueprintGraph` fragment validated by one unified rules engine and round-tripping `graph → .nls → graph` across 500 seeded graphs.

**You'll see:** nothing new yet (the `.nls` text form is what AI and MCP use in 246 and 250).
**Done when:** graph → `.nls` → graph round-trips unchanged over 500 random graphs.

### Phase 161 · Blueprint runtime
**Needs:** 160 · **Was:** v3 74.1 · **Status:** 🚧
- [x] Events queued in the input phase; latent nodes as resumable, cancellable continuations; a per-frame node budget and loop guards; deterministic under the test clock and tapes (`src/core/nodescript/blueprintRuntime.ts`).

**You'll see:** interactions written in text form run live in Preview.
**Done when:** 20 reference graphs produce identical state timelines on repeated tape replays.

### Phase 162 · 2D physics core
**Needs:** 161 · **Was:** v3 91.3, 64.1 (decision) · **Status:** 🚧
- [x] Decision record 0006 (`DOCS/INITIAL/decisions/0006-stateful-simulation-and-determinism.md`): fixed 1/120 s step, seeded PRNG, snapshots for seeking. `src/core/physics2d/physicsCore.ts`: spatial-hash broadphase, SAT narrowphase, deterministic.

**You'll see:** a "drop test" in the Playground: shapes fall and bounce.
**Done when:** a 200-body scene replays bit-identically on the CPU across runs and browsers.

### Phase 163 · Colliders & bodies
**Needs:** 162 · **Was:** v3 91.1, 91.2 · **Status:** 🚧
- [x] Colliders (shapes derived from the layer: ellipse → circle, rectangle → box; trigger or solid; collision layers and masks). Bodies: static, kinematic, dynamic (home spring, damping, bounciness). Draggable bodies: kinematic while dragged, then thrown. Simple face: Weight, Bounce, Grip, Return, Gravity with a direction arrow.

**You'll see:** drag a letter and throw it into the others.
**Done when:** the falling-letters fixture matches stored snapshots at 5 checkpoints.

### Phase 164 · Contact events & collision view
**Needs:** 163 · **Was:** v3 91.4, 91.5 · **Closes:** AUD-56 (physics) · **Status:** 🚧
- [x] `OverlapBegin`, `OverlapStay`, `OverlapEnd`, `Hit` and `FieldEnter/Exit` events with `other` and contact pins, fired from the fixed step. "Show collision" draws colliders, contacts, normals and velocities.

**You'll see:** collision outlines and contact points while previewing.
**Done when:** contact events fire at the expected tape frames in 3 browsers.

### Phase 165 · Joints, ropes & chains
**Needs:** 164 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Hinge, spring, distance, rope and weld joints between bodies, to a fixed point or to the cursor; ropes and chains as generators.

**You'll see:** a badge on a rope that you can throw around.
**Done when:** joint references replay bit-identically and match stored snapshots at 5 checkpoints.

### Phase 166 · Soft bodies & jelly
**Needs:** 109, 165 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Soft bodies made from a shape's outline (springs and pressure): jelly buttons, squishy blobs that wobble on hover and squash on impact. The vector path itself is deformed, so edges stay sharp.

**You'll see:** a button that wobbles like jelly when you press it.
**Done when:** the outline never self-intersects in 1,000 random impacts; replay is deterministic.

### Phase 167 · Simple rules editor
**Needs:** 164 · **Was:** v3 73.1, 73.5, 73.6 · **Status:** 🚧
- [x] An Interactions list in the Motion tab: "When [event] on [layer] → Do [actions]" in plain language, ≤ 7 controls. Rules that mention overlap, hit, field or drag add the colliders, fields and home springs they need (listed under the rule, editable, removable with it). Rule parameters are dragged on the canvas or chosen by feel (Law 17).

**You'll see:** "When the button is hovered → the background glows" built from dropdowns.
**Done when:** 5 people each build "hover → background glows; click → confetti and the card flips" in < 3 minutes.

### Phase 168 · Blueprint graph editor & debugger
**Needs:** 167 · **Was:** v3 73.2, 73.3 · **Status:** 🚧
- [x] The Pro graph (reusing `BlueprintCanvas.tsx` after it meets Laws 8 and 9): pin-aware node search, comments, reroutes, collapse to function, variables panel. "Open as graph" from any Simple rule and back. Debugger in Preview: pulses on wires, breakpoints, watches, event log, step-through on the transport.

**You'll see:** an Unreal-style graph for any interaction, with live execution pulses.
**Done when:** a 25-step graph journey (create, wire, collapse, breakpoint, step) asserts the exact graph and trace.

### Phase 169 · Blueprint compiler & interaction parity
**Needs:** 168 · **Was:** v3 74.2–74.4, 91.6 · **Closes:** AUD-50 (runtime) · **Status:** 🚧
- [x] Graphs compile to plain TypeScript per target (React hooks, Vue composables, vanilla listeners) with node names as comments and no LazyLayout imports; CSS-expressible rules compile to CSS; keep-out rules compile to the effector or physics constraint. The vendored runtime gains `kinetics`, `physics2d` and `blueprint` modules. No arbitrary-code nodes.

**You'll see:** interactions work the same in the exported site.
**Done when:** 20 reference graphs pass journey parity in the Next, Vite and vanilla exports in 3 browsers; compiled code passes the fixtures' ESLint with no `any`.

### Phase 170 · Spawner
**Needs:** 169 · **Was:** v3 89.4 · **Status:** 🚧
- [x] The `Spawn` action creates runtime copies of a layer the user designed (at the pointer, a pin or a point), with velocity, spin, Variety and a lifetime with an exit; copies come from a pool with a cap per tier and can be bodies. Never saved into the document.

**You'll see:** click to spray confetti made of your own star shape.
**Done when:** the click-confetti build stays within its pool cap and matches tape replays.

### Phase 171 · Sound design & haptics
**Needs:** 99, 169 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] An original, licence-clean library of interface sounds (clicks, pops, whooshes, ticks, chimes) made for LazyLayout; a sound on any event; pitch, volume and pan bound to inputs (a faster drag sounds higher); vibration on phones that support it; one mute switch, and nothing plays before the user interacts.

**You'll see:** buttons that click and drags that whoosh, with a global mute.
**Done when:** sounds fire at the expected tape frames; nothing plays before interaction; the export matches.

### Phase 172 · Scene rasteriser: any layer to pixels
**Needs:** 17, 19, 74, 170 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Draw any layer or group (shapes, text, images, fills, strokes, masks, effects) into a bitmap from the same render definitions as the stage (Law 11). Decision record 0016 (scene rasteriser): SVG `foreignObject` capture or an in-house canvas renderer for LazyLayout's own primitives. Re-draws only what changed.

**You'll see:** Copy as PNG and Export selection as image give exactly what is on the canvas.
**Done when:** 30 gallery cases rasterise within 1% of a stage screenshot in 3 browsers; re-drawing a 1440 × 900 frame after an edit takes < 16 ms.

### Phase 173 · GPU surface strategy & compositor
**Needs:** 170 · **Was:** v3 61.1, 61.3 · **Closes:** AUD-46 (runtime, partial), AUD-49 · **Status:** 🚧
- [x] Decision record 0011 (GPU surface strategy): per-surface canvases within a budget, a shared backdrop canvas, or one hidden context blitting to 2D, per surface role; WebGL2 baseline, WebGPU opt-in through three.js TSL; minimal in-house WebGL2 helper or OGL (Unlicense) for 2D surfaces.
- [x] The compositor owns every context (Law 13): ≤ 8 live surfaces on desktop and ≤ 4 on mobile, posters over budget, device tiers T0–T3 with a frame-time controller, pausing offscreen and in hidden tabs, async compile, context-loss recovery.

**You'll see:** a test surface on the canvas that pauses offscreen and recovers from a forced context loss.
**Done when:** a 20-surface page never exceeds the budget or logs "Too many active WebGL contexts" in 3 browsers; a forced loss recovers within 1 s.

### Phase 174 · Passes, render targets & GPU memory ledger
**Needs:** 173 · **Was:** v3 61.2, 61.5 · **Closes:** AUD-58 (partial) · **Status:** 🚧
- [x] Pass stacks (program, feedback ping-pong, post: grain, dither, vignette, bloom-lite, pixelate, chromatic offset); float targets after a capability check. A memory ledger for every texture, target, buffer and canvas, with per-tier budgets (T1 96 MB, T2 256 MB, T3 512 MB initially) and a degrade order; a shared render-target pool; a program cache; Safari canvas limits.

**You'll see:** a memory readout in the dev overlay.
**Done when:** mounting and unmounting a surface 100 times returns the ledger to 0 and the heap to within 2 MB.

### Phase 175 · Layer textures, outlines & distance fields
**Needs:** 172, 174 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Any layer or group becomes a live GPU texture, an outline path (for effects that ride an edge) and a signed distance field (how far every pixel is from the shape). They update when the layer changes and count against the memory ledger (Phase 174).

**You'll see:** a debug view that shows any layer as a texture, an outline or a distance field.
**Done when:** distance-field error < 0.5 px on 10 shapes; textures update within one frame of an edit; the ledger returns to 0 after unmount.

### Phase 176 · Surfaces in the editor & the first interactive background
**Needs:** 174 · **Was:** v3 61.4, 19.1 · **Status:** 🚧
- [x] Only the focused frame runs live surfaces; other frames and breakpoint copies show their last frame. A `background` surface fills its frame behind its siblings and stays selectable in Design mode.
- [x] **Vertical slice:** one hand-written shader background that bends toward the cursor through a binding, scrubbed with a tape, with reduced-motion and touch behaviours.

**You'll see:** a cursor-reactive shader background on your hero, scrubbable on the timeline.
**Done when:** the slice matches stored frames at tape checkpoints within the GPU tolerance.

### Phase 177 · Shader graph
**Needs:** 176, 175 · **Was:** v3 62.1, 62.3 · **Status:** 🚧
- [x] A typed node graph (float, vec, colour, texture, SDF) compiling to GLSL ES 3.00 and TSL; the uniform contract (`uTime`, `uResolution`, `uSeed`, pointer uniforms from bindings, props); noise, SDF, pattern, colour, distortion, texture, feedback and post nodes; a static cost estimate feeding the rules and tiers.
- [x] **v4.1:** layer texture, outline and distance-field nodes (Phase 175), so a shader can read any layer's pixels and shape.

**You'll see:** build backgrounds visually, like Unreal's material editor.
**Done when:** 10 reference backgrounds built from the graph alone compile on WebGL2 and WebGPU and match within tolerance; a node edit updates the stage in < 100 ms.

### Phase 178 · Raw GLSL (Pro) & shader safety
**Needs:** 177 · **Was:** v3 62.2 · **Status:** 🚧
- [x] A GLSL editor with errors mapped to lines and hot reload; its uniform block becomes props. Safety: constant loop bounds, a texture-fetch budget, async compile, and a program that loses the context twice is disabled for the session.

**You'll see:** a code editor for shaders in Pro mode.
**Done when:** an injected unbounded-loop shader is refused at compile time.

### Phase 179 · Effect layers
**Needs:** 74, 175, 178 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] An effect layer applies a shader (from the graph or the library) to everything below it in its parent, or to one target layer, like an After Effects adjustment layer: dither, pixelate, chromatic split, displacement, halftone, glitch and colour grade. Masks and blend modes apply to it.

**You'll see:** drop a Dither effect layer over a hero and everything under it is dithered.
**Done when:** 8 effect-layer references match within the GPU tolerance in 3 browsers; text underneath stays real in the DOM.

### Phase 180 · Outline effects: light that rides edges
**Needs:** 179 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Effects driven by a layer's outline and distance field: electric borders, a star that travels the exact outline, light that pours over corners, liquid metal inside a logo, and rims that brighten near the cursor.

**You'll see:** a crackling electric border on any button that follows its real corners.
**Done when:** 6 outline references match within the GPU tolerance on 5 shapes each; budgets hold on low tiers.

### Phase 181 · Backdrop sampling & liquid glass
**Needs:** 180 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Layers that bend, blur and tint what is behind them: refraction shaped by the layer's distance field (liquid glass), lenses and magnifiers, frosted panels with edge light. Built on the scene rasteriser so it works in every browser, with a `backdrop-filter` fast path where available and a blur fallback.

**You'll see:** Apple-style liquid glass over your own design, in Safari and Firefox too.
**Done when:** glass references match within the GPU tolerance in 3 browsers; each tier stays within its budget.

### Phase 182 · 2D lights & surface depth
**Needs:** 175, 179 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Point and spot lights for flat designs: layers get a surface (flat, embossed from their shape, or a normal map), and lights cast highlights, soft shadows and glints. A light can follow the cursor.

**You'll see:** a light that follows the mouse across embossed cards.
**Done when:** lighting matches references within the GPU tolerance; 20 lit layers hold 60 fps on mid tiers.

### Phase 183 · Particles & force fields
**Needs:** 178, 175 · **Was:** v3 63, 19.2 · **Status:** 🚧
- [x] Niagara-style module stack (emitter → spawn → update → render); forces (gravity, drag, noise and curl, vortex, pointer attract/repel/orbit, spring-to-shape, bounds); CPU (≤ 5k) and GPU (≤ 250k) backends by tier; points, sprites, links, trails, instanced meshes; interaction modes (grab, repulse, burst on tap, scatter on scroll).
- [x] **v4.1:** emit from, stick to and fill any layer's shape (its outline and distance field, Phase 175), so text can assemble from particles.

**You'll see:** particle fields that swirl around the cursor.
**Done when:** 5 reference effects hold their tier budgets; CPU and GPU backends agree within 2% on density and centroid at checkpoints; seeded runs repeat exactly.

### Phase 184 · Stateful simulations & replay
**Needs:** 183 · **Was:** v3 64.2, 64.3 · **Closes:** AUD-48 · **Status:** 🚧
- [x] Stable fluids with pointer splats, spring-mass lattices (grid distortion, dot fields with shockwaves), Verlet ropes and cloth, metaballs and SDF blobs, rigid bodies on the physics core (162). Simulations run at reduced resolution per tier, and scrubbing re-simulates from the nearest snapshot (≤ 50 ms per seek; CPU modules in a worker).

**You'll see:** a fluid splash that follows the cursor and scrubs on the timeline.
**Done when:** each module's reference replay matches stored snapshots at 5 checkpoints in 3 browsers; a 10 s back-and-forth scrub never shows two states for one time.

### Phase 185 · Deformation: mesh warp, bend & peel
**Needs:** 109, 175, 184 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Deform any layer with a warp mesh (envelope, bend, bulge, wave, flag), and bend or peel it from a corner or edge (stickers, page curls), as modifiers that can be animated and bound to inputs. The real DOM stays underneath for accessibility; the deformed look is drawn from the layer texture.

**You'll see:** peel a sticker off the page by dragging its corner.
**Done when:** deformation references match within the GPU tolerance; the accessibility tree is unchanged.

### Phase 186 · Fracture: shatter, strips & tearing
**Needs:** 112, 163, 185 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Break a layer into pieces along Voronoi cells, strips (a shredder), a grid or a drawn tear line; the pieces become physics bodies or spring home, and the layer can pull itself back together.

**You'll see:** click a card and it shatters, then reassembles.
**Done when:** fracture replays are deterministic; pieces tile the original exactly (no gaps or overlaps above 0.5 px).

### Phase 187 · Media as texture & distortion
**Needs:** 184, 175 · **Was:** v3 65 · **Status:** 🚧
- [x] Images, video, text (SDF or canvas, re-rendered on font load and resize) and rasterised SVG as textures. Hover displacement, pixel and dither transitions, grid and wave distortion, halftone reveals, image trails, glass and lens. Real text and `alt` stay in the DOM; SVG-filter or CSS fallbacks for low tiers.
- [x] **v4.1:** built on the general layer textures (Phase 175) instead of its own capture; video becomes a fill in the fill stack (Phase 113), using the video assets of Phase 99.

**You'll see:** images that ripple under the cursor.
**Done when:** 6 references work on image, video and text; the accessibility tree reads the real text and alt once; fallbacks render with WebGL disabled.

### Phase 188 · Scroll-scrubbed image sequences & video
**Needs:** 81, 99, 187 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Apple-style scroll stories: an image sequence or a video scrubbed by scroll (or any input), with preloading per device tier, a frame budget, a poster fallback and pinned sections.

**You'll see:** a product that turns around as you scroll.
**Done when:** scrubbing shows the right frame at 20 scroll positions in 3 browsers; memory stays within the tier budget.

### Phase 189 · Smooth scrolling & scroll physics
**Needs:** 188 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Page-wide smooth scrolling (inertia and easing) with the native scroll as fallback, snapping per section, and scroll-velocity effects. Respects reduced motion, keyboard scrolling and find-in-page.

**You'll see:** a site that scrolls smoothly with sections that snap into place.
**Done when:** keyboard, find-in-page and anchor links work; reduced motion turns smoothing off; the export matches.

### Phase 190 · Depth parallax by scroll and cursor
**Needs:** 129, 143, 189 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] The Stage 3 depth camera bound to scroll and the cursor with one-click presets: multi-plane parallax, dolly on scroll, look-around with the cursor, and tilt on phones.

**You'll see:** a hero with 5 depth planes that parallax with the cursor and with scroll.
**Done when:** plane offsets match the projection at tape checkpoints; the export matches the stage.

### Phase 191 · Cursor & overlay layer
**Needs:** 187, 155, 180 · **Was:** v3 66 · **Status:** 🚧
- [x] One cursor layer per page: follower, blob, trail, splash, target brackets, image trail, magnetic snap. Cursor states from what's under the pointer; hiding the native cursor is opt-in and never over text inputs, under reduced motion or on touch; focus rings stay visible. Runs live only in Preview and the Playground.
- [x] **v4.1:** cursors read roles and outlines (Phases 155 and 180): brackets that snap to a button's real corners, a crosshair that measures what it locks onto, a swarm that flows around hovered buttons.

**You'll see:** custom cursors in Preview.
**Done when:** 8 cursor references pass mouse, pen and touch profiles; axe and keyboard-only journeys pass with the cursor layer on.

### Phase 192 · Effect SDK: effects as data
**Needs:** 191 · **Was:** v3 67 · **Closes:** AUD-54 (engine) · **Status:** 🚧
- [x] `EffectDefinition` v1 (spec §11): props view-model with AI descriptions, surfaces and programs by reference, bindings and affordances, states, fallback, touch and reduced-motion policies, tier costs, poster, export templates, provenance. Instances store only overrides; definitions migrate by version. Fork into the project, edit, publish to the project library. Every definition ships a tape test and a Playground scene.

**You'll see:** fork any library effect and change how it works.
**Done when:** every library effect is a definition validated in CI with no per-effect code; a definition migration round-trips 100 fixtures.

### Phase 193 · Library: interaction, backgrounds, cursors & distortion
**Needs:** 192 · **Was:** v3 25.3 (waves 2, 5, 7, 8, 9) · **Closes:** AUD-54 (library) · **Status:** 🚧
- [x] Wave 2 interaction (8), Wave 5 backgrounds (7), Wave 7 interactive backgrounds (≥ 20, ≥ 15 pointer-reactive, ≥ 5 scroll-reactive), Wave 8 cursors (≥ 10), Wave 9 distortion (≥ 8). Original implementations with provenance; open recipes wherever the primitives can express them.

**You'll see:** 50+ interactive effects ready to insert (80+ in the library with Stage 2's).
**Done when:** each passes the Playground sweep, tape parity and its tier budget; a new user makes a background react to the cursor in < 2 minutes.

### Phase 194 · Library: micro-interactions, glass, light & deformation
**Needs:** 193 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Wave 10 micro-interactions (≥ 20: hold, slide, swipe, sling, toggles, ratings), Wave 11 glass, light and outline effects (≥ 12), Wave 12 deformation and fracture (≥ 8), Wave 13 sound packs. Original implementations with provenance (GATE-02).

**You'll see:** 40+ more ready-made effects, each one open to see how it is built.
**Done when:** each passes the Playground sweep, tape parity and its tier budget.

### Phase 195 · Sandbox boundaries for untrusted code
**Needs:** 193 · **Was:** v3 80.2 · **Status:** 🚧
- [x] Opaque-origin sandboxed iframes (`allow-scripts` without `allow-same-origin`) with typed MessageChannel bridges; no editor-origin storage, cookies or tokens reachable from any user-content frame (decision record 0012, code isolation).

**You'll see:** nothing yet; 196 runs code components inside it.
**Done when:** a malicious fixture reading `document.cookie`, `localStorage` and `parent.document` gets nothing in 3 browsers.

**Status check (2026-11-16, audit), 🚧:** before this the sandbox frame never ran the component (its script only answered `ready`) and the "malicious access" report was fixed strings. Now the frame runs the bundle it is sent, and `tests/e2e/code-sandbox.spec.ts` runs a hostile bundle in a real Chromium frame: the host's cookie, localStorage, parent document and network are out of reach and the token never arrives (the test fails if `allow-same-origin` is added). Still missing: no code component is mounted in the editor through this frame yet.

### Phase 196 · Code components
**Needs:** 195 · **Was:** v3 68 · **Status:** 🚧
- [x] Import TSX/JSX, files or an npm package; bundle in a worker (esbuild-wasm) with pinned, hashed dependencies; render in the sandbox; infer property controls from prop types (JSDoc hints optional); bind props to signals, variables and states; callback props become Blueprint events; record the licence and keep restricted ones private (GATE-03).

**You'll see:** paste your own animated React component and get inspector controls for it.
**Done when:** 10 real-world fixtures import, render, expose controls and export to a Next app that builds.

### Phase 197 · Interactive export runtime
**Needs:** 196, 194 · **Was:** v3 69.1, 69.2 · **Status:** 🚧
- [x] The exporter copies only the vendored modules an effect uses (`ticker`, `signals`, `kinetics`, `physics2d`, `blueprint`, `gl`, `particles`, `sims`, `cursor`) as readable source with an MIT notice. React for Next and Vite (client boundary, poster first, init after idle, cleanup releases contexts), Vue 3 and a Web Component. Memory discipline as in the editor.
- [x] **v4.1:** runtime modules for the new capabilities (`gestures`, `raster`, `deform`, `audio`), copied only when an effect uses them.

**You'll see:** export any interactive effect and it runs in your own app with no LazyLayout package.
**Done when:** every library effect builds in the Next, Vite, Vue and HTML fixtures and passes tape parity.

### Phase 198 · Embed script, size budgets & Web Vitals
**Needs:** 197 · **Was:** v3 69.3–69.5 · **Status:** 🚧
- [x] A framework-free embed (`<script type="module">` + `<div data-fx>`) for Webflow, Framer, Wix, WordPress and plain HTML (self-hosted until 268). Per-family size budgets in CI; the poster reserves the box (CLS 0), init waits for LCP, effects pause offscreen.

**You'll see:** "Copy embed code" for any effect.
**Done when:** every effect meets its size budget with CLS 0 and no long task ≥ 50 ms at init; the embed works under a strict nonce-based CSP.

### Phase 199 · Interactive accessibility
**Needs:** 198 · **Was:** v3 29 (v3.0 amendment), 29.4 · **Closes:** AUD-14 · **Status:** 🚧
- [x] Per-effect reduced-motion policy (freeze, calm, off); a pause control and page-wide switch for motion longer than 5 s; flash detection on sampled GPU frames under aggressive tapes; dynamic contrast for text over animated backgrounds; target stability; cursor safeguards; rules 6.12–6.15 checked at runtime; axe on every export.

**You'll see:** accessibility warnings in the inspector with one-click fixes.
**Done when:** axe reports 0 violations across the export matrix; the reduced-motion run with pointer tapes shows no spatial movement.

### Phase 200 · Interactive performance budgets per tier
**Needs:** 199 · **Was:** v3 26 (v3.0 amendment) · **Closes:** AUD-55 (simulated tiers) · **Status:** 🚧
- [x] Budgets per device tier for every interactive effect (frame time, memory, live surfaces, runtime size), measured under input tapes with a 10-minute soak on simulated low and mid tiers. Real phones come in 261.

**You'll see:** tier badges (runs on low / mid / high devices) on every effect.
**Done when:** every library effect meets its simulated tier budgets in CI.

### Phase 201 · Composition test suite
**Needs:** 200 · **Was:** v3 91.7 · **Closes:** AUD-57 · **Status:** 🚧
- [x] Ten interactions built from primitives only (no code, no preset, no typed numbers), run in 3 browsers and on a phone profile, then exported and parity-checked: letters flee an invisible cursor circle; a magnetic dot grid with a click shockwave; a cursor chain; falling, throwable letters with a reset; eyes that look at the cursor; scroll scatter; click confetti of your own shape; a tilting card grid; an orbit around a lagging helper; a hit counter that plays a composition and a sound.
- [x] **v4.1:** five more builds from primitives: letters that get bolder as the cursor nears (inside a fixed box); a sticker that peels and is thrown; a jelly button; a liquid-glass navigation bar over the design; a 3D ring of cards dragged with momentum.

**You'll see:** the same 10 builds work for anyone, from primitives.
**Done when:** all 10 pass, and no Simple face in them shows a technical parameter.

### Phase 202 · Stage 4 gate: the interactive journey
**Needs:** 132–201 · **Was:** v3 58.5, 58.6 · **Status:** 🚧
- [x] **Journey A (React):** a hero with a cursor-reactive background, a magnetic CTA, a cursor effect and a rule (hover → glow, click → particles and a card flip), scrubbed with a tape, opened as a graph, exported and parity-checked on desktop and a mid-tier phone profile.
- [x] **Journey B (Compose):** the reference build from primitives in < 5 minutes: helper circle following by its bottom pin, Split letters, "keep outside, spin, spring home" rule, opened as a graph, exported, accessibility tree and touch profile checked.
- [x] **Journey C (Keyboard):** a card carousel driven by arrows and focus, identical in the export.
- [x] **Journey D (Bring your own):** an imported component with one prop bound to the cursor, exported, isolation verified.
- [x] **v4.1 Journey E (Feel):** a hero with depth parallax, a liquid-glass navigation bar, a hold-to-confirm button with sound and haptics, and a card that shatters and reassembles, exported and parity-checked.

**You'll see:** LazyLayout's pitch, working end to end: interactive effects anyone can add, compose and export.
**Done when:** the journeys pass in CI in 3 browsers, plus one recorded manual run.

---

# STAGE 5 — CHARACTERS & RIGGING (Phases 203–217)

> **Stage output (new in v4.1):** Rive-style characters inside real websites. Bones drawn on the canvas, poses on the timeline, meshes with painted weights so images and vectors bend smoothly, IK, constraints with natural limits and secondary motion (jiggle), puppet pins, and rigs that react: a head that follows the cursor while the neck bends, a character that walks with the arrow keys, blends between states, blinks, breathes and lip-syncs, and even copies your own head through the webcam. Auto-rig gets an illustration moving in one click, and the `rig` runtime exports it with parity.
>
> Order inside the stage: model and posing (203–205) → deformation, IK and constraints (206–209) → reactive rigs and states (210–211) → auto-rig, faces and tracking (212–214) → export, library and the gate (215–217).

**Status check (2026-11-16, audit), 🚧:** the gate ran pure modules, not the editor. Journey A's "export parity" compared a number with itself and its phone figure was a formula; it now replays the tape on a fresh controller (and a real touch run). Journeys C and E compare two runs of the same code, so they check determinism, not export parity. Of the 78 new Stage 4 source files, 4 are reachable from `/editor`; 38 only from `/editor/interactive-lab` and 36 from nothing. The Signals, Simple rules and state-machine panels are mounted nowhere. Not ✅ until the journeys run in the editor and the export.

### Phase 203 · Rig model: bones & skins
**Needs:** 72, 73, 185, 202 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Bones (length, rest pose, parent) in the document, with layers bound to bones rigidly or through mesh weights; claim the schema version in `CLAIMS.md`. Evaluated in the kernel (Law 3) and deterministic. Decision record 0017 (rigging): the skinning maths and how vectors and images deform.

**You'll see:** nothing new yet; Phase 204 adds the bone tool (model work).
**Done when:** 20 rig fixtures evaluate to hand-computed poses.

### Phase 204 · Bone tool & posing
**Needs:** 203 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Draw bone chains on the canvas, attach layers, rotate bones to pose (forward kinematics), switch to the rest pose, and show or hide the bone overlay.

**You'll see:** draw an arm with 3 bones and pose it.
**Done when:** a 15-step posing journey gives exact transforms and one undo step per gesture.

### Phase 205 · Bones on the timeline
**Needs:** 66, 67, 71, 204 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Keyframe poses, with onion skin for poses, copy and mirror poses, and a pose library.

**You'll see:** a 3-pose wave keyframed in a few clicks.
**Done when:** keyed poses match `evaluate()` at 10 times; the export matches.

### Phase 206 · Mesh deformation & weights
**Needs:** 205 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Turn an image or a vector into a deformable mesh (automatic triangulation with a density control), bind it to bones with automatic weights, paint weights with a brush and smooth them. Vectors deform as paths (crisp); images deform through textures.

**You'll see:** a character's body bends smoothly when its spine bone turns.
**Done when:** deformed vertices match references within 0.5 px; weights always add up to 1.

### Phase 207 · Inverse kinematics
**Needs:** 206 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] IK chains (two-bone and multi-bone), targets you drag, bend direction, stretch, and angle limits per bone; switch and blend between FK and IK.

**You'll see:** drag a hand and the whole arm follows naturally.
**Done when:** IK solutions match references at 50 target positions; limits are never exceeded.

### Phase 208 · Constraints & secondary motion
**Needs:** 207 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Look at (with angle limits and smoothing), copy position, rotation or scale, stay at a distance, follow a path, limit rotation, and jiggle: springs that make hair, ears and antennae wobble after a move.

**You'll see:** eyes and a head that turn towards a target within natural limits, and ears that wobble.
**Done when:** constraints match references at tape checkpoints; jiggle replays deterministically.

### Phase 209 · Puppet pins
**Needs:** 206 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] After Effects-style puppet pins for quick deformation without bones: drop pins on any layer, drag and keyframe them, mark areas that stay stiff, and set overlap order.

**You'll see:** make a flag wave by dragging three pins.
**Done when:** pin deformations match references; keyframed pins match `evaluate()`.

### Phase 210 · Rigs that react
**Needs:** 135, 208, 209 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Bind IK targets, look-at targets and bone rotations to inputs: the head and eyes follow the cursor, the body leans with scroll speed, the character walks with the arrow keys and reacts to clicks. Simple face: "Follow the cursor with: eyes · head · whole body".

**You'll see:** a character whose head follows the cursor while its neck bends.
**Done when:** 5 reactive rigs match tapes at checkpoints in 3 browsers; keyboard equivalents pass.

### Phase 211 · Character states & blend trees
**Needs:** 151, 210 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Animation states for rigs (idle, walk, run, jump) with 1D and 2D blends by inputs such as speed and direction, crossfaded transitions, and layered states (wave with the arms while the legs walk).

**You'll see:** a character that blends from walking to running as you hold the arrow key longer.
**Done when:** a 5-state machine driven by a tape matches hand-computed poses.

### Phase 212 · Auto-rig & pose sliders
**Needs:** 211 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] One click "Rig this character" for common shapes (person, animal, face, simple mascots), using layer names and geometry; pose presets (happy, sad, wave, point) as sliders that blend.

**You'll see:** a ready rig and expression sliders on an imported illustration.
**Done when:** auto-rig succeeds on 8 of 10 fixture illustrations without manual fixes.

### Phase 213 · Faces: expressions, blinks & lip sync
**Needs:** 99, 212 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Face rigs with blinks, brows and mouth shapes; mouth shapes from an audio track's levels or a transcript; automatic blinking and breathing for idle life.

**You'll see:** a character that blinks on its own and moves its mouth with a voice line.
**Done when:** mouth shapes follow the reference timing within one frame on 3 voice clips.

### Phase 214 · Face & pose tracking as an input
**Needs:** 135, 213 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Webcam face and body tracking on the device (an ML model with its licence recorded, Law 7) as inputs: head turn, blinks, mouth open, hand position. They drive rigs live or record as tapes. Video never leaves the device.

**You'll see:** your character copies your head movements through the webcam.
**Done when:** recorded tracking tapes replay identically; with the camera denied, the rig falls back to the cursor.

### Phase 215 · Rig export runtime
**Needs:** 197, 214 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] A `rig` runtime module (skinning for SVG paths, canvas and WebGL), copied only when used; parity with the editor under tapes; Lottie export of bone animation where Lottie can express it.

**You'll see:** export a rigged, reactive character and it behaves the same on your own site.
**Done when:** 5 rigged references pass tape parity in the Next, Vite and HTML exports.

**Status check (2026-11-16, audit), 🚧:** the parity check compared the editor's rig evaluation with itself. It now runs the emitted `rig-runtime` source and compares heads and tails; doing so found that the exported runtime placed a bone wrong when it was listed before its parent (fixed). Rigs are not in the editor: Stage 5 is reachable only from `/editor/rig-lab`.

### Phase 216 · Rig library & recipes
**Needs:** 215 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Original rigged characters and parts (eyes, faces, hands, mascots) as open recipes with provenance.

**You'll see:** drop in a ready mascot and make it look at the cursor in one click.
**Done when:** every library rig passes tape parity and its tier budget.

### Phase 217 · Stage 5 gate: the character journey
**Needs:** 203–216 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Import an illustration, auto-rig it, fix the weights, give it a head that follows the cursor and blinks, a walk and run on the arrow keys, lip sync to a voice line, then export to Next and Vite with parity checked.

**You'll see:** Rive-style characters inside a real website, made without code.
**Done when:** the journey passes in CI in 3 browsers, plus one recorded manual run.

---

# STAGE 6 — 3D (Phases 218–240)

> **Moved to `ROADMAP_3D.md` (2026-11-11), re-ordered 2026-11-13.** Stage 6 is replaced by the 3D roadmap, which now also carries the photo studio and the anime studio. Its build order is its §0a. Rows in the index above that say *→ ROADMAP_3D 3D-…* are done there, not here. Phases this file owes it: **99** (video and audio layers; needed by tracking, 3D-205, and shots, 3D-223), **76–79** (links, expressions, states, transitions; Lane B) and the animation phases Lane B builds around them (3D-218 time on twos, 3D-227 live animation mixing). **Lane F status (PR #184):** All 227 phases (`3D-001`–`3D-227`, milestones `M1`–`M6`, `M1+`, and `3D-227`) are implemented in `src/core/3d/roadmap3d/`, documented in Decisions `0019`–`0025`, and exposed for live headed verification on `/editor/scene3d-lab`.

> **Stage output:** real 3D inside the same documents, timeline and interactions: a scene layer drawn through the GPU compositor, Spline-style editing with gizmos, primitives and 3D text, GLTF models (including their animations), PBR materials, lights, shadows and environments, cameras and camera paths, 3D keyframes, cursor and scroll reactions, raycast events for Blueprints, instancing, 3D physics, post-processing, and export to React Three Fiber or plain three.js.
>
> **Why three.js and not our own engine:** three.js, React Three Fiber and drei are MIT-licensed (§1.9), which allows commercial use. Building a custom 3D engine would cost years and add nothing a user would see. If that ever changed, Phase 218's decision record names the fallback.

**Status check (2026-11-16, audit), 🚧:** the gate runs the rig modules with built-in inputs; none of it runs in `/editor`. The rig maths is real (breaking the IK law of cosines fails its tests); export parity is now checked against the exported code (Phase 215).

### Phase 218 · 3D stack decision & licences
**Needs:** 202 · **Was:** v3 18 (v3.0, v3.3 amendments) · **Status:** 🚧
- [x] Decision record 0013 (3D stack): three.js r186+ through the compositor (one renderer per context, shared by every 3D layer); `WebGPURenderer` with TSL falling back to WebGL2; R3F for export and React targets; a 3D physics engine chosen by benchmark among permissively licensed candidates (licence recorded in `LICENSES.md` before use); the fallback if a licence ever changed (the compositor's WebGL2 helper for 2.5D; a new stage for full 3D).
- [x] Record three.js, R3F, drei and the physics engine in `LICENSES.md` (Law 7).

**You'll see:** nothing yet (a decision). 219 draws the first scene.
**Done when:** the record is reviewed and every 3D dependency is in `LICENSES.md`.

### Phase 219 · Scene layer
**Needs:** 218 · **Was:** v3 18.1 · **Closes:** AUD-11 · **Status:** 🚧
- [x] A `scene3d` layer kind, lazily loaded, rendered through the compositor (shared contexts, posters offscreen, context-loss recovery). The 3D archetypes (object, camera, light) become reachable in the editor.

**You'll see:** add a 3D scene to any frame.
**Done when:** a scene renders in 3 browsers and recovers from a forced context loss.

### Phase 220 · 3D viewport editing
**Needs:** 219 · **Was:** — (new) · **Status:** 🚧
- [x] Enter a scene to edit it: orbit, pan and dolly camera; translate, rotate and scale gizmos with snapping; click selection by raycast; grid, axes and local/world space toggle; frame selected. All are commands (Law 20).

**You'll see:** Spline-style 3D editing inside the canvas.
**Done when:** a 15-step gizmo journey gives exact transforms and one undo step per gesture.

### Phase 221 · Scene hierarchy & 3D inspector
**Needs:** 220 · **Was:** — (new) · **Status:** 🚧
- [x] Scene objects appear in the Layers panel (grouping, parenting, visibility); the inspector shows position, rotation (Euler display, quaternion stored) and scale, with Simple and Pro faces.

**You'll see:** 3D objects listed and edited like any other layer.
**Done when:** reparenting in the tree keeps world transforms (golden tests).

### Phase 222 · Primitives & 3D text
**Needs:** 221 · **Was:** v3 18.2 (primitives) · **Status:** 🚧
- [x] Box, sphere, cylinder, torus, plane, capsule and 3D text (extruded, with the project's fonts); parameters editable with handles.

**You'll see:** drop in 3D shapes and extruded headlines.
**Done when:** each primitive renders identically (within GPU tolerance) in 3 browsers.

### Phase 223 · Inflate & extrude any vector into 3D
**Needs:** 103, 222 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Turn any 2D shape, text or logo into 3D: extrude with bevels, inflate into a puffy balloon shape, or lathe around an axis. It stays linked to its 2D source, so edits update the 3D.

**You'll see:** your logo becomes a puffy 3D object that updates when you edit the logo.
**Done when:** meshes are watertight for 10 reference shapes; an edit to the 2D source updates the mesh in < 100 ms.

### Phase 224 · GLTF import pipeline
**Needs:** 222 · **Was:** v3 18.2 (GLTF), 54 (v3.3 amendment) · **Status:** 🚧
- [x] GLTF/GLB import into the asset store: validation and sanitising (rules from Phase 16), Draco and meshopt decoding, KTX2/Basis textures transcoded in a worker, tier-sized variants, thumbnails.

**You'll see:** drag a `.glb` model onto a scene.
**Done when:** 10 sample models import; a malformed fixture is rejected with a reason.

### Phase 225 · Materials & textures
**Needs:** 224 · **Was:** v3 18.2 (materials) · **Status:** 🚧
- [x] PBR materials (colour, metalness, roughness, normal, emissive, transmission, clearcoat) with a material inspector and presets; texture maps from the asset store; shared materials.

**You'll see:** make an object look like glass, metal or plastic.
**Done when:** material presets match reference renders within tolerance.

### Phase 226 · Lights, shadows & environments
**Needs:** 225 · **Was:** v3 18.2 (lights) · **Status:** 🚧
- [x] Ambient, directional, point, spot and area lights with gizmos; shadows with quality per tier; HDRI environments and backgrounds; tone mapping.

**You'll see:** light a scene and see real shadows.
**Done when:** lighting references render within tolerance and stay within tier budgets.

### Phase 227 · Cameras & camera paths
**Needs:** 226 · **Was:** v3 18.3 (camera) · **Status:** 🚧
- [x] Perspective and orthographic cameras, an active-camera switch, field of view and depth of field settings, and camera paths drawn in 3D (constant speed, look-at target).

**You'll see:** a camera flying along a path through your scene.
**Done when:** sampled camera positions on a path match `evaluate()`.

### Phase 228 · 3D keyframes on the timeline
**Needs:** 227 · **Was:** v3 18.3 (tracks) · **Status:** 🚧
- [x] Position, rotation (quaternion slerp) and scale tracks, material and light properties, camera properties; 3D motion paths and onion skin in the scene view.

**You'll see:** animate 3D objects on the same After Effects-style timeline.
**Done when:** 3D tracks match `evaluate()` at 5 times; scrubbing is exact.

### Phase 229 · Animated GLTF playback
**Needs:** 228 · **Was:** — (new) · **Status:** 🚧
- [x] Skeletal clips and morph targets from imported models appear as clips on the timeline (trim, loop, blend, speed) and can be triggered by states and Blueprints.

**You'll see:** a character model's walk cycle placed on the timeline.
**Done when:** an animated sample model scrubs exactly and plays in sync with other layers.

### Phase 230 · 3D skeletons & IK
**Needs:** 207, 208, 229 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Pose skinned GLTF models with the same bone tools, IK, constraints and look-at as 2D rigs (Stage 5).

**You'll see:** a 3D character's head that follows the cursor.
**Done when:** 3D IK matches references at 50 targets; the export matches.

### Phase 231 · 3D materials in the shader graph & WebGPU
**Needs:** 229 · **Was:** v3 18 (v3.0 amendment), 62 (TSL) · **Status:** 🚧
- [x] The shader graph (177) targets TSL node materials for 3D objects; the WebGPU path (opt-in, with WebGL2 fallback) is tested end to end.

**You'll see:** custom animated materials built visually.
**Done when:** 5 graph materials match between WebGPU and WebGL2 within tolerance.

### Phase 232 · 3D reactions & raycast events
**Needs:** 231 · **Was:** v3 18.3 (pointer) + new · **Status:** 🚧
- [x] Bindings into 3D (tilt, parallax, look-at, follow in 3D, scroll-driven camera); raycast pointer events (enter, leave, click, drag on objects) for the Blueprint library; keyboard bindings for 3D (orbit with arrows).

**You'll see:** an object that turns toward the cursor and reacts when clicked.
**Done when:** scripted tapes produce the expected object transforms and Blueprint events.

### Phase 233 · Page layers inside 3D scenes
**Needs:** 232 · **Was:** — (new in v4.1) · **Status:** 🚧
- [x] Real page layers (text, buttons, forms) placed in a 3D scene and kept as DOM (CSS 3D), so they stay selectable, accessible and crisp, with occlusion by 3D objects where possible.

**You'll see:** a real button on a 3D screen that you can click.
**Done when:** the layers stay in the accessibility tree; their position matches the 3D projection within 1 px.

### Phase 234 · Instancing, LOD & 3D cloners
**Needs:** 232 · **Was:** — (new; extends 154 to 3D) · **Status:** 🚧
- [x] Instanced meshes, levels of detail, and grid, radial, scatter and path cloners in 3D with per-instance attributes usable by bindings and effectors.

**You'll see:** thousands of 3D objects reacting together.
**Done when:** 10,000 instances hold the mid-tier budget.

### Phase 235 · 3D physics
**Needs:** 234 · **Was:** — (new) · **Status:** 🚧
- [x] Rigid bodies and colliders on the engine chosen in 218, deterministic fixed step with snapshots for scrubbing, contact events for Blueprints, draggable 3D bodies.

**You'll see:** drop objects into a scene and throw them around.
**Done when:** a 100-body scene replays within tolerance at checkpoints; contact events fire at the expected frames.

### Phase 236 · Post-processing
**Needs:** 235 · **Was:** — (new) · **Status:** 🚧
- [x] Bloom, depth of field, ambient occlusion, colour grading and vignette as an ordered stack, each with a cost per tier and automatic downgrade.

**You'll see:** cinematic glow and depth of field.
**Done when:** each effect stays within its tier budget and degrades in the documented order.

### Phase 237 · 3D memory discipline
**Needs:** 236 · **Was:** v3 18 (v3.3 amendment) · **Closes:** AUD-58 (3D) · **Status:** 🚧
- [x] Every geometry, material, texture and target is reference-counted in the ledger and disposed when unused; loader caches cleared; programs precompiled asynchronously.

**You'll see:** big scenes stay stable for long sessions.
**Done when:** loading and unloading a GLTF 20 times returns `renderer.info.memory` to its baseline.

### Phase 238 · 3D export
**Needs:** 237 · **Was:** v3 18.4 · **Status:** 🚧
- [x] Export to React Three Fiber components and plain three.js, lazily loaded, with a poster fallback when WebGL is missing and the vendored runtime for bindings and Blueprints.

**You'll see:** export a 3D hero to your Next app.
**Done when:** the 3D references build in the fixtures and match the editor within 2% (GPU tolerance).

### Phase 239 · 3D library
**Needs:** 238 · **Was:** v3 25.3 (wave 6) · **Status:** 🚧
- [x] Floating object, 3D card flip, GLTF spin showcase, depth-parallax scene, physics badge on a lanyard, product turntable, as open recipes.

**You'll see:** ready-made 3D effects you can customise.
**Done when:** each passes the Playground sweep, parity and its tier budget.

### Phase 240 · Stage 6 gate: the 3D journey
**Needs:** 218–239 · **Was:** — (new) · **Status:** 🚧
- [x] A hero with an imported GLTF product that turns toward the cursor, a scroll-driven camera path, PBR materials, lights, a physics interaction on click, and a Blueprint rule; scrubbed with a tape, exported, parity-checked, and run on a mid-tier phone profile.
- [x] **v4.1:** the Stage 3 logo inflated into 3D, and a rigged 3D character whose head follows the cursor.

**You'll see:** 3D scenes designed, animated and made interactive in the same editor.
**Done when:** the journey passes in CI in 3 browsers, plus one recorded manual run.

---

# STAGE 7 — AI & AGENTS (Phases 241–250)

> **Stage output:** a real model builds the first version and helps refine it, always as a diff the user approves. Claude, through MCP, can do everything a person can do in the editor.

**Status check (2026-11-16, audit), 🚧:** the export "parity" (0.42 %, 0.38 %) and the recipe parity values were typed-in numbers, the R3F export imported a file it never wrote, and sphere, torus and capsule were one bulged disc. Fixed: the export writes and compiles its files, primitives use the 3D-011 generators, unmeasured parity is `null`, and the gate lists what nothing measures (export pixel parity, real-browser context loss, real `.glb` import) and does not pass while that list has entries. The Studio tab's "ALL GATES (227/227): PASS" came from a constant 227; it now says it ran 8 simulated model checks.

### Phase 241 · LLM integration layer
**Needs:** 13, 50 · **Was:** v3 30.1, 30.2 · **Closes:** AUD-17 · **Status:** 🚧
- [ ] A Next.js route handler calls the Claude API through `@anthropic-ai/sdk`; the key stays server-side. The model ID lives in one constant, checked against the current model lineup when this phase starts.
- [ ] Schema-constrained output (the MDM JSON Schema and the command schemas from 13 as strict tool inputs); edits are MDM patches, graphs are `.nls`; streaming; prompt caching of the stable prefix; vision input; graceful handling of every stop reason.
- [ ] The route is private (developer use) until Phases 259 and 260.

**You'll see:** an AI panel that answers about your document.
**Done when:** no API key appears in client bundles (build scan); cache reads show on repeated requests.

### Phase 242 · Validation loop & offline provider
**Needs:** 241 · **Was:** v3 30.3, 30.4 · **Closes:** AUD-18 · **Status:** 🚧
- [ ] Every model output goes through schema validation, then `rules.validate`, then at most one repair turn with the diagnostics, otherwise it's rejected with an explanation. The v1.1 deterministic parsers become the offline provider and a test oracle; `ConstrainedDecoder.ts` is removed.

**You'll see:** AI suggestions never break the rules.
**Done when:** 50 scripted prompts give ≥ 95% schema- and rule-valid patches with at most one repair.

### Phase 243 · AI builder: prompt → design and motion
**Needs:** 242 · **Was:** v3 31 · **Status:** 🚧
- [ ] A planner picks layers, library effects (preferred when they fit), reactions and rules; a builder emits patches; a streaming ghost diff on the canvas and timeline (accept all, per layer, or discard); follow-up turns; a plain-language summary with the engine choices.

**You'll see:** type a sentence and watch a first version appear as a ghost you can accept.
**Done when:** a first-time user gets an accepted result from a one-sentence prompt within 20 s at p90 over the eval prompts.

### Phase 244 · AI evals & visual self-check
**Needs:** 243 · **Was:** v3 33 · **Status:** 📋
- [ ] An eval set of ≥ 210 prompts (layouts, motion, interactive effects, interaction rules, 3D, edits, fixes, sketches); renders checked at sampled times and under tapes by a second model call; a dashboard of validity, repair, acceptance, latency and cost; CI blocks prompt changes that drop validity by > 2 points.

**You'll see:** (team) an AI quality dashboard.
**Done when:** the baseline is recorded, with ≥ 95% validity tracked.

### Phase 245 · AI co-pilot: edit, explain, fix
**Needs:** 244 · **Was:** v3 32 · **Status:** 📋
- [ ] Selection-scoped edits ("bouncier", "stagger from the centre", "calmer on mobile"), enforced to touch only the selection; explanations of what an animation does and why it routes where it does; one-click fixes for rule and performance diagnostics; entry points in a prompt bar, the context menu and the Simple Motion card.

**You'll see:** right-click → Ask AI on anything.
**Done when:** selection-scoped edits never modify unselected layers (100% on the eval set); explanations are rated accurate on ≥ 90% of 30 samples.

### Phase 246 · AI interaction builder
**Needs:** 245 · **Was:** v3 73.4 · **Status:** 📋
- [ ] "When the button is clicked, burst confetti and flip the card" → Simple rules or graph patches as a ghost diff, using the `.nls` text form.

**You'll see:** describe an interaction and get rules you can open as a graph.
**Done when:** ≥ 90% of the 20 interaction prompts in the eval set produce valid, runnable rules.

### Phase 247 · AI effect author
**Needs:** 246 · **Was:** v3 70 · **Closes:** AUD-54 (authoring) · **Status:** 📋
- [ ] A prompt or reference becomes a shader graph, particle stack and bindings (never free-form GLSL by default), validated, compiled and render-probed at tape checkpoints before it appears as a ghost diff; remix edits ("react to scroll too").

**You'll see:** "a background like ink in water that swirls around the cursor" becomes an editable effect.
**Done when:** on the 40 effect prompts, ≥ 90% are valid and within budget, and ≥ 60% are accepted without manual edits.

### Phase 248 · AI character animator
**Needs:** 216, 247 · **Was:** — (new in v4.1) · **Status:** 📋
- [ ] Rig a character from an image, and turn a description ("wave happily, then look at the button") into poses, keys and reactions, always as a diff the user approves (Law 4).

**You'll see:** describe an action and watch the rigged character do it.
**Done when:** on 10 eval prompts the result passes the visual self-check (Phase 244) and validates in the rules.

### Phase 249 · AI from references
**Needs:** 247 · **Was:** v3 34 · **Status:** 📋
- [ ] Image references → layout and style; GIF or video references → sampled frames → closest effects and parameters; a screenshot the user is allowed to use → a matching motion treatment (no automatic scraping).

**You'll see:** drop a GIF and get a matching animation.
**Done when:** 20 reference clips map to the right effect category in ≥ 80% of cases.

### Phase 250 · MCP v1: full agent parity
**Needs:** 249 · **Was:** — (new) · **Status:** 📋
- [ ] The MCP server covers every command added since Phase 50 (timeline, states, bindings, Blueprints in `.nls`, effects, 3D, export, render queue). New tools: render a frame at time `t` under a tape, evaluate a property, validate, explain, run the Playground sweep for one effect. Resources: effect catalogue, signal catalogue, grammar summary. Prompts: guided flows ("animate this hero", "make it react to the cursor").
- [ ] An MCP activity log in the editor showing each agent action and its approval.

**You'll see:** in Claude: "make the cards fly in on scroll and tilt toward the cursor" happens on your canvas, step by step, as diffs you approve.
**Done when:** the coverage test reports 0 commands missing from MCP; an MCP client completes the Stage 1–4 gate journeys' key steps using only MCP tools.

---

# STAGE 8 — EASY FOR EVERYONE (Phases 251–258)

> **Stage output:** someone who knows Figma or After Effects feels at home immediately, can bring their existing work in, and a complete beginner can draw roughly and get a clean, animated result in three steps.

### Phase 251 · Familiar keymaps & terms
**Needs:** 250 · **Was:** — (new) · **Status:** 📋
- [ ] Keymap presets: **Figma** (default on the canvas) and **After Effects** (default in the timeline), switchable, with a searchable cheat sheet. Tooltips show the equivalent term ("Precomp — like a Figma component for time").

**You'll see:** your Figma and After Effects shortcuts just work.
**Done when:** a test checks the 60 most-used Figma and After Effects shortcuts map to the right commands.

### Phase 252 · Figma import
**Needs:** 251 · **Was:** — (new) · **Status:** 📋
- [ ] Import a Figma file the user owns through Figma's REST API (personal access token or OAuth, used server-side and not stored): frames, auto-layout, constraints, components and variants, text styles, vectors, images and colour styles map to the MDM; anything that doesn't map is listed, never silently dropped.

**You'll see:** paste a Figma file link and keep working on it here.
**Done when:** 5 sample files import with a mapping report; layouts match screenshots within tolerance.

### Phase 253 · After Effects import via Lottie
**Needs:** 252 · **Was:** — (new) · **Status:** 📋
- [ ] Import Bodymovin/Lottie JSON (exported from After Effects): shape layers, transforms, keyframes and easing, trim paths, masks, mattes and precomps become compositions; unsupported features are reported.

**You'll see:** bring an After Effects animation in and edit it on the timeline.
**Done when:** 10 sample Lottie files import and play within 2% pixels of `lottie-web`.

### Phase 254 · Shape recognition & beautification
**Needs:** 253 · **Was:** v3 36 · **Status:** 📋
- [ ] Local recognisers (< 50 ms): lines, ellipses and circles, polygons with right-angle snapping, and template shapes (arc, arrow, star, heart, check, cross); confidence scores; hold-to-snap with "keep as drawn"; multi-stroke grouping; recognised shapes become the shape archetypes.

**You'll see:** draw a wobbly oval and get a perfect ellipse.
**Done when:** on ≥ 300 labelled strokes, ≥ 92% accuracy for basic shapes, ≥ 85% for templates, ≤ 5% false positives, p95 < 50 ms.

### Phase 255 · Draw-to-animate gestures
**Needs:** 254 · **Was:** v3 37 · **Status:** 📋
- [ ] Stroke → draw animation timed like the drawing; a line from an element → motion path; circle around an element → orbit; flick → fade up; zig-zag → shake; draw shape A and B → morph. Every result is a normal clip.

**You'll see:** draw a line from a shape and it travels along it.
**Done when:** PRD §11 criterion 2 passes as a Playwright script with recorded strokes.

### Phase 256 · Sketch to elements with AI
**Needs:** 255 · **Was:** v3 38 · **Status:** 📋
- [ ] Rough boxes and scribbles on a sketch layer → real elements (buttons, cards, images, headings, toggles) with default motion as a ghost diff; handwriting becomes label text after confirmation.

**You'll see:** sketch a UI and get real components.
**Done when:** 30 sketch fixtures map to the right element in ≥ 80% of cases.

### Phase 257 · Recipes: open anything and see how it is made
**Needs:** 192, 256 · **Was:** — (new in v4.1) · **Status:** 📋
- [ ] Any library effect, template or AI result can be opened as a step-by-step replay of how it was built from primitives, with every step editable and explained in plain words.

**You'll see:** open the liquid-glass button and step through how it was made.
**Done when:** every library effect opens as a replay that rebuilds it exactly.

### Phase 258 · Simple mode & guided flow
**Needs:** 256 · **Was:** v3 39 · **Closes:** AUD-21 · **Status:** 📋
- [ ] A new start screen: **Describe it**, **Draw it**, **Start from a template or effect**, **Import from Figma or After Effects**. Three steps: Create → Make it move and react → Get code or embed. "Open in Pro" at every step; a ≤ 60 s first-run tour; Pro panels and CSS lazy-loaded in Simple mode (initial bundle ≤ 60% of today's).

**You'll see:** a beginner-friendly path from blank to exported animation.
**Done when:** 5 first-time users each go from blank to a copied, working animated component in < 3 minutes (median), without help.

---

# STAGE 9 — PRODUCTION & PUBLIC BETA (Phases 259–266)

> **Stage output:** a public beta that is secure, observable, tested on real devices and licence-clean, with the legacy systems gone.

### Phase 259 · Security hardening
**Needs:** 16, 96, 241 · **Was:** v3 80.3–80.5 · **Closes:** AUD-51 (security) · **Status:** 📋
- [ ] A strict CSP with nonces and Trusted Types; sanitisers for SVG, GLTF and fonts re-verified; GPU compile limits and a watchdog; AI and MCP routes with authentication, authorisation, rate limits and prompt-injection handling for references; dependency audit, lockfile integrity and secret scanning in CI; exported code with no `eval`, no inline handlers, and working under a CSP.

**You'll see:** nothing new; everything keeps working under a strict security policy.
**Done when:** an escape corpus (malicious SVG, code component, shader, expression, GLTF, text inside a reference image) can't read editor storage, cookies or tokens in 3 browsers; 0 high or critical dependency findings; the editor runs with no CSP violations.

### Phase 260 · Observability & kill switches
**Needs:** 259 · **Was:** v3 82 · **Closes:** AUD-51 (operations) · **Status:** 📋
- [ ] Client and server error reporting with PII scrubbing; opt-in performance telemetry (frame time, long tasks, GPU tier, context losses, memory, unexpected reloads); remote kill switches and feature flags without a deploy; canary, beta and stable channels; SLOs, runbooks and a status page for the AI and MCP routes.

**You'll see:** a status page; a crashing effect family can be switched off remotely.
**Done when:** an injected error and a context-loss storm show on dashboards within 5 minutes; a kill switch disables an effect family for new sessions within 5 minutes.

### Phase 261 · Real-device & browser matrix
**Needs:** 260 · **Was:** v3 84 · **Closes:** AUD-55 · **Status:** 📋
- [ ] The support matrix (editor: current and previous desktop Chrome, Edge, Safari, Firefox; exports: those plus the last 2 majors of iOS Safari and Android Chrome); named reference devices per tier in a device lab; per-tier budgets for every effect and 3D scene calibrated on real hardware; 10-minute soaks; the input matrix (mouse, trackpad, pen, touch, keyboard-only, screen reader).

**You'll see:** "tested on" tier badges backed by real devices.
**Done when:** every library effect meets its tier budgets on the matrix; no crash or tab kill in a 10-minute soak on the low mobile tier; input-matrix journeys pass.
**v5 (R2):** "every library effect" reads "each of the five reference recipes"; 3D scenes join the matrix in R3.

### Phase 262 · Licensing & compliance automation
**Needs:** 261 · **Was:** v3 85 · **Status:** 📋
- [ ] A licence scanner in CI with an allowlist (fails on GPL/AGPL or Commons Clause in shipped code); generated third-party notices in exports; provenance complete for every library effect; a bundle check that `gsap` is absent from the editor; terms of service, privacy policy, and AI and MCP data-use policy; consent for telemetry.

**You'll see:** a notices file in every export.
**Done when:** CI fails on a planted disallowed licence and on a planted `gsap` import; every export carries correct notices.

### Phase 263 · Legacy retirement & grep gates
**Needs:** 262 · **Was:** v3 57 · **Status:** 📋
- [ ] Remove whatever earlier phases left behind (each replacing phase deleted most of it already). A CI grep gate forbids: HTML-string stage markup, local playheads, `requestAnimationFrame` outside the scheduler, listeners outside the input bus, WebGL contexts outside the compositor, `Math.random()`/`Date.now()` in effect programs, `gsap` in editor code. Split `panels.css` per panel and drop unused selectors.

**You'll see:** a smaller, faster editor (bundle size drop recorded).
**Done when:** the grep gate is green and the full Playwright and parity suites pass.

### Phase 264 · Documentation & audit close-out
**Needs:** 263 · **Was:** v3 40.4 · **Status:** 📋
- [ ] A user guide (Simple and Pro, written for Figma and After Effects users), an effect authoring guide, an MCP guide for agents, known limitations; every `AUDIT.md` ID resolved or explicitly deferred.

**You'll see:** in-app help and docs links.
**Done when:** the doc-link checker passes and `AUDIT.md` has no open ID without an owner.

### Phase 265 · Integration journeys
**Needs:** 264 · **Was:** v3 58 · **Status:** 📋
- [ ] Every stage gate journey (52, 102, 202, 240) and the AI and MCP journeys run together on the release candidate in CI in 3 browsers and on the device matrix.

**You'll see:** a release candidate.
**Done when:** all journeys are green on one tagged commit.
**v5 (R2):** the journeys are the gates passed so far: Phase 52, the five recipes of Gate R1, and the AI and MCP journeys. The later stage gates (102, 202, 240) join when their releases close.

### Phase 266 · Public beta gate
**Needs:** 259–265 · **Was:** v3 40 · **Status:** 📋
- [ ] PRD §11 criteria 1–13 as automated journeys plus a recorded manual run; every matrix green (export parity, performance tiers, accessibility, AI evals, recognition accuracy, security, licences); a go/no-go review against PRD §13.

**You'll see:** the public beta.
**Done when:** every item is green in CI at a tagged commit (`v0.2.0-beta`).
**v5 (R2):** the PRD §11 criteria are checked for what R0 to R2 built. A criterion that needs a later release is listed as open in the go/no-go review, with its release.

---

# STAGE 10 — SITES & PLATFORM (Phases 267–276)

> **Stage output:** general availability. Accounts, cloud projects and sharing, remote MCP, content collections and forms, whole-site export and deploy, and plans and billing.

### Phase 267 · Accounts & cloud projects
**Needs:** 266 · **Was:** v3 81.1, 81.2 · **Closes:** AUD-51 (platform), AUD-53 · **Status:** 📋
- [ ] Passkeys and OAuth sign-in, account deletion and data export; local-first IndexedDB projects synced to the server with a single-writer lock per project; assets stored by content hash; backups.

**You'll see:** sign in and open your projects on another computer.
**Done when:** a project edited offline on device A syncs to device B with no loss; deleting an account removes its data (verified by test).

### Phase 268 · Share links & hosted embeds
**Needs:** 267 · **Was:** v3 81.3, 81.4 · **Status:** 📋
- [ ] View-only Preview links with live effects and Blueprints (password and expiry options); hosted embeds served from a CDN; storage and bandwidth quotas.

**You'll see:** share a live, interactive preview with a link.
**Done when:** a share link renders the interactive preview in a logged-out browser.

### Phase 269 · Remote MCP endpoint
**Needs:** 268 · **Was:** — (new) · **Status:** 📋
- [ ] A hosted MCP endpoint (Streamable HTTP, OAuth) that works on cloud projects without a local bridge; per-project agent permissions; the same approval and activity log as Phase 250.

**You'll see:** connect Claude to LazyLayout from anywhere, without installing anything.
**Done when:** an MCP client authenticates, edits a cloud project, and the user approves the diffs; unauthorised projects are refused.

### Phase 270 · Content collections & repeaters
**Needs:** 269 · **Was:** v3 78.1, 78.2 · **Closes:** AUD-44 (content) · **Status:** 📋
- [ ] Collections with typed fields (text, rich text, image, number, date, reference); repeaters bound to collections with item templates, sorting, filtering and staggered entrances; dynamic pages per item.

**You'll see:** a blog list and post pages driven by your own content.
**Done when:** a 50-post collection renders its list and post pages correctly in Preview.

### Phase 271 · Forms
**Needs:** 270 · **Was:** v3 78.3 · **Status:** 📋
- [ ] Form fields, validation, and Submitting, Success and Error states (animated); submission to a user-configured endpoint, webhook or form service, with spam protection and a privacy-notice slot.

**You'll see:** a contact form that animates through its states.
**Done when:** the form posts to a mock endpoint and all three states animate in Preview and export.

### Phase 272 · Whole-site export & SEO
**Needs:** 271 · **Was:** v3 79.1, 79.2, 78.4 · **Closes:** AUD-44 (site) · **Status:** 📋
- [ ] A complete Next 16 App Router (or static Vite) project: routes, layouts, components, collections as static JSON or MDX with typed loaders, statically generated dynamic routes, the vendored runtime, compiled Blueprints, assets and fonts. SEO: metadata, Open Graph images, sitemap, robots, structured data, landmarks.

**You'll see:** export your whole site as one project.
**Done when:** the 5-page fixture with a blog exports, builds statically and passes axe with 0 violations.

### Phase 273 · Web Vitals & deploy handoff
**Needs:** 272 · **Was:** v3 79.3, 79.4 · **Status:** 📋
- [ ] LCP, INP and CLS budgets in CI on the mid and low tiers with auto-fixes (poster-first effects, image sizing, font loading); export to a Git repository or one-click deploy to the user's own hosting through OAuth.

**You'll see:** one-click deploy.
**Done when:** the fixture deploys to a preview environment and meets LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 on the mid tier.

### Phase 274 · Plans, metering & billing
**Needs:** 273 · **Was:** v3 83 · **Status:** 📋
- [ ] Metering of AI tokens and cost per feature, MCP usage, storage and bandwidth; quotas per plan with graceful fallbacks; abuse detection; billing with idempotent webhooks, upgrades, downgrades and invoices.

**You'll see:** plans and usage in account settings.
**Done when:** over-limit use is blocked with a clear message and fallback; replayed billing webhooks are idempotent.

### Phase 275 · Animated templates & themes
**Needs:** 274 · **Was:** v3 76.3 (interactive variants), 76.4 · **Status:** 📋
- [ ] Every section template gets default motion and at least one interactive variant; whole-site themes (tokens + motion style) switch in one click.

**You'll see:** templates that already move and react.
**Done when:** every template passes accessibility checks, tier budgets and export parity.

### Phase 276 · General availability gate
**Needs:** 267–275 · **Was:** v3 86 · **Status:** 📋
- [ ] A first-time user builds a 3-page site from templates with an interactive hero background, a cursor effect, a 3D element, a collection list and a contact form, plus two Blueprint interactions; previews it on desktop and phone; exports and deploys it. Every matrix green; operations and billing live; go/no-go against PRD §13 using beta telemetry.

**You'll see:** LazyLayout 1.0.
**Done when:** every item is green in CI at a tagged commit (`v1.0.0`), plus a recorded manual run on desktop and phone.

---

# STAGE 11 — APPS (Phase 277)


### Phase 277 · Apps re-baseline: the After-track audit
**Needs:** 276 · **Was:** v3 87 · **Closes:** AUD-50 (After-track) · **Status:** 📋
- [ ] Audit the After-track code (NodeScript backend nodes, `LogicFlowEmitter`, `ApiRouteEmitter`, `PrismaSchemaEmitter`, Database Studio, deployment, version control) the way `AUDIT.md` audited v1.1, and record what really works in a browser and a build.
- [ ] Write the Apps roadmap in this format (sequential, gated), reusing the Blueprint language so interaction logic and app logic are one language. Include real-time collaboration, plugins, importing existing code projects (`DOCS/FUTURE/ROADMAP_EXISTING_PROJECT_IMPORT.md`) and mobile app export as candidates.
- [ ] Decide the backend model (user-owned or hosted) with its security and compliance scope.

**You'll see:** (planning) a gated roadmap for data, backend logic, collaboration and plugins.
**Done when:** the audit and the Apps roadmap exist, and every old ✅ claim for the After track is re-verified or withdrawn.

---

## 6. Reference

### Decision records

Existing: `decisions/0001-wasm.md`, `decisions/0002-time-model.md`, `decisions/0003-geometry-vs-transform.md`, `decisions/0004-motion-primitives.md`, `decisions/0005-phase8-rule-table-and-reconciliation.md`, `decisions/0007-deterministic-evaluation-kernel.md`. Number 0006 stays reserved for stateful simulation (Phase 162).

v3 planned three records under numbers that were already taken (`0004-render-capture`, `0005-gpu-surface-strategy`, `0007-code-component-isolation`). v4 renumbers every new record:

| Record | Phase |
|---|---|
| 0006 stateful simulation & determinism | 162 |
| 0008 threat model | 16 |
| 0009 render host | 18 |
| 0010 render capture | 100 |
| 0011 GPU surface strategy | 173 |
| 0012 code component isolation | 195 |
| 0013 3D stack | 218 |
| 0014 MCP bridge | 50 |
| 0015 path engine (curve-exact booleans and offsets) | 103 |
| 0016 scene rasteriser | 172 |
| 0017 rigging and deformation | 203 |

### Scope notes
- **GSAP:** never runs in the editor while `LICENSES.md` GATE-01 is open; optional export target only (Phase 98).
- **three.js:** MIT, used for real 3D only and loaded lazily; 2D GPU effects use the lighter compositor helper (Phase 173).
- **Mobile apps (React Native, Flutter):** out of scope until the Apps roadmap (Phase 277).
- **Real-time multiplayer editing:** Apps roadmap (Phase 277). Cloud projects use a single-writer lock (Phase 267).
- **Reverse-engineering other products' code:** not used. Figma and After Effects users are served by importing their own files through public APIs and formats (Phases 252, 253) and by familiar keymaps (Phase 251).


## 7. Crosswalk: v3 Phase → v4.1 Phase

Use this to read `AUDIT.md`'s "Fix Phase" column, decision records, the PRD and specs, old commit messages and `TODO(P…)` comments, which all use v3 numbers. Where a v3 phase was split, each part is listed with its v3 sub-phase. The right-hand column uses v4.1 numbers; a table from v4.0 to v4.1 numbers is at the end of this section.

| v3 | v4 |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |
| 6 | 6 |
| 7 | 8 |
| 8 | 10 |
| 9 | 11, 139 |
| 10 | 57 (10.1), 58 (10.1), 59 (10.2), 60 (10.3) |
| 11 | 78 (11.1), 79 (11.2), 93 (11.4), 151 (11.3) |
| 12 | 136 (12.3), 143 (12.2) |
| 13 | 81 (13.1, 13.2), 82 (13.3) |
| 14 | 98 |
| 15 | 87 |
| 16 | 40 (16.1), 85 (16.2, 16.3), 86 (16.3, 16.4) |
| 17 | 38 (17.3), 83 (17.1), 84 (17.2) |
| 18 | 218, 219 (18.1), 222 (18.2), 224 (18.2), 225 (18.2), 226 (18.2), 227 (18.3), 228 (18.3), 231, 232 (18.3), 237, 238 (18.4) |
| 19 | 176 (19.1), 183 (19.2) |
| 20 | 21 (20.3), 25 (20.4), 26 (20.1), 27 (20.1), 28 (20.2) |
| 21 | 32 (21.1), 61 (21.2), 91 (21.3) |
| 22 | 33 (22.1), 34 (22.2), 35 (22.2), 45 (22.3), 91 (22.4) |
| 23 | 61 (23.1), 66 (23.2), 67 (23.3), 136 (23.4) |
| 24 | 90 (24.0–24.3, 24.5), 136 (24.4) |
| 25 | 91 (25.1, 25.2), 92 (25.3), 193 (25.3), 239 (25.3) |
| 26 | 101 (26.1–26.4), 200 |
| 27 | 49 (27.1), 94 (27.1), 95 (27.2, 27.3), 96 (27.4) |
| 28 | 97 |
| 29 | 93 (29.1, 29.3), 95 (29.2), 199 (29.4) |
| 30 | 241 (30.1, 30.2), 242 (30.3, 30.4) |
| 31 | 243 |
| 32 | 245 |
| 33 | 244 |
| 34 | 249 |
| 35 | 39 (35.1–35.4) |
| 36 | 254 |
| 37 | 255 |
| 38 | 256 |
| 39 | 258 |
| 40 | 264 (40.4), 266 |
| 41 | 3 (41.2), 12 |
| 42 | 7 |
| 43 | 13 (43.1, 43.3), 24 (43.2), 25 (43.2) |
| 44 | 14 (44.1, 44.4), 15 (44.2, 44.3) |
| 45 | 54 (45.1), 55 (45.2, 45.3), 56 (45.4) |
| 46 | 9 |
| 47 | 76 (47.1, 47.3, 47.4), 77 (47.2, 47.4) |
| 48 | 17 (48.1), 18 (48.2, 48.5), 19 (48.3, 48.4), 49 |
| 49 | 20 (49.1), 21 (49.2), 22 (49.3), 23 (49.4, 49.5) |
| 50 | 41 (50.1), 42 (50.1, 50.2), 43 (50.3), 44 (50.4), 49 (50.5), 88 (50.3) |
| 51 | 72 (51.1), 73 (51.2), 74 (51.3, 51.4), 75 (51.5, 51.6) |
| 52 | 61 (52.1), 62 (52.2), 63 (52.3), 64 (52.4), 65 (52.5) |
| 53 | 69 (53.1), 70 (53.2, 53.4), 71 (53.3) |
| 54 | 36 (54.1, 54.2), 99 (54.3, 54.4), 224 |
| 55 | 100 |
| 56 | 101 |
| 57 | 68 (57.1), 263 |
| 58 | 52 (58.1), 102 (58.2, 58.3, 58.4), 202 (58.5, 58.6), 265 |
| 59 | 132 (59.1), 133 (59.2), 136 (59.3) |
| 60 | 138 (60.1), 139 (60.2), 140 (60.3), 142 (60.4) |
| 61 | 173 (61.1, 61.3), 174 (61.2, 61.5), 176 (61.4) |
| 62 | 177 (62.1, 62.3), 178 (62.2), 231 |
| 63 | 183 |
| 64 | 162 (64.1), 184 (64.2, 64.3) |
| 65 | 187 |
| 66 | 191 |
| 67 | 192 |
| 68 | 196 |
| 69 | 197 (69.1, 69.2), 198 (69.3–69.5) |
| 70 | 247 |
| 71 | 137 |
| 72 | 159 (72.1, 72.2), 160 (72.3, 72.4) |
| 73 | 167 (73.1, 73.5, 73.6), 168 (73.2, 73.3), 246 (73.4) |
| 74 | 161 (74.1), 169 (74.2–74.4) |
| 75 | 46 (75.1, 75.5), 47 (75.2, 75.3), 49 (75.5), 80 (75.2, 75.4) |
| 76 | 48 (76.1), 51 (76.3, 76.4), 82 (76.2), 275 (76.3, 76.4) |
| 77 | 48 (77.1, 77.2, 77.4), 89 (77.3) |
| 78 | 270 (78.1, 78.2), 271 (78.3), 272 (78.4) |
| 79 | 272 (79.1, 79.2), 273 (79.3, 79.4) |
| 80 | 16 (80.1), 195 (80.2), 259 (80.3–80.5) |
| 81 | 267 (81.1, 81.2), 268 (81.3, 81.4) |
| 82 | 260 |
| 83 | 274 |
| 84 | 261 |
| 85 | 262 |
| 86 | 276 |
| 87 | 277 |
| 88 | 72 (88.2), 73 (88.1), 152 |
| 89 | 153 (89.1), 154 (89.2, 89.3), 170 (89.4) |
| 90 | 157 (90.1–90.3), 158 (90.4–90.6) |
| 91 | 162 (91.3), 163 (91.1, 91.2), 164 (91.4, 91.5), 169 (91.6), 201 (91.7) |

### v4.0 → v4.1 (2026-10-21)

v4.1 kept Phases 1–102 and renumbered everything after them, to insert Stage 3 (Design depth), Stage 5 (Characters & rigging) and new phases inside the later stages. Use this table for anything written with a v4.0 number from 103 on.

| v4.0 | v4.1 | Phase (title in v4.0) |
|---|---|---|
| 103 | 132 | Input bus & coordinate spaces |
| 104 | 133 | Signal catalogue, including the keyboard |
| 105 | 136 | Input tapes |
| 106 | 137 | GPU & interactive verification harness |
| 107 | 138 | Operators & bindings runtime |
| 108 | 139 | Targets, blending & cycles |
| 109 | 140 | Reactivity card (Simple) |
| 110 | 142 | Signals panel (Pro) & binding export |
| 111 | 143 | Pointer behaviours as presets |
| 112 | 146 | Keyboard & focus interactivity |
| 113 | 151 | State machines |
| 114 | 152 | Helpers, pins & Follow |
| 115 | 153 | Split into real layers |
| 116 | 154 | Cloners, tags & group targets |
| 117 | 157 | Fields & effectors |
| 118 | 158 | One evaluation space & no-maths kinetics |
| 119 | 159 | Blueprint model & interaction library |
| 120 | 160 | NodeScript text form & one model with the grammar |
| 121 | 161 | Blueprint runtime |
| 122 | 162 | 2D physics core |
| 123 | 163 | Colliders & bodies |
| 124 | 164 | Contact events & collision view |
| 125 | 167 | Simple rules editor |
| 126 | 168 | Blueprint graph editor & debugger |
| 127 | 169 | Blueprint compiler & interaction parity |
| 128 | 170 | Spawner |
| 129 | 173 | GPU surface strategy & compositor |
| 130 | 174 | Passes, render targets & GPU memory ledger |
| 131 | 176 | Surfaces in the editor & the first interactive background |
| 132 | 177 | Shader graph |
| 133 | 178 | Raw GLSL (Pro) & shader safety |
| 134 | 183 | Particles & force fields |
| 135 | 184 | Stateful simulations & replay |
| 136 | 187 | Media as texture & distortion |
| 137 | 191 | Cursor & overlay layer |
| 138 | 192 | Effect SDK: effects as data |
| 139 | 193 | Library: interaction, backgrounds, cursors & distortion |
| 140 | 195 | Sandbox boundaries for untrusted code |
| 141 | 196 | Code components |
| 142 | 197 | Interactive export runtime |
| 143 | 198 | Embed script, size budgets & Web Vitals |
| 144 | 199 | Interactive accessibility |
| 145 | 200 | Interactive performance budgets per tier |
| 146 | 201 | Composition test suite |
| 147 | 202 | Stage 3 gate: the interactive journey |
| 148 | 218 | 3D stack decision & licences |
| 149 | 219 | Scene layer |
| 150 | 220 | 3D viewport editing |
| 151 | 221 | Scene hierarchy & 3D inspector |
| 152 | 222 | Primitives & 3D text |
| 153 | 224 | GLTF import pipeline |
| 154 | 225 | Materials & textures |
| 155 | 226 | Lights, shadows & environments |
| 156 | 227 | Cameras & camera paths |
| 157 | 228 | 3D keyframes on the timeline |
| 158 | 229 | Animated GLTF playback |
| 159 | 231 | 3D materials in the shader graph & WebGPU |
| 160 | 232 | 3D reactions & raycast events |
| 161 | 234 | Instancing, LOD & 3D cloners |
| 162 | 235 | 3D physics |
| 163 | 236 | Post-processing |
| 164 | 237 | 3D memory discipline |
| 165 | 238 | 3D export |
| 166 | 239 | 3D library |
| 167 | 240 | Stage 4 gate: the 3D journey |
| 168 | 241 | LLM integration layer |
| 169 | 242 | Validation loop & offline provider |
| 170 | 243 | AI builder: prompt → design and motion |
| 171 | 244 | AI evals & visual self-check |
| 172 | 245 | AI co-pilot: edit, explain, fix |
| 173 | 246 | AI interaction builder |
| 174 | 247 | AI effect author |
| 175 | 249 | AI from references |
| 176 | 250 | MCP v1: full agent parity |
| 177 | 251 | Familiar keymaps & terms |
| 178 | 252 | Figma import |
| 179 | 253 | After Effects import via Lottie |
| 180 | 254 | Shape recognition & beautification |
| 181 | 255 | Draw-to-animate gestures |
| 182 | 256 | Sketch to elements with AI |
| 183 | 258 | Simple mode & guided flow |
| 184 | 259 | Security hardening |
| 185 | 260 | Observability & kill switches |
| 186 | 261 | Real-device & browser matrix |
| 187 | 262 | Licensing & compliance automation |
| 188 | 263 | Legacy retirement & grep gates |
| 189 | 264 | Documentation & audit close-out |
| 190 | 265 | Integration journeys |
| 191 | 266 | Public beta gate |
| 192 | 267 | Accounts & cloud projects |
| 193 | 268 | Share links & hosted embeds |
| 194 | 269 | Remote MCP endpoint |
| 195 | 270 | Content collections & repeaters |
| 196 | 271 | Forms |
| 197 | 272 | Whole-site export & SEO |
| 198 | 273 | Web Vitals & deploy handoff |
| 199 | 274 | Plans, metering & billing |
| 200 | 275 | Animated templates & themes |
| 201 | 276 | General availability gate |
| 202 | 277 | Apps re-baseline: the After-track audit |

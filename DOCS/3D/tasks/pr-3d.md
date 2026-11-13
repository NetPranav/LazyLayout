Lane A · Surfaces S1–S9 and ROADMAP_3D phases **3D-001 to 3D-020**. One commit per phase (or pair); every phase's roadmap row is 🚧 until this is on `main` (then ✅ under the owner's rule of 2026-11-12).

**What it adds**
- **Surfaces S1–S9:** the glossy "Get Started" button as generic properties (membrane, cloth, press physics, studio lighting); a lab route, a comparison harness, a right-panel 2D | 3D switch, File > Place reference image.
- **3D-001..010 foundation:** the 3D stack decision (0013), the GPU compositor (one shared surface context, scene contexts within a budget, sleep with a poster, loss recovery), memory ledger and passes, a GPU test harness (SSIM + goldens), device tiers and budgets, a worker job pool (cloth runs off the main thread), **schema v7** data blocks (scenes, objects, meshes, materials, lights, cameras, armatures, actions, worlds, images) with an additive migration, 3D maths and hierarchy, units/axes/glTF mapping, and `evaluate3D` in the kernel.
- **3D-011..020 the viewport:** typed 3D commands with undo and "Adjust last operation", Insert > 3D scene on the canvas (double-click to enter), the editable mesh, orbit/pan/dolly/views, picking and selection, G/R/S with axis locks and typed values, gizmos, snapping/pivots/orientations, four shading modes, overlays and the 3D cursor, Blender and Beginner keymaps.

**Shared hot spots touched (please look):**
- `src/core/document/`: **schema v7** (additive tables, `scene3d` archetype, migration v6→v7). Lane B: the v7 claim is in `DOCS/TEAM/CLAIMS.md`.
- `src/core/kernel/evaluate.ts`: additive only; 2D evaluation is unchanged and skips the 3D step for documents without 3D objects.
- `src/core/commands/`: `onCommandRun` display hook; `getContextKeys()` now self-corrects a stuck `textEditing` (a focused field removed from the page never fired focusout, which left Undo and shortcuts off).
- `src/editor/stage/Artboard.tsx` and `Stage.tsx`: a `scene3d` hit box handles double-click and hosts the 3D interaction layer above the page's other hit boxes; pointer coordinates are scaled by the stage zoom.
- `src/editor/components/TopBar.tsx`: View > Show keystrokes, Insert > 3D scene.

**Testing (all local, Chromium, `tsc` and eslint clean)**
- Unit: 3458 pass, 0 fail (the Phase 50 bridge tests need a local server and were not run in my sandbox).
- Browser: canvas contract (canvas, device views, anchor points), `new-ui-tools`, the 3D scene, viewport and panels specs, GPU compositor, jobs: all pass. The 3D viewport specs also pass in a slow, visible run.
- Not run: Firefox and WebKit locally (they have known failures on `main` unrelated to this PR).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

# Code review: Lanes C, D, E, F, G (Phases 103–250)

**Date:** 2026-11-17 · **On:** `main` @ `80878c62` · **Reviewed by:** Claude (read-only review, nothing changed in `src/`)

**Method.** Every phase commit since `8c4b6365` (v5 roadmap) was mapped to the source files it added or changed. Each new file was then checked two ways:
1. **Reachability:** is it imported, directly or indirectly, by a real route (`/editor`, `/api/*`, the MCP bin, the export runtime build), by a lab route only (`/editor/*-lab`, render gallery), or by nothing but its own tests?
2. **Reading the code** for bugs, fake results, duplicates of existing modules, and law violations.

Lanes D, E, F, G and the AI route were read in full. Lane C got a targeted pass only (red-flag scan plus the riskiest module). Its style matches the Lane A/B work, every file is wired into the editor, and a full line-by-line read of it is still to do.

Severity: **H** = wrong result shipped to users, data loss, a gate that can't fail, or a claim the code doesn't back · **M** = a real bug in code that isn't shipped yet, or an architecture problem that will cost later · **L** = cleanup.

---

## 1. Summary

| Lane | Phases | New src files | Reach `/editor` / API | Lab only | Dead (tests only) | Verdict |
|---|---|---|---|---|---|---|
| C | 103–131 | ~45 | all | 0 | 0 | Wired and tested. A few fixes (§7). |
| D | 132–202 | ~75 | 2 (`cycleAndLayoutGuard`, `reactivityCard` core) | ~35 | ~35 | **Not in the product.** Large parts duplicate wired Design-track code; several gates can't fail. |
| E | 203–217 | 15 | 0 | 14 | 1 | Maths mostly sound; lab only; export is a façade. |
| F | 218–240 + `roadmap3d` | 17 | 7 (`roadmap3d` via StudioTab) | 10 | 0 | **`roadmap3d` is a façade shown in the real editor.** `stage6` duplicates `core/3d`. |
| G | 241–250 | 24 | 17 | 0 | 7 | Real and wired (241–243). One data-loss bug, two security/abuse gaps. 244–250 honestly marked 📋. |

Reachability, file by file: 98 of 213 new files reach a real route, 67 reach only a lab page, 48 reach nothing.

### The five things to fix first
1. **G · 243 · H · AI "Accept all" can silently undo the user's work** (§6.2). It replaces the whole document with a copy made when the proposal arrived. Edits made since then are reverted, and layers the user had discarded are applied anyway.
2. **F · roadmap3d · H · Fake results shown in the real editor.** The 3D Studio tab shows a "227-Phase Gates Summary" whose values are hard-coded `true` (§5.2). Remove it from the product, and don't count those 3D phases as built.
3. **D · 143 · H · A known gap was deleted, not fixed.** `KERNEL_GAPS` lost its "behaviours" entry, and a test now asserts the gap is "closed by Phase 143". `evaluate()` still runs only `loop` behaviours (`src/core/kernel/evaluate.ts:328`).
4. **D · 169, 200, 195, 198 · H · Gates and probes that can't fail** (§3.6–3.8). The blueprint export is a no-op façade. The 10-minute soak test adds and then subtracts the same numbers. The sandbox probe returns literal strings. The embed "Web Vitals" audit returns `expectedCls: 0` and `strictNonceCspCompliant: true` as constants.
5. **D/F · Architecture · H · Parallel copies of wired code.** Lane D re-implements the input bus, follow, split text, cloner and effectors (§3.1), and Lane F re-implements primitives, glTF and viewport (§5.1). Delete the copies, or merge what's new into the wired module. Two implementations of one feature will drift (Laws 2 and 11).

### Process findings
- Lane D's own rule was "batched verification every 10th phase", but the batches verified the lab modules against themselves. Nothing ties them to `/editor` or the real exporter, so a Stage 4 gate (202) pass says nothing about the product.
- Phase status: Lane D marked most phases 🚧, which is honest. But commit titles such as "closes AUD-48 / AUD-54 / AUD-55 / AUD-57" and "Milestone N verified" claim more than the code shows. The 2026-11-16 audit (`fd0ede14`) reopened some of these; the ones listed here are still claimed.
- Recommendation: a phase is not 🚧 or ✅ until its code is reachable from `/editor` or the real export. Add a CI check that fails when a new `src/core/**` file is reachable only from tests. The script used for this review is in §8.

---

## 2. Cross-cutting improvements

| # | Sev | Improvement |
|---|---|---|
| X1 | H | **One implementation per feature.** Three 2D affine-matrix libraries exist (`core/geometry/parentTransforms.ts`, `core/signals/worldSpaceKinetics.ts`, `core/rig/rigModel.ts`). There are two input buses, two follow systems, two split-text systems, two cloners, two effector systems, three state systems (`core/states`, `signals/stateMachineRuntime`, `rig/characterBlendTrees`), and two rasterisers. Keep the wired one in each case. |
| X2 | H | **No literal-`true` results.** A field such as `privacyLockRespected: true`, `gate02Verified: true`, `zeroLazyLayoutImports: true` or `meshoptCompressed: true` must be computed or deleted. About 60 such literals exist across `core/3d`, `core/export`, `core/effects`, `core/components` and `core/profiler`. A lint rule could flag `readonly x: true` literal types on report interfaces. |
| X3 | M | **Test fixtures live in `src/`.** For example `core/bindings/referenceBindings.ts`, `core/signals/compositionSuite.ts` and `core/signals/stage4GateJourneys.ts`. Move them to `__tests__/fixtures` so they can't be mistaken for features and don't ship. |
| X4 | M | **Hot-path allocation (Law 9).** Many per-frame steppers allocate a new array or object every frame (trail buffers, physics body clones, camera luma buffers). Use ring buffers and in-place updates once anything is wired. |
| X5 | M | **`dt` clamping is inconsistent.** Some modules clamp to 1/15 s, some to 1/240–1/15, and some divide distance by the *clamped* `dt` (which inflates velocities after a frame drop). Use one helper. |
| X6 | L | **Lane D modules are single 200–500-line files** that mix types, maths, presets and React-free "UI specs". Split them only if they are kept; most should be deleted (X1). |

---

## 3. Lane D (132–202)

### 3.1 Duplicates of already-wired code (H, architecture)
| Lane D file | Duplicates (wired, Design track) |
|---|---|
| 132 `core/signals/inputBus.ts` | `core/bindings/inputBus.ts` (`busFrame`, used by `BindingDriver` and the export runtime) |
| 152 `core/bindings/helpersAndFollow.ts` | `core/bindings/follow.ts` (D6) |
| 153 `core/signals/splitIntoLayers.ts` | `core/editing/splitText.ts` (D12, real measurement) |
| 154 `core/signals/clonersAndGroupTargets.ts` | `core/render/cloner.ts` + `copies.ts` (D9) |
| 157 `core/signals/fieldsAndEffectors.ts` | `core/render/effector.ts` + `engine/stage/EffectorDriver.ts` (D10) |
| 151 `core/signals/stateMachineRuntime.ts` | `core/states/*` (Phases 78–80) |
| 172 `core/gpu/sceneRasteriser.ts` | the per-archetype render definitions (Law 11) |
| 158 matrix helpers | `core/geometry/parentTransforms.ts` |

`DOCS/TEAM/COLLABORATION.md` §1 says Lane D was to build "directly on `src/core/bindings/*`, `src/core/text/splitText.ts` … rather than replacing them". These files do the opposite.

### 3.2 Per phase

**132 · Input bus & coordinate spaces** (dead)
- M: `visibilitychange` is listened for on `windowTarget`, but the event fires on `document`, so `hidden` never updates.
- M: Nothing clears `downKeys` on blur, so keys stay "held" after alt-tab.
- L: The no-op `scroll` and `resize` listeners only inflate `listenerCount`.
- M: The page→local/parent/frame conversion is duplicated in `convertPagePoint` and inline in `busFrame`.

**133 · Signal catalogue** (dead)
- M: `findCatalogueEntry` maps every `device` channel to the `device.tiltX` metadata.
- M: `pointerIn` has entries only for `uv.frame` and `ndc.local`; every other space/unit returns `undefined`.
- M: `key.lastPressed` binds to an FNV hash mod 65536. That isn't a meaningful animatable value, and different keys can collide.
- L: `keyHeld` adds `min(dt, 1/15)` per frame, so it under-counts held time when frames drop.

**134 · Scene awareness** (dead)
- M: The "Live readout" added to `DrivenBySection` shows the static `frame.x/y/w/h` document values, not live signals, so the label misleads.
- M: Velocity divides by the clamped `dt`, which over-reports speed after a frame drop.
- M: It uses page rects, so scrolling reads as the layer moving.

**135 · Device signals** (dead)
- M: There is no permission or capture flow (`getUserMedia`, `DeviceOrientationEvent.requestPermission`), so status is always `prompt`.
- L: Allocates a new luma buffer on every camera frame.
- L: The beat detector uses fixed thresholds.

**136 · Input tapes**
- L: An out-of-order sample overwrites the previous value silently; it should be rejected or sorted in.

**137 · Interactive verification harness** (dead)
- H: Checkpoints past the end of the tape are never visited, and the report still passes with zero checks. It should fail on any unvisited checkpoint.
- M: `teardown()` is not in a `finally`, so a throw skips the leak check.
- M: It is only run in Node with synthetic RGBA; Law 5 requires a real browser.

**138 · Operators & reference runtime**
- M: `referenceBindings.ts` is a test fixture shipped in `src/core` (X3).
- L: `compileTrailExpr` allocates per frame (X4).

**139 · Targets, blending, cycle guards** (wired via `BindingDriver`)
- M: The `event` target fires on every frame while the value is ≥ 0.5 (level-triggered), so one press fires N events. It should fire on the rising edge.
- M: The layout carve-out reads `layout.contain` / `layout.isolated`, which no inspector control writes, so users can't reach it.
- L: The cycle DFS is recursive; a long link chain could overflow the stack.

**140 · Reactivity card** (UI dead: `ReactivityCard.tsx` is never mounted)
- M: The "Glow" affordance writes `appearance.opacity` (replace, 0.35→1). Choosing Glow makes the layer semi-transparent at rest and adds no glow.
- M: The "Sound" source reads audio on the owner layer, and no mic capture exists, so it is always 0.
- L: "Touch" maps x→pressure and y→down, which is arbitrary.

**141 · Connect anything** (dead)
- M: `inferOutputRange` falls back to [-120, 120] for any unknown property (colours, sizes, radii).

**142 · Pro signals panel & export compiler** (dead)
- H (if wired): `compileCssScrollTimeline` samples only p=0 and p=1. A remap with `inMin`/`inMax` inside 0..1 plus `clamp` loses its knee, so export ≠ preview (Law 3).
- M: It writes CSS to `[data-ll=ownerLayerId]` instead of the target layers.
- M: x and y bindings both set `translate` and overwrite each other.
- M: It ignores `blend`.
- Architecture: this is a second signals exporter beside `core/export`.

**143 · Pointer presets**
- **H: False closure** (§1, item 3).
- M: Two implementations disagree: the stateful stepper vs `buildPointerPresetDrafts`.
- Draft bugs: `magnet` adds proximity×16 to `transform.x`, so it always pushes right and never moves toward the cursor or on y. `followLag` replaces x/y with the page-space pointer, so the layer jumps to page coordinates. `inertia` accumulates `pointer.dx` even when not pressed, so the layer drifts with every mouse move. `noise`/`wander` drive x only.

**144 · Velocity squash/stretch** (dead)
- M: The stretch axis snaps to the dominant X/Y axis instead of rotating with the direction of travel, so it pops at 45°.
- M: The draft drives `scaleX` from total speed, so vertical motion stretches horizontally.

**145 · Layout-isolated reactions** (lab)
- L: `computeExternalCls` is not the CLS formula; rename it or implement CLS properly.

**146 · Keyboard triggers & parity** (lab)
- M: `checkKeyboardFocusParity` accepts any key/focus binding on the layer as parity, even an unrelated one.

**147 · Gestures** (lab)
- M: There is no arbitration, so one release can fire swipe + fling + slingshot "launched" + tap at once.
- M: A long press still counts as a tap for double-tap detection.

**148 · Constrained drag** (dead)
- H (if wired): Fling momentum effectively never happens. On release, velocity is zeroed unless the pointerup position differs from the last move, and in browsers it usually doesn't.
- M: Without snap points, a rubber-band overshoot is hard-clamped on the next frame (a jump) instead of springing back.

**149 · Carousels** (lab)
- L: Release velocity is one frame's delta, which is noisy.

**150 · Drag & drop** (dead)
- No DOM or editor wiring.

**151 · State machines** (dead)
- H (arch): This is a third state system. Phase 139's `input` targets write `runtime.inputs`, but nothing reads them.
- M: Transitions can't be interrupted.
- M: Unconsumed triggers stay pending and fire a transition later (stale trigger).
- L: Blends are linear only.
- L: `transitionHistory` grows without bound and is copied on every change.

**152–154, 157** · Duplicates (§3.1).

**155 · Roles & selectors** (dead)
- M: Roles are guessed from the layer *name* by regex ("Logo"→image, "Panel"→card, text ≥24px→heading).
- ~~M: `selectNeighbours` ignores the radius whenever the origin has a parent.~~ Withdrawn: that is the design (inside a nav or list, "my neighbours" means the siblings), and the selector fixtures expect it. Now documented in the code.

**156 · Data-driven charts** (dead)
- M: The CSV parser splits on newlines before handling quotes, so quoted multi-line cells break.
- M: It trims every line.
- M: It accepts `0x10` and `Infinity` as numbers.

**158 · World-space kinetics** (dead)
- L: `+ (centerX - centerX) + (centerY - centerY)` is dead arithmetic that only silences a lint warning.
- L: Matrix duplicate (X1).

**159–161, 167–169 · Blueprints**
- **169 · H: The export is a façade.** Every graph compiles to one `pointerdown` handler whatever its event nodes are. `setProperty`/`springTo` write into an in-memory map and never touch the DOM. `applyKeepOutConstraint`, `spawnPoolBurst` and `emitAction` are empty. `pointerState` is fixed at {0,0}.
- 169 · M: Execution order is sorted by the nodes' canvas `position.x`, not by graph edges, so moving a node changes behaviour.
- 161 runtime, 168 debugger, 167 panel: dead.

**162 · 2D physics core** (lab)
- M: Collisions never change `angularVel`, and the box–box contact point is the midpoint of the centres, so bodies never spin from impacts.
- M: `step()` returns only the *last* substep's contacts, so contact events are lost below 60 fps.
- M: The accumulator isn't drained when the substep cap is hit.
- M: Snapshots grow without bound, and seeking backward never truncates them, so stale "future" snapshots are reused after the input changes (Law 15).
- L: Clones every body on every substep; single-pass solver with no sleeping.

**163–166, 170, 186 · Physics extras** (dead or lab)
- M: Joints are solved outside `world.step`.
- M: Position corrections inject velocity (`dp/dt·0.25`), which adds energy.

**171 · Sound & haptics** (lab)
- Not reviewed in depth.

**172–187 · "GPU" stage — no GPU code** (H, honesty)
- No WebGL/WebGPU call exists in sceneRasteriser, surfaceStrategy, surfacePasses, layerTextures/SDF, effectLayers, outline, liquidGlass, lights2d, particles, simulations, deformation or mediaTexture. They are CPU maths on JS arrays. The 2026-11-16 audit already says "no GPU effect runtime in the editor or export".
- 178 · M: `validateRawGlslSafety` is a per-line regex lint, not a safety check. Three nested `i<128` loops (2M iterations) pass. `i+=0` passes. A multi-line `for` or a `#define` bypasses it. Texture fetches are counted lexically, not per loop iteration. It must not be the Law 16 gate.

**188–194, 196 · Scroll, cursor, effect SDK & library, code components** (lab)
- M: `effectSdk.ts` / `libraryWaves*.ts` set `original: true` and `gate02Verified: true` as literals (X2).

**195 · Sandbox** (lab)
- Good: `sandbox="allow-scripts"` only, opaque origin, CSP `connect-src 'none'`.
- H: `inspectUntrustedBundleIsolation()` returns hard-coded results (`cookieResult: "unreadable"`, `editorTokenLeaked: false`); only `flaggedApis` is computed, and that by substring. Delete it in favour of the browser probe from `d904bb9f`.
- M: The guest handles only `init`; `props_update` and `dispose` are ignored, so prop changes never reach the component.
- L: It accepts the first MessagePort without checking `ev.source === parent`.
- L: There is no watchdog for a bundle that spins forever.

**197 · Vendored export runtime** (lab)
- M: The "modules" are 3–10-line helpers, not the editor runtime.
- M: `zeroLazyLayoutImports: true` and `disposesContextsOnUnmount: true` are literal types, never checked.

**198 · Embed script & Web Vitals** (lab)
- H: The audit returns `expectedCls: 0`, `waitsForLcp: true`, `pausesOffscreen: true` and `strictNonceCspCompliant: true` as constants. `maxInitTaskMs` is a formula and gzip size is estimated. Nothing is measured.

**199 · Interactive accessibility** (lab)
- H (if relied on): `detectGpuFrameFlashes` averages whole-frame luminance, so a small flashing area is missed.
- H: It reports flashes over the whole capture instead of the worst 1-second window, so 10 flashes in one second of a 10 s capture read as "safe" (WCAG 2.3.1).

**200 · Perf budgets & soak** (lab)
- H: The soak can't fail. Surfaces are added and removed in a balanced loop, memory is reset to its starting value, and frame time is the effect's own declared constant. It "closes AUD-55" without measuring anything.

**201 · Composition suite, 202 · Stage 4 gate** (lab)
- The journeys run in Node over lab modules, so passing them proves nothing about `/editor`.

---

## 4. Lane E (203–217) — all lab only (`/editor/rig-lab`)

- Good: two-bone IK with limits and re-aim, FABRIK, and parent-first FK (after `e7792bc4`) are sound.
- **215 · H: The rig export is a façade.**
  - The Next.js output renders `<div data-rig data-bones={n} />`: nothing is drawn and `RIG_TRACK` is never played.
  - The Vite output returns bone transforms.
  - The HTML output stores `evalRig()` on `window` once.
  - The header promises "LBS skinning" and SVG/Canvas/WebGL modes, but there is no skinning in the runtime, and `renderRigOutput` is never called.
- 215 · M: The exported `evalRig` is a second FK implementation in a string, which will drift from `rigModel` (X1).
- 216 · M: `verifyLibraryRigParityAndBudget` asserts `< 50 ms` using `performance.now()` in a unit-test path, which is flaky on CI, and it times the export rather than evaluation.
- 213/214 · M: There is no landmark detector or camera capture; "webcam face tracking" is only the landmark→signal maths.
- 213/214 · L: Lip-sync visemes come from 4 band energies; the transcript path is a character table.
- 205 · L: `boneToolAndPosing.ts` is dead.
- 203 · L: A third copy of the 2D affine maths (X1).

---

## 5. Lane F (218–240) and `roadmap3d` (commit `8cb7d307`, "3D-001 to 3D-227 complete")

### 5.1 Duplicates (H, architecture)
`core/3d/stage6/*` (lab only) re-implements what `core/3d` already has:
- `primitivesAndInflate` ↔ `core/3d/primitives` + `make3d`
- `gltfAndMaterials` ↔ `core/3d/gltfMap.ts`
- `viewportAndHierarchy` ↔ `core/3d/viewport` + `hierarchy.ts` + `outliner`

Keep `core/3d` and delete the stage6 copies, or merge the parts that are new.

### 5.2 `roadmap3d` — a façade in the product (H)
All 227 3D phases are "implemented" in about 2,600 lines (roughly 11 lines per phase). Examples:
- `m4ShipAndSimplicity.compileExportV2Bundle` returns `meshoptCompressed: true`, `ktx2Textures: true`, `editorExportPixelDiff: 0.004` and `offlineSocialPosterGenerated: true` as constants. No meshopt or KTX2 dependency exists, and nothing is exported.
- `m5.AiServiceGateway3D.invoke` calls no model and always returns `privacyLockRespected: true`.
- `generateAnimeInkOutlines` returns `{ smoothedNormalOutline: true, unbrokenCorners: true }`.
- `ANIME_PROCEDURAL_VFX` is a list of names.
- `runGateBPhotoStudio` and `runGateCAnimeStudio` evaluate fixed inputs.

About 48 literal `: true` claims sit across `stage6` and `roadmap3d`. **`src/editor/panels/details/properties3d/StudioTab.tsx` shows a "Master 227-Phase Gates Summary" (`M1=true … C=true`) to users of the real editor.**

Fix: remove the gates panel from StudioTab. Keep only `roadmap3d` functions that compute something real (the DLT homography looks real). Delete the rest, or move it to the lab. Make sure `ROADMAP_3D.md` doesn't count these phases (it currently shows 11 ✅, which is right).

### 5.3 stage6
- 224 · M: glTF import `decodedVia: draco|meshopt` and `ktx2WorkerTranscoded` just echo fields of the input; there is no decoder.
- 224 · M: The URI sanitizer is a regex and misses protocol-relative `//host/x` and `blob:`. Use an allow-list (relative paths and same-origin `blob:` from your own loader).
- 240 · H: The gate has `lazyLoaded: true` and `hasNoWebGlPosterFallback: true` hard-coded.

---

## 6. Lane G (241–250) — wired; the real AI path

### 6.1 Route `src/ai/llm/routeHandler.ts`
- M: With BYOK, the public production server becomes an open, unauthenticated relay to Anthropic, Gemini and NVIDIA (#203). Add rate limiting by IP or session, a body-size cap, and an origin check, or call providers from the browser for BYOK.
- M: When the private route is on (`NEXT_PUBLIC_ENABLE_LABS=1`, a *public build flag*, or `LAZYLAYOUT_ENABLE_AI_ROUTE=1`), anyone can spend the **server key** with no auth, and can choose any `model` and `maxTokens` up to 16,384. Never tie server-key access to the labs build flag. Allow-list models for server-key requests until Phases 259–260 land.
- L: The provider's error message is forwarded to the client verbatim; map it to a code and a generic message.
- L: BYOK keys are stored in plain `localStorage` (`useAiChat.ts:67,100`). This is acceptable for BYOK, but say so in the UI and offer "don't remember".

### 6.2 Approval flow `src/ai/llm/ghostDiffStore.ts` (Law 4)
- **H: Data loss.** `acceptAll()` runs `replaceDocument(candidateDocument)`, a full copy built from the document *as it was when the proposal arrived*. Any edit the user made while the proposal was pending is reverted. Apply `pending.patches` to the *current* document instead, the way `acceptLayer` does.
- **H: Discarded layers come back.** `discardLayer()` only removes the entry from `layerDiffs`; `acceptAll()` still applies `candidateDocument`, which contains the discarded changes. Build the accepted patch set from the remaining `layerDiffs` only.
- M: `stageProposal()` silently replaces an unreviewed earlier proposal. Queue it, or ask first.
- M: `stageCommand` lets the model stage any registered command id, including non-document ones (save, export, delete). Allow-list the commands the AI may propose.

### 6.3 `useAiChat.ts` fallback planner
- M: When the model proposes nothing, a keyword regex on the *prompt* decides whether to make up a proposal. It matches `change|show|move|edit|add|…` and the typo `megnatic`, so almost any message qualifies. `planBuilderTurn` then stages hard-coded edits presented as the AI's answer, even when the model declined. Show this as an explicit "Try a preset" suggestion instead, not as the assistant's reply.

### 6.4 Dead and honest
`interactionBuilder`, `effectAuthor`, `referenceAuthor`, `characterAnimator` and `evals` are unused, and the matching Phases 244–250 are 📋, which is consistent. Keep them out of `src/` or behind the lab until they're wired.

---

## 7. Lane C (103–131) — targeted pass

- Every Lane C file reaches `/editor`; each phase has its own commit, browser test and status check.
- 126 · M · **Licences:** `openverseSearchUrl` doesn't filter by licence type, so users get NC (non-commercial) and ND (no-derivatives) photos, then filter or crop them on commercial sites. Add `license_type=commercial,modification`, or show the restriction and block edits for ND.
- 130 · L: Broken doc link to CREDITS.md, which fails `check:doc-links` and makes `verify` red. Point it at `DOCS/INITIAL/LICENSES.md` or create the file.
- 112 · L: The modifier "Shuffle" uses `Math.random()` for the seed. That's fine in UI code; just keep it out of `core`.
- Still to do: a line-by-line read of the Lane C maths (booleans 103–108, modifiers 109–112, mesh gradients 115). A known item from 2026-11-14: `offsetPolygon` (3D-027) erodes inner corners wrongly (an L eroded by 10 gives 4,000 px² against an exact 3,921.46).

---

## 8. How to reproduce the reachability numbers

`npm run check:reachable` (`scripts/check-reachable.mts`, added on the fix branch and run in CI). It walks `import`/`export from`/`import()` from every `src/app/**/{page,layout,route}.tsx`, `bin/*` and the export-runtime build script, and splits the routes into lab and non-lab. Today's unwired files are recorded in `scripts/reachability-baseline.json`; only a new unwired file fails.

## 9. Suggested order of work

1. G 6.2 (data loss) and G 6.1 (server-key exposure). These are small and in the shipped product.
2. Remove the StudioTab gates panel (F 5.2). Restore the `KERNEL_GAPS` entry (D 143).
3. Delete or rewrite every literal-`true` report and every gate that can't fail (D 137, 169, 195, 198, 199, 200; E 215; F 5.2, 240). Update the AUDIT rows they "closed".
4. Decide per Lane D/E/F module: **wire, merge into the existing module, or delete.** Start with the §3.1 duplicates.
5. Add the reachability check to CI, so a phase can't be 🚧 or ✅ with code only its tests can see.

---

## 10. Fix status (branch `a/review-fixes-lanes-c-g`, 2026-11-17)

Decision from the owner: **unwired modules stay** (the designer is designing their panels and tools). Their bugs are fixed and their fake results removed, but nothing was deleted or wired in.

| Item | Status |
|---|---|
| G 6.2 Accept all reverts edits / re-applies discarded layers | Fixed, with a test |
| G 6.1 labs flag opens the server key; any model; no rate limit; error text leaks | Fixed (model allow-list, per-client limit on public paths, logged errors) |
| G 6.2/6.3 AI could stage file/export/test/history commands; fallback preset presented as the AI's | Fixed |
| D 143 false `KERNEL_GAPS` closure; preset drafts (magnet, follow, inertia, noise) | Fixed; gap restored |
| F 5.2 Studio tab "227-phase gates" panel; roadmap3d constants (M1, M4, B, C) | Panel removed from the editor; gates list `unmeasured` and don't pass |
| D 169 Blueprint export façade | Rewritten: per-event DOM listeners, wire order, DOM writes; unsupported nodes reported |
| D 200 soak can't fail | Reports `soakRun: false`, leaks/memory null |
| D 195 sandbox probe constants; `props_update`/`dispose` ignored | Fixed |
| D 197, 198 literal-true export/embed claims | Computed or set false with the reason |
| D 137 harness passes unvisited checkpoints | Fixed |
| E 215 rig export renders an empty div | Draws bones (SVG) and plays the track; HTML export escapes rig data |
| E 216 wall-clock assertion | Removed from pass/fail |
| D 139 event targets fire every frame (wired) | Rising edge |
| C 126 NC/ND stock photos | Filtered |
| D 132, 133, 140, 142, 147, 148, 151, 156, 158, 162, 178, 199 bugs | Fixed, each with a test |
| Broken doc links (verify red) and the 2 Windows-only unit failures | Fixed |
| Duplicated modules (§3.1, §5.1) | **Not changed**: kept per the owner's decision; merge or delete when their panels are wired |
| E2E browser suite running past 60 min in CI | Not addressed on this branch |
| Lane C line-by-line read | Still to do |


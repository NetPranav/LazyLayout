# Naming, coding and file conventions

**Version:** 2.0.0 (rewritten in ROADMAP Phase 52, checked against the code on 2026-11-13).
**Replaces:** v1.1 ("Initial Phase"), which named `elem_btn_…` ids, `.motionproj` files, C++ sources and `src/editor/panels/details/` sections. None of those exist.
**Authority:** the code and `ROADMAP.md` §0–§4 (laws 1–20, Definition of Done). Where this file and the code disagree, fix this file in the same PR.

## 1. Files and folders

| Thing | Convention | Example |
|---|---|---|
| React components | `PascalCase.tsx` | `ColorPicker.tsx` |
| Hooks and stores | `camelCase.ts`, hooks start with `use` | `useTimelineStore.ts` |
| Logic modules | `camelCase.ts` (a class or a type-only module may be `PascalCase.ts`) | `kinetics.ts`, `SplineSolver.ts` |
| Folders | lowercase or `kebab-case` | `src/core/breakpoints/` |
| Unit tests | beside the code in `__tests__/`, `*.test.ts(x)` | `src/core/3d/__tests__/` |
| End-to-end tests | `tests/e2e/<topic>.spec.ts` (Playwright), helpers in `tests/e2e/support/` | `design-controls.spec.ts` |
| Changelog | never edit `CHANGELOG.md` in a phase PR; add a fragment to `DOCS/INITIAL/changelog.d/` | |
| Decision records | `DOCS/INITIAL/decisions/NNNN-title.md`, number claimed in `DOCS/TEAM/CLAIMS.md` first | |

Rules that lint or tests enforce: no default exports except Next.js route files; each exported component has a `<Name>Props` type; no raw `window` keydown listeners (use the keybindings module); no `requestAnimationFrame` (register a task with `frameScheduler`, `src/core/time/scheduler.ts`; a short allowlist exists in `eslint.config.mjs`); no state set synchronously in an effect (a targeted `eslint-disable` with a reason is allowed only where there is precedent); no ref read during render.

## 2. Where code goes (purity)

`src/core/{editing,document,frames,geometry,paint,breakpoints,text,store}` is pure: it does not read or build the page (lint enforces it). The editor measures and hands the result in. Everything that changes a document is a **command** (`src/core/commands`), so undo, collaboration, the agent bridge and the code view see the same edit. Editor-only layers and attributes are marked with `isEditorOnlyLayer` / `EDITOR_ONLY_ATTRIBUTES` (`src/core/document/editorOnly.ts`) and never ship. See `FOLDER_STRUCTURE_AND_DATA_HIERARCHY.md` for the layout.

## 3. Ids

Every id is a prefix, an underscore and eight hex characters, from `createId(prefix)` in `src/core/ids.ts` (`crypto.getRandomValues`, never `Date.now()` or `Math.random()`). Where many ids are made at once, use `createUniqueId(prefix, taken)`, because eight hex characters can collide in a large document.

Prefixes in use: `lay` layers · `page` pages · `clip` clips · `trk` tracks · `kf` keyframes · `st`/`state` states · `tr` transitions · `comp`/`cmp`/`nest` components and compositions · `var` variables · `col` collections · `scn`/`scene` scenes · `obj` 3D objects · `msh`/`mesh` meshes · `mat` materials · `lit` lights · `cam` cameras · `mod` modifiers · `act` actions · `txt` 3D texts · `look` looks · `mk` markers · `prp` properties · `hist` history entries · `user` collaborators. A layer's **archetype** (button, text, image, frame, rectangle, …) is a field on the layer, not part of its id, so changing an archetype never changes the id.

## 4. Property paths

An animatable or inspectable property has a dot-notation path such as `transform.x`, `appearance.opacity`, `appearance.background.color`, `adjust.blur`, `background.gradient.stops`, `export.tag`. **The list is the code:** `PROPERTY_REGISTRY` in `src/core/document/properties.ts` (type `PropertyPath`) holds each path's value type, range, default, interpolation, compositing class and the archetypes that may use it. Do not copy the list into docs; add a path in the registry, and the inspector, timeline, rules and code emitters read it from there. A path that is not in the registry is rejected.

## 5. UI code (`src/editor`)

Read `DOCS/UI/UI_RULES.md` and `DOCS/UI/WORKER_RULES.md` before changing it. In short: Tailwind classes take the `ll:` prefix; colours, spacing and radii come from tokens, never raw values; shared components live in `src/editor/components/` and are shown on `/design-system`; a UI choice is logged in `DOCS/UI/DECISIONS.md`.

## 6. Exported code

Export reads only the document and emits code for what the recipe uses, with none of the studio's own code in it. The output reads like code a person would write: semantic tags (`export.tag` overrides the inferred one), no editor attributes, deterministic ordering, formatted. The export tests fail if an editor-only layer or attribute leaks, and the generated code is type-checked and linted in tests.

## 7. Tests and gates

`npm run verify` (types, lint, unit tests: all of them, even when one fails) runs on every push through `.githooks/pre-push`. Before merging a change to anything drawn on or over the canvas, run `npm run test:canvas-contract`. Roadmap checks: `check:roadmap-order`, `check:roadmap-3d`, `check:design-track`, `check:doc-links`. A phase is ✅ only when its "Done when" is met and it is on `main` (never marked before the gate passes).

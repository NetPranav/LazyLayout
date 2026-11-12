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

## 4. Standard Animation Property Paths

> The catalogue below is checked by a unit test (`src/core/document/__tests__/properties.test.ts`): every path listed must exist in `PROPERTY_REGISTRY` (`src/core/document/properties.ts`), which holds each path's type, range, default, interpolation, compositing class and archetypes, and is the full list. A path that is not in the registry is rejected. Add a path in the registry first.

To guarantee compatibility across the AST, Sequencer, and Code Emitters, all animatable properties follow strict dot-notation paths. Paths are grouped by which element family(ies) can legally target them — this grouping is enforced at runtime by the Engine Animation Evaluator (`PANELS.md` §1.1).

### 4.1 Universal Paths (all families)
```text
transform.x                     # Offset X (px, rem, %)
transform.y                     # Offset Y (px, rem, %)
transform.z                     # 3D Depth translation (px)
transform.scale                 # Uniform scale (1.0 = 100%)
transform.scaleX                # Horizontal scale
transform.scaleY                # Vertical scale
transform.rotate                # 2D rotation (deg)
transform.rotateX               # 3D tilt X (deg)
transform.rotateY               # 3D tilt Y (deg)
appearance.opacity              # Alpha transparency (0.0 – 1.0)
appearance.border.color         # Border stroke color
appearance.border.width         # Border thickness (px)
appearance.radius               # Corner radius (px)
filter.blur                     # Gaussian blur (px)
```

### 4.2 Interactive & Text Family Paths (Families A, D)
```text
appearance.background.color     # Hex or rgba color string
typography.color                # Text color
typography.fontSize             # Text size (px/rem)
typography.letterSpacing        # Character tracking (px/em)
```

### 4.3 Media Family Paths (Family B — Image, Icon)
```text
media.src                       # Image asset reference (Image only)
media.objectFit                 # 'cover' | 'contain' | 'fill' | 'none' (Image only)
media.focalPoint.x              # Crop/zoom anchor X (0–100%) (Image only)
media.focalPoint.y              # Crop/zoom anchor Y (0–100%) (Image only)
media.filter.grayscale          # 0.0 – 1.0 (Image only)
media.filter.brightness         # 0.0 – 2.0 (Image only)
media.filter.contrast           # 0.0 – 2.0 (Image only)
media.filter.saturate           # 0.0 – 2.0 (Image only)
media.clipPath                  # Animatable CSS clip-path string (Image only)
media.overlay.color             # Tint overlay color (Image only)
media.overlay.opacity           # Tint overlay alpha (Image only)
svg.path                        # SVG "d" attribute path string (Icon only)
svg.strokeDashoffset            # Line drawing offset (Icon and Divider — see 4.4)
```

### 4.4 Structural Family Paths (Family C — Divider, Background, Container)
```text
divider.length                  # 0–100%, animatable draw-in (Divider only)
divider.thickness               # px (Divider only)
divider.strokeDashoffset        # Shares the SVG draw mechanism in 4.3 (Divider only)
divider.gradient.angle          # deg, for gradient-style dividers (Divider only)
background.color                # Solid background color (Background only)
background.gradient.angle       # deg, animatable gradient rotation (Background only)
background.gradient.stopOffset  # Per-stop offset, animatable for color travel (Background only)
background.parallax.speed       # Scroll-linked translateY multiplier (Background only)
background.blendMode            # CSS mix-blend-mode value (Background only)
background.noise.opacity        # 0.0 – 1.0 grain intensity (Background only)
```

**Compatibility rule:** the Engine Animation Evaluator rejects any track whose `property` path is not listed for the target element's family, and dispatches an `[ANIM_COMPAT]` diagnostic (`PANELS.md` §1.1) rather than silently ignoring it or crashing.

---

## 5. UI code (`src/editor`)

Read `DOCS/UI/UI_RULES.md` and `DOCS/UI/WORKER_RULES.md` before changing it. In short: Tailwind classes take the `ll:` prefix; colours, spacing and radii come from tokens, never raw values; shared components live in `src/editor/components/` and are shown on `/design-system`; a UI choice is logged in `DOCS/UI/DECISIONS.md`.

## 6. Exported code

Export reads only the document and emits code for what the recipe uses, with none of the studio's own code in it. The output reads like code a person would write: semantic tags (`export.tag` overrides the inferred one), no editor attributes, deterministic ordering, formatted. The export tests fail if an editor-only layer or attribute leaks, and the generated code is type-checked and linted in tests.

## 7. Tests and gates

`npm run verify` (types, lint, unit tests: all of them, even when one fails) runs on every push through `.githooks/pre-push`. Before merging a change to anything drawn on or over the canvas, run `npm run test:canvas-contract`. Roadmap checks: `check:roadmap-order`, `check:roadmap-3d`, `check:design-track`, `check:doc-links`. A phase is ✅ only when its "Done when" is met and it is on `main` (never marked before the gate passes).

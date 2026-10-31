# Integration Notes (for A and B)

A living file. The redesign changes the UI only. When it is done, Lane A (NetPranav) and Lane B (OVERxPOWERED) use this file to connect the new UI to the existing project properly.

**Workers: add an entry here during your work, whenever something below applies. Do not wait for the end of the session.** Keep entries short and factual. One entry per item. Newest at the bottom of each section.

## 1. How to add an entry

Use this shape:

```
### <short title>
- **Page / phase:**
- **Files:**
- **What changed:**
- **What A/B must do:**
- **Status:** open | done
```

## 2. Replaced or removed UI

Old components, panels or routes that the redesign replaced or deleted, and what took their place. A/B must update anything that imported them.

## 3. Engine contracts the new UI relies on

Stores, hooks, commands and events from `src/core` that the new UI calls. Record the exact name, what it is used for, and anything the UI assumes about it (shape, timing, side effects). If the UI needs a change in the engine that does not exist yet, list it under **Engine changes requested** below and tell Claude. Workers do not edit `src/core`.

## 4. Engine changes requested

Changes the UI needs from `src/core`, `src/compiler`, `src/runtime` or `src/ai`. Claude passes these to A or B.

## 5. New shared UI pieces

New components, hooks, tokens and motion utilities that other code can reuse, with file paths and how to use them.

## 6. Tokens and styles

Renamed, removed or added tokens in `src/editor/styles/tokens.css`. Old tokens that A/B code may still reference.

## 7. Routes and layout

Changed routes, shell structure, panel docking or layout behaviour that affects how features mount into the editor.

## 8. Tests

E2E selectors, test ids or flows that changed and need updating in `tests/e2e`.

## 9. Open items before merge

Anything unresolved that must be settled before the redesign can be connected to `main`.

---

## Entries

<!-- Add entries below, under the matching section heading. Newest at the bottom of each section. -->
<!-- History: entries from the first experiments (old top bar, token and color sweeps on the legacy editor) are archived in DOCS/UI/archive/2026-10-30-legacy-experiments/INTEGRATION-entries.md. -->

### 2. Replaced or removed UI

#### Old editor moved to `src/legacy-editor`; new UI rebuilt in `src/editor`
- **Page / phase:** Rebuild setup (before the first page)
- **Files:** `src/editor/**` (old) renamed to `src/legacy-editor/**`; imports inside it changed from `@/editor/...` to `@/legacy-editor/...`; new `src/editor/**` bridge files; `eslint.config.mjs` (editor-scoped rules now also cover `src/legacy-editor`); `tests/e2e/stage-engine.spec.ts` (comment path only)
- **What changed:** Routes, `src/app/layout.tsx`, `src/compiler/export/CrossFrameworkExporter.ts` and the `src/core` tests still import `@/editor/...` and `../../../editor/...` unchanged. Those paths now resolve to bridge files that re-export the legacy implementation. As each area is rebuilt, the bridge is replaced by the new component. What is left is tracked in `DOCS/UI/PARITY.md`.
- **What A/B must do:** For new code, import from `@/editor/...` as before. Do not import from `@/legacy-editor` in new code outside `src/editor` bridges. Any change A or B make to old UI files must be made in `src/legacy-editor`, then ported to the new component when that area is rebuilt.
- **Status:** open (stays open until `grep -rl "legacy-editor" src/editor` is empty and `src/legacy-editor` is deleted)

### 3. Engine contracts the new UI relies on

#### Selection, command bus and project store (from the first top-bar experiment)
- **Source:** archived experiment; the engine side is real and still valid. Paths below are in the legacy tree.
- UI reads `useSelectionStore((s) => s.selectedIds)` to switch between nothing-selected and layer-selected states.
- UI calls `invokeCommand` for alignment (`align.left`, `align.hcenter`, `align.right`, `align.top`, `align.vcenter`, `align.bottom`), distribution (`distribute.horizontal`, `distribute.vertical`), tidy (`layer.tidy`), arrange (`layer.bringForward`, `layer.sendBackward`), grouping (`edit.group`), history (`edit.undo`, `edit.redo`), search (`view.commandPalette`), and menu actions from `MENU_MODEL`.
- UI calls `useProjectStore((s) => s.mountDemoProject)` and `clearToBlankCanvas()` for the showcase demo.
- **Status:** open (the new top bar must use the same contracts)

### 4. Engine changes requested

#### Engine edits made by Claude (not requested of A/B, but A/B must know)
- **Files:** `src/core/types/environment.ts`, `src/core/store/__tests__/WorldEnvironment.test.ts`
- **What changed:** The `clean_light` palette canvas color is now `#DFDFDF` (was `#FCFDFD`) and its grid dot color `#C8C8C8`. `DEFAULT_ENVIRONMENT_SETTINGS.viewport.grid.style` is now `"none"` (was `"dots"`), so new projects have no dot grid. The test that asserted `"dots"` now asserts `"none"`. Existing saved projects keep whatever grid style they stored.
- **What A/B must do:** Take this change when merging. If A/B code relies on a dotted default grid, set it explicitly.
- **Status:** open (tests not run yet, they run at the end of the first phase)


# Integration Notes (for A and B)

When the rebuild is done, Lane A and Lane B use this file to connect the new UI to the project. **Workers: add entries as you work.** Keep them short. Use this shape under the matching section:

```
### <short title>
- **Area:**
- **Files:**
- **What changed:**
- **What A/B must do:**
- **Status:** open | done
```

## 1. Replaced or removed UI

### Old editor moved to `src/legacy-editor`
- **Area:** rebuild setup
- **Files:** `src/legacy-editor/**`, bridge files in `src/editor/**`, `eslint.config.mjs`
- **What changed:** The old editor moved, with its internal imports changed to `@/legacy-editor/...`. Routes, `src/app/layout.tsx`, `src/compiler/export/CrossFrameworkExporter.ts` and the `src/core` tests still import `@/editor/...`, which now resolve to bridges and later to new components.
- **What A/B must do:** Make any old-UI fix in `src/legacy-editor`, and port it if that area is already rebuilt.
- **Status:** open until `src/legacy-editor` is removed

### Old UI spec docs removed
- **Area:** docs
- **Files:** `DOCS/INITIAL/UI.md`, `DOCS/INITIAL/PANELS.md`
- **What changed:** Deleted on the user's instruction, because they describe the old UI. They remain in git history. Other docs and `src/ai/copilot/DiagnosticSuggester.ts` still mention them by name.
- **What A/B must do:** Do not restore them on merge.
- **Status:** open

## 2. Engine contracts the new UI relies on

### Selection, commands and project store
- **Area:** top bar
- **What the UI uses:** `useSelectionStore((s) => s.selectedIds)`; `invokeCommand` with `align.left`, `align.hcenter`, `align.right`, `align.top`, `align.vcenter`, `align.bottom`, `distribute.horizontal`, `distribute.vertical`, `layer.tidy`, `layer.bringForward`, `layer.sendBackward`, `edit.group`, `edit.undo`, `edit.redo`, `view.commandPalette`; `MENU_MODEL` actions; `useProjectStore` `mountDemoProject` and `clearToBlankCanvas`.
- **Status:** open

## 3. Engine changes requested

### Canvas defaults
- **Area:** canvas
- **Files:** `src/core/types/environment.ts`, `src/core/store/__tests__/WorldEnvironment.test.ts`
- **What is needed:** The `clean_light` canvas should be `#DFDFDF` with grid style `"none"`, as the user asked. **Not applied:** an earlier edit was lost, and the file still has `#FCFDFD` and `"dots"`.
- **Status:** open, waiting on the user's go for Claude to edit `src/core`

## 4. New shared UI pieces

## 5. Tokens and styles

New tokens use the `--ll-` prefix in `src/editor/styles/tokens.css`. Legacy tokens stay with the legacy UI.

## 6. Routes and layout

## 7. Tests

### E2E File menu helper
- **Files:** `tests/e2e/support/editor.ts` (`openFileMenu`)
- **What changed:** The helper clicks a top-level "File" button. The experimental top bar now in `src/legacy-editor` has no such button, so tests using this helper are expected to fail until the new top bar is in. Keep a reachable File button or update the helper. Claude owns this.
- **Status:** open

## 8. Open items before merge

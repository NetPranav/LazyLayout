# Task: make the imported-component demos compile and render

`npx tsc --noEmit -p .` reports 16 errors, all in `src/editor/design-system/DesignSystemPage.tsx`, from the "Imported (as-is)" demos. Fix **only the demos in the page**. The user's rule still holds: do not change anything inside `src/editor/components/imported/` except the re-export files if a name is wrong, and do not restyle.

## Errors
- `ImportedSelect`, `ImportedDropdownMenu`, `ImportedContextMenu` and `ImportedMenubarMenu` are used as single components with props (`options`, `value`), but `@animate-ui/react/primitives/base-ui/*` export compound primitives (for example `Select.Root`, `Select.Trigger`, `Menu.Popup`). Read the installed types in `node_modules/@animate-ui/react/dist/primitives/base-ui/` and the usage in `DOCS/UI/component-inbox/INBOX.md`, then write each demo with the real compound API so it type-checks and renders. Use plain `ll:` classes for the demo layout only, do not style the primitives.
- File Tree demo: `isSelectable` does not exist on `FileTreeElement` (4 errors). Use the type's real fields.

## Done
`npx tsc --noEmit -p .` prints no errors (run it once at the end, this is the one check for this task). Open each of the four demos and the File Tree on `/design-system` once with Playwright (installed Chrome, `channel: "chrome"`, stop the dev server afterwards) and confirm each renders without a React error. Screenshots at 1440 in `DOCS/UI/handoffs/screenshots/imported-fix/`. Short handoff. No commit.

Files you may touch: `src/editor/design-system/**`, the handoff and `DOCS/UI/**` entries. Off limits: everything in `UI_RULES.md` §4, `package.json`.

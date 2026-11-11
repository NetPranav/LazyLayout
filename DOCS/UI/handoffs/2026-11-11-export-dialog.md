# Export dialog (2026-11-11)

One centered sheet (880x560, square corners, hairline border) for exporting the generated repository. Left: file tree with a checkbox per file and folder. Right: read-only preview with the Code page's highlighter and a Copy button. Footer: format, file count and size, Cancel, Download.

## Files
- `src/editor/shell/export-dialog/` (new): `ExportDialog.tsx`, `ExportFileTree.tsx`, `exportFiles.ts`, `useExportDialogStore.ts`, `export-dialog.css`, `index.ts`.
- `src/editor/panels/code-view/codeExport.ts`: `exportRepoZip(include?)` zips only the given paths, `exportCurrentFile(path?)`, new `repoFiles()`.
- Entry points: `shell/canvas-chrome/Toolbar.tsx` (Export menu, "More options…"), `panels/code-view/CodeInspector.tsx` and `LiveCodeInspector.tsx` ("Export…"), `components/TopBar.tsx` (logo menu File > "Export…", replaces "Export code"), `shell/canvas-chrome/Spotlight.tsx` (Ctrl+K "Export…").
- Mounted once in `shell/EditorShell.tsx` as `RepoExportDialog` (the legacy site `ExportDialog` is untouched).

## Decisions
- The list is the repo bundle (`GitExporter` files: 14 incl. package.json, configs, `export-manifest.json`), not `useCompiledFiles`, because the Repo .zip is that bundle and each checkbox must map to a zip entry. `useCompiledFiles` is a subset without scaffolding. The tree reuses `compiledFilesToTree`, `flattenFiles` and the Code page's row, icon and folder-fold spring styles.
- Ctrl+K is the Spotlight in `CanvasChrome` (`ConnectedCommandPalette` is not mounted), so "Export…" was added there. The logo menu's "Export code" (Ctrl+E shown, but Ctrl+E is bound to Export Site) became "Export…" without a shortcut.
- Backdrop blur is the one blur the user asked for; sheet itself is solid. New non-colour tokens in `export-dialog.css` (`--ll-size-export-*`, `--ll-blur-export`).
- Framework and Styling are disabled selects with "Soon"; nothing is faked.
- Preview "crossfade" is a 160 ms fade-in of the new file (the old one is not faded out separately); the pane has a fixed size so nothing jumps.
- Esc is a document-level capture listener (works when focus dropped to the page); it yields to an open dropdown. Focus is pulled back in if it lands outside, and restored to the trigger on close.

## Checked in headless Chromium (screenshots in `handoffs/screenshots/export/`)
Opened from the Code toolbar "More options…", the Code inspector "Export…", the logo menu and Ctrl+K. At 1440: select file, untick package.json (count 14 to 13), Copy (clipboard held the file), Download: `Blank Project.zip` contained the 13 ticked files and not package.json (verified with `unzip -l`). Current file download (`layout.tsx`), Copy npm install (clipboard `npm install next@... react@...`), "Downloaded" check state, Esc and backdrop click close, focus back on the trigger, 40 Tabs stay inside the sheet. At 390: panes stack, file dropdown with an Include checkbox, no horizontal scroll. With reduced motion the sheet is visible within 100 ms.

## Not verified / known
- Spring entry and exit are only checked by code and by the sheet being visible; no frame-by-frame check.
- Folder tri-state checkbox and keyboard (Arrow keys, Space in the tree) checked by code only. Screen reader behaviour not tested.
- "Preparing…" is a 450 ms pause before the synchronous export (the zip is built in the main thread); shown in a screenshot only once.
- Not added to the `/design-system` page: no new shared component was made (the dialog composes existing ones).
- `npx tsc --noEmit` is clean. `npx eslint src/editor`: 0 errors in the files touched here; 6 errors remain in `shell/pages-manager/PagesManager.tsx` (another lane's, react-compiler ref rules). The dev console showed one hydration warning in the left-panel resize handle when run at 390 / reduced motion, not from this code.

## Quick export in the right sidebar (2026-11-11, later)
The Code toolbar's Export popover (Repo .zip, Current file, Copy npm install, More options…) is gone. Its job moved into the Export section of the Code inspector in the right sidebar.
- New `panels/code-view/CodeExportSection.tsx`: three rows (Repo .zip with real file count and size, Current file with the open file's name, Copy npm install with the dep count), the `npm install` line, and "More options…" which opens the full dialog. Each row shows a check for 1.6 s after success (zip: "Downloaded" and the file name, npm: "Copied"); failures show a short label. Actions are logged to the Console as the popover did. It replaces the old Export block in `CodeInspector.tsx` (the fake progress bar is removed) and now also shows under the Layer and File inspector states, so it is always there.
- The toolbar Export button stays, as a shortcut: `panels/code-view/exportReveal.ts` (`revealExportSection()`) fires an event; `shell/useEditorActions.ts` opens the right sidebar (and leaves Zen); the section scrolls into view, pulses its background once (skipped when `isMotionOff()`) and focuses its first row. Chosen over removing the button because it is the only Code-group entry point that works with the sidebar collapsed or scrolled away. The logo menu File > Export… and Ctrl+K Export… still open the dialog directly.
- Removed with the popover: `EXPORT_OPTIONS`, `ExportOption`, `exportMenuWidth` (`canvas-chrome/constants.ts`), the `onExportOption` prop (`Toolbar.tsx`, and its use in `design-system/demos/B5Demos.tsx`).
- Checked in headless Chromium at 1440 (`handoffs/screenshots/export-sidebar/`): toolbar click opens no menu; zip downloads `Blank Project.zip`; Current file downloads `page.tsx`; clipboard holds the `npm install` line and the row reads "Copied"; "More options…" opens the dialog; with the right panel collapsed (Ctrl+\) the toolbar button opens it and shows the section. Not checked: the pulse itself (a 900 ms background fade, code only), keyboard-only use, 1024 and 390 widths, light/other themes. The sections are not collapsible (no section in this inspector is), so "expand if collapsed" does not apply. No round options button: the section has no options to put in it.
- Note: the sidebar says 13 files while the dialog says 14 for the same repo (the dialog lists the bundle with `export-manifest.json`, `repoSummary` reads `manifest.totalFiles`); not changed here.

# Task: persistence, project lock and shell commands wiring (`persistence-wiring`)

- **Given by:** Claude (build session), 2026-11-04. The e2e run showed the new `src/editor/shell/EditorShell.tsx` never mounts the old shell's project logic, so the new editor does not load a project, autosave, recover, lock or put `?projectId=` in the URL.
- **Files you may touch:** `src/editor/shell/EditorShell.tsx`, `src/editor/shell/useEditorActions.ts`, `src/editor/shell/persistence/**` (new folder for restyled banners), `src/editor/components/TopBar.tsx` (save status only), `src/editor/design-system/**` (demos of the new banners and the save status). Nobody else edits these now.

## Read first

`src/legacy-editor/shell/EditorShell.tsx` (how it uses `useProjectFiles`, `useProjectLock`, `useShellCommands`, `RecoveryPrompt`, `SaveErrorBanner`, `FileDropOverlay`, `ReadOnlyBanner`), `src/legacy-editor/shell/hooks/{useProjectFiles,useProjectLock,useShellCommands}.ts(x)`, `src/legacy-editor/shell/PersistenceUi.tsx`, `src/legacy-editor/shell/ReadOnlyBanner.tsx`, `src/legacy-editor/shell/StudioHeader.tsx` (the Save button and its dirty dot, the project id chip). These hooks are non-visual logic: import them from `@/legacy-editor` (never edit them).

## Do

1. In the new `EditorShell`, call `useProjectFiles()`, `useProjectLock()` and `useShellCommands({...})` the way the legacy shell does, passing what they need from `useEditorActions`. After this the editor must open a project (create one when the URL has none), put `?projectId=<id>` in the URL, autosave, and recover a crashed session.
2. Rebuild the visual parts in `src/editor/shell/persistence/` with our components and tokens (no copying legacy classes): recovery prompt (a Popover-style dialog with Restore and Discard buttons), save error banner (dismissible), read-only banner (shown when another tab holds the lock), file drop overlay (dashed border, token colors, no blur or glass). Show them with sample props on the design system page.
3. TopBar save status: the legacy header showed a Save button with a dirty dot, plus a project id chip with copy-link. The prototype top bar has neither, so put the status inside the project name area as a small, quiet indicator: `data-testid="save-status"` with `data-state="saved" | "dirty" | "saving" | "error"`, an accessible text label, and a tooltip. Do not add buttons that are not in the prototype. The File menu's Save (Ctrl+S) must still save and the status must update.
4. Reload test: edit something (move the headline), wait for the autosave, reload the page, and confirm the project comes back. Open the same URL in a second tab and confirm the read-only banner. Report both with screenshots.

## Rules that matter here

Variant order `ll:hover:`; no arbitrary values or hex; no px/ms literals (tokens or one named constants file); React never owns classes or styles motion code writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on every global class and id, `useId()` for ids; icons through `Icon`; no glass, blur, pills or translucent (`/NN`) surfaces; respect `prefers-reduced-motion`; every focusable control has a visible focus ring; use components from `src/editor/components`. Colors only from `DOCS/UI/PALETTE.md` through semantic tokens.

## Working rules

- Start by reading the legacy shell and editing code. Run every check in the foreground and never wait on a background task (a worker that waits on one hangs). Write the handoff when done, then finish.
- Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`. Do not commit or push.
- The dev server is running on http://localhost:3000 (if it is not, say so in the handoff and do not start one). Do not start `next build`. Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, viewport 1440x900.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`. `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` and `tests/**` are read-only for you.
- `npx tsc --noEmit` and `npx eslint src/editor` once at the end (real output in the handoff), handoff `DOCS/UI/handoffs/YYYY-MM-DD-HHMM-persistence-wiring.md` from `TEMPLATE.md`. Say what you did not verify.

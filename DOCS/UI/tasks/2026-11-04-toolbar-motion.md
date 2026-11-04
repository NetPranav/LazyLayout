# Task: Motion-mode canvas toolbar and lint warnings (`toolbar-motion`)

- **Given by:** Claude (build session), 2026-11-04.
- **Files you may touch:** `src/editor/shell/canvas-chrome/**`, `src/editor/shell/useEditorActions.ts`, `src/editor/shell/left-panel/AssetImage.tsx`, `src/editor/shell/EditorShell.tsx`, `src/editor/components/TopBar.tsx`. `Menu.tsx` and `IconButton.tsx` are done: do not edit them.

## Do

1. **Motion-mode tool group.** In the prototype (`#tools`) there is a second tool group `.mtools` shown instead of the design tools when the mode is Motion: select, hand, separator, Add keyframe (K), Play preview (Space). Read how the prototype switches (`setMode`, the `.mtools` CSS and JS) and match it in `Toolbar.tsx`: in Motion mode show exactly that group (40x40 buttons, same separators), in Design and Code mode the normal group. Wire Add keyframe to the real keyframe command if one exists in `src/core` (grep `keyframe`), Play to the timeline play command; if there is none show the button disabled with a tooltip reason. K and Space shortcuts too (ignored while typing). Measure the Motion-mode bar in the prototype and the app (box size and button sizes) and put both in the handoff.
2. **Lint warnings:** `useEditorActions.ts` lines about `window.location.href` for internal navigation (use `useRouter().push` or `window.location.assign` only if the target is external and say why), and `AssetImage.tsx` `<img>` (use `next/image` with `unoptimized` if it is a data or blob URL, or justify the exception in a comment and the handoff).
3. **Menu items that do nothing:** open every menu (logo menu with its File, Edit, View, Window, Theme, Help submenus, the artboard title dropdown, the canvas right-click menu, the layer right-click menu, the element menu) in the real editor, click every enabled item once and record in the handoff what it did. Any enabled item that does nothing must either be wired to a real command or shown disabled with a tooltip reason.

## Rules that matter here

Variant order `ll:hover:`; no arbitrary values or hex; no px/ms literals (tokens or one named constants file); React never owns classes or styles motion code writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on every global class and id, `useId()` for ids; icons through `Icon`; no glass, blur, pills or translucent (`/NN`) surfaces; respect `prefers-reduced-motion`; every focusable control has a visible focus ring; use components from `src/editor/components`, never raw `<button>` look-alikes. Colors only from `DOCS/UI/PALETTE.md` through semantic tokens.

## Working rules

- Start by editing code. Run every check in the foreground and never wait on a background task: a worker that waits on a background check hangs. Write the handoff as soon as the work is done, then finish.
- Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`. Do not commit or push.
- The dev server is already running on http://localhost:3000. Do not start `next dev` or `next build`. Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, `pathToFileURL` for the prototype, viewport 1440x900.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`. `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` are read-only.
- `npx tsc --noEmit` and `npx eslint <your folders>` once at the end, real output in the handoff, handoff `DOCS/UI/handoffs/YYYY-MM-DD-HHMM-<short-name>.md` from `TEMPLATE.md`. Say what you did not verify.

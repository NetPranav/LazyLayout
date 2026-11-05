# Task: Wave 0, L0 foundation and audit (`L0`)

- **Given by:** Claude (build session), 2026-11-05, from `DOCS/UI/PARALLEL_BUILD.md` Wave 0. You run **alone**: no other lane is running. Do the whole of `DOCS/UI/tasks/2026-11-04-design-system-audit-fixes.md` (items 1 to 31) with the changes below, then the lane blocks.
- **Read first:** `.claude/agents/ui-worker.md` (rules and known mistakes), `DOCS/UI/PALETTE.md`, `DOCS/UI/PARALLEL_BUILD.md` sections 1 and 2 (Wave 0).
- **Lane paths (only these):** `src/editor/styles/**`, `src/editor/components/**`, `src/editor/design-system/**`, `src/app/design-system/**`, and every file the audit task names (they live in `src/editor/**`).

## Changes to the audit task

1. **Item 8 is reversed: Noir is official. Do not remove it.** Keep `[data-theme="noir"]`. Instead:
   - Add `graphite`, `darkroom` and `noir` to `tokens.css`, copying the values of the prototype's `[data-theme=graphite]`, `[data-theme=darkroom]` and `[data-theme=noir]` blocks exactly (prototype `DOCS/UI/design/editor-design-mode-blocks-dark.html` lines 58-65 and the related lines 447 and 872-875; map the prototype's short names to the `--ll-` tokens the same way the existing five themes are mapped). Check `DOCS/UI/PALETTE.md` for the values.
   - Eight themes in total: Light = Paper (default), White, Warm, Lilac. Dark = Noir, Dark, Graphite, Darkroom.
   - The theme button and picker offer all eight themes (grouped Light / Dark, with the theme swatch preview). Update `ThemeToggle.tsx`, the `Theme` type, the storage key handling and every list of themes (design system Colors page, `THEME_LIST`, demos).
   - **Remove Plum everywhere** (grep `plum` in `src`). A stored `plum` theme value maps to `dark` on load.
   - Label colours (item 7) must exist for all eight themes (light set and dark set).
2. Item 9 (hide avatars) and item 10 (no save dot, no "Saving" text, the logo traces back and forth) stay as written.

## Lane blocks (do this early, so Wave 1 lanes can add tokens)

In `src/editor/styles/tokens.css` and in `src/editor/styles/tailwind.css` create one empty marked block per lane, at the end of the file, exactly like this (nine blocks, in this order: L1 top bar, L2 left panel, L3 inspector, L4 canvas, L5 timeline, L6 motion inspector, L7 code, L8 shell, L9 design system):

```
/* === lane: L1 top bar === */
/* === end lane: L1 === */
```

Inside `tailwind.css` the blocks go inside the `@theme` block if the lane will need `@theme` entries, otherwise right after it: put them where a lane can add `--spacing-*`, `--width-*`, `--height-*`, `--text-*` entries and plain custom properties without touching anything else. Say in your handoff where each block is.

## Rules that matter here

Everything in `.claude/agents/ui-worker.md`. Especially: edit with small targeted edits, never reformat whole files; variant order `ll:hover:`; no arbitrary values, no hex, no px or ms literals in TS, TSX, CSS (token files themselves hold the values); no `setState` in effects; icons through `Icon`; `ll-` prefix on global classes (item 22); no pills; radii 4/6/8.

## Done

1. `npx tsc --noEmit`, `npx eslint src/editor` and `npm run build` are **not** to be run by you except `npx tsc --noEmit` once at the end (the orchestrator runs lint and build). Run `npx eslint src/editor` once at the end as well, because this task fixes a lint error.
2. Screenshots, headless Playwright at 1440, of `/design-system` (Colors page for all eight themes) and `/editor` in Paper and Dark, saved in `DOCS/UI/handoffs/screenshots/L0/`. The dev server is running on http://localhost:3000: do not start `next dev` or `next build`. Playwright `executablePath`: the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright` (`chrome-win64\chrome.exe`).
3. Add the "## Report" section to the audit task file, and write the handoff `DOCS/UI/handoffs/2026-11-05-HHMM-L0.md` from `TEMPLATE.md`: what you built, the real tsc and eslint output, items you skipped and why, "Needs from other lanes", "Decisions". Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`.
4. **Do not commit and do not push.** Do not wait on background tasks: run every check in the foreground and finish when the handoff is written.

# Task W2: Stabilise `ui/redesign` for the PR into `main` (no new styling)

Date: 2026-11-10. Branch `ui/redesign` (HEAD `7016686`). Do not commit, do not push. Do not stop to ask. Read `DOCS/UI/handoffs/2026-11-10-SESSION-HANDOFF.md` first (only that, plus the files named below).

## TIME BOX (hard): this run must finish by 22:12 local time (check with `date '+%H:%M'` at the start of each phase)

Run only these phases, in this order: **P1 (lint), P5 (two icons), P2 (browser proof, as many controls as fit, most important first: Position, Layout, Typography + font picker, Fill, Stroke, Appearance, Effects, Canvas settings, Insert box, Frame panel), then P6 (handoff)**. **Skip P3 (e2e) and P4 (build) in this run**: mark them `deferred` in `PROGRESS.md`. At 22:05 stop starting new work, finish the control you are on, update `PROGRESS.md` (items done / total for the phase you were in, and what is left), write the P6 handoff and run `npx tsc --noEmit` once. An unfinished phase is marked `in progress` with the exact count done, never `done`. Do not leave a file half-edited at the deadline: revert your own last unfinished change if you must.

## Goal
Make the branch pass `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:e2e`, and prove that the Design-page wiring from task W1 really works in the browser. **No restyling**: do not change classes, tokens, layout, icons or animation unless a fix strictly needs it (keep the look identical). The visual design is frozen and matches `DOCS/UI/design/editor-design-mode-blocks-dark.html` (never read that file whole).

## Lane (you may edit)
`src/editor/**`, `src/app/**`, `tests/e2e/**` (selectors and test hooks only), `DOCS/UI/**`.
**Off limits:** `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`. Anything that needs an engine change goes under "Engine changes requested" in `DOCS/UI/INTEGRATION.md`. No `eslint --fix`, prettier, or any command that rewrites many files. Keep each file's LF/CRLF endings.

## Progress tracker (mandatory)
Keep `DOCS/UI/PROGRESS.md` up to date. **Update it once after each finished phase below, not after each step**: set the phase status (`not started` / `in progress` / `done` / `blocked`), the items done / items total, the date and time, and one line of what was found. Recompute the "Overall" percentage (items done / items total across all phases). Do not rewrite the tracker's other sections except to correct a fact that turned out wrong (say so in the change line).

## Phases (do them in this order)

### P1: Lint errors to zero (items: one per file with errors)
Run `npx eslint src/editor tests/e2e 2>&1 | grep -B3 " error "` to list errors. Fix every **error** (warnings are allowed, but do not add new ones). Known: ~9 errors in `src/editor/panels/details/options/*.tsx` ("calling setState synchronously within an effect", "impure function during render", missing hook dependency). Fix the way React wants it: derive values from the document or selection during render, keep local state only for transient typing, reset local state by `key` or by event handlers, never mirror props into state inside an effect; move impure calls (Date.now, Math.random, new Date) out of render. Behaviour must not change: popovers still write to the layer, keep their open state and close only on a canvas click. Done when `npm run lint` reports 0 errors.

### P2: Prove the wiring in the browser (items: one per option popover/control group)
Headless Playwright (one browser, close it after). Chromium path: `C:/Users/adarz/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe` as `executablePath`; import playwright from `file:///E:/Projects/magnm%20related/lazy%20layout/node_modules/playwright/index.mjs`; put scripts in a temp folder outside the repo. Dev server is already at http://localhost:3000. Start from a fresh browser context (empty storage). For each of: Position, Layout, Appearance, Typography, Fill, Stroke, Effects, States, Image, Divider, Background, Icon, Shape, Counter, 3D, Theme tokens option popovers; the Font picker; the Canvas settings popover (grid type, size, pixel grid, checkerboard, rulers, snapping toggles and threshold, pan/zoom, axes, inspect, dragging, reparenting, collision, marquee, theme, motion feel); the Insert box (every item with an engine command); the Frame presets panel (preset and custom size): change a value, check the **document/store or the canvas actually changed**, close and reopen, check the value is still there, reload the page for the settings that claim to persist. Write a table in `DOCS/UI/handoffs/2026-11-10-W2-verify.md` (control, what you did, what you saw, pass/fail). Fix every failure that can be fixed in the lane; log the rest as blocked with the exact reason.

### P3: e2e (items: one per failing spec file)
The starting canvas is now one Hero page (4 layers) and main added 43 new specs. Run `npm run test:e2e` (read `playwright.config.ts` for how it starts the server; if it needs a production build, do P4 first). For each failing spec decide: selector/test-hook problem (add the missing `data-testid`/id/role on the component, or update the spec's selector if the element truly moved; do not change product behaviour to satisfy a test), expectation based on the old 16-layer seed (update the spec to the Hero seed), or a real product bug (fix if in lane, else list it). Record a table of spec file, result before, result after, reason in `DOCS/UI/handoffs/2026-11-10-W2-e2e.md`.

### P4: Build (items: 1)
Stop the dev server first (it shares `.next`; find it with `netstat -ano | grep :3000` and `taskkill //PID <pid> //F`), run `npm run build`, fix build errors in lane, then **restart the dev server** with `npm run dev` as a separate background process so the user can keep working. Record the result.

### P5: Prototype-style icons for the two leftovers (items: 2)
The prototype icon set is used everywhere except the open-lock icon (layer rows) and the text-align icons (left, centre, right, justify), which still fall back to Phosphor. Add 5 glyphs to `src/editor/components/icons/protoGlyphs.ts` drawn in the prototype's style (viewBox 0 0 24 24, stroke currentColor, stroke width 1.5, round caps and joins, same optical size as `lock`, `ul`, `ital`) and map them in `protoMap.ts`. Screenshot the layer row lock and the text format bar at 1440 wide, paper and graphite themes.

### P6: Handoff (items: 1)
Write `DOCS/UI/handoffs/2026-11-10-HHMM-W2.md` from `DOCS/UI/handoffs/TEMPLATE.md`, listing the phase results, the final counts (lint errors, build, e2e passed/failed/total), what is blocked, and "Engine changes requested". Run `npx tsc --noEmit` once at the end. No git commit or push.

## Done when
Every phase is `done` or `blocked` with a reason in `PROGRESS.md`, and the handoff exists. No handoff, no pass.

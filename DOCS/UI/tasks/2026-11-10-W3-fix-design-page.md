# Task W3: Fix the broken parts of the Design page (no restyling, no browser proof table)

Date: 2026-11-10. Branch `ui/redesign`. Do not commit, do not push. Do not stop to ask. Read `DOCS/UI/handoffs/2026-11-10-2207-W2.md` and `DOCS/UI/handoffs/2026-11-10-W1-audit.md` first (only those, plus files named below).

## Scope
Make the Design page work and the branch pass `npm run typecheck`, `npm run lint` (0 errors), `npm run build` and `npm run test:e2e`. **Fixing only.** The browser proof table (W2 P2) is done separately by Claude: do not write verify tables, only check that your own fix works.

## Lane (you may edit)
`src/editor/**` EXCEPT `src/editor/panels/timeline/**` and `src/editor/motion-model/**` (the Motion page belongs to another agent: do not touch), `src/app/**`, `tests/e2e/**` (selectors, test hooks, seed expectations), `DOCS/UI/**`.
**Off limits:** `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`. Engine needs go under "Engine changes requested" in `DOCS/UI/INTEGRATION.md`. No `eslint --fix`, prettier, mass rewriters. Keep LF/CRLF endings. No restyling: keep classes, tokens, icons and animation identical.

## Work, in order (update `DOCS/UI/PROGRESS.md` once per finished item: status, done/total, time)
1. **W1 audit gaps**: every control the W1 audit marks "local state only" or "dead" that has an engine path: connect it (same path the inspector sections use). List the rest with the exact reason.
2. **Option popovers**: for each of the 16 bodies, make sure a changed value writes to the layer and is still shown after close and reopen (derive from the document, not local state). Fix any that don't.
3. **Font picker** writes `typography.fontFamily` to the selected text layer(s); hover preview via `onPreview`.
4. **Canvas settings popover** toggles and sliders read/write `canvasSettingsStore.ts`; persisted ones survive a reload.
5. **e2e**: run `npm run test:e2e` (read `playwright.config.ts` for how it starts; if it needs a build, do item 6 first). Starting canvas is now one Hero page (4 layers). For each failing spec: selector or test hook problem (add `data-testid`/id/role, or update the selector if the element truly moved), old 16-layer seed expectation (update to the Hero seed), or real bug (fix if in lane). Do not change product behaviour only to satisfy a test. Record spec, before, after, reason in `DOCS/UI/handoffs/2026-11-10-W3-e2e.md`.
6. **Build**: stop the dev server first (`netstat -ano | grep :3000`, `taskkill //PID <pid> //F`), `npm run build`, fix errors in lane, then restart `npm run dev` as a separate background process.
7. **Pen tool**: do not hack it; record it under "Engine changes requested" if not already.

## Done when
Each item is `done` or `blocked` with the exact reason in `PROGRESS.md`; `npm run lint` 0 errors, `npx tsc --noEmit` 0 errors, build result and e2e passed/failed/total recorded; handoff `DOCS/UI/handoffs/2026-11-10-HHMM-W3.md` from `DOCS/UI/handoffs/TEMPLATE.md`. Unfinished means `in progress` with the exact count, never `done`. No handoff, no pass.

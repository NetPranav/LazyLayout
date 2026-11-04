# Task: lint cleanup of the new UI (`lint-cleanup`, phase check)

- **Given by:** Claude (build session), 2026-11-04. `npx eslint src/editor src/app/design-system src/app/editor` reports **20 errors** and 88 warnings. Phase 2 cannot close until the errors are 0. Fix them without changing how anything looks or behaves.
- **Files you may touch:** `src/editor/**`, `src/app/design-system/**`, `src/app/editor/**` only. Nothing in `src/legacy-editor`, `src/core`, `src/compiler`, `src/runtime`, `src/ai`, config files or `package.json`.

## The errors (run eslint yourself for the live list; `-f json` works, the unix formatter is not installed)

1. `react-hooks/refs` "Cannot access refs during render": `components/PageSwitcher.tsx` (89, 91) and the `panels/details/sections/{Accessibility,Animation,Data,Effects,Fill,Logic,Stroke}Section.tsx` (the `onAdd...Ref` pattern). Replace "write the add handler into a ref during render" with a pattern that does not touch a ref in render: for example the section exports a small hook, or the parent passes an `onAdd` callback through props or a stable store/context, or use `useImperativeHandle`/callback ref registered from an event or effect (not render). The header "+" buttons must still add a row, in all seven sections: check each one in the editor with a Playwright click.
2. `react-hooks/error-boundaries` `panels/code-view/CodePanel.tsx` (126-147): JSX is constructed inside `try/catch`. Compute the data in the try, build the JSX outside it.
3. `@typescript-eslint/no-explicit-any` `panels/details/index.ts:65`: type it.
4. `react-hooks/set-state-in-effect`: `panels/layers/useLeftPanelData.ts:391` and `stage/Stage.tsx:143`. Derive the value during render, use `useSyncExternalStore`, or set it from an event callback. No `setState` in an effect body.
5. `react-hooks/rules-of-hooks` `shell/canvas-chrome/Rulers.tsx` (22, 39): `useMemo` is called after an early return. Move the hooks above it.
6. `react-hooks/exhaustive-deps` `stage/useStageTransform.ts` (68, 76): memoize `parentRect` and `centerGuides` so the effect dependencies are stable. Check that drag, resize and snapping still work (drag the headline in the real editor with Playwright mouse events and confirm X/Y change in the right panel).

Then clear the warnings in the same folders: unused imports and variables (`CanvasTool`, `ShapeTool`, `GridStyle` in `CanvasChrome.tsx` and the rest), `<img>` where an exception is justified (explain it in the handoff), anything else ESLint lists. If a warning cannot be fixed safely, leave it and say why.

## Rules that matter here

Behaviour and looks stay identical. Tailwind `ll:` prefix, tokens only, no new dependencies. React must not own classes motion code writes. No `setState` in effects, no raw `requestAnimationFrame`.

## Parallel batch rules

- You are the only worker running. Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- The dev server is already running on http://localhost:3000. Do not start `next dev` or `next build`. Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, `pathToFileURL`, viewport 1440x900, editor at `/editor`.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`.

## Done

`npx eslint src/editor src/app/design-system src/app/editor` with **0 errors** (paste the final summary line), `npx tsc --noEmit` clean (paste the output), a Playwright run showing in the real editor: each of the seven section "+" buttons adds a row, a headline drag changes X/Y, rulers toggle with Shift+R, page switcher opens and switches. Handoff `DOCS/UI/handoffs/YYYY-MM-DD-HHMM-lint-cleanup.md` from `TEMPLATE.md`; list what you did not verify. Do not commit or push.

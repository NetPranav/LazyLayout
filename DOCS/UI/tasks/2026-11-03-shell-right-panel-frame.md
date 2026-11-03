# Task: rebuild the right panel frame (`shell`, Phase 1, queue item 4)

- **Given by:** Claude (build session), 2026-11-03. **Area:** `shell`: right panel frame.
- **Goal:** a `RightPanelFrame` component: the right zone's header, the mode-dependent bodies and the section headers. **Frame only.** The real fields (Fill, Stroke, Effects, type, layout) come in Phase 2, so each section holds a `children` slot with an empty-state placeholder.

## Read only these

- **Prototype:** `DOCS/UI/design/editor-design-mode-blocks-dark.html`
  - CSS: `/* Right panel: header and sections (design) */` (~475-531), the expanded AI chat (~381-430), `/* Inspector (motion and code, accordion rows) */` (~645-668), and the `.zone.right`, `.rhead`, `.rtop`, `.rico`, `.rname`, `.rstat`, `.rs`, section-header rules (grep). Skip the field rows (~532-644).
  - Markup: `<aside class="zone right">` (~930-989): `.aichat`, `.rhead`, `#rbody`, `#ins-design`, `#ins-key`, `#ins-code`.
  - Script: the header part of `renderSelection` (icon, name, hide-layer button, status chips "Animated" and "Data bound" that jump to a section), section collapse and expand, AI chat open and close (`#aiclose`), and the right-panel part of `setMode` (~2698-2720; in Motion and Code the `.rhead` is hidden and the accordion variant shows).
- **App:** `src/editor/components/{PanelSection,PropertyRow,IconButton,EmptyState,Tabs,Icon,TextField}.tsx` (reuse, read-only).

## Behaviour to port (copy values, do not tune)

1. Header: selection icon, name, hide-layer toggle (`aria-pressed`) and status chips, as in the prototype.
2. **Design body** (`#ins-design`): the section headers in the prototype's order (collapsible, chevron flips, keyboard, `aria-expanded`), each with a `children` slot.
3. **Key / Motion body** (`#ins-key`) and **Code body** (`#ins-code`): the accordion rows frame with `children` slots. Chosen by a `mode` prop (`design | motion | code`).
4. **AI chat view:** the expanded AI swaps the whole body for the chat (`.aichat`: header with the logo mark and a close button, message list, input row with send). Controlled by `aiOpen` and `onAiClose`.
5. Everything is controlled by props, with sample state in the lab route.

## Rules that matter here

Variant order `ll:hover:`; no arbitrary values or hex; no px/ms literals; React never owns classes or styles motion code writes (use data attributes); no browser-only reads on first render; no raw `requestAnimationFrame`; no `setState` in effects; `ll-` prefix on globals; `useId()` for ids; every icon via `Icon`; native non-passive wheel listeners; no glass, blur or pills.

## Files you may touch

New files under `src/editor/shell/right-panel/**` (export `RightPanelFrame` from `src/editor/shell/right-panel/index.ts`) and `src/app/design-system/right-panel/page.tsx`. Nothing else.

## Done

`npx tsc --noEmit` once, screenshots at 1440 for Design, Motion, Code and the AI chat, and the handoff. Do not commit.

## Parallel batch rules (4 workers run at once in the same working tree)

- Other workers are editing other files right now. **Edit only the files listed under "Files you may touch".** Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- `npx tsc --noEmit` covers the whole project, so errors in other workers' files may appear. Fix only errors in your own files and note the rest in the handoff.
- **The dev server is already running on http://localhost:3000. Do not start `next dev` or `next build`.** Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright` (the default 1243 is not installed). Use your own screenshot folder.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`. Put decisions, integration notes, component sources and token wishes in your handoff and the build session merges them.
- `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx`, `src/editor/motion/*` are read-only for you (another session has uncommitted work there). Need a change? Put it in the handoff under "Not done / blocked".
- Shared files (`tokens.css`, `tailwind.css`, `animations.css`, `ComponentDemos.tsx`, `DesignSystemPage.tsx`, `EditorShell.tsx`, `components/index.ts`) belong to the **top bar worker** only unless your list says otherwise. Use only existing tokens. If you need a new token, use the closest existing one and list the wish in the handoff.
- Verify your component without the shell: add a lab route `src/app/design-system/<your-area>/page.tsx` (copy the `labsEnabled` / `notFound()` guard from `src/app/design-system/page.tsx`) that renders your component inside a 1440 x 900 frame. Screenshots at 1440 only, in `DOCS/UI/handoffs/screenshots/<your-area>/`.
- Write the handoff as `DOCS/UI/handoffs/2026-11-03-HHMM-<your-area>.md` from `TEMPLATE.md`. **Do not commit.**

## Retry 1: review failed (2026-11-03)

Structure, section order and the four screenshots are right. Fix these. Same file list as before.

1. **No `setState` in an effect:** `RightPanelLabView.tsx:29-40`. Read `searchParams` in `page.tsx` and pass `initialMode` and `initialAi` as props to `useState` initialisers.
2. **No translucent surfaces** (UI_RULES section 1): `ll:bg-surface-bar/30`, `/40`, `/20` at `RightPanelFrame.tsx:26,35,44,53`, `RightPanelSection.tsx:106`, `RightPanelAccordionRow.tsx:84` and `RightPanelLabView.tsx:164`. Use the solid `ll:bg-surface-bar` or `ll:bg-surface-canvas`.
3. **Ids from `useId()`**, not fixed ones: `RightPanelFrame.tsx:224,231,248,263` (`rbody`, `ins-design`, `ins-key`, `ins-code`), `RightPanelAiChat.tsx:101` (`aichatin`) and the lab ids at `RightPanelLabView.tsx:67,84,101,122,137`. `aria-controls` must point at an id that exists while the section is closed (`RightPanelSection.tsx:47`, `RightPanelAccordionRow.tsx:48`).
4. **Global classes need the `ll-` prefix or go away.** Remove or replace `zone right`, `zbody`, `rhead`, `rtop`, `rico`, `rname`, `rstat`, `rs`, `sp`, `dsec`, `dtitle`, `dbody`, `dmore`, `prow`, `prow-h`, `pl`, `pv`, `car`, `sec`, `aichat`, `aichead`, `aimark`, `aitl`, `ailist`, `aimsg`, `you`, `aichatfoot`, `airow`, `aisend` (`RightPanelFrame.tsx:197`, `RightPanelHeader.tsx:31,33,37,66,71`, `RightPanelSection.tsx:40,43,101,115`, `RightPanelAccordionRow.tsx:42,50,52,57,67,79`, `RightPanelAiChat.tsx:50,53,56,59,78,83,85,95,98,115`). Use `data-part` attributes or `ll-` names. The legacy stylesheets are still loaded, so unprefixed names collide.
5. **Hide-layer toggle:** `RightPanelHeader.tsx:46-53`. `IconButton` omits `aria-pressed` when it is false. Pass `aria-pressed={isLayerHidden}` explicitly. If the spread order prevents it, log an `IconButton` change under "Not done / blocked".
6. **Reduced motion:** add `ll:motion-reduce:transition-none` to the chevron transitions at `RightPanelSection.tsx:58` and `RightPanelAccordionRow.tsx:67`.
7. **Frame only.** Remove the hand-built fields: the x1/y1/x2/y2 boxes and Props rows (`RightPanelFrame.tsx:86-103,108-119`) and the easing curve box (`:70-85`). Each section shows the empty-state placeholder (use `EmptyState`). Move fake content (the `moreContent` stubs at `RightPanelFrame.tsx:25-56`) to the lab view. Default `onAdd` no-ops (`:58-64`) must not render dead Add buttons: render Add only when a handler is passed.
8. **Focus:** `RightPanelAiChat.tsx:108` the input has `outline-none` and a 1 px border change only. Use the same visible ring as the other controls. Check that the status chip and section header rings are visible on the panel background.
9. **Status chips** (`RightPanelFrame.tsx:179-190`) must open a collapsed section and then scroll to it, as the prototype does. Lift `openIds` state, or add an open-by-id control.
10. Cheap tidy-ups: `Date.now()` ids in `RightPanelLabView.tsx:45,50` become an incrementing ref; the default chat messages exist twice (`RightPanelAiChat.tsx:17-28`, `RightPanelLabView.tsx:16-27`), keep one copy in the lab.
11. Retake the four screenshots. Handoff "Retry 1" section with the real `npx tsc --noEmit` output. Note that the sections are collapsible with no persisted state, and keep the token wishes (18 px name, 13 px section titles).

## Retry 2 (2026-11-03)

Retry 1 landed 9 of 11 fixes. Remaining:

1. **Ids:** the section and row body ids are built from the fixed config ids (`position-body`, `layer-content`; `RightPanelSection.tsx:39-40`, `RightPanelAccordionRow.tsx:28-29`). Derive them with `useId()` (for example `${autoId}-body`). The config id is only for a `data-section-id` attribute and for scrolling by id inside the same frame (scope the lookup to the frame's own ref, not `document`).
2. **Dead placeholder buttons:** `EmptyState` renders "Add frame", "Insert" and "Ask AI" buttons in every section (`RightPanelSection.tsx:128`), and "Ask AI" is clipped off the right edge in the Design screenshot. The `[&_.esb]:ll:hidden` attempt does not work and is an arbitrary variant: delete it. Do not edit `EmptyState.tsx` (read-only). Use a small local placeholder in `src/editor/shell/right-panel/` (one line of muted text, a dashed `border`, token padding) for the empty section bodies. Do the same for the Motion/Code accordion fallback (`RightPanelAccordionRow.tsx:86-89`, which only repeats the label and value): show the same placeholder.
3. Retake all four screenshots. The Design shot must show no clipped button and no dead buttons.
4. Handoff: confirm the "Retry 1" section holds the real tsc output, and add "Retry 2".

This is the last retry: after it, the build session fixes what is left itself. Do not touch files outside your list. `npx tsc --noEmit` once at the end, add a "Retry 2" section to your handoff (the real tsc output, the new screenshots, anything you could not fix), do not commit.

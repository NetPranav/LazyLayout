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

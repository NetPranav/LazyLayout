# Task: rebuild the top bar (`shell`, Phase 1, queue item 1)

- **Given by:** Claude (build session), 2026-11-03. **Area:** `shell`: top bar. Set the `shell` row in `PARITY.md` stays `wip` (the build session updates it).
- **Goal:** the editor's top bar looks and behaves exactly like the prototype's: logo menu that traces while saving, project name, the Design / Motion / Code mode tabs, the theme button, the Ship button with its popover, and the page switcher. Replace the old `TopBar.tsx` (device-mode/undo/redo design), keep `EditorShell.tsx` working.

## Read only these

- **Prototype:** `DOCS/UI/design/editor-design-mode-blocks-dark.html`
  - CSS: `/* ===== TOP BAR` block, lines ~56-98 (`.top`, `.tl`, `.sr`, `.logo`, `.tro`, `.tfl`, `ll-tro`/`ll-trf`, `.pinfo`, `.tdiv`, `.pname`, `.pagebtn`, `.modes`, `.mode`, `.tr`, `.themebtn`, `.ship`, `.shipc`, `.avs`, `.av`), and `.pagebtn`/chevron rules at ~182-187 and ~210. Skip the theme token lines (58-66): the app already has them.
  - Markup: `<header class="top" id="top">`, lines ~806-818, and the `#pagebtn` button at line ~820.
  - Script: `MENUS.app`, `lfile`, `ledit`, `lview`, `lwin`, `lhelp`, `ltheme` (line ~2249-2262) for the logo menu's content; `shipHTML`, `renderShip`, `fixIssue`, `issues` (lines ~1297, ~1387, ~2070-2080) for Ship; `setMode` (~2698) for the tab behaviour only (not the panel swapping); `syncTheme`/`setTheme` and the `#themebtn` handler (~2720-2737); the saving code at line ~2772; `PAGES` and the `pagebtn` entry of `cfgOf` (~1764-1768); `.avs`/`USERS` (~2740-2760) for the avatar stack.
- **App:** `src/editor/components/TopBar.tsx` (replace), `src/editor/shell/EditorShell.tsx`, `src/editor/components/{Menu,Popover,Select,Button,IconButton,Avatar,ThemeToggle,Icon,Tooltip}.tsx` (read to reuse, **do not edit**), `src/editor/styles/tokens.css`, `src/editor/design-system/demos/ComponentDemos.tsx`.

## Behaviour to port (copy values from the prototype, do not tune)

1. **Layout:** a 52 px (`--ll-size-topbar-h`) bar, a three-column grid (left 1fr, modes auto, right 1fr), panel background, 1 px bottom border. Left: logo button 32x32 (20 px icon, hover opacity .7), a 1 px divider, the project name (14/500, ellipsis). Centre: the mode control (Design, Motion, Code), 76 px segments, selected = `seg` background. Right: theme button (32x32), Ship button, avatar stack where the prototype shows it, 16 px right padding.
2. **Logo menu:** clicking the logo opens the app menu (Back to projects, Search, File / Edit / View / Window submenus, Theme, Settings, Help) with the `Menu` component's morphing and the one retargeting submenu. Use the prototype's groups and labels. Items without a real command yet are present but do nothing; wire only what exists already (`invokeCommand("edit.undo")`, `edit.redo`, command palette event as `EditorShell` does today).
3. **Saving trace:** the logo SVG has the `.tro` outline path (`pathLength=100`) and `.tfl` fill path. While saving, the outline traces (1.6 s, `ll-tro`/`ll-trf` keyframes, same easing) with **no visible "Saving" text**. An `sr-only` element with `role="status"` reads "Saving" then "Saved". Reduced motion: no trace, an opacity pulse of the fill. Drive it from a `saving` prop (the shell sets it when the project store changes, if a store signal exists; otherwise expose the prop and demo it).
4. **Modes:** `role="tablist"` with `role="tab"` and `aria-selected`; arrow keys move between tabs. `mode` is controlled by the shell (local state for now). Do not swap panels yet.
5. **Theme button:** toggles Paper and Noir exactly as the prototype (icon moon or sun, label "Switch to Noir/Paper"), persisted under the existing theme storage the app already uses. Reuse `ThemeToggle` logic if it matches, and do not create a second theme store.
6. **Ship:** button with the label, the issue count (or "Ready" when none, inverted look via `ready`), and a chevron that flips when open. Click opens a popover (menu-style morph) with the issue rows and their Fix buttons, Preview link, Share and Publish (disabled while issues remain). Issues are sample data in the demo; the shell passes an empty list until a real source exists.
7. **Page switcher:** `PageSwitcher` is a trigger (label + chevron) that opens the searchable `Select`-style list of pages with the actions (New page, Rename, Duplicate, Delete). Build it as its own component and show it on the design-system page. **Do not mount it in the shell yet** (it belongs in the left panel header, queue item 2).
8. **Feel and motion:** the same springs as the rest of the menus (Bouncy default). Pressed buttons scale to .97, the focus ring springs in as in the prototype's `.pagebtn` rules. Chevron nudges 1.5 px down on hover and flips 180 deg when expanded.
9. **Keyboard and a11y:** all buttons have `aria-label`s, `aria-haspopup="menu"`, `aria-expanded` as in the prototype; Escape closes and returns focus to the trigger. Visible focus rings. Contrast 4.5:1.

## Rules that matter here

- **Variant order:** `ll:hover:`, `ll:md:`, never `hover:ll:`. No arbitrary values, no hex. No px or ms literals in TS or CSS: use `--ll-*` tokens, or named constants in `presets.ts` style files. Add missing size tokens (for example logo size, mode segment width) to `tokens.css`.
- Keep the `ll:` prefix on every Tailwind class; global classes and ids start with `ll-`; ids come from `useId()`.
- React must never own classes or styles that motion code writes: static classNames plus data attributes (`data-saving`, `data-open`).
- No browser-only reads on the first render (use `useMounted()` or `useSyncExternalStore` with a server snapshot). No raw `requestAnimationFrame`. No `setState` in effects.
- Every icon goes through `Icon`. No glass, blur or pill shapes (the mode control is a rectangle with `--ll-radius-md`).
- Unlayered CSS in `animations.css` beats Tailwind: keep looks in `ll:` classes; only the trace keyframes and `data-saving` rules go in `animations.css`.
- You are the **only** worker in this batch, so you may edit the shared files (`tokens.css`, `tailwind.css`, `animations.css`, `ComponentDemos.tsx`, `DesignSystemPage.tsx`).
- No new dependencies. Do not bulk-reformat files.

## Files you may touch

`src/editor/components/TopBar.tsx` (rewrite, keep it exported from `index.ts`), new components in `src/editor/components/` (`PageSwitcher.tsx`, `ShipPopover.tsx`, `ModeTabs.tsx`, `LogoMark.tsx` or similar, exported from `index.ts`), `src/editor/shell/EditorShell.tsx`, `src/editor/styles/{tokens,tailwind,animations}.css`, `src/editor/design-system/**`.
**Do not edit** `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx` or anything in `src/editor/motion/`: another session is finishing them and they have uncommitted changes. If you need a change there, list it in the handoff under "Not done / blocked".

## Design system page

Add a "Top bar" section: the full bar in each of the five themes' current theme (the theme switch on the page already changes it), the logo in idle and saving states (a button to toggle saving), the mode tabs, the Ship button with 2 issues and with Ready, the page switcher, and the avatar stack.

## Done

- Run `npx tsc --noEmit` once at the end and paste the output in the handoff. Do not run lint, build or e2e.
- Screenshots at 1440 (Playwright headless; see `.claude/skills/run-editor`) in `DOCS/UI/handoffs/screenshots/shell-top-bar/`: the editor with the top bar, the logo menu open with a submenu, the Ship popover open, the saving state, and Noir.
- Write the handoff from `DOCS/UI/handoffs/TEMPLATE.md` (`YYYY-MM-DD-HHMM-shell-top-bar.md`). **Do not commit.**

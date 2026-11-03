# Task: rebuild the top bar (`shell`, Phase 1, queue item 1)

- **Given by:** Claude (build session), 2026-11-03. **Area:** `shell`: top bar.
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
- You are the **only worker allowed to edit the shared files** (`tokens.css`, `tailwind.css`, `animations.css`, `ComponentDemos.tsx`, `DesignSystemPage.tsx`, `EditorShell.tsx`, `components/index.ts`) in this batch.
- No new dependencies. Do not bulk-reformat files.

## Files you may touch

`src/editor/components/TopBar.tsx` (rewrite, keep it exported from `index.ts`), new components in `src/editor/components/` (`PageSwitcher.tsx`, `ShipPopover.tsx`, `ModeTabs.tsx`, `LogoMark.tsx` or similar, exported from `index.ts`), `src/editor/shell/EditorShell.tsx`, `src/editor/styles/{tokens,tailwind,animations}.css`, `src/editor/design-system/**`.
**Do not edit** `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx` or anything in `src/editor/motion/`: another session is finishing them and they have uncommitted changes. If you need a change there, list it in the handoff under "Not done / blocked".

## Shell grid and slots (also yours)

Rebuild `EditorShell.tsx` as the app grid from the prototype's `.app` (rows: top bar, then body; columns: left panel `--ll-size-panel-left-w`, center 1fr, right panel `--ll-size-panel-right-w`; grep `.app{`, `.app.lc` and `.app.rc` for the collapsed states). Provide three slots (`left`, `center`, `right`) that default to empty placeholders of the right size. Three other workers are building `LeftPanel` (`src/editor/shell/left-panel/`), `CanvasChrome` (`src/editor/shell/canvas-chrome/`) and `RightPanelFrame` (`src/editor/shell/right-panel/`) in parallel. **Do not import them.** The build session mounts them into your slots after the batch. Keep the panel collapse state (`lc`, `rc`) as shell state with a `togglePanel(name, open)` function that the logo menu's Window items call.

## Design system page

Add a "Top bar" section: the full bar in each of the five themes' current theme (the theme switch on the page already changes it), the logo in idle and saving states (a button to toggle saving), the mode tabs, the Ship button with 2 issues and with Ready, the page switcher, and the avatar stack.

## Done

- Run `npx tsc --noEmit` once at the end and paste the output in the handoff. Do not run lint, build or e2e.
- Screenshots at 1440 (Playwright headless; see `.claude/skills/run-editor`) in `DOCS/UI/handoffs/screenshots/shell-top-bar/`: the editor with the top bar, the logo menu open with a submenu, the Ship popover open, the saving state, and Noir.
- Write the handoff from `DOCS/UI/handoffs/TEMPLATE.md` (`YYYY-MM-DD-HHMM-shell-top-bar.md`). **Do not commit.**

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

Layout, the logo menu, the trace and the theme store reuse are right. Fix these. Same file list as before. `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx` and `src/editor/motion/*` stay read-only.

1. **Chevron CSS bug** (`animations.css`, the `.ll-pagebtn svg` / `.ll-chevron-flip` rules, ~470-490). `:hover .ll-chevron-flip` and `[aria-expanded="true"] .ll-chevron-flip` are unscoped, so every chevron on the page is nudged and the Ship chevron sits low. Scope to the trigger: `button:hover > .ll-chevron-flip`, `button[aria-expanded="true"] > .ll-chevron-flip`. Target `.ll-chevron-flip` only, never every `svg`. Delete the unscoped variants.
2. `TopBar.tsx:181` `ll:grid-cols-[1fr_auto_1fr]` is an arbitrary value. Use a token or utility in `tailwind.css`, or an `ll-` CSS class.
3. **No fake data in the real editor.** `ShipPopover.tsx:28-31,52-54,62`: the default `issues` is `[]` (the Ship button reads "Ready"); drop the internal issues state; sample issues live in the demo and lab only. The shell passes an empty list.
4. **No `setState` in an effect:** `ShipPopover.tsx:56-60` (goes away with 3).
5. **No raw `requestAnimationFrame`:** `PageSwitcher.tsx:129`. Use a ref callback or `autoFocus`.
6. **No literals in TS:** `ShipPopover.tsx:101-102,115,121` (280, 12, 6, 120); `PageSwitcher.tsx:110-111,123,134` (220, 12, 4, 120/280); `TopBar.tsx:199` (use `--ll-size-logo-icon`), `:226,579` (use `--ll-size-menu-w`). Read the values from tokens, or put them in one named constants file. Move the trace's 1.6 s, 2.8 s and `cubic-bezier(.65,0,.35,1)` into `--ll-dur-*` and `--ll-ease-*` tokens.
7. **Prefix globals with `ll-`**, ids from `useId()`: `TopBar.tsx` ids `menubtn`, `themebtn`, `avs` (`:190,530,551`) and the classes `top tl logo sr tdiv pinfo pname tr themebtn avs av urow`; `ShipPopover.tsx:206,246` `ship ready srow mini btn strong wfull pubrow shipc`; `ModeTabs.tsx:66,83` `modes mode`; `PageSwitcher.tsx:236` `menu dd dd-o dd-s dd-sep ddl dd-none pagebtn`; `EditorShell.tsx:70-71` `id="main"` and `app editor-root lc rc left right zone canvas bottom` (keep `editor-root`, it is the reset scope). Delete unused ones. The legacy stylesheets are still loaded, so unprefixed names collide.
8. `EditorShell.tsx:32`: `saving` state that is never set. Either subscribe to a real project-store signal, or take `saving` as a shell prop. Say which in the handoff. Remove the unused setter.
9. **ARIA:** `ShipPopover.tsx:202,235` the trigger says `aria-haspopup="menu"` but the popup is a `dialog`. Use `aria-haspopup="dialog"`, and move focus to the first control when it opens. `ModeTabs.tsx:79` remove `aria-pressed` from `role="tab"` (use `aria-selected` only). `:62` `<nav role="tablist">` overrides the landmark: use a `div`.
10. **Avatar stack as a component.** `AvatarStack.tsx` in `src/editor/components/` (export from `index.ts`), used by the top bar and the demo. `COLLAB_USERS` (`TopBar.tsx:93-99`) is fake people: make `users` a prop that defaults to empty, with the sample data in the demo only.
11. **Dead code:** `DesignSystemPage.tsx:8,454` (`TopBar`, `DeviceMode`, `topBarDevice`) and `TopBar.tsx:59,67-68` (`DeviceMode`, `deviceMode`, `onSelectDeviceMode`, `compact`) if no caller needs them.
12. `ShellTopBarLab.tsx:30-32` `ll:w-[1440px]` and `ll:h-[900px]` are arbitrary: use tokens (`--ll-size-viewport-desktop`) or an `ll-` class. Put `ll:font-sans` on the lab root (it renders serif now).
13. **Screenshots:** retake 04 (saving, must show a clear trace frame) and 05 (Noir) **from the real editor** at `/editor`, not the lab frame, and add the Ship popover open in the Ready state. Check that the 1 px divider between the logo and the project name is visible in Noir.
14. **PageSwitcher:** Up, Down and Enter keys in the list. Add the disabled, focus and hover states for Ship, the mode tabs and the page switcher to the demo, and Ship in each theme.
15. Handoff "Retry 1" section: the real `npx tsc --noEmit` output; list the menu items that do nothing yet; record that the Desktop/Tablet/Mobile segmented control was dropped "per the task, set by Claude".

## Retry 2 (2026-11-03)

Retry 1 landed 12 of 15 fixes. Remaining:

1. **Handoff:** the handoff for this task (`DOCS/UI/handoffs/2026-11-03-2035-shell-top-bar.md`) has no "Retry 1" section. Add "Retry 1" and "Retry 2" sections: the tsc output, `saving` is a shell **prop** (no store signal exists), the list of logo-menu items that do nothing yet, and "the Desktop/Tablet/Mobile segmented control was dropped per the task, set by Claude".
2. **Noir divider:** the 1 px divider between the logo and the project name is nearly invisible in Noir. Check which token it uses and switch to the border token that is visible in all five themes (contrast against the panel background). Do the same check for the other 1 px lines in the top bar.
3. **ARIA:** `ShipPopover.tsx:265,276` has `role="menuitem"` buttons inside a `role="dialog"`. Remove the `menuitem` roles (plain buttons inside the dialog).
4. **Literals:** `ll:w-72` (`ShipPopover.tsx:232`) and `ll:w-56` (`PageSwitcher.tsx:268`) duplicate `SHIP_POPOVER_WIDTH` and `PAGE_DROPDOWN_WIDTH`: use one source (a token), delete the duplicate. Icon `size={14}` and `{16}` (`TopBar.tsx:210,528`) use the icon size constants. `EditorShell.tsx:63,65,66,78,79` (`"0px"`, `100vh`, `100vw`): use tokens or classes.
5. **Demo states:** add hover and focus samples for Ship, the mode tabs and the page switcher (force them with a `data-state` attribute or a class in the demo, not by hovering).
6. **Screenshots:** retake 04 (saving) with the pointer away from the Ship button, so no hover shows and the chevron sits level, and 05 (Noir) without the tooltip sliver at the top and without the theme button hover fill. Move the pointer to a neutral spot before each shot.

This is the last retry: after it, the build session fixes what is left itself. Do not touch files outside your list. `npx tsc --noEmit` once at the end, add a "Retry 2" section to your handoff (the real tsc output, the new screenshots, anything you could not fix), do not commit.

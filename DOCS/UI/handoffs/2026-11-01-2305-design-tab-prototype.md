# Handoff: Design tab prototype, next up micro-interactions

- **Date / time:** 2026-11-01 23:05 IST
- **Worker:** Claude, with cheap subagents writing the prototype code
- **Branch:** ui/redesign
- **Page / phase:** Design tab HTML prototype. Nothing here is built in `src/editor`
- **Task given by:** the user, directly in the session

## Start here next session

The user wants to work on **micro-interactions and animations** in the prototype: `DOCS/UI/design/editor-design-mode-blocks-dark.html`.

Read `DOCS/UI/UI_RULES.md` §7 first: animate only `transform` and `opacity`, respect `prefers-reduced-motion`, 60fps, no layout shift. Workflow is in the memory note on fast prototypes: cheap subagents write the code, no heavy checks.

**Motion already in the prototype, and it is very little:**
- `...` block opening: `dmore-in`, 120ms fade and 4px slide
- Theme change: 150ms opacity dip on the app
- AI loader: `ll-breathe` and `ll-fade`
- A few transform and opacity transitions, such as chevrons

**Places with no motion yet, as a starting list (Claude's, not agreed with the user):**
- Menus, submenus, the command palette, Insert and the settings popover opening and closing
- Mode switch and any segmented control: moving the active marker
- Layer rows: hover, selection, expand, drag and drop indicator, nesting
- Canvas: selection box and handles appearing, tool change, zoom, panel hide and show
- Fill, Stroke and Effects rows: add, remove and reorder
- Ship: issue fixed, the change to ready, publish
- Saved status, AI prompt box and its working and done states
- Number scrubbing feedback, toggles, checkboxes, the alignment grid

**Open before coding motion:** GSAP's license is unresolved (below). `motion` is the library for interface motion under `UI_RULES.md`. The user rejected a custom Lazy Motion engine for the UI.

## What changed
- `DOCS/UI/design/editor-design-mode-blocks-dark.html`:
  - Four candidate dark themes (Graphite, Darkroom, Plum, Noir)
  - Top bar toggle between Paper and Noir, theme lists grouped as Light and Dark
  - Right panel at 320px, with the original's options added: per-section `...` blocks laid out as a property sheet, Layout with Free, Stack and Grid, one-line rows for Fill, Stroke, Effects, Animation, Data and Logic with a settings popover and drag reorder, icons instead of text where clear
  - Sample "Other elements" layers: Input, Toggle, Divider, Background, Icon, Shape, Counter, 3D
  - Saved status, Undo and Redo buttons, shape shortcuts, Blank page empty state, command palette (Ctrl+K)
  - Layer rename, range selection, drag to reorder or nest, motion badge, page actions, asset upload and search
  - Theme & Tokens when nothing is selected, more Insert items, fuller right-click and logo menus, Window tools opening in a bottom panel
- `DOCS/UI/DECISIONS.md`, `DOCS/UI/PARITY.md`, `DOCS/UI/PALETTE.md`: status and decisions recorded.

## Decisions made
All logged in `DECISIONS.md`. By the user: right panel stays Figma style with no extra features, one-line rows with a popover, icons where clear, no status bar, Paper and Noir toggle, wider panel allowed. By Claude, pending review: `...` block arrangement, 320px width, Lilac for Noir's Ship button.

## Components from other sites
- Icon paths in the prototype come from the installed `lucide-react`, plus 9 custom plain-line icons. No other sources.

## Legacy behaviour dropped
- Status bar. FPS, memory, git branch and AST version go, because the original's values were fixed text. Simple and Pro switch, section rail, filter properties and per-property reset (logged, user can overrule).

## Tokens / palette touched
- Prototype only. `PALETTE.md` has a note that the candidates are not official. `src/editor/styles/tokens.css` still has the earlier colors.
- Noir is sampled from the user's motion.dev screenshots, with Lilac `#CEB4F5` on Ship.

## Integration notes added
- none

## Not done / blocked
**Waiting on the user:**
- The build plan is not approved. Proposed: build on `ui/redesign` with a draft PR to `main`, merging only when the Design tab works and all four checks pass. No PR exists. Do not merge the branch as it stands: the app has only the top bar and blanked panels, so it would replace the working editor on `main`
- Which themes stay. Claude suggested Paper, Noir, White, Warm and Lilac
- Logo choice, and the SVG's source and license
- GSAP license: ask Webflow or a lawyer, or replace it

**Found missing from the original, not added (the user has not said go):**
- Multiple frames side by side, custom frame size
- In-place text editing on the canvas, guides dragged from rulers, collaborator cursors
- Color picker: square, hue, opacity, HSB or OKLCH, eyedropper
- Font picker: Google Fonts, project and system fonts, upload
- Data binding sources: database fields, state variables, URL params, storage
- Settings screen: general, build and framework, environment variables
- Preview running state
- System messages: crash recovery, save error, read-only banner, file drop overlay, import problem notice

**Also open:**
- "Any Blank" under Canvas pan in View options is clipped
- Everything is a mock: fields do not change the canvas, and most new menu items only close the menu
- Motion and Code tabs have not had the same comparison against the original
- `tasks/2026-11-01-shell-step2-left-rail-panel.md` is out of date and must be rewritten from the prototype
- The 12 imported components' licenses are unverified, and Phase 1 checks have not run

## Phase checks
- typecheck: not run (docs and prototype only)
- lint: not run
- build: not run
- Playwright: prototype only, by subagents, and scripts were not kept. Overflow at both panel widths and console errors were clean on their last runs. The final Noir color edit was not re-rendered

## Screenshots
- Session scratchpad only, not in the repo. None kept.

## Deployment
- Live at https://lazy-layout-prototype.vercel.app, logos at `/logo`. The live page was checked against the local file by hash.
- Vercel project `lazy-layout-prototype` is deployed by hand. To deploy: copy the HTML to a temporary folder as `index.html`, with `logo-options.html` as `logo/index.html`, run `vercel link --project lazy-layout-prototype`, then `vercel deploy --prod`. The last folder used was a session scratchpad, so it may be gone.

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason): not a worker task. The user reviews the prototype directly.

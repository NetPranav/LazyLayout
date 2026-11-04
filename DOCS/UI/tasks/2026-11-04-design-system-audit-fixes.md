# Task: fix the design system audit findings

- **Given by:** Claude (design session), 2026-11-04, at the user's request.
- **Source:** three read-only audits of `src/editor` against the prototype `DOCS/UI/design/editor-design-mode-blocks-dark.html` (P), `PALETTE.md` and `UI_RULES.md`.
- **Current state:** `npm run build` and `tsc` pass. `eslint` has 1 error.
- **Rules:** `ll:` prefix with the variant after it, tokens only, no arbitrary values, no hex, no px literals, icons through `Icon`, no `setState` in effects.
- **Don't touch:** `src/core`, `src/legacy-editor` or config files. Don't bulk-reformat.
- **Done when:** `npx tsc --noEmit`, `npx eslint src/editor` and `npm run build` pass, and screenshots of `/design-system` and `/editor` at 1440 show nothing broken.

## A. Broken now (visible bugs)
1. `panels/details/controls/RowSettingsPopover.tsx:30`: there's a `setState` in an effect, which is the lint error. Use `useSyncExternalStore` or derive the value instead.
2. Invalid class order:
   - `components/Avatar.tsx:76`: `-ll:space-x-1.5` → `ll:-space-x-1.5`
   - `panels/timeline/TimelineTransport.tsx:119`: `-ll:ml-1` → `ll:-ml-1`
   - `panels/inspectors/KeyframeInspector.tsx:30`: `first:ll:` → `ll:first:`
   - `panels/inspectors/InspectorsLab.tsx:83`: `md:ll:` → `ll:md:`
   - `design-system/demos/ComponentDemos.tsx:802`: `font-bold` → `ll:font-bold`
3. `shell/canvas-chrome/ViewOptionsPopover.tsx:237`: `--ll-spacing-2-5` is undefined. Use an existing spacing token.
4. `src/app/design-system/stage/page.tsx:5`: it has its own `labsEnabled`. Import the shared gate from `@/app/editor/labsEnabled` instead, so the route is 404 in production.

## B. Out of sync with the prototype
5. **Trace loader:** copy P:74-78 exactly. Keyframes `ll-tro` `{0%{dashoffset:100}55%,100%{dashoffset:0}}` and `ll-trf` `{0%,55%{opacity:0}85%,100%{opacity:1}}`, with `infinite alternate`.
   - The logo uses 1.6s. The AI loader uses `--ll-dur-trace-ai` (2.4s, defined but unused today) in `shell/canvas-chrome/ai-loader.css:19,25`.
   - `ll-fade` follows P:370 (opacity 1 → .4 → 1).
   - Replace the local `--ll-aiload-stroke` with `--ll-stroke-loader`.
6. **Bottom panel heights:** `--ll-size-bottom-motion-h` and `-code-h` (`tokens.css:66-67`) become `clamp(180px, 40vh, 70vh)`, as in P:46-47.
7. **Label colours:** add the six label colours from `PALETTE.md` (Label colours section) to `tokens.css` as `--ll-label-1..6` and `--ll-label-1..6-tint`, in the light set (Paper, White, Warm, Lilac) and the dark set (Dark). Map them in `tailwind.css`.
8. **Noir is not official:**
   - Remove `[data-theme="noir"]` from `tokens.css:206`.
   - The TopBar theme button (`TopBar.tsx:535-541`) must say "Switch to Dark" / "Switch to Paper", or open the five-theme picker.
   - `ComponentDemos.tsx:1672`: the label is "Dark".
   - The storage key stays as it is in the app, but on load map any stored `noir` value to `dark`.
9. **Avatars:** hide the AvatarStack everywhere for now, by the user's decision (`TopBar.tsx:557`, `CanvasChrome.tsx:571`). Keep the component.
10. **TopBar:**
    - Remove the visible save dot after the project name (`TopBar.tsx:317-345`), because the logo trace shows saving.
    - `pinfo` gap is 16px (P:80).
11. **ModeTabs (`components/ModeTabs.tsx`):**
    - a sliding highlight on a spring (P:889 `.mhl`)
    - unselected hover shows the `--bar` background (P:870)
    - the active tab shows a ▾ and clicking it again opens the mode menu (P:890-891, `aria-haspopup`). The menu items are in P (grep `mcv` / mode menu).
12. **SegmentedControl:**
    - The `md` size matches the mode switch: 32px high with 2px padding (P:87). Selected text is weight 500, and unselected text is muted.
    - The `sm` size (inspector) uses 11px text (P:327-330, 729).
    - Remove the duplicated spring-marker code in `Tabs.tsx:39` by sharing one helper.
13. **IconButton:** hover is the `--seg` token (P:32), not surface-hover.
14. **Inspector fields** (Effects, Fill, Stroke, Page, Data and Animation sections, plus Select, NumberField and ColorSwatchField):
    - 28px boxes with padding 8 and gap 8 (P:714).
    - Values are 11px mono at weight 400 with no tracking (P:717). Don't use `text-micro` here.
    - Focus border is the `--text` colour (P:716).
    - Prefixes (X, W, …) go inside the field as 11px mono 500 muted with no uppercase (P:719). Remove the uppercase mono labels above Select, NumberField and TextField.
    - Select is one 28px box, not a nested frame (`Select.tsx:816,830`).
    - ColorSwatchField: 28px, the swatch has a border only and no shadow, and the value is not uppercase.
15. **Right panel:**
    - Section title is 13px/500 (P:695, `RightPanelSection.tsx:49`).
    - Sub-labels are 12px sans muted (P:410), not 10px mono uppercase (LayoutSection 472, 517; PositionSection 141; AppearanceSection 98; StatesSection 49).
    - Add a `.micro` equivalent utility (11px mono 500 uppercase .08em muted) and use it only where the prototype uses `.micro`.
16. **Menu:**
    - Icons are 16px and muted (P:130).
    - Item text is `--text2` at rest and `--text` on hover or open (P:123-124).
    - kbd has no tracking.
    - Disabled is opacity .45.
17. **TreeRow:** hover is the `--canvas` token (P:232), and the label is 13px.
18. **Button:**
    - Text is 13px.
    - The default is transparent with a border (P:36).
    - Add a `strong` variant (panel background, `--text` border, P:38).
    - Disabled: canvas background, muted text and border (P:39).
19. **CommandPalette:**
    - 520px wide, input 14px, rows 32px.
    - Selected row is `--sel`.
    - kbd is plain 11px mono muted, with no box.
20. **TextField / NumberField:** 28px (`NumberField.tsx:177`), and TextField matches `.field` (P:860).
21. **Tabs line variant:** unselected tabs are weight 500 and muted (P:969).

## C. Rule cleanup
22. **Class names:** prefix the global classes with `ll-`: `av` and `avs` (Avatar), `saving-on`, `tro` and `tfl` (`animations.css:407-415`; use the `ll-` names the logo already has), and `editor-root` / `design-system-root` (`globals.css`). Update the code that writes them.
23. **Dead code:** delete the stale duplicate `AvatarStack` in `components/Avatar.tsx:62` (the live one is `AvatarStack.tsx`).
24. **Arbitrary values:** replace them with tokens or theme entries:
    - `RightPanelSection.tsx:45,67,71`
    - `RightPanelHeader.tsx:80,84`
    - `TimelineCurveGraph.tsx:42`
    - `SaveErrorBanner.tsx:45` and `RecoveryPrompt.tsx:32`
    - `LayoutSection.tsx:190,271,355` (add grid-template tokens to `@theme`)
25. **Hex colours:**
    - `LiveCodeInspector.tsx:97-100`: syntax uses only `--text`, `--text2` and `--muted`, plus weight and italic.
    - Demo data (`DetailsLabView.tsx:95-125`, `ComponentDemos.tsx:1186`, `PanelDemos.tsx:31`): read the token values instead, or label them as sample data with a `// sample value` constant block.
26. **px literals:** replace them with tokens:
    - `KeyframeInspector.tsx:181`, `TimelineLab.tsx:179`, `TransformOverlay.tsx:158`, `TimelinePlayhead.tsx:68`
    - `FilesTree.tsx:111` and `LayersTree.tsx:178` (use a tree-indent token)
    - `LayersLab.tsx:191,321`, `CodeViewLabView.tsx:218,231`, `ViewOptionsPopover.tsx:235`, `AssetsSection.tsx:172`, `StrokeSection.tsx:45`
27. **Icons:** about 60 files import `lucide-react` directly. Route them through `Icon`. Passing the lucide component as a prop to `Icon` is fine, as long as `Icon` sets the size and the 1.5 stroke. Type-only imports are fine.
28. **Pills:** `MotionDemo.tsx:120,448`: replace `ll:rounded-full` dots with `--ll-radius-xs` squares.
29. **Tokens:**
    - Remove the duplicates (`tokens.css:70-72` repeat 102-107).
    - Remove the unused tokens: `--ll-size-tall-btn-h`, `--ll-text-heading-weight`, `--ll-text-lead-weight` and `--ll-text-nano-weight`. Use `--ll-stroke-loader` and `--ll-dur-trace-ai` (item 5) instead of deleting them.
30. **Design system page:** add `MenuHeading` and `ThemeSwatch` to it.
31. **PALETTE.md:5:** remove the stale note that `tokens.css` "still holds the earlier colours".

## Report
Add a short "## Report" here: what was fixed, what was skipped and why, and the output of the three checks.

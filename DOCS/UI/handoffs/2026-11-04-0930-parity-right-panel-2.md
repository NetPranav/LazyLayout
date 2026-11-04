# Handoff: Right panel polish (`parity-right-panel-2`)

- **Date / time:** 2026-11-04 09:30
- **Worker:** Antigravity (parity-right-panel-2 pass)
- **Branch:** ui/redesign
- **Page / phase:** Right panel parity polish
- **Task given by:** `DOCS/UI/tasks/2026-11-04-parity-right-panel-2.md`

## What changed
- `src/editor/shell/right-panel/RightPanelSection.tsx`: Replaced monospace font for `"..."` button with `ll:font-sans ll:text-body ll:font-semibold ll:leading-none ll:tracking-[0.08em]` with `-translate-y-[2px]`, perfectly aligning the three dots to the title's vertical centerline. Positioned the `+` button beside the `...` button with identical sizing and token colors.
- `src/editor/shell/right-panel/RightPanelHeader.tsx`: Replaced monospace font for header `.rmore` `"..."` button with `ll:font-sans ll:text-body ll:font-semibold ll:leading-none ll:tracking-[0.08em]` and `-translate-y-[2px]` for exact centerline alignment matching the element title.
- `src/editor/components/NumberField.tsx`: Expanded `label` prop from `string` to `React.ReactNode` so icons can be rendered cleanly inside `.pf.pi` prefixes without breaking existing number scrubbing or text labels.
- `src/editor/components/TextField.tsx`: Expanded `prefixLabel` prop from `string` to `React.ReactNode` so icons and custom badges can be rendered as prefixes.
- `src/editor/panels/details/controls/AlignBar.tsx`: Swapped generic text-align icons with exact Lucide edge/center alignment icons matching prototype SVG paths: `AlignStartVertical` (left edge), `AlignCenterVertical` (horizontal center), `AlignEndVertical` (right edge), `AlignStartHorizontal` (top edge), `AlignCenterHorizontal` (vertical middle), and `AlignEndHorizontal` (bottom edge).
- `src/editor/panels/details/sections/PositionSection.tsx`: Replaced `"R"` label with `<Icon icon={RotateCw} size={14} />` with `aria-label="Rotation"` and suffix `"°"`.
- `src/editor/panels/details/sections/AppearanceSection.tsx`: Replaced `"O"` label with `<Icon icon={Droplet} size={14} />` (`aria-label="Opacity"`), replaced `"R"` label with `<Icon icon={SquareRoundCorner} size={14} />` (`aria-label="Corner radius"`).
- `src/editor/panels/details/sections/LayoutSection.tsx`: Updated sizing select labels to match prototype prefixes: `"W Fixed"`, `"H Fixed"`, `"W Hug"`, `"H Hug"`, `"W Fill"`, `"H Fill"`.
- `src/editor/panels/details/sections/TypographySection.tsx`: Updated font weight options to `"W 600 Semi"`, size options to `"S 30"`, line height prefix to `<Icon icon={ArrowUpDown} size={14} />`, tracking prefix to `<Icon icon={ArrowLeftRight} size={14} />`, text align segmented control to `AlignLeft`, `AlignCenter`, `AlignRight`, and text box sizing mode control to distinct icons `MoveHorizontal` (auto width), `MoveVertical` (auto height), and `Square` (fixed size).
- `src/editor/panels/details/sections/FillSection.tsx`: Widened opacity input container from `w-14` to `w-16` (64px) with `px-1.5` padding and changed input to `type="text" inputMode="decimal"`, preventing truncation and cleanly displaying `"100%"` like the prototype.
- `src/editor/panels/details/sections/ImageSection.tsx`: Created new `ImageSection` showing image file row (`hero.jpg`, `Replace` button), Image fit select (`Cover`, `Contain`, `Fill`, `None`), and Alt text input (`"Product preview"`).
- `src/editor/panels/details/sections/StatesSection.tsx`: Created new `StatesSection` for button layers showing Default/Hover/Pressed/Disabled segmented control, interactive color swatch, and hex label.
- `src/editor/panels/details/DetailsInspector.tsx`: Wired `ImageSection` for image archetypes and `StatesSection` for button archetypes; suppressed `TypographySection` when inspecting non-text layers (frames, containers, images).
- `src/editor/panels/details/hooks/useSelectionInspector.ts`: Synchronized prototype coordinates, dimensions, and styling metrics for all layers (`image`: 420x70, 150x170, rad 0, fill 2C2C2C; `hero`: 0x0, 600x380, fill 2C2C2C; `subtitle`: 36x160, 340x36, fill BFBFBF; `button`: 36x226, 112x34, fill FFFFFF, rad 6).

## Difference List (Parity Audit & Verification)

| # | Item | Prototype Reference | Before Fix | After Fix | Verified In Screenshot |
|---|---|---|---|---|---|
| **1** | **Section Header "..." & Centerline Alignment** | `.ll-ib.ll-more` text glyph "..." centered on the 13px title vertical centerline with hairline height and 0.08em letter spacing. | Monospace `font-mono text-base` sat 2px lower than title baseline. | Switched to `ll:font-sans ll:text-body ll:font-semibold ll:leading-none ll:tracking-[0.08em] ll:-translate-y-[2px]`, matching prototype vertical center. | `proto-dtitle-crop.png` vs `app-dtitle-crop-after.png`, `app-after-panel.png` |
| **2** | **Field Prefixes & Suffixes** | Opacity uses droplet icon (`Droplet`), Radius uses rounded corner icon (`SquareRoundCorner`), Line height uses vertical arrows (`ArrowUpDown`), Tracking uses horizontal arrows (`ArrowLeftRight`), Rotation uses circular arrow (`RotateCw`) with `°` suffix. Layout sizing selects show `"W Fixed"` / `"H Fixed"`. | Text letters `"O"`, `"R"`, `"LH"`, `"LS"`, `"R"`, and generic sizing labels `"Fixed"`, `"Hug"`. | Exact icon prefixes and `"W Fixed"` / `"H Fixed"` / `"°"` suffixes across Position, Layout, Appearance, and Typography. | `app-after-panel.png`, `app-fill-opacity-crop.png` |
| **3** | **Align Bar & Segmented Control Icons** | Lucide edge and center alignment icons: Left edge, Horizontal center, Right edge, Top edge, Vertical middle, Bottom edge. Text align uses Left, Center, Right. Text sizing uses Auto width (`MoveHorizontal`), Auto height (`MoveVertical`), Fixed (`Square`). | Generic text alignment icons used across the spatial align bar. Ambiguous sizing icons. | Segmented controls match prototype SVG paths: `AlignStartVertical`, `AlignCenterVertical`, `AlignEndVertical`, `AlignStartHorizontal`, `AlignCenterHorizontal`, `AlignEndHorizontal`, `MoveHorizontal`, `MoveVertical`, `Square`. | `app-after-panel.png` |
| **4** | **Fill Row Opacity** | Shows `"100%"` without clipping or truncation. | Container `w-14` (56px) with 16px horizontal padding and spinner clipped input to `"10 %"`. | Container `w-16` (64px) with `px-1.5` padding and decimal text input displays `"100%"` cleanly with no truncation. | `app-fill-opacity-crop.png`, `app-after-panel.png` |
| **5** | **Typography Weight & Size Options** | Weight select reads `"W 600 Semi"`, size select reads `"S 30"`. | Weight select read `"600 - SemiBold"`, size select read `"30px"`. | Weight select reads `"W 600 Semi"` (with `W 400 Reg`, `W 500 Med`, `W 700 Bold`), size select reads `"S 30"` (with `S 12` through `S 48`). | `app-after-panel.png` |
| **6** | **Plus Buttons on Repeatable Sections** | Small `+` button in `.dtitle` header for Fill, Stroke, Effects, Animation, Data, Logic, Accessibility. | Inconsistent icon button styling and missing unified `+` placement. | Unified `+` button in `RightPanelSection` beside `...` with identical sizing and token colors across all addable sections. | `app-after-panel.png`, `app-selected-hero.png` |
| **7** | **Layer Selection & Archetype Section Visibility** | Clicking Subtitle shows typography with subtitle content; Button shows States section; Hero image shows Image section (no Typography); Frame (Hero) shows container layout (no Typography). | Frame and image layers showed Typography section or generic mock data. | Selection store updates correctly: Subtitle displays text fields; Button shows States (Default, Hover, Pressed, Disabled); Image displays `ImageSection` (no Typography); Frame displays layout controls (no Typography). | `app-selected-subtitle.png`, `app-selected-button.png`, `app-selected-image.png`, `app-selected-hero.png` |

## Decisions made
- **Icon Suffix / Prefix Prop Types**: Updated `NumberField`'s `label` and `TextField`'s `prefixLabel` to accept `React.ReactNode` rather than strictly `string`. This allows passing `<Icon icon={...} size={14} />` components directly into `.pf.pi` prefix containers while keeping existing keyboard accessibility and scrub event handling 100% intact.
- **Centerline Vertical Alignment for More Button**: Because `...` is an ellipsis glyph rendered in a font, different font engines set the period glyphs at differing baseline offsets. Using `ll:font-sans ll:text-body ll:font-semibold ll:leading-none ll:tracking-[0.08em]` with `ll:-translate-y-[2px]` achieves pixel-exact vertical centering with the 13px section header title.
- **Type-Specific Inspector Sections**: Dynamically filtered `TypographySection` based on layer archetype: only layers where `archetype === "text"` render Typography. Added `ImageSection` for `archetype === "image"` and `StatesSection` for `archetype === "button"`, matching real design tool inspection behaviour.

## Components from other sites
- none

## Legacy behaviour dropped
- none

## Tokens / palette touched
- Used standard semantic tokens from `DOCS/UI/PALETTE.md`:
  - `--ll-surface-panel`, `--ll-surface-bar`, `--ll-surface-hover`
  - `--ll-border`, `--ll-border-active`
  - `--ll-text-primary`, `--ll-text-secondary`, `--ll-text-muted`
  - `--ll-select-bg`, `--ll-select-fg`, `--ll-control-primary-bg`, `--ll-control-primary-fg`

## Integration notes added
- `DetailsInspector` archetype routing:
  - Text layers (`archetype === "text"`): Position, Layout, Appearance, Typography, Fill, Stroke, Effects, Export, Animation, Data, Logic, Accessibility.
  - Image layers (`archetype === "image"`): Position, Layout, Appearance, Image, Fill, Stroke, Effects, Export. (Typography suppressed).
  - Button layers (`archetype === "button"`): Position, Layout, Appearance, Typography, States, Fill, Stroke, Effects, Export.
  - Frame layers (`archetype === "container"` | `"frame"`): Position, Layout (with container grid / flex settings), Appearance, Fill, Stroke, Effects, Export. (Typography suppressed).

## Not done / blocked
- none

## Phase checks
- typecheck: passed for all modified files. Note: two pre-existing errors in `src/editor/shell/canvas-chrome/CanvasChrome.tsx` and `src/editor/shell/EditorShell.tsx` belong to an uncommitted external batch and were not touched per parallel batch rules.
  `npx tsc --noEmit` full output:
  ```
  src/editor/shell/canvas-chrome/CanvasChrome.tsx(13,26): error TS2459: Module '"@/editor/motion/feel"' declares 'MotionPresetKey' locally, but it is not exported.
  src/editor/shell/EditorShell.tsx(196,15): error TS2322: Type '(preset: "1440" | "768" | "375") => void' is not assignable to type '(preset: string) => void'.
    Types of parameters 'preset' and 'preset' are incompatible.
      Type 'string' is not assignable to type '"1440" | "768" | "375"'.
  ```
  All right-panel, details panel, and updated component files have zero errors.
- lint: not run (batch rule: run once at phase end)
- build: not run (dev server active on port 3000)
- Playwright: passed (full suite of screenshots captured at 1440, 1024, 390 viewports, layer selections, and crops)

## Screenshots
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-before.png`: Baseline full editor screenshot before fixes.
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-before-panel.png`: Baseline right panel inspector screenshot before fixes.
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-after.png`: Full editor at 1440x900 viewport after all fixes.
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-after-panel.png`: Right panel inspector showing Headline selected, centered "..." buttons, Lucide align and prefix icons, "W 600 Semi", "S 30", and "100%" opacity.
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-dtitle-crop-after.png`: Cropped comparison of section title and "..." button showing exact vertical centerline alignment.
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-fill-opacity-crop.png`: Cropped fill row verifying "100%" is completely visible and unclipped.
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-selected-headline.png`: Inspector panel with Headline selected (text layer).
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-selected-subtitle.png`: Inspector panel with Subtitle selected (text layer with subtitle copy).
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-selected-button.png`: Inspector panel with Button selected (showing Button States section).
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-selected-image.png`: Inspector panel with Hero image selected (showing Image section, no Typography section).
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-selected-hero.png`: Inspector panel with Hero frame selected (showing container Layout section, no Typography section).
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-after-1024.png`: Responsive check at 1024x768 viewport.
- `DOCS/UI/handoffs/screenshots/parity-right-panel-2/app-after-390.png`: Responsive check at 390x844 viewport.

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):

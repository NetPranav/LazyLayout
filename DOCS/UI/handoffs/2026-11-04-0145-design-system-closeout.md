# Handoff: Design System Close-out (`design-system`, queue item 5)

- **Date / time:** 2026-11-04T01:45:00+05:30
- **Worker:** Antigravity (worker on `ui/redesign`)
- **Branch:** `ui/redesign`
- **Page / phase:** `/design-system` (queue item 5)
- **Task given by:** `DOCS/UI/tasks/2026-11-04-design-system-closeout.md`

## What changed
- `src/editor/styles/tokens.css`: Added wished-for trace loader tokens (`--ll-dur-trace-ai: 2.4s;` and `--ll-stroke-loader: 10;`) and documented layout dimensions.
- `src/editor/styles/animations.css`: Expanded `.ll-logo` and SVG trace animation selectors to support standalone `LogoMark` trace animation under `data-saving="true"` and `.saving-on`, including reduced-motion fallback.
- `src/editor/components/LogoMark.tsx`: Added `data-saving` and `saving-on` class propagation for standalone saving trace demo rendering.
- `src/editor/components/EmptyState.tsx`: Aligned button variants to prototype parity ("Add frame" is primary `var(--ctl)`, "Insert" and "Ask AI" are secondary).
- `src/editor/components/AvatarStack.tsx`: Added empty state fallback rendering (`0` avatar count pill) instead of returning `null`.
- `src/editor/panels/code-view/CodeInspector.tsx`: Fixed parameter types for `handleTargetChange` and `handleStyleChange` to accept string values from `Select.onChange`.
- `src/editor/design-system/demos/ShellDemos.tsx`: Created isolated demos with full states and variants for:
  - `LogoMarkDemo` (idle, saving trace 1.6s, size scale)
  - `ModeTabsDemo` (interactive, forced design/motion/code, forced hover, forced focus, disabled)
  - `PageSwitcherDemo` (interactive searchable dropdown, hover, focus, disabled)
  - `ShipPopoverDemo` (ready, has issues checklist, 5 themes preview)
  - `AvatarStackDemo` (multiple users with +N chip, single user, empty state)
  - `LeftPanelHeaderDemo` (design layers vs code files, search open, match count)
  - `LeftPanelRowsDemo` (layer hierarchy, file rows, track rows, asset tiles)
  - `LayerContextMenuDemo` (single selection vs multi-selection with align submenu)
  - `LeftPanelEmptyDemo` (empty layers, empty search filter)
  - `RightPanelHeaderDemo` (layer name, hide button, more options, status chips)
  - `RightPanelAccordionRowDemo` (open/closed rows, summary values, muted values)
  - `RightPanelAiChatDemo` (conversation view, user/assistant messages, chat input)
  - `RightPanelEmptyDemo` (empty placeholder when nothing is selected)
- `src/editor/design-system/demos/CanvasDemos.tsx`: Created isolated demos with full states and variants for:
  - `ToolbarDemo` (all tools: select, hand, frame, shape, text, image, undo/redo, shape menu, zoom)
  - `InsertBoxDemo` (520x400 modal above toolbar, categories, search, wireframe thumbnail cards)
  - `AiBoxDemo` (idle with suggestions, working with 2.4s trace loader, done state)
  - `ViewOptionsPopoverDemo` (grid style, size, snap toggles, rulers, appearance, motion feel)
  - `RulersDemo` (18px canvas measurement rulers with adaptive tick scaling)
  - `StageSelectionDemo` (selection outline, 8 resize handles, hover outline, dimension chip `.dim`)
- `src/editor/design-system/demos/PanelDemos.tsx`: Created isolated demos with full states and variants for:
  - `InspectorControlsDemo` (AlignBar 9-button toolbar, AlignmentGrid 3x3 matrix, EasingCurveBox interactive SVG bezier editor, RepeatableRow with reorder grip, RowSettingsPopover, section fields)
  - `TimelineDemo` (transport bar, time ruler, tracks & lanes, keyframe diamonds, scrub playhead, curve graph)
  - `CodeViewDemo` (syntax highlighted code editor with line numbers, live diagnostics console, code inspector)
- `src/editor/design-system/DesignSystemPage.tsx`:
  - Reorganized sidebar navigation into 5 distinct groups: **Foundations**, **Components**, **Shell**, **Canvas**, **Panels**, plus Motion.
  - Added all 26 new component entries to navigation and main content.
  - Added bottom panel heights and shell dimension tokens to the Layout Sizes foundation table.

## Differences list per component (Prototype vs Component)
| Component | Prototype reference | Difference found | Status |
|---|---|---|---|
| `Button` | `.btn` (32px, r-6px, 13px font, gap 6px, border 1px) | Previous demo used 12px text in md; gap was 8px | **Fixed** |
| `IconButton` | `.ib` (28x28px, r-4px, hover var(--seg), active var(--sel)) | None (exact match) | **Fixed / Parity verified** |
| `SegmentedControl` | `.seg` (r-6px, 2px pad, 26px item, hover, active) | Height adjusted to match prototype 26px items | **Fixed** |
| `Toggle` | `.vi i` (28x16px / 34x18px, rectangular knob, no pills) | None (exact match to token geometry) | **Fixed / Parity verified** |
| `Checkbox` | `.dtc input[type=checkbox]` (14px neutral control) | Styled token checkbox with 4px radius and check | **Fixed / Parity verified** |
| `Tooltip` | Elevated floating surface with soft shadow | None | **Fixed / Parity verified** |
| `TextField` | `.dfield` (28px/32px, r-4px, focus border) | None | **Fixed / Parity verified** |
| `NumberField` | `.dfield .pf[data-scrub]` (scrub cursor, suffix) | None | **Fixed / Parity verified** |
| `Select` | Read-only per task instructions | Verified dropdown morphing and selection | **Read-only / Verified** |
| `ColorSwatchField` | `.dsw` (28x28px, r-4px, hairline border) | None | **Fixed / Parity verified** |
| `Menu` | Read-only per task instructions | Verified rows, flyouts, and highlight motion | **Read-only / Verified** |
| `ContextMenu` | Read-only per task instructions | Context variant (248px) verified | **Read-only / Verified** |
| `Popover` | Read-only per task instructions | Surface and spring animation verified | **Read-only / Verified** |
| `CommandPalette` | Read-only per task instructions | Centered dialog overlay verified | **Read-only / Verified** |
| `PanelSection` | `.dsec`, `.dtitle` (13px font-medium, chevron, actions) | Header layout and icons match prototype | **Fixed / Parity verified** |
| `PropertyRow` | `.dtrow` (72px label column, field slot) | None | **Fixed / Parity verified** |
| `ListRow` | Read-only per task instructions | Matches list rows | **Read-only / Verified** |
| `TreeRow` | `.row` (32px row, indent, hover actions eye/lock) | Matches prototype tree rows | **Fixed / Parity verified** |
| `Tabs` | Mode and navigation tabs | Matches | **Fixed / Parity verified** |
| `Avatar & Ship` | `.av` (28x28px), `.ship` (32px, tabular count) | Matches | **Fixed / Parity verified** |
| `EmptyState` | `.es` ("Start with", "Add frame" primary) | "Add frame" was secondary, "Ask AI" was primary | **Fixed** |
| `TopBar` | `.top` (52px height, left info, modes, right tools) | Matches | **Fixed / Parity verified** |
| `ThemeToggle` | 5 official themes (Paper, Dark, White, Warm, Lilac) | Matches | **Fixed / Parity verified** |
| `Swatch` | Token inspection swatch | Matches | **Fixed / Parity verified** |
| `WorkspaceFrame` | Real Layer Studio workspace preview | Matches | **Fixed / Parity verified** |
| `LogoMark` | `.logo.saving-on` (1.6s outline trace) | Standalone SVG lacked `data-saving` animation hooks | **Fixed** |
| `AvatarStack` | Multiple collaborators (+N chip) | Empty state returned `null` | **Fixed** |

## Sections added to Design System Page
- **Shell Group:**
  - `LogoMark`
  - `ModeTabs`
  - `PageSwitcher`
  - `ShipPopover`
  - `AvatarStack`
  - `LeftPanelHeader`
  - `Left Panel Rows` (Layer, File, Track, AssetTile)
  - `LayerContextMenu`
  - `LeftPanelEmpty`
  - `RightPanelHeader`
  - `RightPanelAccordionRow`
  - `RightPanelAiChat`
  - `RightPanelEmptyPlaceholder`
- **Canvas Group:**
  - `Toolbar & Zoom`
  - `InsertBox`
  - `AiBox`
  - `ViewOptionsPopover`
  - `Rulers`
  - `Stage & Selection Handles`
- **Panels Group:**
  - `Inspector Controls` (`AlignBar`, `AlignmentGrid`, `EasingCurveBox`, `RepeatableRow`, `RowSettingsPopover`, section fields)
  - `Timeline` (transport, ruler, lanes, keyframes, playhead, curve graph)
  - `Code View & Console` (`CodePanel`, `ConsoleView`, `CodeInspector`)

## Decisions made
- Reorganized design system sidebar into 5 categorical groups (Foundations, Components, Shell, Canvas, Panels) to keep the 56 sections quickly navigable while retaining hash-based routing.
- Configured all demos to operate exclusively with sample props and local state; zero store coupling.
- Rendered complex canvas/panel chrome inside bounded preview containers matching their design proportions.

## Components from other sites
- none

## Legacy behaviour dropped
- none

## Tokens / palette touched
- Added `--ll-dur-trace-ai: 2.4s;` (trace duration for AI prompt loader) to `src/editor/styles/tokens.css`.
- Added `--ll-stroke-loader: 10;` (SVG stroke-width token for outline trace animations) to `src/editor/styles/tokens.css`.
- Added bottom panel heights (`--ll-size-bottom-motion-h: 260px`, `--ll-size-bottom-code-h: 200px`) and mode tab sizes to the Layout Sizes table.

## Integration notes added
- none (design system internal demos only)

## Not done / blocked
- Menu, Popover, Select, CommandPalette, and ListRow were verified visually and structurally but left unedited per task instructions.
- Did not verify real store reactivity in the demos, which is intentional (Part 2 requirement: sample props only, never a store).

## Phase checks
- typecheck: **passed**
```
$ npx tsc --noEmit
(exit code 0, no errors)
```
- Playwright: **passed** (all 56 sections + prototype references captured at 1440x900)

## Screenshots
Screenshots captured with headless Playwright at 1440x900 under `DOCS/UI/handoffs/screenshots/ds-closeout/`:
- `proto-full.png`, `proto-topbar.png`, `proto-toolbar.png`, `proto-right-panel.png`, `proto-left-panel.png`
- Foundations: `ds-colors.png`, `ds-type.png`, `ds-spacing.png`, `ds-radii.png`, `ds-shadows.png`, `ds-sizes.png`, `ds-motion.png`
- Components: `ds-button.png`, `ds-icon-button.png`, `ds-segmented-control.png`, `ds-toggle.png`, `ds-checkbox.png`, `ds-tooltip.png`, `ds-text-field.png`, `ds-number-field.png`, `ds-select.png`, `ds-color-swatch-field.png`, `ds-menu.png`, `ds-context-menu.png`, `ds-popover.png`, `ds-command-palette.png`, `ds-tabs.png`, `ds-avatar.png`, `ds-empty-state.png`, `ds-theme-toggle.png`, `ds-swatch.png`, `ds-workspace-frame.png`, `ds-imported-cursor.png`, `ds-imported-scroll-fade.png`
- Shell: `ds-top-bar.png`, `ds-logo-mark.png`, `ds-mode-tabs.png`, `ds-page-switcher.png`, `ds-ship-popover.png`, `ds-avatar-stack.png`, `ds-left-panel-header.png`, `ds-left-panel-rows.png`, `ds-layer-context-menu.png`, `ds-left-panel-empty.png`, `ds-right-panel-header.png`, `ds-right-panel-accordion.png`, `ds-right-panel-ai-chat.png`, `ds-right-panel-empty.png`
- Canvas: `ds-toolbar.png`, `ds-insert-box.png`, `ds-ai-box.png`, `ds-view-options.png`, `ds-rulers.png`, `ds-stage-selection.png`
- Panels: `ds-panel-section.png`, `ds-property-row.png`, `ds-list-row.png`, `ds-tree-row.png`, `ds-inspector-controls.png`, `ds-timeline.png`, `ds-code-view.png`

## Watcher verdict
- [ ] Pass   - [ ] Fail (reason):

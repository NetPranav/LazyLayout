# Integration Notes (for A and B)

A living file. The redesign changes the UI only. When it is done, Lane A (NetPranav) and Lane B (OVERxPOWERED) use this file to connect the new UI to the existing project properly.

**Workers: add an entry here during your work, whenever something below applies. Do not wait for the end of the session.** Keep entries short and factual. One entry per item. Newest at the bottom of each section.

## 1. How to add an entry

Use this shape:

```
### <short title>
- **Page / phase:**
- **Files:**
- **What changed:**
- **What A/B must do:**
- **Status:** open | done
```

## 2. Replaced or removed UI

Old components, panels or routes that the redesign replaced or deleted, and what took their place. A/B must update anything that imported them.

## 3. Engine contracts the new UI relies on

Stores, hooks, commands and events from `src/core` that the new UI calls. Record the exact name, what it is used for, and anything the UI assumes about it (shape, timing, side effects). If the UI needs a change in the engine that does not exist yet, list it under **Engine changes requested** below and tell Claude. Workers do not edit `src/core`.

## 4. Engine changes requested

Changes the UI needs from `src/core`, `src/compiler`, `src/runtime` or `src/ai`. Claude passes these to A or B.

## 5. New shared UI pieces

New components, hooks, tokens and motion utilities that other code can reuse, with file paths and how to use them.

## 6. Tokens and styles

Renamed, removed or added tokens in `src/editor/styles/tokens.css`. Old tokens that A/B code may still reference.

## 7. Routes and layout

Changed routes, shell structure, panel docking or layout behaviour that affects how features mount into the editor.

## 8. Tests

E2E selectors, test ids or flows that changed and need updating in `tests/e2e`.

## 9. Open items before merge

Anything unresolved that must be settled before the redesign can be connected to `main`.

---

## Entries

### 2. Replaced or removed UI

#### Redesigned StudioHeader with unified logo menu and contextual center
- **Page / phase:** Top bar (`StudioHeader`) / Phase 1
- **Files:** `src/editor/shell/StudioHeader.tsx`, `src/editor/menus/UnifiedLogoMenu.tsx`, `src/editor/shell/StudioCenterToolbar.tsx`, `src/editor/styles/top-bar.css`
- **What changed:**
  - Replaced traditional horizontal 5-menu strip (`File`, `Edit`, `View`, `Window`, `Help`) with a single unified logo menu button (`LazyLayoutLogo` + chevron) opening `UnifiedLogoMenu.tsx`.
  - Moved `Showcase Demo` toggle button (`#header-toggle-demo-btn`) out of outer header strip into top slot of `UnifiedLogoMenu.tsx`.
  - Replaced static center device switcher with adaptive contextual center toolbar (`StudioCenterToolbar.tsx`) showing Undo/Redo + Device Switcher when nothing is selected, and Align/Spacing/Tidy/Arrange actions when a layer is selected.
  - Added Command Palette search trigger button (`Ctrl+K`) and live collaborator avatar stack to right fixed cluster.
- **What A/B must do:**
  - If any outside code mounted individual menu triggers or expected demo button directly in header DOM outside the menu, point to the new unified logo menu.
- **Status:** done

### 3. Engine contracts the new UI relies on

#### Contextual selection and command bus contracts in StudioHeader
- **Page / phase:** Top bar (`StudioHeader`) / Phase 1
- **Files:** `src/editor/shell/StudioHeader.tsx`, `src/editor/shell/StudioCenterToolbar.tsx`, `src/editor/menus/UnifiedLogoMenu.tsx`
- **What changed:**
  - UI reads `useSelectionStore((s) => s.selectedIds)` to switch adaptive toolbar state dynamically between nothing-selected and layer-selected.
  - UI calls `invokeCommand` for alignment (`align.left`, `align.hcenter`, `align.right`, `align.top`, `align.vcenter`, `align.bottom`), distribution (`distribute.horizontal`, `distribute.vertical`), tidy (`layer.tidy`), arrange (`layer.bringForward`, `layer.sendBackward`), grouping (`edit.group`), history (`edit.undo`, `edit.redo`), search (`view.commandPalette`), and menu actions from `MENU_MODEL`.
  - UI calls `useProjectStore((s) => s.mountDemoProject)` and `clearToBlankCanvas()` from `#header-toggle-demo-btn`.
- **What A/B must do:**
  - Ensure `selection.set` / `selection.none` updates `useSelectionStore` reactively (verified working).
- **Status:** done

### 5. New shared UI pieces

#### StudioCenterToolbar and UnifiedLogoMenu components
- **Page / phase:** Top bar (`StudioHeader`) / Phase 1
- **Files:**
  - `src/editor/shell/StudioCenterToolbar.tsx`
  - `src/editor/menus/UnifiedLogoMenu.tsx`
  - `src/editor/styles/top-bar.css`
- **What changed:**
  - `StudioCenterToolbar`: Reusable adaptive contextual toolbar supporting history, device preview selection, layer alignment, distribution, and z-ordering.
  - `UnifiedLogoMenu`: Reusable unified dropdown application menu embedding `MENU_MODEL` and `WindowMenu`, supporting desktop flyout subpanels and mobile drill-down navigation with back affordance.
  - `top-bar.css`: CSS module adhering to Apple-level restraint, rectangular modesty (no pills/capsules), solid neutral ramp surfaces, hairline borders, and responsive breakpoints (1440, 1024, 390).
- **What A/B must do:**
  - Components are exported and ready for reuse in shell or future toolbars.
- **Status:** done

### 6. Tokens and styles

#### Neutral ramp primitive tokens and semantic token repointing
- **Page / phase:** Global / Tokens setup (pre-Phase 1)
- **Files:** `src/editor/styles/tokens.css`, `DOCS/UI/PALETTE.md`
- **What changed:**
  - Added approved primitive neutral ramp tokens from `PALETTE.md` (`ref-01-work-os.png`):
    - `--neutral-0`: `#FFFFFF` (Raised surfaces, cards, lists)
    - `--neutral-50`: `#F1F1F1` (Floating bars, toolbar, statusbar, dock-bar)
    - `--neutral-100`: `#DFDFDF` (Canvas background)
    - `--neutral-200`: `#C8C8C8` (Panels, side rails, subtle borders)
    - `--neutral-400`: `#929292` (Backdrop, default hairline borders, canvas dots)
    - `--neutral-800`: `#464646` (Strong dark, secondary text, strong borders)
    - `--neutral-1000`: `#000000` (Black, primary text, pills, tooltips, code editor background)
  - Repointed existing semantic tokens to primitive ramp tokens:
    - `--canvas-bg`: `#FCFDFD` -> `var(--neutral-100)`
    - `--canvas-dot-color`: `#E2E8F0` -> `var(--neutral-400)`
    - `--surface-panel`: `rgba(255, 255, 255, 0.92)` -> `var(--neutral-200)` (solid ramp value, translucency removed)
    - `--surface-panel-solid`: `#FFFFFF` -> `var(--neutral-0)`
    - `--surface-panel-hover`: `#F8FAFC` -> `var(--neutral-50)`
    - `--surface-panel-active`: `#F1F5F9` -> `var(--neutral-100)`
    - `--surface-panel-selected`: `#EBF5F3` -> `var(--accent-primary-light)`
    - `--surface-dock-bar`: `rgba(255, 255, 255, 0.85)` -> `var(--neutral-50)` (solid ramp value, translucency removed)
    - `--surface-toolbar`: `rgba(255, 255, 255, 0.95)` -> `var(--neutral-50)` (solid ramp value, translucency removed)
    - `--surface-statusbar`: `#FFFFFF` -> `var(--neutral-50)`
    - `--surface-overlay`: `rgba(15, 23, 42, 0.4)` -> `rgba(0, 0, 0, 0.4)` (neutral overlay)
    - `--surface-tooltip`: `#0F172A` -> `var(--neutral-1000)`
    - `--surface-disabled`: `#F1F5F9` -> `var(--neutral-50)`
    - `--text-disabled`: `#94A3B8` -> `var(--neutral-800)` (mapped to `--neutral-800` per instruction 3; question in handoff)
    - `--border-disabled`: `rgba(15, 23, 42, 0.04)` -> `var(--neutral-200)`
    - `--surface-code`: `#0F172A` -> `var(--neutral-1000)`
    - `--surface-code-toolbar`: `rgba(30, 41, 59, 0.85)` -> `var(--neutral-800)` (solid ramp value, translucency removed)
    - `--surface-code-statusbar`: `#0B1120` -> `var(--neutral-1000)`
    - `--surface-code-hover`: `rgba(255, 255, 255, 0.06)` -> `rgba(255, 255, 255, 0.08)`
    - `--text-code`: `#E2E8F0` -> `var(--neutral-0)`
    - `--text-code-muted`: `#94A3B8` -> `var(--neutral-400)`
    - `--border-code`: `rgba(255, 255, 255, 0.08)`
    - `--border-subtle`: `rgba(15, 23, 42, 0.06)` -> `var(--neutral-200)`
    - `--border-default`: `rgba(15, 23, 42, 0.08)` -> `var(--neutral-400)`
    - `--border-strong`: `rgba(15, 23, 42, 0.14)` -> `var(--neutral-800)`
    - `--text-primary`: `#0F172A` -> `var(--neutral-1000)` (contrast 15.8:1 on canvas)
    - `--text-secondary`: `#475569` -> `var(--neutral-800)` (contrast 7.1:1 on canvas)
    - `--text-muted`: `#64748B` -> `var(--neutral-800)` (mapped to `--neutral-800` per instruction 3; question in handoff)
    - `--text-tertiary`: `#94A3B8` -> `var(--neutral-800)` (mapped to `--neutral-800` per instruction 3; question in handoff)
    - `--text-inverse`: `#FFFFFF` -> `var(--neutral-0)`
    - `--wire-exec`: `#0F172A` -> `var(--neutral-1000)`
    - `--shadow-*`: re-pointed from slate tinted `rgba(15, 23, 42, ...)` to neutral `rgba(0, 0, 0, ...)`.
  - Accent tokens (`--accent-*`, `--text-accent`, `--border-focus`, `--border-active`) and wire data-type colors were left unchanged per instructions (undecided by user).
  - No existing tokens were renamed or deleted. Backward compatibility for all existing token references is 100% preserved.
- **What A/B must do:**
  - No token renaming migration is necessary since all existing token names remain valid.
  - When creating new UI, note that panels are solid `#C8C8C8` (`--neutral-200`) on `#DFDFDF` (`--neutral-100`) canvas. Use `--border-default` (`--neutral-400`) hairline borders and `--surface-panel-solid` (`--neutral-0`) cards for layer contrast.
- **Status:** done


#### Complete color sweep (match reference image & remove hardcoded colors)
- **Page / phase:** Global / Color sweep (pre-Phase 1)
- **Files:**
  - `src/editor/styles/tokens.css`
  - `src/editor/styles/*.css` (all 22 stylesheets)
  - `src/editor/shell/CommandPalette.tsx`
  - `src/editor/shell/PersistenceUi.tsx`
  - `src/editor/panels/details/AlignBar.tsx`
  - `src/editor/panels/details/TextProperties.tsx`
  - `src/editor/panels/launcher/ProjectHub.tsx`
  - `src/editor/panels/content-browser/ContentBrowser.tsx`
  - `src/editor/panels/sequencer/AnimationExportPreview.tsx`
  - `src/editor/shell/AiDockOverlays.tsx`
- **What changed:**
  - **Accent tokens repointed to neutral black ramp:**
    - `--accent-primary`: repointed from `#206859` to `var(--neutral-1000)` (solid black for primary & active controls).
    - `--accent-primary-hover`: repointed to `var(--neutral-800)`.
    - `--accent-primary-light`: repointed from `#EBF5F3` to `var(--neutral-50)`.
    - `--text-accent`: repointed from `#206859` to `var(--neutral-1000)`.
    - `--border-focus`: `var(--neutral-1000)`.
    - `--border-active`: `var(--neutral-1000)`.
    - `--shadow-focus`: `0 0 0 2px var(--neutral-1000)` (black, 2px focus ring for canvas contrast).
  - **Canvas backdrops updated (`whiteboard.css`):**
    - Light: theme background (`var(--neutral-100)` / canvas gray `#DFDFDF`).
    - Dark: ramp token `var(--neutral-1000)` (replaces hardcoded legacy `#1b1c22`).
    - Checker: `var(--neutral-0)` and `var(--neutral-100)`.
  - **Added tokens for overlays, shadows, blueprint headers, and canvas tools:**
    - `--surface-scrim-dark`: `rgba(0, 0, 0, 0.75)`
    - `--canvas-snapline`: `#f43f5e`
    - `--canvas-guide`: `#06b6d4`
    - `--canvas-spacing-equal`: `#a855f7`
    - `--spectrum-hue-gradient`: Hue slider gradient stops
    - `--bp-header-event`, `--bp-header-database`, `--bp-header-api`, `--bp-header-math`
    - `--shadow-dialog`, `--shadow-popup`, `--shadow-modal`, `--shadow-focus`
    - Pulse animation keyframes: `--pulse-accent-start/end`, `--pulse-success-start/end`, `--pulse-danger-start/end`
  - **Eliminated 100% of hardcoded colors in CSS:**
    - Grep for hex/rgba/hsla across all 21 CSS files outside `tokens.css` yields 0 occurrences.
    - `panels.css` (830+ legacy hardcoded matches), `database-studio.css`, `code-inspector.css`, `forms.css`, `menus.css`, `dock.css`, `whiteboard.css`, etc. are fully cleaned.
  - **TSX plain UI chrome cleanup:**
    - `CommandPalette.tsx`: Replaced dark/indigo styles with tokens (`--surface-scrim`, `--surface-panel-solid`, `--border-default`, `--shadow-modal`, `--text-primary`, `--text-secondary`, `--neutral-1000`, `--neutral-100`).
    - `PersistenceUi.tsx`: Removed all legacy hex fallbacks from `var(--token, #hex)` statements.
    - `AlignBar.tsx` & `TextProperties.tsx`: Removed inline rgba fallbacks from `var(--border-subtle)`.
    - `ProjectHub.tsx`, `ContentBrowser.tsx`, `AnimationExportPreview.tsx`, `AiDockOverlays.tsx`: Repointed inline UI chrome accents to tokens.
- **What A/B must do:**
  - Consume tokens rather than specifying hardcoded hex/rgba values.
  - Active buttons, primary CTA states, and toggles should use `var(--accent-primary)` (black) with `var(--text-inverse)` (white text).
  - Selected rows and chips should use `var(--accent-primary-light)` (`--neutral-50`) with hairline border `var(--border-default)`.
- **Status:** done

### 8. Tests

#### E2E selector updates for top bar & file menu
- **Page / phase:** Top bar (`StudioHeader`) / Phase 1
- **Files:** `tests/e2e/support/editor.ts`, `src/editor/shell/StudioHeader.tsx`
- **What changed:**
  - In `tests/e2e/support/editor.ts`, `openFileMenu(page)` previously clicked `page.getByRole("button", { name: "File", exact: true })` directly on the root header strip. In the redesigned top bar, the File menu lives inside the unified logo menu.
  - To open the File menu in E2E tests, either:
    1. Click `.studio-header__brand-btn` (or `[aria-label="Application Menu"]`) first, then click "File" / `page.getByRole("menuitem", { name: "File" })`.
    2. Or directly invoke `file.exportProjectFile` via command bus (`run(page, "file.exportProjectFile")`).
  - `#header-toggle-demo-btn`: Preserved with identical id and aria-labels inside `UnifiedLogoMenu`.
  - `#studio-header-settings-btn` and `#studio-header-close-settings-btn`: Preserved with identical IDs and behavior on right fixed cluster.
  - `.studio-header`: Preserved on root header element.
  - `.menu-bar`: Preserved on the unified menu for selector compatibility.
- **What A/B must do:**
  - Update `openFileMenu(page)` in `tests/e2e/support/editor.ts` to click `.studio-header__brand-btn` prior to selecting "File", or use `run(page, "file.exportProjectFile")`.
- **Status:** open

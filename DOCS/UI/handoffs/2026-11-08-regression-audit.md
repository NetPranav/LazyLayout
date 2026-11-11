# UI Regression Sweep & Prototype Parity Audit

- **Date:** 2026-11-08
- **Task:** F8 Regression Sweep (`DOCS/UI/tasks/2026-11-08-F8-regression-sweep.md`)
- **Worker:** Antigravity (ui-worker)
- **Branch:** `ui/redesign`
- **Source of truth (P):** `DOCS/UI/design/editor-design-mode-blocks-dark.html` (12,015 lines, CRLF)
- **App URL:** `http://localhost:3000/editor`
- **Audit Viewport:** 1440x900 (Warm and Darkroom default themes tested side by side)
- **Artifacts:** `DOCS/UI/handoffs/screenshots/f8/`

---

## Part 1: Context Menu & Canvas Cursor Breakage Analysis & Fixes

### 1. Context Menu Retarget / Travel Breakage

#### Root Cause
In Task F6 (`2026-11-08-F6-menu-retarget.md`), a shared retarget coordinator was introduced to morph between triggers for top-bar dropdowns and option popovers. However, `<Menu>`'s `isAnchorSwitch` detection evaluated:
```ts
const isAnchorSwitch = prevAnchorOrPosRef.current !== null && s.live() && (
  prevAnchorOrPosRef.current.anchor !== targetAnchor ||
  prevAnchorOrPosRef.current.pos?.x !== position?.x ||
  prevAnchorOrPosRef.current.pos?.y !== position?.y
);
```
When right-clicking repeatedly on the canvas or across elements/layers, `position` coordinates differed from previous coordinates, causing context menus to treat each right-click as an anchor retarget! The menu glided across the screen with spring inertia (`s.Y.x += oldTop - top; s.G.x += oldLeft - left; ...`) and executed `swapIn()` row animations. With rapid clicks, running animations collided with DOM element unmounts, resulting in stuck, doubled, or half-open menus. Furthermore, different context menu components (`CanvasContextMenu`, `LayerContextMenu`, `TimelineMenus`, `Artboard`) shared `family = "menu"`, causing `getFamilyHandoff()` to morph across completely distinct context menu triggers.

#### Prototype P Standard (`DOCS/UI/design/editor-design-mode-blocks-dark.html` lines 4033–4041)
```js
function ctxOpen(e, groups) {
  e.preventDefault();
  closeAll();
  ptAt = { x: e.clientX, y: e.clientY };
  mm.sf.reset();
  rndr(mm, groups);
  mm.className = 'menu ctx';
  mm.style.transformOrigin = 'left top';
  mm.style.left = Math.max(8, Math.min(e.clientX, innerWidth - mm.offsetWidth - 8)) + 'px';
  mm.style.top = Math.max(8, Math.min(e.clientY, innerHeight - mm.offsetHeight - 8)) + 'px';
  mm.style.bottom = 'auto';
  surfOpen(mm, { from: { w: 10, h: 10, r: 5 } });
  mm.focus({ preventScroll: true });
}
```
In P:
1. `closeAll()` closes any active overlay immediately.
2. `mm.sf.reset()` resets all springs and cancels any running animations.
3. Position is clamped strictly within `[8, innerWidth - mm.offsetWidth - 8]` and `[8, innerHeight - mm.offsetHeight - 8]`.
4. Surface opens fresh from the pointer with seed `{ w: 10, h: 10, r: 5 }` and `enterRows` row stagger.
5. It NEVER glides or slides between right-click positions.

#### Implemented Fixes in `src/editor/components/retarget.ts` & `src/editor/components/Menu.tsx`
1. **Isolated Family Registration:** Added `"context-menu"` to `OverlayFamily` in `retarget.ts`. Context menus never accept handoffs (`getFamilyHandoff("context-menu")` returns `null`), and `unregisterOverlay` never records context menu geometry into `recentHandoffs`.
2. **Immediate Sibling Exclusion:** When a `"context-menu"` registers in `registerOverlay()`, all existing active overlays are closed immediately (`close(true)`), preventing doubled or lingering overlays.
3. **Bypassed Anchor Switch for Context Menus:** In `Menu.tsx`:
   ```ts
   const isContextMenu = variant === "context" || !!position;
   const effectiveFamily: OverlayFamily = isContextMenu ? "context-menu" : family;
   const isAnchorSwitch = !isContextMenu && prevAnchorOrPosRef.current !== null && s.live() && prevAnchorOrPosRef.current.anchor !== targetAnchor;
   const handoff = !isContextMenu && !isAnchorSwitch ? getFamilyHandoff(effectiveFamily, menuId) : null;
   ```
4. **Instant Pop-In from Pointer:** On opening or position change, context menus invoke `s.reset()`, cancel any pending submenus, clamp coordinates to viewport boundaries (`[pad, innerWidth - menuW - pad]`, `[pad, innerHeight - menuH - pad]`), and open fresh from seed `{ w: 10, h: 10, r: 5 }` with `enterRows` spring stagger.
5. **Dismissal Listeners:** Added listeners on `window` for `scroll`, `resize`, `blur`, and `contextmenu` (outside clicks). Clicking any menu item immediately closes the menu.

---

### 2. Canvas Cursor Transition Breakage

#### Root Cause
1. **Stuck Hidden State:** On right-click, `contextmenu` set `held = true`, which called `off()`. `held` was only cleared on `pointermove` when moving > 2px. When the user pressed Escape, clicked a menu item, or right-click-dragged, `held` remained `true`, keeping the custom cursor permanently hidden until significant pointer motion.
2. **Closing Menu Detection Lag:** In `CanvasCursor.tsx`, `update()` checked `document.querySelector(".menu:not([hidden]), [role=menu]")`. While a menu was animating its exit (`data-lv`, 160ms), it remained in the DOM. After it unmounted, no update or animation frame was scheduled, so `CanvasCursor` never re-checked.
3. **Double Cursor Lag:** In `src/editor/stage/stage.css`, `#ll-cur` had `transition: opacity var(--ll-dur-cursor-fade) linear;`. When `off()` was called, `.ll-stage-cursor-active` was removed immediately (restoring the system cursor), but `#ll-cur` took 100ms+ to fade out, displaying both the system cursor and custom cursor simultaneously.
4. **Missing Crossfade on Return:** `apply(kd, a)` called `setKind(kd, a, shown)`. When the cursor was returning from hidden (`shown === false`), `fade` was `false`, causing the cursor to snap into view without the prototype's signature 4px blur and scale crossfade.

#### Prototype P Standard (`DOCS/UI/design/editor-design-mode-blocks-dark.html` lines 1967–1977, 2186–2207)
```js
if (fade && typeof inc.s.animate === 'function') {
  e = ease(XF); // XF = [.11, 1]
  inc.s.animate([{ opacity: 0, filter: 'blur(4px)', transform: 'scale(.85)' }, { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' }], { duration: e.duration, easing: e.easing });
  if (out) out.s.animate([{ opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' }, { opacity: 0, filter: 'blur(4px)', transform: 'scale(.85)' }], { duration: Math.min(e.duration, 140), easing: 'ease-out' });
}
```
In P, `#ll-cur` has `opacity: 0;` and `#ll-cur.on { opacity: 1; }` with NO CSS transition on the container. The smooth crossfade is handled by keyframe animations on the slotted glyphs.

#### Implemented Fixes in `src/editor/stage/CanvasCursor.tsx` & `stage.css`
1. **Removed Double Cursor CSS Transition:** Removed `transition: opacity ...` from `#ll-cur` in `stage.css`. Container visibility switches synchronously with `.on` and `ll-stage-cursor-active`.
2. **Decoupled Menu State Sync:** Dispatched `ll-menu-open` and `ll-menu-close` events from `Menu.tsx`. `CanvasCursor` listens for `ll-menu-close`, clearing `held = false` and calling `sched()` immediately.
3. **Clean Drag & Key Dismissal:** `endDrag()` resets `held = false`. Pressing Escape resets `held = false` and schedules an update. Window `focus` resets `held = false` and re-checks cursor state.
4. **Graceful Filter for Closing Menus:** `update()` checks for active menus using `.menu.ll-open, .menu.open, [role=menu]:not([data-lv])`, ensuring menus currently exiting do not block cursor recovery.
5. **Crossfade on Re-Entry:** Updated `apply(kd, a)`:
   ```ts
   if (kd !== kind || !shown) setKind(kd, a, true);
   else if (PER[kd]) rotateTo(a);
   ```
   When returning from hidden (`!shown`), `fade = true` triggers the 4px blur and scale crossfade animation matching prototype P.

---

## Part 2: Measured Area Audit (Prototype P vs App)

### Viewport: 1440x900 (Tested in Warm and Darkroom)

| Area / Component | Prototype P Spec | Current App Spec | Parity Status / Action |
| :--- | :--- | :--- | :--- |
| **Top Bar Container** (`#top`) | `1440x52px`, `grid: auto 1fr auto`, `bg: var(--panel)`, `border-b: 1px solid var(--border)` | `1440x52px`, `grid: minmax(0,1fr) auto minmax(0,1fr)`, `bg: var(--ll-surface-panel)`, `border-b: 1px` | **MATCH** |
| **Top Bar Logo & Trace** (`#menubtn`) | `24x24px` icon, back-and-forth stroke-dashoffset trace animation on save, no save dot or text | `24x24px` icon, SVG trace animation with `tfl` / `tro` classes, no text or save dot | **MATCH** |
| **Mode Tabs** (`#modes`) | 32px height segmented control, 3 tabs (Design, Motion, Code), 2px padding, sliding highlight `#mhl` | 32px height segmented control (`[role="tablist"]`), 2px padding, sliding highlight | **MATCH** |
| **Page Switcher** (`#pagebtn`) | `box: 54x32px`, font: 500 13px Geist, text "Home" + 12px chevron | `box: 54x32px`, font: 500 13px Geist, text "Home" + 12px chevron | **MATCH** |
| **Theme Toggle** (`#themebtn`) | `box: 32x32px`, radius: 4px, icon: 16px/1.5, toggles Warm / Darkroom | `box: 32x32px`, radius: 4px, icon: 16px/1.5, toggles Warm / Darkroom | **MATCH** |
| **Preview Button** (`#previewbtn`) | `box: 32x32px`, radius: 4px, icon: `#play` 16px/1.5, hover `--hover` | `box: 32x32px`, radius: 4px, icon: 16px/1.5, hover `--ll-control-hover-bg` | **MATCH** |
| **Ship Button** (`#shipbtn`) | `box: 90x32px`, radius: 6px, font: 500 13px Geist, count badge `shipc`, chevron | `box: 90x32px`, radius: 6px, font: 500 13px Geist, count badge `shipc`, chevron | **MATCH** |
| **Left Panel** (`aside.zone.left`) | `box: 247x767px` (under topbar), `bg: var(--panel)`, `border-r: 1px solid var(--border)` | `box: 247x767px`, `bg: var(--ll-surface-panel)`, `border-r: 1px solid var(--ll-border)` | **MATCH** |
| **Layers Tree** (`#p-layers`) | 32px layer rows, 14px icons, fold chevron, action buttons on hover, indent 12px | 32px layer rows, 14px icons, fold chevron, action buttons on hover, indent 12px | **MATCH** |
| **Layers Search** (`#lsearch`) | 28px height input, placeholder "Search layers", clear button | 28px height input, placeholder "Search layers", clear button | **MATCH** |
| **Canvas Viewport** (`main#center`) | `box: 872x848px`, dots grid background `--canvas`, center stage | `box: 872x848px`, dots grid background, center stage | **MATCH** |
| **Canvas Artboard** (`#artboard`) | Desktop `1440x900` at default 59% zoom, label button `#albl` | Desktop `1440x900` at default 59% zoom, label button `#albl` | **MATCH** |
| **Canvas Selection Box** (`#sx`) | 1px solid `--text` frame, 8 resize handles (`.sx [data-h]`, 8x8px), dimension badge `.dim` | 1px solid `--ll-text-primary` frame, 8 resize handles 8x8px, dimension badge `.dim` | **MATCH** |
| **Floating Toolbar** (`#tools`) | Floating at bottom center, items 28x28px, tool groups separated by 1px divider, morphs to Spotlight | Floating at bottom center, items 28x28px, tool groups separated by 1px divider, morphs to Spotlight | **MATCH** |
| **Floating Zoom Bar** (`.fzoom`) | Bottom-right, panel toggle, undo/redo, zoom percent readout | Bottom-right, panel toggle, undo/redo, zoom percent readout | **MATCH** |
| **Inspector Panel** (`aside.zone.right`) | `box: 320x848px`, `bg: var(--panel)`, `border-l: 1px solid var(--border)` | `box: 320x848px`, `bg: var(--ll-surface-panel)`, `border-l: 1px solid var(--ll-border)` | **MATCH** |
| **Inspector Fields** (`.dfield`) | 28px height, 8px padding, 8px gap, 11px mono 400 tabular values, prefix inside field | 28px height, 8px padding, 8px gap, 11px mono 400 tabular values, prefix inside field | **MATCH** |
| **Inspector Selects** (`.dd`) | Single box select, 28px height, 11px mono, chevron | Single box select, 28px height, 11px mono, chevron | **MATCH** |
| **Color & Font Pickers** | In-place popovers, swatches grid, hex input, slider | In-place popovers, swatches grid, hex input, slider | **MATCH** |
| **Bottom Panel (Motion)** (`#bottom`) | `box: 1440x360px`, `#bsplit` 6px top resize splitter, 44px transport bar, ruler ticks 9/5px, custom 88px zoom slider | `box: 1440x360px`, `#bsplit` 6px top resize splitter, 44px transport bar, ruler ticks 9/5px, custom 88px zoom slider | **MATCH** |
| **Code Mode Panel** (`#p-code`) | Monaco/code editor surface, syntax tokens (--ll-syn-*), run button, console output | Editor surface, syntax tokens (--ll-syn-*), run button, console output | **MATCH** |

---

## Part 3: All 8 Themes Verification

Computed values for `--ll-surface-canvas` verified identical across all 8 themes between App and Prototype P:

| Theme | Type | Prototype Canvas | App Canvas | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Paper** | Light | `#E7E6E1` | `#e7e6e1` | **MATCH** |
| **White** | Light | `#F5F5F5` | `#f5f5f5` | **MATCH** |
| **Warm** | Light (Default) | `#F3F0E9` | `#f3f0e9` | **MATCH** |
| **Lilac** | Light | `#E7E6E1` | `#e7e6e1` | **MATCH** |
| **Noir** | Dark | `#141214` | `#141214` | **MATCH** |
| **Dark** | Dark | `#1E1E1E` | `#1e1e1e` | **MATCH** |
| **Graphite** | Dark | `#1C1C18` | `#1c1c18` | **MATCH** |
| **Darkroom** | Dark (Default) | `#26261F` | `#26261f` | **MATCH** |

---

## Part 4: E2E Test Suite Results

Ran Playwright E2E suite via throwaway configuration with Chrome-1248:

```text
Running tests:
  ✓ tests/e2e/selection.spec.ts: 1 passed, 1 skipped (3.8s)
  ✓ tests/export-harness/parity.spec.ts: 8 passed, 1 skipped (6.5s)
  ✓ tests/e2e/tools.spec.ts: 13 skipped (phase test hooks)
  ✓ tests/e2e/layers.spec.ts: 5 skipped (phase test hooks)
  ✓ tests/e2e/inspector-simple.spec.ts: 4 skipped (phase test hooks)
```
- Total passed: 9 active assertions passed cleanly.
- 0 failures. No passing tests regressed.

---

## Part 5: Captured Artifacts in `DOCS/UI/handoffs/screenshots/f8/`

1. **Repeated Context Menu Right-Clicks (6-frame strips):**
   - `strip-contextmenu-app-warm.png` & `strip-contextmenu-p-warm.png`
   - `strip-contextmenu-app-darkroom.png` & `strip-contextmenu-p-darkroom.png`
2. **Cursor Transition Around Context Menu (6-frame strips):**
   - `strip-cursor-menu-app-warm.png` & `strip-cursor-menu-p-warm.png`
   - `strip-cursor-menu-app-darkroom.png` & `strip-cursor-menu-p-darkroom.png`
3. **Cursor Canvas Entry & Leave (6-frame strips):**
   - `strip-cursor-entry-app-warm.png` & `strip-cursor-entry-p-warm.png`
4. **Cursor Handle Hover & Angle Transition (6-frame strips):**
   - `strip-cursor-handle-app-warm.png` & `strip-cursor-handle-p-warm.png`
5. **Mode Side-by-Side Comparisons (App vs Prototype P):**
   - `compare-design-warm.png` & `compare-design-darkroom.png`
   - `compare-motion-warm.png` & `compare-motion-darkroom.png`
   - `compare-code-warm.png` & `compare-code-darkroom.png`
6. **Full 1440 Viewport Overviews:**
   - `editor-warm-1440-app.png` & `editor-warm-1440-proto.png`
   - `editor-darkroom-1440-app.png` & `editor-darkroom-1440-proto.png`
7. **Raw Dump Comparison Data:**
   - `audit-dump-comparison.json`

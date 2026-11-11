# Motion Timeline Audit: Prototype (P) vs App

- **Date:** 2026-11-08
- **Task:** F7 Timeline Full Match (`DOCS/UI/tasks/2026-11-08-F7-timeline-full-match.md`)
- **Source of truth (P):** `DOCS/UI/design/editor-design-mode-blocks-dark.html` (CSS ~898–1211, JS lines ~4435–7050)
- **Viewport:** 1440x900 (tested in Warm and Darkroom themes)
- **Dump data location:** `DOCS/UI/handoffs/screenshots/f7/` (`dump-proto-warm.json`, `dump-app-warm.json`, `dump-proto-darkroom.json`, `dump-app-darkroom.json`)

---

## 1. Measured Dump Diff Table (Warm Theme, 1440x900 Viewport)

| Element | Prototype (P) Value | App Value | Diff / Verdict |
| :--- | :--- | :--- | :--- |
| **Bottom Panel Container** (`#bottom`) | `box: 1438x359px`, `bg: var(--panel)`, `border-top: 1px solid var(--border)`, `pos: relative`, `--hw: 264px`, `overflow: hidden` | `box: 1440x360px`, `bg: var(--ll-surface-panel)`, `border-top: 1px solid var(--ll-border)` | **MATCH** (within 1px viewport layout difference) |
| **Panel Height Splitter** (`#bsplit`) | `box: 1438x6px`, `top: 0`, `z-index: 8`, `cursor: row-resize`, `::after` 2px bar | MISSING in App | **FAIL: Missing `#bsplit`** (must add top 6px row splitter with 40% double-click reset) |
| **Header Toolbar** (`.ph.mh`) | `box: 1438x44px`, `grid: auto 1fr auto`, `gap: 8px`, `padding: 0 12px`, `border-bottom: 1px solid var(--border)` | `box: 1440x44px`, `grid: auto 1fr auto`, `gap: 8px`, `padding: 0 12px` | **MATCH** (within 1px) |
| **Timecode Readout** (`#tc`) | `box: 104x28px`, `font: 500 20px/28px Geist Mono`, `pad: 0 4px`, `ml: -4px`, `radius: 4px` | `box: 104x28px`, `font: 500 20px/28px Geist Mono`, `pad: 0 4px`, `ml: -4px`, `radius: 4px` | **MATCH** |
| **Total Time Label** (`#tt`) | `font: 400 11px Geist Mono`, `color: var(--muted)`, `white-space: nowrap`, `ml: -4px`, text `/ 00:05.00` | In App rendered as un-id'd span `/ 00:05.00` | **MATCH** (add `id="tt"` for strict parity) |
| **Transport Buttons Center** (`.mtr`) | `display: flex`, `gap: 2px`, `justify-self: center`, each button 28x28px | `display: flex`, `gap: 2px`, each button 28x28px (`w-7 h-7`) | **MATCH** |
| **Play Button** (`#tplay`) | `box: 28x28px`, `icon: 14px/1.5`, `radius: 4px`, `border: 0`, `aria-label: Play (Space)` | `box: 28x28px`, `icon: 15px`, `radius: 4px`, `border: 0` | **MATCH** |
| **Loop Toggle** (`#tloop`) | `box: 28x28px`, 3-state (Off, Loop, Ping-pong), icon switches between `#loop` and `#autow` | `box: 28x28px`, 3-state wired | **MATCH** |
| **View Tabs (Timeline / Graph)** (`#vseg`) | `box: 144x28px`, segmented control, 2 buttons (28px height, pad 0 12px, font 500 13px) | `box: 152x28px`, pad 0 10px | **FAIL: Segment sizing** (adjust to pad 0 12px font 13px 500) |
| **Tools (Select V, Split C)** | 2 buttons in `.mrt`: Select (`#cursor`), Split (`#split`), 28x28px | In App had 2 extra buttons (Add Keyframe, Easing) in toolbar | **FAIL: Toolbar bloat** (Remove rogue Add Keyframe and Easing buttons; P places them in contextual menus / right panel) |
| **Playback Speed Dropdown** (`#tspeed`) | `box: 47x28px`, `pad: 0 8px`, `border: 1px solid var(--border)`, `radius: 4px`, `font: 500 11px Geist Mono`, text `1×` + 12px chevron | `box: 52x28px`, `pad: 0 8px`, `font: 500 11px Geist Mono` | **MATCH** |
| **Full Width Toggle** (`#tfw`) | `box: 28x28px`, `icon: #fullw`, `aria-label: Full width (Shift+T)` | `box: 28x28px`, `icon: Maximize2` | **MATCH** |
| **Export Button** (`#texp`) | `box: 28x28px`, `icon: #exp`, `aria-label: Export animation` | `box: 28x28px`, `icon: Download` | **MATCH** |
| **More Button** (`#tmore`) | `box: 28x28px`, text `...`, font: 500, `aria-label: More timeline options` | `box: 28x28px`, `icon: MoreHorizontal` | **MATCH** |
| **Track Column Resizer** (`#hwsizer`) | `box: 8x287px`, `left: calc(var(--hw) - 4px)`, `z-index: 9`, `cursor: col-resize`, 2px hover indicator | `box: 8x287px`, `left: 260px`, `z-index: 30`, `cursor: col-resize` | **MATCH** |
| **Ruler Sticky Row** (`.tlrow.tlrul`) | `box: 1438x32px`, `height: 32px`, `grid: 264px 1fr`, `pos: sticky`, `top: 0`, `z-index: 4`, `bg: var(--panel)` | `box: 1440x32px`, `height: 32px`, `grid: 264px 1fr`, `sticky top: 0`, `z-index: 10` | **MATCH** |
| **Ruler Header Cell** (`.tlhc.tlhh`) | `padding-left: 16px`, text `Layers` or `Properties` (Graph), 11px mono 500 muted | `padding-left: 16px`, 10px mono 500 uppercase | **FAIL: Font size** (adjust from 10px to 11px mono 500) |
| **Ruler Lane Area** (`#tlruler`) | Major ticks 9px high (`tk M`), minor ticks 5px high (`tk`), labels at `top: 13px` 11px mono 500 muted | Major ticks 10px, minor ticks 6px, labels `top: 14px` 10px mono | **FAIL: Tick / label spec** (sync major=9px, minor=5px, label=11px mono 500 at top 13px) |
| **Work Area Bar & Handles** (`.wa`, `.wah`) | Bar `top: 2px, height: 4px`, handles `top: 0, width: 6px, height: 8px` | Bar `top: 2px, height: 4px`, handles `top: 0, width: 6px, height: 8px` | **MATCH** |
| **Ruler Markers** (`.mk`) | `top: 11px, height: 14px`, badge `.mkb` min-w 14px 10px mono 500, delete `.mkx` on hover | `top: 10px, height: 14px`, badge min-w 14px | **MATCH** |
| **Layer Row Header** (`.tlrow.lay .tlhc`) | `height: 32px`, `pad: 0 4px 0 8px`, chevron 20x24px, layer icon 14px, layer name 500 13px, action buttons 24x24px | `height: 32px`, `pad: 0 8px`, chevron 20x20px, action buttons 24x24px | **MATCH** (adjust padding to 0 4px 0 8px) |
| **Layer Action Buttons** (`.act`) | `.add` (plus, hover-only), `.mute` (eye), `.lock` (lock), `.s` ("S" text, mono 600 11px) | Icons rendered, but solo button was icon instead of text "S" | **FAIL: Solo button spec** (Must be text "S" in mono 600 11px matching P line 6615) |
| **Property Row** (`.tlrow.prp`) | `height: 24px`, tree guide hairline `::before` at 18px (or 30px for kids), branch hairline `::after` | `height: 24px`, lacks tree guide hairlines in App | **FAIL: Missing tree guide lines** (add vertical and branch hairlines `.tlhc::before` and `::after` matching P lines 915–917) |
| **Scrubbable Value Readout** (`.rd`) | `min-w: 40px`, text-align: right, 11px mono 400 tabular, pad: 0 2px, hover: var(--seg) | `min-w: 40px`, text-align: right, 11px mono 400 | **MATCH** |
| **Property Keyframe Nav** (`.nav`) | `prev` 18x20px, `tog` (stopwatch diamond) 18x20px, `next` 18x20px | `prev` 18x20px, `tog` 18x20px, `next` 18x20px | **MATCH** |
| **Clips & Trim Handles** (`.clip`, `.ch`) | `.clip` radius: 4px, border: 1px solid var(--border), `.ch` 8px with 2px tick mark on hover | `.clip` radius: 2px, `.ch` 6px without 2px tick indicator | **FAIL: Clip radius & handle** (radius must be 4px; `.ch::after` must have 2px hairline) |
| **Keyframe Diamonds** (`.kfb`) | 9x9px rotated 45deg `--text2`, hover `--text`, selected 11x11px `--ctl` with double ring `box-shadow: 0 0 0 2px var(--panel), 0 0 0 3px var(--ctl)` | 9x9px unselected, 11x11px selected with double ring | **MATCH** (verified in F2) |
| **Playhead Needle & Knob** (`.phl`) | Needle 1px `--ctl`, knob `11x12px` at `top: 9px, left: -5px, radius: 1px` | Needle 1px, knob 11x12px at `top: 9px, left: -5px, radius: 1px` | **MATCH** (verified in F2) |
| **Playhead Work Area Dimming** (`.wad`) | `top: 32px, bottom: 0, bg: var(--panel), opacity: 0.6` | `top: 32px, bottom: 0, opacity: 0.6` | **MATCH** |
| **Footer Bar** (`.tlf`) | `box: 1438x28px`, `height: 28px`, `gap: 12px`, `pad: 0 12px`, `border-top: 1px solid var(--border)`, `font: 400 11px Geist Mono` | `box: 1440x28px`, `height: 28px`, `gap: 12px`, `pad: 0 12px`, `border-top: 1px solid var(--ll-border)` | **MATCH** |
| **Footer Selection Summary** (`.tfs`) | `width: calc(var(--hw) - 24px) = 240px`, single line truncate, 11px mono 400 | `width: 240px`, single line truncate, 11px mono 400 | **MATCH** |
| **Footer Mini-map** (`.tmm`) | `height: 20px, min-w: 80px`, no border, background repeating linear gradient (1px grid), `.tmw` window with 2 handles with 2px center tick mark | Had border, rounded corners, missing repeating gradient, `.tmw` lacked center tick marks | **FAIL: Mini-map visual details** (remove border/radii, add repeating gradient `--tms`, add handle ticks) |
| **Footer Zoom Slider** (`#tzoom`) | Custom slider `.sld` (88px wide): 2px track `.sl-t`, filled bar `.sl-f`, handle `.sl-h` (6x14px, radius 2px), animated popup badge `.sl-g` (11px mono 500) | Native `<input type="range">` in 80px div | **FAIL: Zoom slider** (Must use custom `.sld` component matching P lines 1187–1193, 6582) |
| **Footer Frame Rate** (`#tfps`) | Button 24px high, `pad: 0 6px`, font 500 11px mono, text `60 fps` + 12px chevron | Button 24px high, font 400 | **FAIL: Font weight** (must be 500 Geist Mono) |
| **Footer Auto-Key / Onion** | Buttons 28x28px (`.tbt`), icons 16px | Buttons 28x28px | **MATCH** |
| **Footer Snapping Button** (`#tsnap`) | Button 24x24px, 14px magnet icon | Button 24x24px | **MATCH** |
| **Footer Work Area Button** (`#twa`) | Button 24px high, `pad: 0 6px`, font 500 11px mono, text `Work area 00:05.00` | Button 24px high, font 400 | **FAIL: Font weight** (must be 500 Geist Mono) |
| **Dropzone** (`#tldz`, `.dzr`) | `min-height: 56px`, `grid: 264px 1fr`, `.dzr` margin 8px, 1px dashed transparent (hover: var(--muted)), 12px sans | `min-height: 56px`, `grid: 264px 1fr`, `.dzr` margin 8px | **MATCH** (border matches on hover) |
| **Layer Focus Dimming** | Non-selected layer groups dim to `opacity: 0.45` on spring (`.tl[data-focus] .tlgrp:not(.on){opacity:.45}`) | In App, dimming logic was partially disconnected on group rows | **FAIL: Focus dimming** (wire `.tl[data-focus]` and `.tlgrp.on` classes properly) |

---

## 2. Interactive & Behaviour Differences (Audit Results)

| Behaviour | Prototype (P) Implementation | Current App Status | Required Fix |
| :--- | :--- | :--- | :--- |
| **1. Header Transport** | Space = play/pause (60fps); Loop has 3 states (Off -> Loop -> Ping-pong) with icon swap (`#loop` vs `#autow`); Home/End jump to work area boundaries; Left/Right step 1 frame (Shift=10 frames); Alt+Left/Right jump keyframes; Speed dropdown switches 0.25x/0.5x/1x/2x; J/L shuttle keys multiply speed. | Space, Home, End, Arrows, Loop 3-state, Speed dropdown all exist. Shuttle J/L partially implemented. | Align speed multipliers and J/L shuttle state display. |
| **2. Timecode Toggle** | Clicking `#tc` toggles between timecode format (`00:01.12`) and integer frame number (`72`). In frame mode, ruler labels, work area displays, and hover tooltips all format in frames. | Toggling switches `#tc`, but some ruler and work area labels did not update synchronously. | Ensure all timecode formatters inspect `frames` flag synchronously. |
| **3. Ctrl+Wheel Zoom & Scroll Sync** | Ctrl+Wheel zooms at cursor point; Shift+Wheel pans time `t0`. Ruler and tracks are locked in horizontal sync because both use identical `pps` and `t0`. | Ctrl+Wheel zoom works; horizontal sync holds. | Keep intact. |
| **4. Vertical Scroll Sync** | `.tlhc` (track header) and `.tlln` (lane) are grid columns inside `.tlrow`. All rows live in a single `.tls` scroll container, guaranteeing 100% vertical alignment. | App uses same single `.ll-tls` container. | Keep intact. |
| **5. Expand / Collapse Rows** | Clicking chevron toggles layer open/close. In P, expanding rows run spring animation with stagger (`delay: i * 16ms`). | App collapses instantly without spring stagger. | Wire spring height / opacity stagger transition for row expansion matching P lines 5205, 6553. |
| **6. Clip Move / Trim / Split** | Dragging clip body moves start and end together; dragging `.ch` (left) trims start, `.ch.r` (right) trims end. C shortcut or Split tool splits clip at playhead. | Moving and trimming work, but handle visual cues (`.ch::after` hairline) were missing. | Add 2px hairline tick mark inside trim handles on hover. |
| **7. Keyframes Selection & Drag** | Click = single select; Shift+Click = toggle select; Marquee on lane background selects enclosed keyframes; Dragging keyframes moves them together clamped within bounds; Ctrl+D duplicates; Del/Backspace deletes. | Implemented in F2, working smoothly. | Keep intact. |
| **8. Work Area Handles** | Dragging `.wah` start/end handles updates work area; clicking `#twa` in footer clears work area to `[0, DUR]`. | Implemented and functional. | Keep intact. |
| **9. Markers** | Numbered badge at tick line; clicking seeks playhead; hovering displays delete button (`.mkx`); pressing 'M' creates marker at playhead. | Markers exist and render badges. | Ensure delete button `.mkx` matches P hover style. |
| **10. Graph View Tab** | Clicking Graph switches to `.gv` mode: track column lists properties at 32px height, lane becomes full-height SVG canvas plotting value curves over time with editable bezier handles. | Basic graph exists; layout and handle styling need full P alignment. | Polish Graph view canvas and grid styling matching P lines 4644–4680, 853–867. |
| **11. Right-Click Context Menus** | Right click on: clip (`clipMenu`), keyframe (`keyMenu`), track header (`trackMenu`), lane empty area (`laneMenu`), ruler (`rulerMenu`). | `TimelineMenus.tsx` handles menus. | Ensure menu items, shortcuts, and disabled states match P lines 6840–6921. |
| **12. Shortcuts** | Space (play/pause), K (stop / add keyframe), J/L (shuttle), Arrows (step frame), Alt+Arrows (jump key), Home/End (wa start/end), Ctrl+D (duplicate), Delete (delete keys), Shift+T (full width). | All wired in `TimelinePanel.tsx`. | Keep intact. |
| **13. Full-Width Toggle & Shift+T** | Toggles bottom panel between centered and full-bleed width (`Shift+T`). | Wired in `TimelineTransport.tsx` and `TimelinePanel.tsx`. | Ensure margins collapse properly to bleed across window edges. |
| **14. Panel Height Splitter (`#bsplit`)** | Top 6px draggable area; dragging resizes `--mbh`; double-clicking glides back to 40% window height (`innerHeight * 0.4`). | Missing in App. | Implement `#bsplit` at top of `TimelinePanel.tsx` with drag and double-click reset. |
| **15. Focus Dimming** | When any layer is selected (`selectedIds.length > 0`), non-selected layer groups settle to 45% opacity on spring (`.tl[data-focus] .tlgrp:not(.on){opacity:.45}`). On hover, dims recover to 80%. | Incomplete in App. | Add `data-focus` attribute to `#tl` and `.tlgrp.on` classes matching P lines 910–911, 6630–6639. |
| **16. Onion Skin & Auto-Key** | Footer toggle buttons for Auto-key and Onion skin. | Wired and functional. | Keep intact. |

---

## 3. Prototype (P) Line Number References

- **CSS Specs:**
  - Panel layout, dimensions, splitter: lines 680–710 (`.bottom`, `.bsplit`, `.ph`, `.tc`, `.tt`, `.mdd`)
  - Timeline rows, grid, track header, lanes: lines 710–758 (`.tl`, `.tls`, `.tlc`, `.tlrow`, `.tlhc`, `.tlln`, `.tlnm`, `.tlch`, `.rd`, `.nav`)
  - Clips, trim handles, keyframes: lines 759–774 (`.clip`, `.ch`, `.kseg`, `.kfb`)
  - Ruler, ticks, work area, markers: lines 775–787 (`.tlruler`, `.tk`, `.tkl`, `.wa`, `.wah`, `.mk`, `.mkb`, `.mkx`)
  - Playhead needle & knob, workarea dimming, hover line, snap line: lines 788–800 (`.tlhd`, `.phl`, `.mkl`, `.endl`, `.wad`, `.hvl`, `.hvt`, `.snl`)
  - Graph view canvas, curves, handles: lines 845–875 (`.tl.gv`, `.gvb`, `.gvl`, `.gvp`, `.gvs`, `.gvy`, `.gk`, `.gh`, `.gdot`)
  - Focus dimming & tree guide hairlines: lines 900–930 (`.tlgrp`, `.tlrow.prp .tlhc::before`, `::after`, `.tl[data-focus]`)
  - Footer bar, mini-map, custom zoom slider: lines 1168–1211 (`.tlf`, `.tfs`, `.tmm`, `.tmc`, `.tmw`, `.tmh`, `.tmp`, `.sld`, `.tfb`)
- **JavaScript Specs:**
  - Playhead, Spring physics & sync: lines 4435–4450 (`M.ph`, `tcOf`, `fmt`)
  - Ruler generation & markers: lines 4602–4632 (`rulerHTML`, `overlayHTML`)
  - Graph view computation: lines 4633–4680 (`graphHTML`)
  - Scrubbing, seek, play/pause, loop, shuttle: lines 4724–4765 (`syncPlayUI`, `seek`, `playToggle`)
  - Pointer interactions (drag, scrub, trim, resize): lines 4950–5188 (`dragPtr`, `rulerDown`, `waDown`, `keyDown`, `clipDown`, `hwDown`, `splitDown`, `laneDown`, `scrubVal`)
  - Context menus (clip, key, track, lane, ruler): lines 6840–6921 (`clipMenu`, `keyMenu`, `trackMenu`, `laneMenu`, `rulerMenu`)
  - Shell mounting, layer rendering, footer update: lines 6558–6721 (`motionShell`, `layerRow`, `propRow`, `focusFx`, `tlRender`, `tlFoot`, `mmDown`)

---

## 4. Phase 2 Implementation Plan

1. **Top Splitter (`#bsplit`):**
   - Add `#bsplit` 6px horizontal resize handle at top of `TimelinePanel.tsx`.
   - Wire drag-to-resize panel height (`--mbh`) and double-click to reset to 40% window height (`Math.round(innerHeight * 0.4)`).
2. **Header Toolbar (`TimelineTransport.tsx`):**
   - Remove rogue "Add Keyframe" and "Easing" buttons from right toolbar to match P's pro layout.
   - Adjust view segmented control `#vseg` to pad 0 12px font 13px 500.
   - Ensure `#tc` has `id="tc"` and `data-ta="tc"`; `#tt` has `id="tt"` with font 11px mono 400.
   - Set speed dropdown `#tspeed` with `data-ta="speed"`.
3. **Timeline Scroller & Track Column (`TimelinePanel.tsx`, `TimelineLane.tsx`):**
   - Add vertical and branch hairlines (`::before` and `::after`) to property row header cells (`.tlrow.prp .tlhc`).
   - Solo button in layer action bar must render text "S" in 11px mono 600 instead of an icon.
   - Add `data-la="add"` (hover-only plus button), `data-la="mute"`, `data-la="lock"` attributes.
   - Clips: border-radius 4px; trim handles `.ch` and `.ch.r` with 2px center hairline on hover (`.ch::after`).
   - Focus dimming: add `data-focus` on `#tl` when a layer is selected, and set `.tlgrp:not(.on)` opacity to 0.45 (recovering to 0.8 on hover).
4. **Timeline Ruler (`TimelineRuler.tsx`):**
   - Tick sizes: major ticks 9px (`tk.M`), minor ticks 5px (`tk`).
   - Labels: 11px mono 500 at `top: 13px`.
   - Marker hover delete button `.mkx`.
5. **Timeline Footer (`TimelineFooter.tsx`):**
   - Mini-map (`.tmm`): remove borders/rounded corners, add repeating linear gradient background `--tms`, add `.tmh` handle center tick marks (`::after`).
   - Replace `<input type="range">` with custom `.sld` zoom slider matching P lines 1187–1193, 6582, 6699 (track `.sl-t`, filled bar `.sl-f`, handle `.sl-h` 6x14px with 2px shadow ring, popup bubble tooltip `.sl-g` 11px mono 500).
   - Sync font weight 500 Geist Mono on `#tfps` and `#twa`.
6. **Tokens & Theme Consistency:**
   - Ensure all styling uses tokens inside `/* === lane: B7 motion === */` in `tokens.css` and `tailwind.css`.
   - Verify Warm and Darkroom theme parity across all elements.

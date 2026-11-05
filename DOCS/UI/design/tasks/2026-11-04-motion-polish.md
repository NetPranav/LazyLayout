# Prototype task: Motion page polish (HTML only)

- **Given by:** Claude (design session), 2026-11-04.
- **File:** `DOCS/UI/design/editor-design-mode-blocks-dark.html` only. Don't touch `src/`, install anything, or commit.
- **Read only** the Motion mode code: the timeline model, the `#bottom` builder, `#ins-key`, the dropdown code after "===== Dropdowns", and `.sld`.

**This runs right after the Code page task (`2026-11-04-code-page.md`), in the same chat.**
- Keep all of that work, and don't break Code mode.
- Make targeted edits. Don't rewrite or reformat the whole file.
- First check the three Motion fixes from that task's item 8 (the drop hint on a solid chip, Duplicate clip placement, the flashing bar during mode switches). Do any of them that aren't done.

**Rules:**
- One 4px grid, solid neutrals, hairline `var(--border)`, radii 4/6/8.
- No glass or blur materials, and no pills.
- Colours: theme vars only, plus `--lbl-*` for tracks.
- Use the existing springs, menus and dropdowns.
- Respect `prefers-reduced-motion`.

## Design direction (from Claude, approved by the user)

1. **Resizable track column.**
   - The default width goes from 224px to 264px.
   - A drag handle sits on the divider between the track column and the lanes. The cursor is `col-resize`, and the hairline brightens on hover.
   - Range is 200 to 420px. Double-clicking resets it, and the width is remembered in localStorage (inside try/catch).
2. **Separate the side panels from the full-width timeline.**
   - No blur. Use tone, gap and elevation instead.
   - The timeline sits on its own lower surface (`--bar`).
   - Between the side panels and the timeline there is a 6px gutter in `--backdrop`.
   - The side panels get rounded bottom corners (`--r-lg`) and a soft shadow downward, so they read as blocks sitting above the timeline.
   - The timeline header gets a hairline under it.
   - Check it in Paper and Dark.
3. **Dropdown choice must feel smooth.**
   - When a value is picked, the list shrinks back into the field on the same spring it opened with. It is one continuous retargeting surface, not a fade or close with a separate landing.
   - The chosen row stays highlighted while it shrinks.
   - The value lands with a single pop.
   - Remove any second animation that fights it (double transitions, a re-render mid-animation, or a flash).
   - Test it on the timeline's speed and fps dropdowns and on the inspector's dropdowns.
4. **Timeline header and ruler look good.**
   - **Buttons:** all 28px, with one icon size (16px), a 2px gap inside a group, and 12px plus a hairline divider between groups.
   - **Groups:** [timecode] · [start, prev-key, step-back] [**Play**] [step-fwd, next-key, end] [loop] · [Timeline | Graph] [select, split] [speed] [full width] [export] [`…`].
   - **Play button:** the primary control, 32px, filled with `--ctl` / `--ctl-fg`, and it springs on press.
   - **Timecode:** left-aligned to the track column width. 20px mono, with the total in `--muted`.
   - **Ruler:** 24px. Tick labels are 11px mono in `--muted`.
   - **Work area:** a calm 4px `--seg` bar at the top with small rectangular handles, not the heavy black bar it is now.
   - **Marker badges:** small and aligned, never overlapping the labels.
5. **Remove the avatar stack** (AP RK SM +2) from the canvas for now. Hide it, don't delete the code.
6. **Property rows must not blend into other layers.**
   - An expanded layer becomes one framed group: the header row plus its property rows. The label-colour strip runs down the whole group, and there is a thin tree guide line on the left of the property rows.
   - Property rows sit on a slightly inset background (`--panel` against the lane tone) across both the track column and the lanes, with an 8px gap and a hairline after the group.
   - The lanes of property rows are tinted very lightly in the layer's label tint, and the keyframe connector lines use the layer's strip colour.
   - The selected layer's group gets a subtle highlight band across the header and lanes.
   - The layer below starts clearly after the group's bottom hairline.
7. **More practical properties.**
   - **In the timeline:** each expanded layer ends with a "+ Add property" row at the bottom of its property list. It opens the property dropdown, grouped as Transform, Appearance and Layout.
   - **Right panel, layer selected:**
     - **Grouping:** properties are grouped into Transform (Position X/Y, Scale, Rotation), Appearance (Opacity, Blur, Colour) and Layout. Each group can be collapsed.
     - **Filtering:** a small search field and an "Animated only" toggle sit at the top.
     - **Each property row:** stopwatch, name, a value you can drag to change, the keyframe navigator ◀ ◆ ▶, and an easing chip (a tiny curve icon plus the name). Clicking the chip opens the easing editor.
     - **Expanding a row:** clicking it opens it inline, like an accordion. It shows that property's keyframe list (time, value, easing, all editable, each with delete) and the easing editor for the selected keyframe, all inside the row, instead of the big editor pinned above everything.
     - **Quick presets row:** Fade in, Slide up, Pop, Spin. Each applies keyframes at the playhead.
   - The keyframe inspector keeps the big editor, but it starts collapsed to 160px with an expand control.

## Done
- Open the file once in headless Playwright. Check there are no console errors in Paper and Dark, and that Design and Code modes still work.
- Take 1440×900 screenshots of the Motion page:
  - default
  - a layer expanded and selected
  - the right panel with a property expanded
  - the header close-up
- Save them in `DOCS/UI/design/tasks/shots-motion/`.
- Add a "## Report" to the end of this file: what you built, what you skipped, and decisions to review.

## Report

### 1. What was built
- **Resizable track column (Item 1)**:
  - Changed default `--hw` width from 224px to 264px.
  - Implemented `.hwsizer` drag handle sitting on the divider hairline with `col-resize` cursor and hairline brightening on hover.
  - Dragging dynamically resizes the track column clamped to 200–420px. Double-clicking resets to 264px.
  - State persisted in `localStorage['ll-tlhw']` with graceful fallback inside `try/catch`.
- **Panel separation and tone (Item 2)**:
  - Set `.app[data-mode=motion]` background to `var(--backdrop)`.
  - Placed timeline container, tracks, and header on lower surface tone `var(--bar)` with a crisp top hairline.
  - Added 6px gutter in `var(--backdrop)` between side panels and full-width timeline.
  - Applied rounded bottom corners (`--r-lg`), bottom border, and soft downward elevation shadow to `.left` and `.right` panels so they read as floating blocks above the timeline surface.
  - Verified across Paper and Dark themes.
- **Smooth dropdown choice (Item 3)**:
  - Overhauled `ddPick`: eliminated flying clone ghost text and competing timeout delays.
  - The list surface smoothly shrinks directly into the anchor field on its native spring (`s.shapeTo(f, f.r); s.Y.to = s.exitY; s.settleOrRun()`).
  - The chosen row remains highlighted (`.cur`, `.on`) while other rows gently fade and blur out.
  - Upon landing, the field value is applied and animates with a single crisp pop.
  - Tested on playback speed, FPS, and inspector dropdowns.
- **Timeline header and ruler (Item 4)**:
  - Standardized all buttons to 28px with 16px icons. Set 2px gap inside groups and 12px margin on hairline dividers (`.tdiv`).
  - Organized groups: `[timecode] · [start, prev-key, step-back] [Play] [step-fwd, next-key, end] [loop] · [Timeline | Graph] [select, split] [speed] [full width] [export] […]`.
  - Primary play button `#tplay.mplay` styled to 32px filled with `var(--ctl)` / `var(--ctl-fg)` with interactive spring response on press.
  - Left-aligned timecode to track column width (`width: calc(var(--hw) - 12px)`), 20px mono, with total time in `var(--muted)`.
  - Compacted ruler height to 24px with 11px mono labels in `var(--muted)`.
  - Restyled work area to calm 4px `var(--seg)` bar with small 5×8px rectangular handles.
  - Sized marker badges to compact 9px mono badges aligned to 5px height, preventing overlap with ruler labels.
- **Hidden avatar stack (Item 5)**:
  - Hidden `.fbar.fpeople` on canvas using CSS `display: none !important;` without removing code or event bindings.
- **Framed property groups (Item 6)**:
  - Wrapped each layer and its property rows into `.tlgrp`.
  - Layer label-color strip runs continuously down the entire group height via `.tlgrp::before`.
  - Added thin tree guide lines with branch connectors on property rows (`.tlrow.prp .tlhc::before` and `::after`).
  - Property rows sit on `var(--panel)` background across track column and lane against the `var(--bar)` timeline tone.
  - Property lanes are tinted lightly in layer label tint `var(--lt)`, and keyframe connector lines (`.kseg`) use layer label color `var(--lc)`.
  - Added 8px gap and hairline bottom border after open groups (`.tlgrp.open`).
  - Added subtle highlight band across header and lanes when the group is selected.
- **Practical properties & inspector accordion (Item 7)**:
  - Added "+ Add property" row at the bottom of expanded layer in timeline, opening grouped dropdown (Transform, Appearance, Layout).
  - Right panel layer inspector:
    - Collapsible property groups: Transform (Position X/Y, Scale, Rotation), Appearance (Opacity, Blur, Colour), Layout (Width, Height).
    - Top filter bar with live search input and "Animated only" toggle.
    - Each property row features: stopwatch toggle, property name, live draggable readout value (`scrubVal` adds track if not yet created), navigator ◀ ◆ ▶, and easing chip with curve icon and easing name.
    - Inline accordion: clicking property name or easing chip expands that property's row inline, showing editable keyframe list (time, value, easing, delete) and inline interactive easing editor (`easeBody`).
    - Quick presets row: Fade in, Slide up, Pop, Spin applying keyframes at the playhead.
    - Removed pinned big easing editor from the top of the layer inspector.
  - Keyframe inspector curve editor starts collapsed to 160px with expand/collapse toggle.

### 2. What was skipped
- Nothing was skipped. All 7 design direction items and sub-requirements were completed and verified.

### 3. Decisions to review
- **Auto-create on scrub / watch**: In the right panel, scrubbing the value or clicking the stopwatch of an un-animated property automatically instantiates the track and inserts a keyframe at the playhead, streamlining workflow.
- **Easing chip trigger**: Clicking either the property name or the easing chip opens the inline accordion; clicking the chip focuses directly on the keyframe's easing curve controls.
- **Search filtering behavior**: Filter input matches property names live within groups; empty non-matching groups are hidden while search is active.

### 4. Verification and screenshots
- Verified with headless Chrome via Playwright:
  - 0 console errors and 0 page errors across Paper and Dark themes in Design, Motion, and Code modes.
  - Track column resizing, localStorage persistence, and double-click reset verified.
  - Smooth dropdown retargeting without competing animations verified.
- Captured 4 screenshots (1440×900) in `DOCS/UI/design/tasks/shots-motion/`:
  - `default.png`: default Motion page
  - `layer-expanded-selected.png`: timeline with expanded selected layer and property groups
  - `property-expanded.png`: right panel with property accordion expanded (keyframe list and inline easing editor)
  - `header-closeup.png`: close-up of polished timeline header and ruler

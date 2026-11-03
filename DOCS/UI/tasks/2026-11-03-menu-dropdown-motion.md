# Task: port the approved menu and dropdown motion to the app

- **Given by:** Claude, 2026-11-03. **Area:** `menus` and `design-system` (Phase 1).
- **Goal:** the app's `Menu`, `SubMenu`, `ContextMenu`, `Popover` and `Select` components (in `src/editor/components/`) move and behave exactly like the prototype's menus and dropdowns, which the user chose. Change only these components, the motion module and their design-system demos.

## Read only these

- **Prototype:** `DOCS/UI/design/editor-design-mode-blocks-dark.html`, script lines ~1395-2050 (engine, `Surf`, `surf`, `wheelAttach`, highlight `hl*`, `surfOpen`, `applyFeel`, dropdowns from the "===== Dropdowns" comment: `rowHTML`, `ddScrollTo`, `setAct`, `bulge`, `ddOnScroll`, `land`, `ddRoll`, `openMenu`) and ~2310-2375 (submenu `placeSub`, `openSub`, `swapSub`, `closeSub`, `popRow`, `mark`, `wiggle`). Also the CSS for `.menu`, `.ll-lay`, `.ll-hl`, `#sub` and `.dd-*`. Skip the rest of the file.
- **Your targets:** `src/editor/motion/*`, and `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx` in `src/editor/components/`, plus their demos in `src/editor/design-system/`.

## Behaviour to port (copy values from the prototype, do not tune)

1. **Menus:** the surface morphs out of its trigger (context menus start from a small rect at the pointer) on the bouncy springs.
   - Rows pop in with a stagger and blur. The hovered icon wiggles.
   - One highlight springs between rows and stretches a little.
   - Pressing a row scales it to 0.97. Choosing an item pops the row, runs the action immediately, and the menu shrinks back into its trigger.
   - The wheel bump (`endBump`) has a lock.
2. **Submenus:** one side flyout surface per menu, which flips left when there is no room.
   - It grows out of the parent row.
   - Moving from File to Edit to View retargets the same surface (keeping velocity) to the new row and size, while the content swaps with a slide, fade and blur.
   - Hovering a plain row shrinks it away.
   - Safe triangle. Delays: open 80 ms, switch 60 ms, close 200 ms.
3. **Blur:** on content only, never on the surface. It runs on its own eased animation, never on the spring.
4. **Dropdowns (`Select`):** the field morphs into the list with the current row exactly over the field.
   - A chosen value flies into the field and lands with a pop. The check moves.
   - The chevron nudges on hover and flips on open. The field presses to 0.97 and the focus ring springs in.
   - Long lists: momentum scroll, the edge bump, and the **bulge** (rows near the edges scale to about 0.92, fade, and get a slight blur in the top and bottom 24 px; stronger while flicking fast), and type-ahead.
   - Optional search row with blur-out and a FLIP of the remaining rows.
   - A closed field with ArrowUp or ArrowDown rolls the value like an odometer.
   - The one-time Mixed shimmer.
5. **Feel:** Smooth, Lively and Bouncy, with **Bouncy now the default**, as in the prototype's `applyFeel`. Keep Nook's values in `presets.ts`. Put the prototype's playful-specific values next to them.
6. **Keyboard and reduced motion:** as in the prototype (arrows, Right and Left for submenus, Enter, Escape closes the submenu first, focus returns to the trigger; `listbox`/`option` roles for Select). Reduced motion means opacity fades only.

## Rules that matter here

- React must never own the classes or styles that the motion code writes on an element. Use a wrapper or data attributes.
- Never read browser-only values on the first render, to avoid a hydration mismatch.
- Use `ll:` classes and tokens only: no arbitrary values, no hex colors, no px constants, and every icon through `Icon`.
- Don't edit `src/core`, `src/legacy-editor` or config files. Add no dependencies. Don't bulk-reformat files.

## Design system page

The menu demo must show the logo menu with File, Edit and View submenus, a right-click area, a short Select, and a long font Select with 30 fonts and search, so the bulge can be tested.

## Done

- Run `npx tsc --noEmit` once at the end. Paste its output in the handoff.
- Take screenshots at 1440 only: the menu with a submenu open, and the long Select scrolled. Put them in `DOCS/UI/handoffs/screenshots/menu-dropdown-motion/`.
- Write a handoff from `TEMPLATE.md`. Don't commit.

## Also fix (from the core components review)

1. The parent menu shrinks from 244 px to about 185 px when a submenu opens, which leaves a gap of about 55 px. The parent keeps its width, and the submenu is placed from the parent's real edge.
2. `Popover.tsx:91-106` hardcodes `8`, `280` and `320`, and `Menu.tsx` has `4` offsets and fallback sizes (`:225-229`, `:245`, `:247`, `:768-780`). Use tokens, or read the values from the DOM.
3. `Menu.tsx:799` `setTimeout(…, 50)`: use a frame callback through the motion loop.
4. Remove the 0.6 dim on the other parent rows while a submenu is open (`animations.css:101-104`). It fails the contrast check, and the prototype doesn't do it.
5. `INTEGRATION.md`: mark the old "Imported candidate packages and components (as-is)" entry as removed. The `imported/` folder is gone.

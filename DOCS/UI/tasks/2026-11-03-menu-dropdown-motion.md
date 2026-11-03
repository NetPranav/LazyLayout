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

## Retry 1: review failed (2026-11-03)

The motion works well: the morph, the single retargeting submenu, the bulge, search and the odometer. Fix these, and edit only `Menu.tsx`, `Select.tsx`, `Popover.tsx`, `animations.css`, `presets.ts` and `ComponentDemos.tsx`:

1. **Lint must be clean.** Run `npx eslint src/editor` once at the end. Errors to fix: refs read during render, setState in an effect, and prefer-const (`Select.tsx:186,198,205,215`; `Menu.tsx:156,478,558,656,717`). Also the unused `mounted` (`Select.tsx:92`) and the extra `options` dependency (`:369`).
2. `Select.tsx:269`: raw `requestAnimationFrame` is banned. Use the motion loop (`defaultHost` / `frameScheduler`).
3. **The Select field is broken.** `.dd-f { all: unset }` (`animations.css:137-145`) is unlayered and beats Tailwind, so the field has no border, background or padding (15.6 px tall). The focus ring (`:120`) wraps the label. Make the field look like the prototype's select field at row height.
4. `Select.tsx:810`: React `onWheel` is passive, so attach a native wheel listener with `{ passive: false }`. There should be no console warning.
5. Left or Escape in a submenu must put focus back on the parent row, not on `BODY` (`Menu.tsx` `closeSub` and its key handler).
6. **React must not own classes that the motion code writes.** Keep the classNames static at `Menu.tsx:727,938` and `Select.tsx:733,834-836`, and use data attributes for `subopen`, `cur`, `open`, `kb` and `flip`.
7. **No px or duration constants in CSS** (`animations.css:86-92,108,131,166,180-290`). Use the `--ll-spacing-*`, `--ll-text-*`, `--ll-size-*` and `--ll-dur-*` tokens, adding tokens where one is missing.
8. **No magic numbers in TS:** `Menu.tsx:105` (`- 4`), `:289` (`120`), and the `|| 8 / 4 / 248 / 320 / 200 / 6` fallbacks (`Menu.tsx:87,93,337,397-422,454`; `Popover.tsx:83,89,100`). Read the values from tokens, or put them in one named constant block in `presets.ts`.
9. `ComponentDemos.tsx:694`: `md:ll:grid-cols-2` must be `ll:md:grid-cols-2`.
10. `presets.ts`: restore Nook's `rows`, `stagger`, `lock`, `endBump` and `rowScale`, and put the playful values in a separate object beside them.
11. Small items: remove the module-level `window` mousemove listener, or add and remove it while a menu is open (`Menu.tsx:35-50`). Make `id="sub"` unique per menu (`Menu.tsx:742`), and prefix global class names with `ll-`.
12. Set `menus` in `PARITY.md` back to `wip`. Add a "Retry 1" section to the handoff with the `tsc` and `eslint` output.

## Retry 2: last retry (2026-11-03)

Lint and typecheck are clean now, and focus, the bulge, search and the odometer work. Fix these:

1. **The playful feel is not in use.** `PLAYFUL_PRESETS` (`presets.ts:131`) is never used, so the menus run on plain Nook values. Wire it in: the Bouncy feel, which is the default, uses the playful values for every menu, submenu, popover and Select surface, exactly as the prototype's `applyFeel` does. Smooth and Lively stay calmer.
2. **The Select field is still 17.6 px tall.** Remove the unlayered `.dd-f { height: 100% }` (`animations.css:148-152`) so the field is row height (`--ll-size-row-h`). Remove the conflicting duplicate `ll:px-*` (`Select.tsx:792,827`). Check that the value text uses the prototype's font (it renders in mono now), then take a screenshot and LOOK at it.
3. `Select.tsx:827`: change `hover:ll:border-text-muted` to `ll:hover:border-text-muted`. Check every file for `hover:ll:`, `focus:ll:`, `md:ll:` and `group-hover:ll:`, since the variant always goes after `ll:`.
4. `Menu.tsx:757`: use `useId()` for menu and submenu ids, so no two menus share an id.
5. **No literals:** the `120` at `Popover.tsx:148` and `Select.tsx:287,530`, `width = 248` at `Popover.tsx:33`, `|| 11` at `Select.tsx:501`, the seeds `{ w: 32, h: 32 }` and `16` at `Menu.tsx:441,457` and `Popover.tsx:93`, the `45` ms throttle at `Menu.tsx:688`, and `outline: 2px` at `animations.css:73`. Move them into `MENU_FALLBACKS` or tokens.
6. **Prefix every global class and id with `ll-`** in `animations.css` and in the code that writes them: `.menu`, `.vpop`, `.ppop`, `.ins`, `.open`, `.kb`, `.ctx`, `.dfield`, `.dd-*`, `.ddl`, `.gone`, and the `kb`, `on` and `open` class writes (`Menu.tsx:375,603`; `Select.tsx:404,641-643`). Delete the dead `#sub` selectors (`animations.css:94,111`) and the redundant `classList` writes of `subopen` and `flip` (`Menu.tsx:218,259,287,337`), since the data attributes replace them. Give `data-subopen` and `aria-expanded` one owner only.
7. Add a "Retry 2" section to the handoff with the real `tsc` and `eslint` output.

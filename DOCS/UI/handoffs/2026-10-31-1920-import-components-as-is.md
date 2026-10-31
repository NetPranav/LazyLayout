# Handoff: Import Candidate Components As-Is

- **Date / time:** 2026-10-31 19:20 IST
- **Worker:** Antigravity
- **Branch:** ui/redesign
- **Page / phase:** Phase 1 (Component Import As-Is)
- **Task given by:** `DOCS/UI/tasks/2026-10-31-import-components-as-is.md`

## What changed
- `src/editor/components/imported/squish-switch/SquishSwitch.tsx`: Imported SquishSwitch as-is from React Bits with first-line comment `// Imported as-is from React Bits. Not yet adapted to the design system.`.
- `src/editor/components/imported/scrub-field/ScrubField.tsx`, `ScrubField.css`: Imported ScrubField and its vanilla CSS as-is from React Bits with first-line comments.
- `src/editor/components/imported/elastic-slider/ElasticSlider.tsx`, `ElasticSlider.css`: Imported ElasticSlider and its vanilla CSS as-is from React Bits with first-line comments.
- `src/editor/components/imported/cursor/index.ts`: Re-exported Cursor primitives (`Cursor`, `CursorContainer`, `CursorFollow`, `CursorProvider`, `useCursor`) from `@animate-ui/react/primitives/cursor`.
- `src/editor/components/imported/avatar-group/index.ts`: Re-exported AvatarGroup primitives (`AvatarGroup`, `AvatarGroupTooltip`, `AvatarGroupTooltipArrow`) from `@animate-ui/react/primitives/avatar-group`.
- `src/editor/components/imported/tooltip/index.ts`: Re-exported Tooltip primitives (`Tooltip`, `TooltipArrow`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`, `useGlobalTooltip`, `useTooltip`) from `@animate-ui/react/primitives/tooltip`. Co-exists alongside Lazy Layout's approved `src/editor/components/Tooltip.tsx`.
- `src/editor/components/imported/select/index.ts`: Re-exported Select primitive from `@animate-ui/react/primitives/base-ui/select`.
- `src/editor/components/imported/menubar/index.ts`: Re-exported Menubar and Menu primitives from `@animate-ui/react/primitives/base-ui/menubar` and `@animate-ui/react/primitives/base-ui/menu`.
- `src/editor/components/imported/dropdown-menu/index.ts`: Re-exported Menu primitive from `@animate-ui/react/primitives/base-ui/menu`.
- `src/editor/components/imported/context-menu/index.ts`: Re-exported ContextMenu primitive from `@animate-ui/react/primitives/base-ui/context-menu`.
- `src/editor/components/imported/scroll-fade/index.ts`: Re-exported ScrollFade primitives (`ScrollFade`, `useScrollFade`) from `@animate-ui/react/primitives/effects/scroll-fade`.
- `src/editor/components/imported/unlumen-ui/file-tree.tsx`, `src/editor/components/imported/file-tree/index.ts`: Imported File Tree component from Unlumen UI registry item with inlined `cn` utility function.
- `src/editor/design-system/DesignSystemPage.tsx`: Added new right-panel navigation group **Imported (as-is)** containing all 12 candidate component items, hash routing support (`#imported-...`), keyboard navigation traversal, and individual demo canvases based directly on the paste usage examples.
- `DOCS/UI/COMPONENT_SOURCES.md`: Added rows for all 12 candidate components (name, source URL, license as stated or unverified, path, and changes).
- `DOCS/UI/DECISIONS.md`: Logged "imported as-is, no restyling" and "packages installed with legacy-peer-deps" as decided by the user.
- `DOCS/UI/INTEGRATION.md`: Added "Imported candidate packages and components (as-is)" entry to Section 4.

## Decisions made
- "imported as-is, no restyling" (decided by user, approved)
- "packages installed with legacy-peer-deps" (decided by user, approved)
- Inlined `cn` helper in `file-tree.tsx` as the smallest TypeScript fix because `@/lib/utils` does not exist in the codebase and modifying outside `src/editor` was off-limits.
- Provided fallback SVG `ArrowIcon` in `CursorDemo` because the usage snippet did not import or define `ArrowIcon`.
- Kept Lazy Layout's existing approved `Tooltip.tsx` untouched; imported Tooltip primitive is isolated under `imported/tooltip/`.

## Components from other sites
- `SquishSwitch`: React Bits (`https://reactbits.dev`), unknown / unverified, copied to `src/editor/components/imported/squish-switch/SquishSwitch.tsx`, no changes.
- `ScrubField`: React Bits (`https://reactbits.dev`), unknown / unverified, copied to `src/editor/components/imported/scrub-field/ScrubField.tsx` & `ScrubField.css`, no changes.
- `ElasticSlider`: React Bits (`https://reactbits.dev`), unknown / unverified, copied to `src/editor/components/imported/elastic-slider/ElasticSlider.tsx` & `ElasticSlider.css`, no changes.
- `Cursor`: Animate UI (`https://animate-ui.com/docs/primitives/animate-ui/cursor`), unknown / unverified, copied to `src/editor/components/imported/cursor/index.ts`, no changes.
- `Avatar Group`: Animate UI (`https://animate-ui.com/docs/primitives/animate-ui/avatar-group`), unknown / unverified, copied to `src/editor/components/imported/avatar-group/index.ts`, no changes.
- `Tooltip`: Animate UI (`https://animate-ui.com/docs/primitives/animate-ui/tooltip`), unknown / unverified, copied to `src/editor/components/imported/tooltip/index.ts`, no changes.
- `Select`: Base UI / Animate UI (`https://animate-ui.com/docs/primitives/base-ui/select`), unknown / unverified, copied to `src/editor/components/imported/select/index.ts`, no changes.
- `Menubar`: Base UI / Animate UI (`https://animate-ui.com/docs/primitives/base-ui/menubar`), unknown / unverified, copied to `src/editor/components/imported/menubar/index.ts`, no changes.
- `Dropdown Menu`: Base UI / Animate UI (`https://animate-ui.com/docs/primitives/base-ui/dropdown-menu`), unknown / unverified, copied to `src/editor/components/imported/dropdown-menu/index.ts`, no changes.
- `Context Menu`: Base UI / Animate UI (`https://animate-ui.com/docs/primitives/base-ui/context-menu`), unknown / unverified, copied to `src/editor/components/imported/context-menu/index.ts`, no changes.
- `Scroll Fade`: Animate UI (`https://animate-ui.com/docs/primitives/animate-ui/scroll-fade`), unknown / unverified, copied to `src/editor/components/imported/scroll-fade/index.ts`, no changes.
- `File Tree`: Unlumen UI (`https://unlumen.com/docs/components/file-tree`), unknown / unverified, copied to `src/editor/components/imported/unlumen-ui/file-tree.tsx` & `src/editor/components/imported/file-tree/index.ts`, inlined `cn` helper; no other changes.

## Legacy behaviour dropped
- none

## Tokens / palette touched
- none (imported components retain raw hex/unprefixed styles as instructed for as-is import)

## Integration notes added
- `Imported candidate packages and components (as-is)` added to `DOCS/UI/INTEGRATION.md` under Section 4.

## Detailed rendering analysis (Task Rule 5)

1. **SquishSwitch (`squish-switch`)**
   - *What renders:* The toggle switch button and track render. Motion spring physics and dragging/clicking interactions work correctly (thumb stretches and smoothly animates across min/max bounds).
   - *What looks broken:* Unprefixed Tailwind utilities (`inline-flex`, `items-center`, `gap-2.5`, `border-0`, `bg-transparent`, `p-0`, `outline-none`) do not take effect because our Tailwind only generates `ll:` classes. Default button margins and borders appear slightly unstyled, though CSS custom properties (`--ss-w`, `--ss-h`, `--ss-r`, `--ss-track`, etc.) successfully drive the track and thumb dimensions and colors.
   - *Why:* Component relies on unprefixed Tailwind v3/v4 classes that are not processed by Lazy Layout's scoped `ll:` Tailwind build.

2. **ScrubField (`scrub-field`)**
   - *What renders:* The chip surface, label, numeric spinbutton input, suffix, and dragging/scrubbing mechanics render and function because styles are defined in dedicated `ScrubField.css`.
   - *What looks broken:* The ghost delta badge renders as a capsule/pill (`border-radius: 999px`) in dark-theme hardcoded colors (`#27272a` chip, `#f5f5f5` accent).
   - *Why:* Vanilla CSS was imported as-is and uses hardcoded hex colors and 999px pill shapes from React Bits rather than design system tokens.

3. **ElasticSlider (`elastic-slider`)**
   - *What renders:* The slider track, thumb, volume icons (`VolumeLowIcon`, `VolumeHighIcon`), and spring elastic rubber-banding physics render and function because styles are bundled in `ElasticSlider.css`.
   - *What looks broken:* The track and thumb have pill/capsule radii (`border-radius: 999px`). The floating bubble indicator displays with a dark background and heavy drop shadow.
   - *Why:* Vanilla CSS was imported as-is without adaptation to Lazy Layout's rectangular radii and neutral palette tokens.

4. **Cursor (`cursor`)**
   - *What renders:* The cursor follower badge and container boundary render inside the demo area.
   - *What looks broken:* Unprefixed Tailwind classes (`relative`, `h-72`, `w-full`, `border-dashed`) in the demo container and primitive lack Tailwind spacing and layout rules; the follower badge text renders without styled background or padding classes (`text-xs`, `px-2`, `py-0.5`).
   - *Why:* Unprefixed Tailwind classes are ignored by Lazy Layout's `ll:` prefixed Tailwind compiler.

5. **Avatar Group (`avatar-group`)**
   - *What renders:* Avatar images and the fallback text avatar render.
   - *What looks broken:* Images do not overlap with negative space (`-space-x-3` missing); circular clipping does not apply (`rounded-full` missing); avatars lack sizing (`size-12` missing), causing raw image sizes to dictate layout.
   - *Why:* Component relies completely on unprefixed Tailwind utility classes (`h-12`, `-space-x-3`, `size-12`, `rounded-full`, `border-3`, `border-background`).

6. **Tooltip (`tooltip`)**
   - *What renders:* Trigger buttons ("B", "I") render. On hover and focus, Floating UI positions the popup overlay.
   - *What looks broken:* `rounded-md`, `bg-foreground`, `px-3`, `py-1.5`, `text-xs`, `text-background` classes do not apply, leaving popup unstyled or transparent with black text unless base styles apply.
   - *Why:* Popup container and arrow rely entirely on unprefixed Tailwind classes and standard shadcn color tokens (`bg-foreground`, `text-background`) that do not exist in Lazy Layout.

7. **Select (`select`)**
   - *What renders:* Trigger button with value ("Geist") and icon indicator. Clicking opens the popup listbox with option items.
   - *What looks broken:* Dropdown popup lacks background, padding, and border styles (`bg-neutral-0`, `p-1`, `border`, `shadow-soft`); items lack hover background highlighting (`hover:bg-neutral-100`); popup positioner is unstyled.
   - *Why:* Animate UI Base UI Select relies on Tailwind utility classes and theme tokens (`bg-accent`, `focus:bg-accent`) for layout and compositor highlight.

8. **Menubar (`menubar`)**
   - *What renders:* Menubar bar and triggers ("File", "Edit") render. Clicking triggers opens the popup menu with items ("New file", "Save", "Undo", "Redo").
   - *What looks broken:* The menubar container lacks rounded border and padding; the dropdown menus render without solid surface background, hairline border, or hover highlights; popover handover animation between menus lacks CSS variable styling.
   - *Why:* Base UI Menubar and Menu primitives rely on unprefixed Tailwind classes (`p-1`, `border`, `rounded`, `shadow-soft`, `hover:bg-neutral-100`).

9. **Dropdown Menu (`dropdown-menu`)**
   - *What renders:* "Account" trigger button renders and opens popup with "Profile", "Billing", separator, "Log out".
   - *What looks broken:* Popup appears without background, rounded corners, or shadows; items lack padding and hover states; separator lacks hairline border styling.
   - *Why:* Unprefixed Tailwind classes in demo and primitive (`p-1`, `border`, `rounded`, `shadow-soft`, `h-px`, `my-1`) do not compile.

10. **Context Menu (`context-menu`)**
    - *What renders:* Dashed right-click target area renders. Right-clicking anywhere within the target opens the ContextMenu popup with items.
    - *What looks broken:* Target area and popup menu lack padding, border, and background styling; items appear unstyled without hover highlight; separator does not show.
    - *Why:* Relies on unprefixed Tailwind classes that are ignored by the `ll:` prefixed compiler.

11. **Scroll Fade (`scroll-fade`)**
    - *What renders:* Scrollable list of changelog items renders and can be scrolled.
    - *What looks broken:* `mask-image` fade effect relies on CSS variables written by Motion values (`--scroll-fade-top`, `--scroll-fade-bottom`) and unprefixed utility classes (`h-64`, `overflow-y-auto`). Without explicit height in `ll:`, overflow scrolling must rely on container constraints.
    - *Why:* Unprefixed classes (`h-64`) do not apply, and blur/shrink effects during scroll violate look rules (to be adapted in subsequent tasks).

12. **File Tree (`file-tree`)**
    - *What renders:* Hierarchical folder/file tree renders with expand/collapse toggle interaction and folder icons (`Folder`, `FolderOpen`, `FileCode`, `FileJson`).
    - *What looks broken:* Unprefixed classes (`p-2`, `gap-2`, `rounded-xl`, `border-border/60`, `bg-accent/55`) do not style the container or row hover highlight box; pink highlight color (`#f472b6`) violates the neutral palette; lines connecting folders rely on `before:w-px` unprefixed classes.
    - *Why:* Unprefixed Tailwind classes do not apply under `ll:` prefix, and upstream component hardcodes pink accent color and rounded-xl pill/bubble aesthetics.

## Smallest compile fixes (Task Rule 7)
- `src/editor/components/imported/unlumen-ui/file-tree.tsx`: Inlined `const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");` to resolve missing `@/lib/utils` without creating files outside `src/editor`.
- `CursorDemo` in `DesignSystemPage.tsx`: Defined inline SVG `ArrowIcon` because the usage paste omitted its import/definition.
- All other 11 components compiled directly without requiring any type modifications or behavior changes.

## Not done / blocked
- none

## Phase checks
- typecheck: not run (speed rules: mid-phase, no full checks)
- lint: not run (speed rules: mid-phase, no full checks)
- build: not run (speed rules: mid-phase, no full checks)
- Playwright: passed (captured 12/12 component demo screenshots at 1440px wide using installed Chrome `channel: "chrome"`)

## Screenshots
- `DOCS/UI/handoffs/screenshots/imported-as-is/squish-switch.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/scrub-field.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/elastic-slider.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/cursor.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/avatar-group.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/tooltip.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/select.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/menubar.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/dropdown-menu.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/context-menu.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/scroll-fade.png`
- `DOCS/UI/handoffs/screenshots/imported-as-is/file-tree.png`

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):

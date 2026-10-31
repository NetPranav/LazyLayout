# Component Inbox Analysis

Analysis of the 12 candidate components collected in [`DOCS/UI/component-inbox/INBOX.md`](file:///e:/Projects/magnm%20related/lazy%20layout/DOCS/UI/component-inbox/INBOX.md) against the requirements of [`DOCS/UI/UI_RULES.md`](file:///e:/Projects/magnm%20related/lazy%20layout/DOCS/UI/UI_RULES.md), [`DOCS/UI/PALETTE.md`](file:///e:/Projects/magnm%20related/lazy%20layout/DOCS/UI/PALETTE.md), and [`DOCS/UI/PARITY.md`](file:///e:/Projects/magnm%20related/lazy%20layout/DOCS/UI/PARITY.md).

---

## 1. Executive Summary

- **Total components analyzed:** 12 components across 3 sources:
  1. **React Bits** (3 components: `SquishSwitch`, `ScrubField`, `ElasticSlider`)
  2. **Animate UI / Base UI** (8 components: `Cursor`, `Avatar Group`, `Tooltip`, `Select`, `Menubar`, `Dropdown Menu`, `Context Menu`, `Scroll Fade`)
  3. **Unlumen UI** (1 component: `File Tree`)
- **License compliance (`UI_RULES.md` §5):**
  - In the pasted text alone, no component states an explicit open-source license name (only generic phrases such as "open-source React component"). Under strict reading of `UI_RULES.md` §5, all are technically "unknown" in the pasted markdown.
  - Upstream repository verification confirms:
    - **React Bits** (`DavidHDev/react-bits`): MIT with Commons Clause (free for personal & commercial apps/products; cannot be resold as standalone component kits/templates).
    - **Animate UI** (`imskyleen/animate-ui`): MIT with Commons Clause (free for personal & commercial apps/products; cannot be resold as standalone component kits).
    - **Base UI** (`@base-ui/react`): MIT License.
    - **Unlumen UI** (`leovvx/unlumen-ui-docs` / registry): MIT License for public/free primitives.
  - None of the components have restrictive GPL or proprietary locks that prevent usage in Lazy Layout, provided the user approves the MIT + Commons Clause scope.
- **Dependency compliance (`UI_RULES.md` §5):**
  - **Installed packages:** `"motion": "^13.4.3"`, `"lucide-react": "^1.41.0"`, `"gsap": "^3.15.0"`, `"three": "^0.186.1"`, `"tailwindcss": "^4.3.3"`.
  - **Uninstalled packages (cannot be installed):** `@hugeicons/*`, `@animate-ui/*`, `@base-ui/*`, `@floating-ui/*`, `@unlumen-ui/*`.
  - Every viable component can and must be rewritten as a clean, in-tree component inside `src/editor/components/` using only the installed stack.
- **Visual & motion rule compliance (`UI_RULES.md` §1, §6, §7):**
  - **Pills / capsules banned (§1):** Multiple components default to pills (`border-radius: 999px` or `rounded-full` in SquishSwitch, ScrubField delta pill, ElasticSlider track/thumb, AvatarGroup, FileTree hover). All must be rewritten to rectangular shapes with modest radii (2px to 6px) and concentric geometry.
  - **Blur banned (§1, §7):** Animate UI components heavily employ 2px–6px blurs during transitions (Select, Menubar, Dropdown, Context Menu, Scroll Fade). All blur filters must be stripped completely, restricting animation strictly to `transform` and `opacity`.
  - **Colors restricted (§6):** Hardcoded dark-mode hex values (`#27272a`), pink highlights (`#f472b6`), and arbitrary `color-mix` values must be replaced exclusively with `PALETTE.md` tokens (`--ll-neutral-*`, `--ll-border-color`).
  - **Tailwind class prefix (§6):** All classes must use the `ll:` prefix.
- **Verdicts summary:**
  - **`use as is`:** 0 components (none satisfy the `ll:` prefix, palette token, and pill/blur bans out of the box).
  - **`use after restyle`:** 0 components (all require structural or dependency rewrites).
  - **`use after rewrite`:** 11 components (`SquishSwitch`, `ScrubField`, `ElasticSlider`, `Cursor`, `Avatar Group`, `Select`, `Menubar`, `Dropdown Menu`, `Context Menu`, `Scroll Fade`, `File Tree`).
  - **`skip`:** 1 component (`Tooltip` — redundant with existing approved `src/editor/components/Tooltip.tsx`).

---

## 2. Detailed Component Analyses

### 2.1. SquishSwitch
- **Source and license:**
  - *Source:* React Bits ([reactbits.dev](https://reactbits.dev)).
  - *Pasted text license:* Not explicitly stated (states "open-source React component"). Technically **unknown** in pasted text.
  - *Upstream license:* MIT with Commons Clause (`DavidHDev/react-bits`). Usable in software applications; cannot be redistributed as a standalone UI library. Requires user approval.
- **Dependencies:**
  - *Required:* `motion` (`motion/react`).
  - *Installed in `package.json`:* **Yes** (`"motion": "^13.4.3"`).
  - *Missing packages:* None.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS + inline CSS custom properties.
- **Fit with our rules:**
  - *Shapes:* Default `radius={19}` and `height={38}` creates a pill/capsule track with round circular thumb. **Violates §1** ("No capsule or pill shapes... Use rectangular shapes with modest radii"). Must be rewritten with modest rectangular concentric radii (e.g. 6px outer track radius, 2px padding, 4px inner thumb radius).
  - *Colors:* Defaults use hardcoded dark hex values (`trackColor="#27272a"`, `trackOnColor="#f5f5f5"`, and `color-mix(...)`). **Violates §6**. Must use tokens from `PALETTE.md`: active track black (`--ll-neutral-1000`) with white thumb (`--ll-neutral-0`); inactive track `--ll-neutral-200` with hairline border (`--ll-border-color`) and dark thumb (`--ll-neutral-800`).
  - *Classes:* Tailwind classes lack `ll:` prefix. Must be converted (e.g. `ll:inline-flex`, `ll:items-center`).
  - *Animation:* Animates `x`, `scaleX`, `scaleY` (pure `transform`) and CSS `background-color`. Complies with §7 (transform-only motion).
  - *Accessibility & reduced motion:* Integrates `useReducedMotion()` cleanly (disables stretch and spring, snaps instantly). Has `role="switch"`, `aria-checked`, `aria-disabled`, `aria-label`, click and keyboard support. Needs visible focus ring (`ll:focus-visible:ring-2 ll:focus-visible:ring-neutral-1000 ll:focus-visible:ring-offset-2`).
- **Where it fits in Lazy Layout:**
  - Boolean property switches in `panels/details` (e.g. Auto Layout toggle, Clip Content, Lock Aspect Ratio, Layer Visibility, Snapping) and settings toggles in `panels/settings`.
  - *Parity area:* `panels/details`, `panels/settings`, `foundations` / `design-system`.
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Replace pill geometry with concentric rectangular radii; map colors to `PALETTE.md` light tokens; add `ll:` Tailwind prefixes; add accessible focus ring; enforce light-mode default.
- **Effort:** Medium.

---

### 2.2. ScrubField
- **Source and license:**
  - *Source:* React Bits ([reactbits.dev](https://reactbits.dev)).
  - *Pasted text license:* Not explicitly stated (states "open-source React component"). Technically **unknown** in pasted text.
  - *Upstream license:* MIT with Commons Clause (`DavidHDev/react-bits`). Requires user approval.
- **Dependencies:**
  - *Required:* `motion` (`motion/react`).
  - *Installed in `package.json`:* **Yes** (`"motion": "^13.4.3"`).
  - *Missing packages:* None.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, accompanied by standalone `ScrubField.css`.
- **Fit with our rules:**
  - *Shapes:* Delta indicator badge (`.scrub-field__ghost`) uses `border-radius: 999px;` (pill shape). **Violates §1**. Must be rewritten to a 4px modest rectangular badge (`--ll-radius-sm`).
  - *Colors:* Uses dark-mode hardcoded hex values (`--sf-accent: #f5f5f5; --sf-chip: #27272a; --sf-ghost-ink: #111111;`) and arbitrary opacity mixes. **Violates §6**. Must map to `PALETTE.md`: chip background `--ll-neutral-0` (raised surface on `--ll-neutral-200` panel), hairline border `--ll-border-color`, primary text `--ll-neutral-1000`, secondary label `--ll-neutral-800`, ghost delta pill converted to solid black rectangle (`--ll-neutral-1000`) with white text (`--ll-neutral-0`).
  - *Classes:* Standalone BEM CSS file must be replaced with `ll:` Tailwind utility classes or scoped CSS variables using `--ll-` tokens.
  - *Animation:* Animates `scale`, `transform`, and `opacity`. Fill indicator uses `scaleX` (pure `transform`). Complies with §7.
  - *Accessibility & reduced motion:* Strong accessibility foundations: `role="spinbutton"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, handles arrow keys (Up, Down, Shift coarse ×10, Alt fine ×0.1, PageUp, PageDown, Home, End), and switches to inline text typing on single click. Supports `prefers-reduced-motion`.
- **Where it fits in Lazy Layout:**
  - Indispensable numeric scrubbing control across the inspector: X, Y, Width, Height, Corner Radius, Rotation, Opacity, Padding, Gap, Font Size, Line Height, Letter Spacing in `panels/details`; and keyframe/bezier values in `panels/curves` and `panels/sequencer`.
  - *Parity area:* `panels/details`, `panels/curves`, `panels/sequencer`.
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Eliminate 999px pill ghost badge (replace with 4px rectangle); convert separate CSS file into `ll:` Tailwind classes; map colors to `PALETTE.md` tokens; preserve scrub interaction and keyboard/modifier logic.
- **Effort:** Medium.

---

### 2.3. ElasticSlider
- **Source and license:**
  - *Source:* React Bits ([reactbits.dev](https://reactbits.dev)).
  - *Pasted text license:* Not explicitly stated ("open-source React component"). Technically **unknown** in pasted text.
  - *Upstream license:* MIT with Commons Clause (`DavidHDev/react-bits`). Requires user approval.
- **Dependencies:**
  - *Required:* `@hugeicons/react`, `@hugeicons/core-free-icons`.
  - *Installed in `package.json`:* **No** (neither package is installed).
  - *Can be rewritten without missing packages:* **Yes**. Replace `@hugeicons` with `lucide-react` (already installed: `"lucide-react": "^1.41.0"`) or accept generic `ReactNode` icon props.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, separate `ElasticSlider.css`, internal spring physics loop via `requestAnimationFrame`.
- **Fit with our rules:**
  - *Shapes:* Track has `border-radius: 999px;`, thumb has `border-radius: 999px;`, ticks have `border-radius: 999px;`. **Violates §1** ("No capsule or pill shapes... Use rectangular shapes with modest radii"). Must use rectangular track (2px or 4px radius) and rectangular/square thumb (4px radius).
  - *Colors:* Hardcoded colors, arbitrary `color-mix`, heavy drop shadows (`rgba(0,0,0,0.28)`). **Violates §6**. Must use `PALETTE.md` tokens: track `--ll-neutral-200`, fill `--ll-neutral-1000`, thumb `--ll-neutral-0` with hairline border (`--ll-border-color`), bubble `--ll-neutral-1000` with white text.
  - *Classes:* Convert standalone CSS to `ll:` Tailwind classes.
  - *Animation:* Physics spring loop manipulates DOM styles directly. Fill band uses `clip-path: inset(...)`. Under §7 ("Animate only transform and opacity"), fill animation should be converted to `transform: scaleX(...)` with `transform-origin: left`. Reduced motion must disable spring stretch and rubber-banding.
  - *Accessibility:* `role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-orientation`, `aria-label`, handles arrow keys, PageUp/Down, Home/End.
- **Where it fits in Lazy Layout:**
  - Canvas zoom level slider in `canvas/ZoomControls.tsx`; opacity, volume, and transition duration sliders in `panels/details`; playback scrub slider in `shell/TransportBar.tsx` and `panels/sequencer`.
  - *Parity area:* `canvas` (`canvas/ZoomControls.tsx`), `panels/details`, `shell` (`shell/TransportBar.tsx`).
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Strip `@hugeicons` and use `lucide-react`; replace 999px pill track and round thumb with rectangular geometry (2px/4px radii); convert `clip-path` animation to `transform: scaleX`; convert CSS into `ll:` Tailwind; map colors to `PALETTE.md`.
- **Effort:** Medium.

---

### 2.4. Cursor
- **Source and license:**
  - *Source:* Animate UI ([animate-ui.com/docs/primitives/animate-ui/cursor](https://animate-ui.com/docs/primitives/animate-ui/cursor)).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* MIT with Commons Clause (`imskyleen/animate-ui`). Requires user approval.
- **Dependencies:**
  - *Required:* `@animate-ui/react`, `motion`.
  - *Installed in `package.json`:* Only `motion`. `@animate-ui/react` is **not installed**.
  - *Can be rewritten without missing packages:* **Yes**. A follower cursor can be built cleanly using native `motion` primitives (`useMotionValue`, `useSpring`).
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS.
  - *Note:* `INBOX.md` contains only the usage example and API reference table, not the underlying source code.
- **Fit with our rules:**
  - *Shapes:* Follower badge must be rectangular with modest 4px radius (`--ll-radius-sm`).
  - *Colors:* Must use `PALETTE.md` tokens: badge background `--ll-neutral-1000` with white text `--ll-neutral-0`, or collaborator-specific neutrals with hairline borders.
  - *Animation:* Driven by motion values with hardware-accelerated transforms (`x`, `y`), scale, and opacity. Fully complies with §7. Ignores touch pointers.
  - *Reduced motion:* Supported (disables spring follow, relies on direct position and opacity fade).
- **Where it fits in Lazy Layout:**
  - Multiplayer collaborator cursor overlay on the canvas in `canvas/CollabCursorOverlay.tsx` and interactive custom tool pointers in `canvas/overlay/OverlayLayer.tsx`.
  - *Parity area:* `canvas` (`canvas/CollabCursorOverlay.tsx`, `canvas/overlay/OverlayLayer.tsx`).
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Rebuild from scratch in `src/editor/components/CanvasCursor.tsx` using native `motion` (`useMotionValue`, `useSpring`) without `@animate-ui/react`; style follower badge with 4px rectangle and `PALETTE.md` tokens.
- **Effort:** Medium.

---

### 2.5. Avatar Group
- **Source and license:**
  - *Source:* Animate UI ([animate-ui.com/docs/primitives/animate-ui/avatar-group](https://animate-ui.com/docs/primitives/animate-ui/avatar-group), inspired by Jhey).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* MIT with Commons Clause (`imskyleen/animate-ui`). Requires user approval.
- **Dependencies:**
  - *Required:* `@animate-ui/react`, `motion`, `@floating-ui/react`.
  - *Installed in `package.json`:* Only `motion`. Neither `@animate-ui/react` nor `@floating-ui/react` is installed.
  - *Can be rewritten without missing packages:* **Yes**. Rebuilt using React, negative margin overlap, `motion` (or pure CSS hover lift), and Lazy Layout's existing `src/editor/components/Tooltip.tsx`.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS.
  - *Note:* `INBOX.md` contains API documentation and usage snippet only.
- **Fit with our rules:**
  - *Shapes:* Example specifies `rounded-full` (circular avatar). **Violates §1** ("No capsule or pill shapes... Use rectangular shapes with modest radii"). Avatars must be square with modest radii (e.g. 4px `--ll-radius-sm` or 6px `--ll-radius-md`), not circles.
  - *Colors:* Border must use hairline `--ll-border-color` or `--ll-neutral-0`, avatar background `--ll-neutral-200`, text `--ll-neutral-1000`.
  - *Animation:* Hover rise uses `translate` (`y`) on a spring, which is pure `transform`. Complies with §7.
  - *Accessibility & reduced motion:* Requires keyboard focusability for interactive avatars and accessible tooltips. Reduced motion disables bouncy spring in favor of immediate lift.
- **Where it fits in Lazy Layout:**
  - Collaborator presence indicator in `shell/CollaboratorAvatarStack.tsx` (TopBar right side or Canvas toolbar).
  - *Parity area:* `shell` (`shell/CollaboratorAvatarStack.tsx`).
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Rebuild from scratch in `src/editor/components/AvatarGroup.tsx` without `@animate-ui/react` or `@floating-ui/react`; use squarish rectangular avatars with 4px/6px radii (no `rounded-full`); wire up with our existing `Tooltip.tsx`; use `ll:` Tailwind prefixes and `PALETTE.md` tokens.
- **Effort:** Small to Medium.

---

### 2.6. Tooltip
- **Source and license:**
  - *Source:* Animate UI ([animate-ui.com/docs/primitives/animate-ui/tooltip](https://animate-ui.com/docs/primitives/animate-ui/tooltip)).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* MIT with Commons Clause (`imskyleen/animate-ui`). Requires user approval.
- **Dependencies:**
  - *Required:* `@animate-ui/react`, `motion`, `@floating-ui/react`.
  - *Installed in `package.json`:* Only `motion`. `@animate-ui/react` and `@floating-ui/react` are not installed.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS.
- **Fit with our rules:**
  - *Violations:* Description explicitly relies on 6px blur animations ("the previous label leaves the other way into a 6px blur... next one slides 40px in... out of the blur"). Blur is **strictly banned under §1** ("No glass, blur or translucent materials") and **§7** ("Animate only transform and opacity"). Also introduces floating SVG pointer arrows and morphing geometry, contrary to Apple-level restraint.
  - *Redundancy:* Lazy Layout **already built and approved** `src/editor/components/Tooltip.tsx` in Phase 1 Shell Step 1. It strictly adheres to Apple-level restraint: 4px radius solid black rectangle (`--ll-neutral-1000`), white micro text (`--ll-neutral-0`), 300ms hover/focus delay, and opacity-only transition without blur, arrows, or extra dependencies.
- **Where it fits in Lazy Layout:**
  - Tooltips across TopBar, MainToolbar, Canvas controls, Inspector buttons.
  - *Parity area:* `foundations` / `design-system`, `shell`.
- **Verdict:** `skip`
  - *Why skip:* Redundant. Lazy Layout already has an approved, tested, Apple-restrained `Tooltip.tsx` in `src/editor/components/Tooltip.tsx`. Animate UI's Tooltip requires 2 uninstalled dependencies (`@animate-ui/react`, `@floating-ui/react`), relies on forbidden blur effects (§1, §7), and would duplicate existing completed work.
- **Effort:** Large (redundant).

---

### 2.7. Select
- **Source and license:**
  - *Source:* Animate UI / Base UI ([animate-ui.com/docs/primitives/base-ui/select](https://animate-ui.com/docs/primitives/base-ui/select), [base-ui.com](https://base-ui.com)).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* Animate UI is MIT with Commons Clause; Base UI (`@base-ui/react`) is MIT. Requires user approval.
- **Dependencies:**
  - *Required:* `@animate-ui/react`, `motion`, `@base-ui/react` (or shadcn/ui select).
  - *Installed in `package.json`:* Only `motion`. Neither `@animate-ui/react` nor `@base-ui/react` is installed.
  - *Can be rewritten without missing packages:* **Yes**. A custom Select dropdown can be built using React state and `motion` (or standard ARIA `combobox`/`listbox` pattern).
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS.
- **Fit with our rules:**
  - *Blur violation:* Description repeatedly describes blur transitions: "clears from a 4px blur as it fades in", "rises 6px into a 4px blur", "pops it in from half its size out of a 2px blur". **Violates §1 and §7**. All blur filters must be eliminated completely.
  - *Shapes:* Trigger and popup items must be rectangular with modest radii (4px/6px, `--ll-radius-sm`/`--ll-radius-md`), no pills.
  - *Colors:* Raised popup surface `--ll-neutral-0`, hairline border `--ll-border-color`, item hover `--ll-neutral-100`, primary text `--ll-neutral-1000`.
  - *Animation:* Scale (0.95 -> 1) and opacity entrance. Gliding item highlight via `motion.div layoutId`. Animate strictly `transform` and `opacity`.
  - *Accessibility:* Full ARIA `role="combobox"` / `role="listbox"`, `aria-expanded`, Up/Down arrow traversal, Enter/Space selection, Escape to close.
- **Where it fits in Lazy Layout:**
  - Core control across `panels/details`: Font Family picker, Font Weight picker, Text Align, Text Transform, Blend Mode, Position type, Display mode, Export format (PNG/SVG/JSON); and archetype selector in `panels/launcher`.
  - *Parity area:* `panels/details`, `panels/launcher`, `foundations` / `design-system`.
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Build from scratch in `src/editor/components/Select.tsx` using React + `motion` (no `@animate-ui/react` or `@base-ui/react`); strip all 4px/2px blur animations; animate only `transform` and `opacity`; style with `ll:` Tailwind and `PALETTE.md` tokens.
- **Effort:** Large.

---

### 2.8. Menubar
- **Source and license:**
  - *Source:* Animate UI / Base UI ([animate-ui.com/docs/primitives/base-ui/menubar](https://animate-ui.com/docs/primitives/base-ui/menubar), [base-ui.com](https://base-ui.com)).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* Animate UI is MIT with Commons Clause; Base UI is MIT. Requires user approval.
- **Dependencies:**
  - *Required:* `@animate-ui/react`, `motion`, `@base-ui/react`.
  - *Installed in `package.json`:* Only `motion`. Missing `@animate-ui/react` and `@base-ui/react`.
  - *Can be rewritten without missing packages:* **Yes**. Built with React Context + `motion`.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS.
- **Fit with our rules:**
  - *Blur violation:* Item stagger describes "clears from a 4px blur as it fades in". **Violates §1 and §7**. Remove blur completely.
  - *Shapes:* Trigger buttons and popups must be rectangular with modest radii (4px/6px), no pills.
  - *Colors:* Bar background `--ll-neutral-50` or `--ll-neutral-200`, popup `--ll-neutral-0`, hairline border `--ll-border-color`, item hover `--ll-neutral-100`, text `--ll-neutral-1000`.
  - *Animation:* Smooth popover handover between menus using spring `transform` (`x`, `y`) without scaling item content. Animate strictly `transform` and `opacity`.
  - *Accessibility:* `role="menubar"`, `role="menuitem"`, Left/Right arrows across menus, Down arrow to enter menu, Up/Down inside menu, Escape to dismiss.
- **Where it fits in Lazy Layout:**
  - Top application menu bar (File, Edit, View, Object, Window, Help) in `shell/StudioHeader.tsx` and legacy menu replacements `menus/WindowMenu.tsx`, `menus/UnifiedLogoMenu.tsx`, `menus/menuModel.tsx`.
  - *Parity area:* `menus` (4 files in `PARITY.md`), `shell`.
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Rebuild in `src/editor/components/Menubar.tsx` using React Context + `motion` without external packages; eliminate 4px blur; implement smooth popover sliding handover between open menus using compositor `transform`; style with `ll:` Tailwind and `PALETTE.md` tokens.
- **Effort:** Large.

---

### 2.9. Dropdown Menu
- **Source and license:**
  - *Source:* Animate UI / Base UI ([animate-ui.com/docs/primitives/base-ui/dropdown-menu](https://animate-ui.com/docs/primitives/base-ui/dropdown-menu), [base-ui.com](https://base-ui.com)).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* Animate UI is MIT with Commons Clause; Base UI is MIT. Requires user approval.
- **Dependencies:**
  - *Required:* `@animate-ui/react`, `motion`, `@base-ui/react`.
  - *Installed in `package.json`:* Only `motion`. Missing `@animate-ui/react` and `@base-ui/react`.
  - *Can be rewritten without missing packages:* **Yes**. Built with React + `motion`.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS.
- **Fit with our rules:**
  - *Blur violation:* Item stagger and check pop describe 4px and 2px blur. **Violates §1 and §7**. Remove blur completely.
  - *Shapes:* Rectangular popup with 6px radius (`--ll-radius-md`), rectangular items with 4px radius (`--ll-radius-sm`). No pills.
  - *Colors:* Raised neutral surface `--ll-neutral-0`, hairline border `--ll-border-color`, item hover `--ll-neutral-100`, item active black `--ll-neutral-1000` with white text.
  - *Animation:* Transform scale (0.95 -> 1) and opacity entrance. Gliding item hover highlight via `layoutId`. Check indicator draw/pop without blur.
  - *Accessibility:* `role="menu"`, `role="menuitem"`, `role="menuitemcheckbox"`, `role="menuitemradio"`, full keyboard navigation (Up, Down, Home, End, Escape, Enter).
- **Where it fits in Lazy Layout:**
  - Replaces `menus/MenuDropdown.tsx`, `shell/LayoutsMenu.tsx`, TopBar project options menu, and layer item action menus.
  - *Parity area:* `menus` (`menus/MenuDropdown.tsx`), `shell`.
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Implement compound `DropdownMenu` in `src/editor/components/DropdownMenu.tsx` (sharing internal primitive with `ContextMenu`) using React + `motion`; strip blur; style with `ll:` Tailwind and `PALETTE.md` tokens.
- **Effort:** Medium to Large.

---

### 2.10. Context Menu
- **Source and license:**
  - *Source:* Animate UI / Base UI ([animate-ui.com/docs/primitives/base-ui/context-menu](https://animate-ui.com/docs/primitives/base-ui/context-menu), [base-ui.com](https://base-ui.com)).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* Animate UI is MIT with Commons Clause; Base UI is MIT. Requires user approval.
- **Dependencies:**
  - *Required:* `@animate-ui/react`, `motion`, `@base-ui/react`.
  - *Installed in `package.json`:* Only `motion`. Missing `@animate-ui/react` and `@base-ui/react`.
  - *Can be rewritten without missing packages:* **Yes**. Can share 90% of implementation with `DropdownMenu`, triggered by `onContextMenu` and positioned at pointer coordinates with boundary collision detection.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS.
- **Fit with our rules:**
  - *Blur violation:* Stagger and check pop mention 4px/2px blur. **Violates §1 and §7**. Remove blur completely.
  - *Shapes:* Rectangular popup with 6px radius, rectangular items with 4px radius. No pills.
  - *Colors:* Raised neutral surface `--ll-neutral-0`, hairline border `--ll-border-color`, item hover `--ll-neutral-100`, text `--ll-neutral-1000`.
  - *Animation:* Transform scale (0.95 -> 1) from pointer origin, opacity fade.
  - *Accessibility:* Triggered via right click or keyboard menu key; Escape dismiss; Arrow keys navigation.
- **Where it fits in Lazy Layout:**
  - Canvas right-click context menu in `canvas/CanvasContextMenu.tsx` (Group, Frame, Ungroup, Align, Delete, Bring to Front, Send to Back) and layer item context menu in `panels/layers`.
  - *Parity area:* `canvas` (`canvas/CanvasContextMenu.tsx`), `panels/layers`.
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Build in `src/editor/components/ContextMenu.tsx` (sharing internal menu parts with `DropdownMenu.tsx`) listening to `onContextMenu`, positioning popup at cursor `(clientX, clientY)` with boundary collision detection, stripping blur, and using `PALETTE.md` tokens.
- **Effort:** Medium.

---

### 2.11. Scroll Fade
- **Source and license:**
  - *Source:* Animate UI ([animate-ui.com/docs/primitives/animate-ui/scroll-fade](https://animate-ui.com/docs/primitives/animate-ui/scroll-fade)).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* MIT with Commons Clause (`imskyleen/animate-ui`). Requires user approval.
- **Dependencies:**
  - *Required:* `@animate-ui/react`, `motion`.
  - *Installed in `package.json`:* Only `motion`. `@animate-ui/react` is not installed.
  - *Can be rewritten without missing packages:* **Yes**. Built with a lightweight React wrapper / hook using CSS `mask-image` opacity gradient tied to scroll position.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, CSS `mask-image`.
- **Fit with our rules:**
  - *Blur and shrink violation:* Default implementation applies 4px blur (`blur: 4`) and shrink (`shrink: 0.03`) to individual items nearing the edge! **Violates §1** ("No glass, blur or translucent materials") and risks 60fps stutter by measuring and mutating child elements on scroll (**violates §7**). Setting `blur: 0` and stripping child-shrink logic leaves a pure, performant CSS `mask-image` edge opacity fade.
  - *Animation:* Pure opacity edge mask calculated from scroll position.
- **Where it fits in Lazy Layout:**
  - Long scrollable containers in `panels/details` (inspector property panels), `panels/layers` (deep layer trees), `panels/console` (`OutputConsole.tsx`), and `panels/assets`.
  - *Parity area:* `panels/details`, `panels/layers`, `panels/console`, `panels/assets`.
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Rebuild as lightweight `ScrollFade.tsx` / `useScrollFade.ts` using CSS `mask-image` edge opacity gradient tied to scroll position; eliminate child element blurring (`blur: 0`) and child shrinkage calculations completely for 60fps performance and §1/§7 compliance.
- **Effort:** Small.

---

### 2.12. File Tree
- **Source and license:**
  - *Source:* Unlumen UI (`@unlumen-ui/file-tree` by Léo `@leouiux`, inspired by Animate UI `animate-ui.com/docs/components/radix/files`).
  - *Pasted text license:* Not stated in pasted text. Technically **unknown**.
  - *Upstream license:* MIT License for public/free primitives (`leovvx/unlumen-ui-docs`). Requires user approval.
- **Dependencies:**
  - *Required:* `@unlumen-ui/file-tree` (depends on `motion`, `lucide-react`).
  - *Installed in `package.json`:* Both `"motion": "^13.4.3"` and `"lucide-react": "^1.41.0"` are installed. `@unlumen-ui` is not installed.
  - *Can be rewritten without missing packages:* **Yes**. Rebuilt directly in React using `motion` and `lucide-react`.
- **Language and stack:**
  - TypeScript (TSX), `'use client'`, Tailwind CSS.
- **Fit with our rules:**
  - *Color violation:* Default `highlightColor: "#f472b6"` (pink) **violates §6** ("Colors come only from PALETTE.md... No accent color"). Must use `PALETTE.md` tokens (bold primary text `--ll-neutral-1000` with subtle `--ll-neutral-100` hover/selected background).
  - *Shapes:* Hover highlight must be rectangular with modest radius (4px, `--ll-radius-sm`), no pill shapes.
  - *Animation:* Folder expand/collapse via height/opacity spring; gliding hover background via `motion.div layoutId`. Animate strictly `transform` and `opacity`.
  - *Accessibility:* Standard ARIA `role="tree"`, `role="treeitem"`, `aria-expanded`, Left/Right arrow keys for expand/collapse, Up/Down for navigation, Enter/Space to select.
- **Where it fits in Lazy Layout:**
  - Foundational component for:
    - Layer tree in `panels/layers` (artboards, frames, groups, components, text layers)
    - File tree in `panels/content-browser/ContentBrowser.tsx` and `stackTreeData.ts`
    - Asset browsing in `panels/assets/AssetsPanel.tsx`
  - *Parity area:* `panels/layers`, `panels/content-browser`, `panels/assets`.
- **Verdict:** `use after rewrite`
  - *Rewrite needed:* Build in `src/editor/components/FileTree.tsx` (and adapt for `LayerTree.tsx`) using React + `motion` + `lucide-react`; replace `#f472b6` with `PALETTE.md` tokens; enforce rectangular hover indicator; provide ARIA treeview accessibility.
- **Effort:** Medium to Large.

---

## 3. Master Summary Table

| # | Component | Source & License | Dependencies (Needed vs Installed) | Stack | Fit with Rules (§1, §6, §7) | Placement in Lazy Layout & Parity Area | Verdict | Effort |
|---|---|---|---|---|---|---|---|---|
| 1 | **SquishSwitch** | React Bits (unknown in text; upstream MIT + Commons Clause) | Needs `motion`. Installed: `motion` ✅ | TSX, Client, Tailwind + CSS vars | Pill shape (radius 19) & dark hex colors violate §1, §6. Transform-only motion ✅. | Boolean toggles in `panels/details` & `panels/settings` | `use after rewrite` | Medium |
| 2 | **ScrubField** | React Bits (unknown in text; upstream MIT + Commons Clause) | Needs `motion`. Installed: `motion` ✅ | TSX, Client, standalone CSS | Pill ghost badge (radius 999px) & dark hex violate §1, §6. Transform/opacity motion ✅. | Numeric scrubbing inputs (X, Y, W, H, radius, opacity) in `panels/details`, `panels/curves`, `panels/sequencer` | `use after rewrite` | Medium |
| 3 | **ElasticSlider** | React Bits (unknown in text; upstream MIT + Commons Clause) | Needs `@hugeicons/*`. Installed: None ❌. Rewritable with `lucide-react` ✅ | TSX, Client, standalone CSS, rAF loop | Pill track & round thumb violate §1. Clip-path fill violates §7 (convert to scaleX). Hardcoded colors violate §6. | Zoom slider in `canvas/ZoomControls.tsx`, opacity/volume in `panels/details`, scrub in `shell/TransportBar.tsx` | `use after rewrite` | Medium |
| 4 | **Cursor** | Animate UI (unknown in text; upstream MIT + Commons Clause) | Needs `@animate-ui/react`, `motion`. Installed: `motion` ✅ | TSX, Client, Tailwind (usage doc only) | Badge must use 4px rectangle & `PALETTE.md` tokens. Transform-only motion ✅. | Real-time multiplayer cursors in `canvas/CollabCursorOverlay.tsx` & canvas tools in `canvas/overlay/OverlayLayer.tsx` | `use after rewrite` | Medium |
| 5 | **Avatar Group** | Animate UI (unknown in text; upstream MIT + Commons Clause) | Needs `@animate-ui/react`, `motion`, `@floating-ui/react`. Installed: `motion` ✅. Rewritable with existing `Tooltip` ✅ | TSX, Client, Tailwind (usage doc only) | Circular avatars (`rounded-full`) violate §1. Must use squarish 4px/6px rectangles. Transform lift ✅. | Collaborator presence in `shell/CollaboratorAvatarStack.tsx` (TopBar / Canvas) | `use after rewrite` | Small to Medium |
| 6 | **Tooltip** | Animate UI (unknown in text; upstream MIT + Commons Clause) | Needs `@animate-ui/react`, `motion`, `@floating-ui/react`. Installed: `motion` ✅ | TSX, Client, Tailwind | 6px blur transition violates §1 & §7. Redundant with existing approved `src/editor/components/Tooltip.tsx` ❌. | Tooltips across `shell`, `menus`, `canvas`, `panels/details` | `skip` | Large (redundant) |
| 7 | **Select** | Animate UI / Base UI (unknown in text; upstream MIT + Commons Clause / MIT) | Needs `@animate-ui/react`, `motion`, `@base-ui/react`. Installed: `motion` ✅. Rewritable in React ✅ | TSX, Client, Tailwind | 4px/2px blur transitions violate §1 & §7. Strip blur; use 4px/6px rectangular popups & `PALETTE.md` tokens. | Font picker, blend modes, units, export format in `panels/details` & `panels/launcher` | `use after rewrite` | Large |
| 8 | **Menubar** | Animate UI / Base UI (unknown in text; upstream MIT + Commons Clause / MIT) | Needs `@animate-ui/react`, `motion`, `@base-ui/react`. Installed: `motion` ✅. Rewritable with React Context ✅ | TSX, Client, Tailwind | 4px blur transition violates §1 & §7. Strip blur; use rectangular popups & sliding handover via `transform`. | Top desktop application menubar in `shell/StudioHeader.tsx` & `menus` (`menus/WindowMenu.tsx`, `menus/UnifiedLogoMenu.tsx`) | `use after rewrite` | Large |
| 9 | **Dropdown Menu** | Animate UI / Base UI (unknown in text; upstream MIT + Commons Clause / MIT) | Needs `@animate-ui/react`, `motion`, `@base-ui/react`. Installed: `motion` ✅. Rewritable in React ✅ | TSX, Client, Tailwind | 4px/2px blur transitions violate §1 & §7. Strip blur; use 6px rectangular popup, 4px items, `PALETTE.md` tokens. | Menu dropdowns in `menus/MenuDropdown.tsx`, `shell/LayoutsMenu.tsx`, TopBar project menu | `use after rewrite` | Medium to Large |
| 10 | **Context Menu** | Animate UI / Base UI (unknown in text; upstream MIT + Commons Clause / MIT) | Needs `@animate-ui/react`, `motion`, `@base-ui/react`. Installed: `motion` ✅. Shares primitive with Dropdown ✅ | TSX, Client, Tailwind | 4px/2px blur transitions violate §1 & §7. Strip blur; pointer-anchored popup with screen bounds clamping. | Canvas right-click menu in `canvas/CanvasContextMenu.tsx` & layer context menu in `panels/layers` | `use after rewrite` | Medium |
| 11 | **Scroll Fade** | Animate UI (unknown in text; upstream MIT + Commons Clause) | Needs `@animate-ui/react`, `motion`. Installed: `motion` ✅. Rewritable with CSS mask ✅ | TSX, Client, CSS mask-image | 4px blur and per-item shrink violate §1 & §7. Strip blur/shrink; keep pure CSS `mask-image` opacity gradient. | Long scroll containers in `panels/details`, `panels/layers`, `panels/console`, `panels/assets` | `use after rewrite` | Small |
| 12 | **File Tree** | Unlumen UI (unknown in text; upstream MIT) | Needs `@unlumen-ui/file-tree`. Installed: `motion`, `lucide-react` ✅. Rewritable in React ✅ | TSX, Client, Tailwind | Pink `#f472b6` violates §6; pill hover violates §1. Use 4px rectangular hover & `PALETTE.md` tokens. | Hierarchy tree in `panels/layers`, project files in `panels/content-browser`, assets in `panels/assets` | `use after rewrite` | Medium to Large |

---

## 4. Recommended Build Order

Following the priority queue in [`DOCS/UI/PARITY.md`](file:///e:/Projects/magnm%20related/lazy%20layout/DOCS/UI/PARITY.md), building components from the design system up:

### Group 1: Phase 1 Foundations & Menu System (Immediate)
1. **`Dropdown Menu` & `Context Menu`:** Share a single underlying menu engine. Directly replaces legacy `menus/MenuDropdown.tsx` and unblocks `canvas/CanvasContextMenu.tsx` and TopBar menus.
2. **`Select`:** Foundational control needed in Phase 1 design system and across almost all Phase 2 panels (Details, Launcher, Canvas).
3. **`Menubar`:** Builds on top of `Dropdown Menu` to deliver the application menu in `shell/StudioHeader.tsx` and complete the `menus` parity area.

### Group 2: Phase 1 & 2 Property Controls (Next)
4. **`ScrubField`:** The primary input component required for rebuilding `panels/details` (numeric property scrubbing). Replaces legacy text inputs for X, Y, W, H, rotation, and radius.
5. **`SquishSwitch`:** Required for boolean properties across `panels/details` and `panels/settings`.
6. **`ElasticSlider`:** Delivers `canvas/ZoomControls.tsx` and opacity sliders in `panels/details`.
7. **`ScrollFade`:** Small, lightweight utility to wrap long property lists in `panels/details` and logs in `panels/console`.

### Group 3: Phase 2 Hierarchy & Collaboration (Following)
8. **`File Tree` / `Layer Tree`:** Essential workhorse for `panels/layers` (artboard, group, node hierarchy) and `panels/content-browser`.
9. **`Avatar Group`:** Completes `shell/CollaboratorAvatarStack.tsx`.
10. **`Cursor`:** Completes `canvas/CollabCursorOverlay.tsx`.

### Skipped:
11. **`Tooltip`:** Skipped as redundant — Lazy Layout already built and verified `src/editor/components/Tooltip.tsx`.

---

## 5. Decisions Needed from the User

1. **Approval of MIT + Commons Clause License Scope:**
   - React Bits (`SquishSwitch`, `ScrubField`, `ElasticSlider`) and Animate UI (`Cursor`, `Avatar Group`, `Tooltip`, `Select`, `Menubar`, `Dropdown Menu`, `Context Menu`, `Scroll Fade`) are licensed under MIT + Commons Clause.
   - *Implication:* Code can be freely used, modified, and shipped in personal or commercial SaaS applications (such as Lazy Layout). It only prohibits packaging and selling the components directly as competing template packs or standalone component libraries. Does the user approve adopting the designs and mechanics under this condition?
2. **Strict In-Tree Zero-Dependency Architecture:**
   - Under `UI_RULES.md` §5, no new dependencies (`@animate-ui/*`, `@base-ui/*`, `@hugeicons/*`, `@unlumen-ui/*`, `@floating-ui/*`) will be added to `package.json`.
   - All approved components will be rebuilt from scratch in `src/editor/components/` using only existing packages (`motion`, `lucide-react`, `tailwindcss`). Does the user confirm this in-tree approach?
3. **Pill & Blur Policy Enforcement:**
   - Candidates with pill shapes (SquishSwitch, ScrubField delta pill, ElasticSlider track/thumb, AvatarGroup, FileTree hover) will be converted to modest rectangular geometry (2px to 6px radii) with concentric curvature.
   - Candidates with blur animations (Select, Menubar, Dropdown, Context Menu, Scroll Fade) will have blur completely stripped, restricting motion purely to compositor `transform` and `opacity`. Does the user confirm these aesthetic guardrails?
4. **Tooltip Redundancy Confirmation:**
   - Does the user confirm skipping Animate UI's Tooltip in favor of maintaining the already built and approved `src/editor/components/Tooltip.tsx`?

# Decisions

Design choices, so workers never have to stop. The user reviews this in batches and can overrule any row. **Always say who decided.** Newest at the bottom.

| Date | Area | Decision | Decided by | Review |
|---|---|---|---|---|
| 2026-10-30 | Global | Neutrals are the base of the UI | user | approved |
| 2026-10-30 | Global | Apple-level layout, no glass or blur, no capsule or pill shapes | user | approved |
| 2026-10-31 | Global | Whole UI built from scratch, old UI kept in `src/legacy-editor` | user | approved |
| 2026-10-31 | Global | Use components from other sites | user | approved |
| 2026-10-31 | Global | Workers do not stop for design questions | user | approved |
| 2026-10-31 | Global | Use Tailwind | user | approved |
| 2026-10-31 | Global | A design system page shows every component, and components change there first | user | approved |
| 2026-10-31 | Global | Claude is the senior designer and instructs the workers, who do all the work | user | approved |
| 2026-10-31 | Canvas | The canvas is fixed in the from-scratch rebuild, not by editing `src/core` | user | approved |
| 2026-10-31 | Global | Backdrop `#8F8F8F`, panels `#C4C4C4`, canvas `#DFDFDF`, sampled by Claude from the user's reference | user | approved |
| 2026-10-31 | Foundations | Use `#000000` for all text until text colors are approved in the palette | worker (Antigravity) | pending |
| 2026-10-31 | Foundations | Non-color token scale: modest radii (`--ll-radius-sm: 4px`, `--ll-radius-md: 6px`, `--ll-radius-lg: 8px`), hairline border (1px), soft shadow (`--ll-shadow-soft`) | worker (Antigravity) | pending |
| 2026-10-31 | Global | Reset on the user's request: pending Claude rows removed, shell, launcher and animation bridges blanked so no legacy UI shows | user | approved |
| 2026-10-31 | Typography | Geist for the interface and Geist Mono for code and numbers | user | approved |
| 2026-10-31 | Design system | The page is laid out as a canvas with a right panel listing foundations and components with titles | user | approved |
| 2026-10-31 | Foundations | Add `--ll-shadow-color: rgba(0, 0, 0, 0.08)` token for soft shadow (`--ll-shadow-soft`) | worker (Antigravity) | pending |
| 2026-10-31 | Foundations | Type scale tokens: display (28px/700/-0.025em), title (18px/600/-0.015em), body (14px/400), small (12px/400), micro (10px/600/0.06em) | worker (Antigravity) | pending |
| 2026-10-31 | Design system | Selected nav item styled with black background and white text, unselected hover on neutral-400 | user | approved |
| 2026-10-31 | Foundations | 4px grid spacing tokens (`--ll-spacing-1` through `--ll-spacing-12`) | worker (Antigravity) | pending |
| 2026-10-31 | Global | Palette complete: white raised surfaces, `#F1F1F1` toolbar, `#464646` secondary text, black text and primary controls, hairline border, no state colors, no accent, light only | user | approved |
| 2026-10-31 | Foundations | Implement all eight palette colors as `--ll-neutral-*` and `--ll-border-color`; `--ll-neutral-1000` replaces earlier `--ll-text` | Claude | approved |
| 2026-10-31 | Foundations | 4px base spacing grid (`--ll-spacing: 4px`) for geometric Tailwind utility scaling | worker (Antigravity) | pending |
| 2026-10-31 | Design system | Canvas content centered within canvas using `--ll-canvas-max-width: 820px` and flex alignment | worker (Antigravity) | pending |
| 2026-10-31 | Foundations | Flat, hairline-divided lists replace nested cards across all foundation pages | Claude | approved |
| 2026-10-31 | Design system | "No components yet" styled with `neutral-800` (`#464646`) to pass 4.5:1 contrast requirement | worker (Antigravity) | pending |
| 2026-10-31 | Typography | Headings in new UI inherit `--ll-font-sans` rather than legacy Inter rules | worker (Antigravity) | pending |
| 2026-10-31 | Styling | All values in `tailwind.css` reference `var(--ll-...)` without repeating hex or rgba values; non-circular mappings used for tokens under `prefix(ll)` | worker (Antigravity) | pending |
| 2026-10-31 | Typography | Explicit Geist Mono typography rule in `globals.css` ensuring code/hex tokens compute to Geist Mono without legacy fallback override | worker (Antigravity) | pending |
| 2026-10-31 | Design system | Headings inside design system reset margin, border, background, and padding to prevent legacy heading leaks; group headers styled as micro labels with hairline above | Claude | approved |
| 2026-10-31 | Workspace preview | WorkspaceFrame preview raised card made fluid (`max-w-xs`) on mobile 390px, eliminating clipping and overflow | worker (Antigravity) | pending |
| 2026-10-31 | Workspace preview | Real labelled controls ("Export", "Preview") replace placeholder empty rectangles in preview toolbar | Claude | approved |
| 2026-10-31 | Design system | Spacing scale visual bars rendered using Tailwind `ll:w-*` classes matching exact pixel values, removing inline style calculations | worker (Antigravity) | pending |
| 2026-10-31 | Motion | Removed `transition-colors` on navigation rows; hover states change instantly, animating only opacity and transform | Claude | approved |
| 2026-10-31 | Design system | Focus ring on navigation buttons uses `neutral-1000` for 3:1+ contrast compliance on `neutral-200` panels | Claude | approved |
| 2026-10-31 | Design system | Swatch and WorkspaceFrame components added to the right navigation panel with live canvas views | Claude | approved |
| 2026-10-31 | Shell | `/editor` is full-viewport with no app frame, no inset and no outer radius. The backdrop color is kept for other places | user | approved |
| 2026-10-31 | Shell | Step 1 is the top bar only, then rail and left panel, canvas, right panel, timeline | Claude | approved |
| 2026-10-31 | Foundations | Control sizes token scale: `--ll-size-control-sm: 28px`, `--ll-size-control-md: 32px`, `--ll-size-topbar: 48px` | worker (Antigravity) | pending |
| 2026-10-31 | Shell | Editor root resets button styles and box-sizing via `.editor-root` in `globals.css` matching design system baseline | worker (Antigravity) | pending |
| 2026-10-31 | Components | SegmentedControl enforces concentric radii with 6px container radius (`--ll-radius-md`), 2px padding, and 4px option radius (`--ll-radius-sm`) | worker (Antigravity) | pending |
| 2026-10-31 | TopBar | TopBar center group is anchored with `absolute left-1/2 -translate-x-1/2` for exact viewport centering | worker (Antigravity) | pending |
| 2026-10-31 | TopBar | Below 640px/390px, brand text, project name, and Undo/Redo/Search buttons hide to prevent overflow, keeping logo, segmented control, Share, and Settings buttons | worker (Antigravity) | pending |
| 2026-10-31 | TopBar | Share and Settings rendered without onClick handlers (disable-free) pending subsequent integration | worker (Antigravity) | pending |
| 2026-10-31 | Motion | Button loading spinner animates purely via CSS `transform` rotation keyframes with `prefers-reduced-motion: reduce` override | worker (Antigravity) | pending |
| 2026-10-31 | Shell | Top bar wires the project name, undo, redo, device preset and search through the engine stores and commands in `@/core` (the same ones the legacy UI uses), not through `@/legacy-editor`, because they live in core | Claude | pending |
| 2026-10-31 | Components | Size `sm` controls (28px) stay as a compact size for dense panels. Segmented control options are 32px and the group is 40px | Claude | pending |
| 2026-10-31 | Shell | Share and Settings have no handler yet, they are wired in a later step | Claude | pending |
| 2026-10-31 | Global | The earlier palette is the light theme only. Dark is built first and is the default. The whole UI is designed for dark first | user | approved |
| 2026-10-31 | Global | Dark colors are Figma's, taken from the user's screenshot and sampled by Claude: canvas `#1E1E1E`, panels `#2C2C2C`, bars and raised `#383838`, border `#444444`, text `#FFFFFF` and `#BFBFBF` | user | approved |
| 2026-10-31 | Global | No accent color in dark either, so Figma's blue is not used | user | approved |
| 2026-10-31 | Global | Dark backdrop `#141414` and primary controls inverting to white with near-black text in dark | Claude | pending |
| 2026-10-31 | Global | Components use semantic tokens (`--ll-surface-*`, `--ll-text-*`, `--ll-control-primary-*`) instead of numbered neutrals so both themes work | Claude | pending |
| 2026-10-31 | Components | imported as-is, no restyling | user | approved |
| 2026-10-31 | Setup | packages installed with legacy-peer-deps | user | approved |
| 2026-10-31 | Global | Semantic color tokens (--ll-surface-*, --ll-text-*, --ll-control-primary-*) replace numbered neutrals; dark theme is default on :root and [data-theme="dark"], light on [data-theme="light"] | worker (Antigravity) | pending |
| 2026-10-31 | Foundations | Soft shadow token (--ll-shadow-soft) adopts stronger black alpha in dark (rgba(0,0,0,0.5)/0.3) and subtle alpha in light (rgba(0,0,0,0.08)/0.04) | worker (Antigravity) | pending |
| 2026-10-31 | Global | Theme stored in localStorage under 'lazy-layout-theme' and set via inline script in layout.tsx to prevent render flash; default dark | worker (Antigravity) | pending |
| 2026-10-31 | Components | Added ThemeToggle component (ghost icon button with Lucide Sun/Moon and "Switch theme" tooltip) in TopBar and DesignSystemPage | worker (Antigravity) | pending |
| 2026-10-31 | Styling | Hover and active states map to surface-panel on raised surfaces and surface-bar on panel surfaces for cross-theme contrast | worker (Antigravity) | pending |
| 2026-10-31 | Design system | Colors page shows dual-theme comparison columns (Dark vs Light) for all 11 semantic roles, real workspace frame preview in active theme, and WCAG AAA/AA surface text contrast ratios | worker (Antigravity) | pending |

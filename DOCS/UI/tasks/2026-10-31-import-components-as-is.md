# Task: import the inbox components exactly as they are

**User direction (overrides `UI_RULES.md` §1 look rules and §5 "make it ours" for these components):** import the components from `DOCS/UI/component-inbox/INBOX.md` exactly as they are. Do **not** restyle, rename classes, remove blur or pills, swap colors, or change code. The user will decide later what to change. The user approved installing the packages: `@animate-ui/react`, `@base-ui/react`, `@floating-ui/react`, `@hugeicons/react`, `@hugeicons/core-free-icons` and `radix-ui` are installed already (with `--legacy-peer-deps`, because Animate UI wants motion 14 and we have 13.5). Do not edit `package.json`.

## Do
1. Read `INBOX.md` and `ANALYSIS.md` (same folder). The 12 components are SquishSwitch, ScrubField, ElasticSlider, Cursor, Avatar Group, Tooltip, Select, Menubar, Dropdown Menu, Context Menu, Scroll Fade and File Tree.
2. Put each one in `src/editor/components/imported/<kebab-name>/`, with the component code copied character for character from the paste (main component, its CSS file if any, and its helper files). Keep the import lines as pasted. For File Tree, create the file at the path the paste imports (`@/components/unlumen-ui/file-tree`) by adding it under `src/editor/components/imported/unlumen-ui/file-tree.tsx` and pointing only that one import path at it, nothing else.
3. Every file gets a first-line comment `// Imported as-is from <source>. Not yet adapted to the design system.` and nothing else added. Include the Tooltip too, as imported, next to our own Tooltip (do not replace ours).
4. Add a demo for each on the design system page (`src/editor/design-system/DesignSystemPage.tsx`) under a new right-panel group **Imported (as-is)**, one entry per component, using the usage example from the paste so it renders. Do not style the demo beyond the page's existing layout.
5. Because the imported code uses unprefixed Tailwind classes and our Tailwind only generates `ll:` classes, some styling will not appear. Do not fix this and do not add a second Tailwind setup. In the handoff, say for each component what renders, what looks broken, and why.
6. Log every component in `DOCS/UI/COMPONENT_SOURCES.md` (name, URL, license as stated or "unknown, unverified", where it went, "no changes"). Log in `DECISIONS.md`: "imported as-is, no restyling" as decided by the user, and "packages installed with legacy-peer-deps" as decided by the user. Add the packages to `INTEGRATION.md`.
7. Make it compile: if a component has a TypeScript error because of the paste (for example a missing type or implicit any), add the smallest fix and list it in the handoff. If it cannot compile without changing its behaviour, leave it out of the demo and say so.

## Files you may touch
`src/editor/components/imported/**`, `src/editor/design-system/**`, and the `DOCS/UI/**` entries above. Off limits: everything listed in `UI_RULES.md` §4, and `package.json`.

## Done
Screenshots of each demo on `/design-system` (1440 wide only is enough) in `DOCS/UI/handoffs/screenshots/imported-as-is/`. Handoff written. Speed rules: write all files first, one Playwright pass (installed Chrome with `channel: "chrome"`, stop the dev server afterwards), do not run typecheck, lint, build or e2e, do not re-read files you wrote. No commit.

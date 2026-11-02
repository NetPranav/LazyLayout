<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lazy Layout UI rebuild: worker rules (Antigravity)

You are a **worker** on branch `ui/redesign`. You are building the whole UI from scratch in `src/editor`. Read `DOCS/UI/UI_RULES.md` and your task file before doing anything. The essentials:

- **Do not stop to ask.** Choose what best fits the rules, finish the task, and log the choice in `DOCS/UI/DECISIONS.md`. If one thing is blocked, log it in your handoff and finish the rest.
- **Layout bar: Apple-level.** This means layout and structure, not a look: clear hierarchy, restraint (few elements, each with one job), generous and consistent spacing on one grid, strict alignment, familiar conventions, large click targets, concentric radii, one icon stroke weight. **No glass, blur or translucent materials. No capsule or pill shapes** (no floating capsules, no fully rounded buttons or containers). Use rectangular shapes with modest radii, solid neutrals, hairline borders and soft shadows. Awwwards-level craft and motion sit on top of that layout.
- **Follow the design direction in your task.** Claude is the senior designer. Choose within that direction where it is silent.
- **Design system first.** Every UI component lives in `src/editor/components/` and is shown, with all its states, on the design system page (`/design-system`, built in `src/editor/design-system/`). Add or change a component there first, then use it in the app. App screens only use components from the design system.
- **`src/legacy-editor` is the old UI: read it, never edit it.** Match its behaviour and reuse its non-visual logic. Do not copy its look.
- **Use components from other sites** when they raise the quality, only where the license allows it. Log each in `DOCS/UI/COMPONENT_SOURCES.md`, copy it into `src/editor/components/`, add it to the design system page and restyle it to our rules. **Add no new dependencies.**
- **Style with Tailwind, and every class needs the `ll:` prefix** (`ll:flex`). Convert classes from other sites. No arbitrary values.
- **Colors only from `DOCS/UI/PALETTE.md`.** Tokens only (`src/editor/styles/tokens.css`), with the `--ll-` prefix. No hardcoded values.
- **Motion:** any property may animate (no layout shift for neighbouring content, 60fps). Use real springs from the shared motion engine (ported from Nook: `response` and damping ratio, Smooth/Lively/Bouncy presets). Respect `prefers-reduced-motion`. Lazy-load heavy effects.
- **Do not edit** `src/core`, `src/compiler`, `src/runtime`, `src/ai`, `src/legacy-editor` or config files, and do not revert changes in them. Request engine changes in `DOCS/UI/INTEGRATION.md`.
- **Never open a browser by hand.** Use Playwright, headless, for screenshots.
- **Do not run the full checks.** They run once per phase.
- **Do not commit or push.** Claude commits after review. No `Co-Authored-By` lines.
- **At the end, write a handoff** in `DOCS/UI/handoffs/` from `TEMPLATE.md`. Update `INTEGRATION.md` and your row in `DOCS/UI/PARITY.md` as you go.

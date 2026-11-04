---
name: ui-worker
description: Builds one lane of the Lazy Layout UI rebuild in src/editor from the HTML prototype, touching only its lane's paths, so several workers can run in parallel. Use for every UI build task; the orchestrator only reviews and commits.
tools: Read, Grep, Glob, Edit, Write, Bash
---

You are a **worker** on branch `ui/redesign` of Lazy Layout. You build one lane of a task in `DOCS/UI/tasks/`. **Other workers are editing other lanes in the same working tree right now.**

## Start
- Read your task file and do what it says. Read only the prototype lines and the files it names. Don't read every doc.
- **Source of truth:** `DOCS/UI/design/editor-design-mode-blocks-dark.html`. Copy its layout, values and motion exactly. Don't redesign, and don't retune.
- **Before writing Next.js code:** read the relevant guide in `node_modules/next/dist/docs/`. This Next.js has breaking changes.

## Lane rules (the parallel run depends on these)
- **Edit only the paths in your task's Lane section.** Need a change somewhere else? Write it under "Needs from other lanes" in your handoff, and work around it.
- **Tokens:** add them only inside your own lane block in `tokens.css` and `tailwind.css`: `/* === lane: Lx … === */`. Re-read the file right before each edit.
- **Demos:** they go in `src/editor/design-system/demos/<Lane>Demos.tsx`. Never edit `ComponentDemos.tsx` or `DesignSystemPage.tsx`.
- **Edits:** make small targeted edits. **Never bulk-reformat or rewrite whole files.** (A worker once mangled JSX this way, leaving 49 tsc errors.)
- **Off limits:**
  - **Paths:** `src/legacy-editor`, `src/core`, `src/compiler`, `src/runtime` and `src/ai`. Read them, and reuse their non-visual logic.
  - **Config and dependencies:** config files and `package*.json`. No new dependencies.
  - **Git:** no commits and no pushes.
- **Checks:** at the end, run `npx tsc --noEmit` once. Fix the errors in your own files. List errors in other lanes' files without touching them. Don't run lint, build or e2e: the orchestrator runs them per phase.

## Known mistakes, never repeat them
1. **Variant order:** the variant always goes after the prefix: `ll:hover:`, `ll:md:`, `ll:first:`, `ll:-ml-1`. Never `hover:ll:`, `md:ll:`, `first:ll:` or `-ll:ml-1`. A class with no `ll:` prefix does nothing.
2. **No hardcoded values:**
   - No arbitrary values (`ll:w-[37px]`, `ll:tracking-[0.08em]`, `ll:grid-cols-[…]`, `ll:[&…]:`). Add a token or a theme entry instead.
   - No hex and no rgb.
   - No px or ms literals in TS, TSX or CSS. Use tokens, or named constants in `motion/presets.ts` (`MENU_FALLBACKS`).
3. **CSS layers:** unlayered CSS in `animations.css` beats Tailwind. `all: unset` and `height: 100%` once broke the Select field. Keep each component's look in `ll:` classes.
4. **React vs the motion engine:** React must never own classes or inline styles that the motion engine writes. Use static classNames plus data attributes.
5. **Hydration:** don't read browser-only values on the first render. Use `useSyncExternalStore` with a server snapshot, or `useMounted()`.
6. **Frames and state:** no raw `requestAnimationFrame`. Use the motion loop (`defaultHost` / `frameScheduler`). No `setState` inside `useEffect`.
7. **Names and ids:**
   - Global CSS classes and ids start with `ll-`.
   - Ids come from `useId()`.
   - Check that a new class name doesn't clash with an existing one: `.ch` and `.cn` once broke tabs and clip names.
8. **Icons and wheel events:**
   - Every icon goes through `Icon` (size and 1.5 stroke). No direct `lucide-react` imports in screens.
   - React `onWheel` is passive, so use a native listener with `{ passive: false }`.
9. **Motion feel:** Bouncy is the default, and `PLAYFUL_PRESETS` must actually be wired for all three feels. Respect `prefers-reduced-motion`: springs and blur become a 120ms fade.
10. **Shapes and materials:**
    - No glass and no blur materials. Blur may go on moving content, never on a surface.
    - No pills and no `rounded-full`.
    - Radii are 4/6/8 only.
11. **Colours:**
    - Only the colours in `DOCS/UI/PALETTE.md`, through semantic tokens. Eight themes: Paper (default), White, Warm, Lilac, Noir, Dark, Graphite, Darkroom. **Plum must not exist.**
    - Label colours `--ll-label-1..6` are used only for timeline track strips and clip tints.
    - No error, warning or success colours. Code syntax uses only `--text`, `--text2` and `--muted`, plus weight and italic.
12. **Field spec** (copy it from the prototype):
    - Inspector fields are 28px, with padding 8 and gap 8. Values are 11px mono at weight 400 with **no** tracking, so not `text-micro`.
    - Prefixes sit inside the field (11px mono 500 muted).
    - No uppercase labels above fields. Select is one box, not a nested frame.
    - Section titles are 13px/500, and sub-labels are 12px sans muted.
13. **Mode switch and menus:**
    - Segmented controls match the top-bar mode switch: 32px high, 2px padding, 500 weight, muted when unselected, a sliding highlight.
    - Menus: 16px muted icons, `--text2` items that turn `--text` on hover, kbd with no tracking, disabled at .45.
14. **Hidden for now:** avatars are hidden in every mode. No visible "Saving" text and no save dot: the logo traces back and forth instead.
15. **Labs gate:** routes import the shared `labsEnabled` gate. Never write a local copy.
16. **Keep the same product:** Motion and Code use the same panel surface, 32px rows, `--hover` / `--sel`, 28px icon buttons and segmented tabs as Design mode. No coloured tabs.
17. **Honest handoff:** never claim something works without checking it. Paste the real `tsc` output into your handoff.

## Done
- **Screenshots:** headless Playwright at 1440, Paper and Dark, of what you built, in `DOCS/UI/handoffs/screenshots/<lane>/`. If it asks for chromium_headless_shell-1243, pass `executablePath` to the 1248 build under `%LOCALAPPDATA%\ms-playwright`.
- **Handoff:** write `DOCS/UI/handoffs/YYYY-MM-DD-HHMM-<lane>.md` from `TEMPLATE.md`, with:
  - what you built
  - the `tsc` output
  - "Needs from other lanes"
  - "Decisions"
- **Shared docs:** in parallel waves, don't edit `DECISIONS.md`, `PARITY.md` or `INTEGRATION.md`. The orchestrator merges those from your handoff.

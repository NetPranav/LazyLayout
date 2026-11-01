# UI Rules (shared by Claude and the Antigravity workers)

Branch: `ui/redesign`. Product name: **Lazy Layout**.

## 1. Goal

Build the whole UI from scratch, to Awwwards level. The old UI is not patched or restyled.

**Layout bar: Apple-level.** This means layout and structure, not a look: clear hierarchy, restraint (few elements, each with one job), generous and consistent spacing on one grid, strict alignment, familiar conventions, large click targets, concentric radii, one icon stroke weight. **No glass, blur or translucent materials. No capsule or pill shapes** (no floating capsules, no fully rounded buttons or containers). Use rectangular shapes with modest radii, solid neutrals, hairline borders and soft shadows. Awwwards-level craft and motion sit on top of that layout.

## 2. Working method: workers do not stop

- Work runs from the queue in `DOCS/UI/PARITY.md`, in order, one area per task, until the queue is empty.
- **Never stop to ask a design question.** Choose what best fits §1 and these rules, finish the task, and log the choice in `DOCS/UI/DECISIONS.md`. The user reviews in batches and may overrule anything.
- **Claude is the senior designer.** The task file carries the design direction. Follow it, and choose within it where it is silent.
- **Fixed by the user, never overridden by a worker's choice:** §1, §3, the palette in `DOCS/UI/PALETTE.md`, and anything marked approved in `DECISIONS.md`.
- **Blocked on one thing?** Log it in the handoff under "Not done / blocked", do the rest of the task and finish. Do not wait.
- **Never do these, even to keep going:** delete anything outside the task's files, use anything needing credentials or payment, or push. Log it and leave it undone.

## 3. Design system first

- **Design system first.** Every UI component lives in `src/editor/components/` and is shown, with all its states, on the design system page (`/design-system`, built in `src/editor/design-system/`). Add or change a component there first, then use it in the app. App screens only use components from the design system.
- The page shows every component with its states (default, hover, focus, active, disabled, loading, error, where they apply), and lets you try its variants and sizes.
- It also shows the foundations: colors, type scale, spacing, radii, shadows and motion.
- A component is not finished until it is on the page. The route answers 404 in production unless labs are enabled (`labsEnabled`, as the other developer pages do).

## 4. Structure and scope

- `src/editor` is the new UI. `src/legacy-editor` is the old UI: **read it, never edit it.**
- **Shell first.** The new `src/editor/shell/EditorShell.tsx` replaces the bridge first and mounts legacy panels until each one is rebuilt. Each later task swaps in one rebuilt area, so routes, the compiler and the tests never need reconnecting.
- A *bridge* is a file in `src/editor` that only re-exports `@/legacy-editor`. Replace it with the real component and keep its export names and the props callers use.
- **Reuse non-visual logic** (snapping, hit-testing, transform math, stores, hooks). New components may import it from `@/legacy-editor`. `PARITY.md` status, not a grep, says what is done.
- Keep behaviour: compare against the legacy area and list anything intentionally dropped in `DECISIONS.md`.

| Allowed | Off limits |
|---|---|
| `src/app/**`, `src/editor/**`, `public/**` | `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` |
| `DOCS/UI/**` entries your task requires | `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs` |

Need an off-limits change? List it under "Engine changes requested" in `INTEGRATION.md`, work around it and carry on.

## 5. Components from other sites

- Take components from other sites freely, to reach the bar faster. Candidates to check: shadcn/ui, Radix, React Bits, Magic UI, Aceternity UI (free tier), Origin UI, 21st.dev.
- **Only use code whose license allows it**, and check it per component. No paid or template code, and nothing copied from a live site's own source. License unclear? Pick another component.
- **Log every one** in `DOCS/UI/COMPONENT_SOURCES.md` before finishing the task: name, URL, license, where it went, what changed.
- **Make it ours.** Copy it into `src/editor/components/`, add it to the design system page, then restyle it to these rules: our tokens, no glass, no pills, plus accessibility and reduced motion. Do not ship a site's default look.
- **No new dependencies.** Use what is installed (`tailwindcss`, `motion`, `gsap`, `three`, `lucide-react`). If a component needs another package, rewrite it without that package or pick another, and note the wish in the handoff.

## 6. Styling

- **Tailwind is the styling tool**, set up in `src/editor/styles/tailwind.css`. **Every class needs the `ll:` prefix** (`ll:flex`, `ll:hover:bg-neutral-50`), so convert classes from other sites. There is no Preflight reset, so components set their own base styles.
- **Tokens only**, from `src/editor/styles/tokens.css` and the `@theme` block in `tailwind.css`. No arbitrary values (`ll:w-[37px]`, `ll:bg-[#123456]`) and no hardcoded colors, sizes, fonts, radii, shadows or durations. The default Tailwind colors do not exist here, on purpose.
- **New tokens use the `--ll-` prefix**, so nothing collides with legacy styles while both are loaded.
- **Colors come only from `PALETTE.md`.** Never add a color. There are five themes, and Paper is the default. Use the semantic tokens, never a raw color.
- Workers may add non-color tokens (spacing, type, radius, motion) and log the scale in `DECISIONS.md`. Reuse them afterwards.

## 7. Motion and performance

- `motion` for interface motion, GSAP for timelines and scroll sequences, CSS for simple transitions. Do not use two libraries for one job.
- Animate **only `transform` and `opacity`**. Respect `prefers-reduced-motion`.
- **Lazy-load** heavy effects (three.js, large animations).
- Smooth 60fps, no layout shift, no long main-thread tasks.

## 8. Quality bar

- Accessible: keyboard focus, visible focus ring, contrast of at least 4.5:1 for text, labels, semantic HTML.
- Responsive: desktop, tablet and mobile.
- No dead code, unused files or TODO comments.

## 9. Checks and phases

- **Browser:** Playwright, headless, only. Take screenshots at 1440, 1024 and 390 wide for each task.
- **No full checks per task.** A phase is a group of areas in `PARITY.md`. At its end run `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:e2e`.
- A phase closes when all four pass. The user reviews it in a batch.

## 10. Handoff (mandatory)

End every worker session with `DOCS/UI/handoffs/YYYY-MM-DD-HHMM-<short-name>.md` from `TEMPLATE.md`. No handoff, no pass.

## 11. Integration notes (A and B)

Add to `DOCS/UI/INTEGRATION.md` as you go, when you replace a component or route, rely on an engine store, hook, command or event, need an engine change, or change a test selector.

## 12. Git

- Work only on `ui/redesign`. Never commit to or push `main`. **Never push until the user says so.** Never force-push.
- Workers do not commit. Claude commits each area after the watcher passes it, e.g. `feat(ui): rebuild top bar`.
- No `Co-Authored-By` lines.

# Task: analyze the component inbox (read-only, no UI code)

**Goal:** the user dropped components into `DOCS/UI/component-inbox/INBOX.md` (about 3,000 lines, from React Bits and other pages). Say, for each one, whether we can use it in Lazy Layout, and how.

## Do
1. Read the whole `INBOX.md`. List every component in it by name, and the source page it came from.
2. For each component, decide and record:
   - **Source and license.** Use what the page or the pasted text says. If the license is not stated, say "unknown" and do not guess. Under `UI_RULES.md` §5, unknown means we cannot use it.
   - **Dependencies.** Which packages it needs (for example `motion`, `gsap`, `three`, `react-spring`, `@use-gesture`). Say which are installed in `package.json` (read it, do not edit it). Say if it can be rewritten without the missing ones.
   - **Language and stack.** TSX or JSX, Tailwind or CSS, client component or not.
   - **Fit with our rules:** any pills or fully rounded shapes, glass, blur, gradients or colors outside `DOCS/UI/PALETTE.md`, animation of anything other than `transform` and `opacity`, heavy effects needing lazy-loading, reduced-motion support, keyboard and aria support.
   - **Where it fits in Lazy Layout.** Name a concrete place, for example "ScrubField for numeric inputs in the Details panel", "SquishSwitch for toggles", "ElasticSlider for opacity and size sliders". Say which area in `DOCS/UI/PARITY.md` it belongs to.
   - **Verdict:** `use as is`, `use after restyle`, `use after rewrite` (say what), or `skip` (say why).
   - **Effort:** small, medium or large.
3. End with one table of all components with those columns, then a short recommended order to build them, and a list of anything that needs a decision from the user.

## Output
Write only `DOCS/UI/component-inbox/ANALYSIS.md`. Do not edit `INBOX.md`, any source file, `package.json` or any other doc. Do not copy components into `src`. No dev server and no screenshots needed. No commit.

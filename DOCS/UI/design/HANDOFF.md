# Design session handoff (for the next Opus session)

Written by Claude (Opus, design session), 2026-11-07. Read this first, then `CLAUDE.md`, `DOCS/UI/BUILD_SESSION.md`, `DOCS/UI/PARALLEL_BUILD.md` and the top rows of `DOCS/UI/design/CHANGELOG.md`.

## 1. Branch and roles

- **Branch: `ui/redesign` is the main working branch.** The user said to ignore `integrate/main-into-new-ui` (it was only for an instant PR). Design commits go on `ui/redesign`, path-scoped (`DOCS/UI/design/**`), never `git add -A`.
- **Design session (Opus):** owns `DOCS/UI/design/**`, designs in the HTML prototype, uses cheap Sonnet subagents for the HTML edits, reviews screenshots, merges and commits.
- **Build session (Sonnet):** binds `src/editor` to the engine with parallel `agy` workers. Its prompt is in section 6.

## 2. How the user works

- **Act fast, use cheap subagents.** The user wants work delegated to Sonnet subagents and done quickly, in as few tokens as possible.
- **Discuss first only when asked** ("tell me first", "what idea do you have"). Then give 2 or 3 options with a recommendation and wait.
- **Our design system first.** The user called out new pieces that were "too loud". Match existing components: menus, the morphing dropdown, `.dtitle` headers, `.field`, tokens. Quiet neutrals, one job per element.
- **Popovers float like the colour picker:** 8px from the inspector, all corners rounded, morph out of the trigger with the Bouncy spring.
- **Never pick a base version yourself; liking one detail is not a request to revert.**

## 3. How we edit the prototype safely (parallel subagents)

- Copy the main file to the scratchpad (`base.html` plus one copy per worker). Each worker edits only its copy and keeps new code in its own named block (`<script id="ll-...">`, a CSS block before a fixed anchor).
- Merge with `git merge-file <main> <base> <worker>`. **Line endings:** the file is CRLF. One worker saved LF and every line conflicted; normalise first.
- Check each merge: every `<script>` parses with `new Function`, then a headless Playwright run with `executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"` and Playwright from the repo's `node_modules`. Look at the screenshots yourself.

## 4. Done this session (2026-11-07, all in CHANGELOG as `not built`)

Canvas-only custom cursor; colour picker; font picker; inspector options popover with the sliders button; Layers rows, search and page selector; multi-selection Mixed values; inline text format bar; Spotlight command panel; lean per-mode toolbar (Select and Hand are separate buttons, carets right of the icon, Preview in the top bar); frame presets panel; Canvas settings layout and scroll fix; list edge blur (no bulge); code syntax colours and per-theme timeline colours; trace logo back and forth; blank page shows nothing; side and bottom panels meet on one hairline; `window.LLMotion` shared motion table.

**User decisions this session** (record as the user's): cursor on the canvas only; colours allowed in the code editor; timeline label colours tuned per theme; list edge blur only, no bulge; options trigger = sliders icon on the right of the section header; options popover floats like the colour picker; Select and Hand as separate buttons; leaner toolbar; blank page shows nothing.

## 5. Next and open items

1. **Open:** collaborator cursor colours: reuse `--lbl-1..6` (recommended) or add a set to `PALETTE.md`.
2. **Not designed yet:** Preview mode (device frame), Pages manager (routes, SEO, redirects, flow map), image Replace and source picker, gradient handles on the canvas and angle control, transform-origin picker, data binding, Logic and Data workspaces, window panels (History, Search, Versions, Plugins, Deployment), Settings (Ctrl+,), crash and save-error states, Home parts 2 to 8 (`home-v2.html`).
3. **Small gaps:** text colour in the format bar; Assets search empty state; Features and Footer have no children; Z zoom cursor does not zoom; Spotlight commands that only close the panel; page selector actions change only the popover's list.
4. **`home.html`** still has a stopped agent's half-done changes (uncommitted). Ask the user: keep them or restore `80b1b02`.
5. **Live preview:** https://lazy-layout-prototype.vercel.app is behind; redeploy only when the user asks.

## 6. Build session prompt

The prompt given to the Sonnet build session is in `DOCS/UI/design/BUILD_PROMPT.md`.

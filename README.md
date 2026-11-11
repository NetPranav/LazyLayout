<p align="left"><img src="public/logo.svg" alt="LazyLayout logo" width="72" height="72"></p>

# LazyLayout

LazyLayout is an AI-native motion design studio: a visual editor for authoring interactive
motion, effects, and components with GSAP, Framer Motion, SVG, and CSS, that compiles to
clean, production-grade code you can drop into any external codebase.

This repository is currently in its **Initial Phase** — the motion/animation editor. The
full-vision product (logic blueprints, a database studio, deployment, plugins, collaboration)
is tracked separately and gated out of this build behind the `edition` flag (see
`src/core/flags.ts`); none of it ships in the Initial Phase bundle.

## Editor UI rebuild (branch `ui/redesign`)

The editor UI is being rebuilt in `src/editor` from the HTML prototype
`DOCS/UI/design/editor-design-mode-blocks-dark.html`. The old editor is kept at `/editor/legacy`
(`src/legacy-editor`). The new editor is at `/editor`. It has three modes: Design, Motion and Code.
Rules for working on it: `DOCS/UI/UI_RULES.md`, `DOCS/UI/WORKER_RULES.md`. Progress and open
items: `DOCS/UI/PROGRESS.md`. Engine changes the UI is waiting for: `DOCS/UI/INTEGRATION.md`.
Handoff notes per piece of work: `DOCS/UI/handoffs/`.

Status words used below: **done** = built, wired to the engine and checked in a headless browser
at 1440 px wide. **partly** = built, with the gaps named. Nothing here has been through the full
e2e suite or a production build yet.

### Done: shell and common parts

- Top bar: logo menu (File, Export…, Disable animations), Play, Ship, avatar stack.
- Left panel: Pages manager (the "Home ⌄" header: add, rename, duplicate, set as home, delete,
  reorder, settings), Layers tree with search, layer-type icons, stack/grid direction icons,
  path point count.
- Floating toolbar per mode, with the Insert box (categories, search, live section thumbnails),
  grouped Shape menu, frame presets, canvas settings and view options popovers.
- Command palette / Spotlight (Ctrl+K), AI box (prompt only), themes (Paper, Graphite and others),
  theme cross-fade, per-mode bottom panel heights, bouncy panel and popover motion.
- Option popovers and the colour picker slide between anchors; all motion turns off with
  "Disable animations".
- Font picker, colour picker with token links, tooltip edge clamping.

### Done: Design mode

- Canvas selection outline, handles, size chip, hover and marquee match the prototype; the
  X/Y/R/O readout is readable and keeps its place at any zoom.
- Right panel sections: Position, Layout, Appearance, Fill, Stroke, Effects, Typography, Image,
  States, Page, Theme & Tokens, Vector, and the kind sections (Input, Toggle, Divider,
  Background, Icon, Shape, Counter, 3D). Sections with rows (Fill, Stroke, Effects) keep their
  extra options in each row's popover; the other sections have a header options popover.
- Auto layout and grid: padding bands and gap strips you can drag, grid track lines and handles,
  insertion line when dragging inside a stack or grid, Free / Row / Column / Grid control,
  alignment grid, Grow / Shrink / Self-align, column and row span.
- Pen and vector: Pen, Pencil and Anchor tools, anchors and handles on the canvas, context bar
  (Close path, Join, Delete point, point type, Done), Vector section, boolean operations.
- Export dialog (file tree with checkboxes, preview, Repo .zip, Current file, Copy npm install),
  also reachable from the Code inspector's Export section, the logo menu and Ctrl+K.

### Done: Motion and Code modes

- Motion: add keyframe at the playhead, split, easing, markers, work area, layer eye / lock /
  solo, key align / duplicate / copy / paste, auto-key and onion skin on one store, transport as
  the single clock (play, loop, step), undo and redo for the edits.
- Code: file tree, tabs, code view and footer show the real compiler output for the current
  document; the Export section in the right sidebar downloads the repo zip or the current file.

### Partly done / open

- Console and Trace show sample data (the runtime does not provide a trace yet).
- Code inspector selects (Framework, Styling, Animation) do nothing: the emitters only produce
  one setup. Selecting a layer cannot highlight code lines (no line ranges from the compiler).
- Stroke Cap, Join, Miter and Dash did not persist on a button layer in one check; not yet
  checked on a path layer.
- Pen tool: point type, Round and Join are built in the editor with no engine command behind
  them (Join creates a new layer and removes the two originals). Seven engine requests are in
  `INTEGRATION.md`; changing `src/core` needs a go-ahead first.
- Pages manager: the page "Share image" field is disabled (no engine field); the initial edition
  is single-page by design and the manager is not hidden there.
- Auto layout and grid: tracks cannot be removed from the canvas, no target-cell outline on a
  grid drop, no gap strips on wrapped stacks.
- Sections: insert is by click only (no drag onto the canvas).
- Not checked at 1024 px and 390 px widths (the shell hides the left panel at 390).
- In progress: one shared bouncy Slider component for all sliders, and a fix for the left panel
  refreshing on every edit.
- Checks still to run: the full e2e suite (the Motion and Code specs have not run), a production
  build, and a write-and-reopen check of all 16 option popovers.

### Not designed yet

- Breakpoint bar and device views
- Tokens panel (only the Theme & Tokens options popover exists)
- Components and variants
- Graph editor (the timeline has the Graph tab, no editor behind it)
- Agent pairing
- Status line / status bar

## Requirements

This is not the Next.js you may know — it runs on Next 16 / React 19, which has breaking API
changes from earlier versions. See `AGENTS.md` at the repo root before making framework-level
changes.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the launcher, and
[http://localhost:3000/editor](http://localhost:3000/editor) for the studio itself.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (warning budget enforced — see `package.json`) |
| `npm run test` | Typecheck + unit tests |
| `npm run test:unit` | Unit tests only (`src/**/__tests__/*.test.ts`) |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run export-harness` | Builds the export-harness fixtures under `tests/export-harness/` |

## Documentation

The living docs for the Initial Phase — PRD, roadmap, audit, conventions, panel reference,
schema reference, licensing register, and folder structure — live under `DOCS/INITIAL/`.
Start with `DOCS/INITIAL/ROADMAP.md` for what's built and what's next, and `DOCS/INITIAL/AUDIT.md` for
known gaps.

`DOCS/FUTURE/` holds the full-vision track (Release 3: visual Blueprints, project import, deep inspection).
It is not the active roadmap — see the banner on each file there.

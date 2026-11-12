# Folder structure and data hierarchy

**Version:** 2.0.0 (rewritten in ROADMAP Phase 52, checked against the code on 2026-11-13).
**Replaces:** the v1.1 spec ("Initial Phase", with `wasm/` C++ sources, an old UI.md, and an `elements` map). That layout was never built as written.
**Authority:** the code. If this file and `src/` disagree, `src/` wins and this file is wrong; fix it in the same PR. The document model itself is in `SCHEMA_REFERENCE.md` §0 (schema v7); the rules are in `ROADMAP.md` §0–§4 and `CONVENTIONS.md`.

---

## 1. Repository layout

```text
WebAPPBuilder/
├── AGENTS.md, CLAUDE.md            rules for people and AI assistants (CLAUDE.local.md is private, not checked in)
├── DOCS/
│   ├── INITIAL/                    PRD, ROADMAP (+ ROADMAP_3D), SCHEMA_REFERENCE, CONVENTIONS, AUDIT, CHANGELOG,
│   │                               changelog.d/ (fragments), decisions/ (records), this file
│   ├── TEAM/                       COLLABORATION.md (two lanes), CLAIMS.md (schema numbers, decision numbers)
│   ├── UI/                         UI_RULES, WORKER_RULES, ORCHESTRATOR_RULES, DECISIONS (the editor rebuild)
│   ├── 3D/                         3D working notes and agy task briefs
│   └── FUTURE/, Learn/, images/    later phases, learning notes, screenshots
├── public/                         fonts, icons, samples, mock-api-worker.js, stage-frame.html
├── bin/                            lazylayout-mcp (the agent bridge), nodescript-cli
├── extensions/nodescript-vscode    VS Code extension for NodeScript
├── scripts/                        roadmap and doc checkers, changelog fold, tooling
├── tests/                          e2e/ (Playwright), and support helpers; unit tests sit beside the code in __tests__/
└── src/                            see §2
```

## 2. `src/`

| Folder | What lives there |
|---|---|
| `src/app/` | Next.js routes: `/` (home), `/editor` (the new editor), `/editor/legacy` (the old one, no link), `/design-system`, `/database` |
| `src/editor/` | The new editor UI. `components/` (the shared UI kit, shown on `/design-system`), `shell/`, `stage/`, `panels/`, `motion/`, `motion-model/`, `viewport3d/`, `styles/`, labs (`stage-lab`, `surface-lab`, `gpu-lab`, `render-gallery`, `diagnostics`). Tailwind classes take the `ll:` prefix; colours come from tokens |
| `src/legacy-editor/` | The old editor (agent, blueprints, canvas, components, database, dialogs, fonts, menus, panels, shell, stage, styles, viewport); kept until the new UI reaches parity |
| `src/core/` | Pure logic, no page access (lint enforces it for `editing, document, frames, geometry, paint, breakpoints, text, store`). See §3 |
| `src/compiler/` | Code emitters and export: `ast-to-react`, `blueprint-to-js`, `motion-to-gsap`, `schema-to-prisma`, `emitters`, `export`, `bundler`, `validator` |
| `src/runtime/` | Runtime tooling: sandbox, bridge, inspector, mock API and database, hot reload, profiler, breakpoints/tracing |
| `src/ai/` | The co-pilot: agent, codegen, intent, layout, motion, review, scaffold, prompts, history, explain |
| `src/after/` | Stores for the later full-stack phase (blueprint, database, pages, state variables actions) |
| `src/components/`, `src/types/` | A shared menu component; ambient type declarations |

## 3. `src/core/` by subject

- **Document and editing:** `document` (the MDM, migrations, property paths, `editorOnly`), `commands` (the command registry), `store` (every store), `rules` (the rule table), `undo`, `selection`, `clipboard`, `editing`, `tools`, `keybindings`, `hooks`, `events`, `jobs`, `errors.ts`, `flags.ts`, `ids.ts`.
- **Layout and design:** `frames`, `geometry`, `layout` (auto layout), `breakpoints`, `pages`, `paint`, `paths`, `text`, `fonts`, `image`, `assets` (the asset store), `tokens`, `components`, `templates`, `inspector`, `viewport`, `workspace`, `hit`, `layers`, `links`.
- **Motion:** `animation`, `timeline`, `motion`, `time`, `engine`, `kernel`, `scroll`, `surface`, `expressions`, `nodescript`, `ast`, `wasm` (the TypeScript side of the kernel: spline solver, cable physics, spatial index, worker pool; there are no C++ sources in this repo).
- **3D:** `3d` (scenes, objects, meshes, modifiers, picking, snapping, primitives, text, SDF, viewport), `gpu`, `render`.
- **Platform:** `export`, `storage`, `collab`, `agent` (the agent bridge), `devmode`, `profiler`.

## 4. Data hierarchy

**In memory** (one document, held by the stores in `src/core/store`):

```text
Document (schema v7)
├── layers          Record<id, Layer>        tree by parentId / children; one root; archetype per layer
├── pages, breakpoints, tokens, modes, designComponents, components
├── clips, states, behaviours, sequences, transitions, bindings, surfaces, inputTapes, graphs, effects, generators, compositions
├── assets          imported files by content hash
├── 3D tables       scenes, objects, meshes, materials, lights, cameras, armatures, actions, worlds, images3d, texts, looks
└── exportSettings
```

A layer's properties live at property paths (`src/core/document`); every change is a command (`src/core/commands`), so undo, collaboration, the agent bridge and the code view all see the same edit.

**On disk and in the browser:**

- The project is one document (JSON, versioned, migrated on load); pictures are in the asset store (IndexedDB, keyed by content hash) and are embedded when a project file is saved.
- A second tab of the same project opens read-only (Phase 36).
- Export reads only the document and emits code for what the project uses; editor-only layers and attributes never ship (`isEditorOnlyLayer`, `EDITOR_ONLY_ATTRIBUTES`).

## 5. Flow of an edit

```text
gesture or shortcut or agent request
  → command (validated, with its rule from src/core/rules)
  → document store (one undo step)
  → render: the stage draws from the document; the code view and export read the same document
```

The editor measures the page and hands the result to core; core never reads the page (canvas contract rule 5, COLLABORATION §10).

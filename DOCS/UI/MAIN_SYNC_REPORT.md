# Main sync report: origin/main vs ui/redesign

Read-only analysis, 2026-11-10. Merge-base 13f1cffb. Source: git log/diff/merge-tree on refs only.

## 0. Key finding

main is NOT on the old UI. Since PR #62 (fc189e1, "new editor UI as the default editor") main already contains an **earlier version of our new `src/editor`** plus `src/legacy-editor` (old UI at `/editor/legacy`). So the path layout already matches ours: no rename problem, no legacy move to track. The friend then built on top of `src/editor` (117 files) and added engine features (253 files in `src/core`).

- Our branch (since merge-base): 621 files in `DOCS/UI`, 100 in `src/editor`. Nothing in `src/core`, `src/app`, `src/legacy-editor`, `package.json`, `eslint`, `CLAUDE.md`.
- main since merge-base: 666 files, +86.5k/-4.3k.
- Every NEW file main added under `src/editor` is absent on our branch (checked file by file). Conflicts are therefore all in files both sides edited.
- `src/legacy-editor` (61 files changed on main, mostly new panels): ours never touched it, so it merges clean.

## 1. The 62 commits by theme

| Theme | Commits (PR / sha) |
|---|---|
| Phases 39-52 engine + legacy UI (pen/vector, auto layout, grid, constraints, breakpoints, tokens, components, variants, pages, static export, MCP agent, templates) | d23c840, 5e422aa, 135715d, 82b88dc, 2a688b8 |
| Phases 64-68 timeline on document (canvas keyframes, precomp tabs, auto-key, graph editor) | a5fa657 |
| Phase 81 scroll model (parallax, reveal, pin in Preview) | d32ce6c |
| Docs/roadmap | 3df48ee (v4.1 roadmap, 277 phases), fe86ac9 |
| PR #62: merge of our UI into main, legacy kept at /editor/legacy | ce037af, fc189e1, 0422f16 (CLAUDE.md/AGENTS.md restored to main's), 13f0ee3 |
| e2e/test repair, dep cleanup (`@animate-ui/react`, `@base-ui`, `@floating-ui`, `radix-ui` removed) | 9282c25, 23a74aa, 5e9b23c, 579f11e, d363389, ea8ee24, 58ae713, 5cf6d24, c6e8459 |
| Component license swap (Cursor, ScrollFade own versions) | 73edaba |
| Lane A reconnect of new UI to engine (#63-#64) | 0551d91, 95f5a23, dd91f8e, 1c9644c, f53a86f (real-size stage, Image tool, in-place text edit, rect radius) |
| Lane A issue batches (#66-#80): command palette, page block, snap toggles, grips; testing rounds; engine-drawn canvas; stacking/depth; depth from one photo; loading pages; drag-select; smart cutout; device views, mirror frames, 3D text; road text; reliability pass; responsive frames/fold line/Preview | f69c980, def31d4, 7342d52, d6fd213, b00abcc, 87dc17f, 61cdc2f, 091a1bc, 01c4865, fb3d869 |
| Motion phases 69-73 (engine+stage): motion paths, auto-key + value HUD, onion skin + 60fps, anchor points/pins, parenting + helper layers | 0675859, d745057, 9bd2abc, 4573390, ac73d3e, 517c16e, 1c8dfff, 1dae115, e874eaf |
| Wiring motion phases 53-55 into new editor (animation category/trigger saved, one clock, one frame scheduler) | f11b76d, 9afede8, 48d21a4 |
| Phase 52 remediation (constraints, pen tool, breakpoint bar, preview, export, components-lab) | b5a4ad9, 43286c6 + merges #76-#79 |

## 2. Diff by area (files / +added / -removed)

| Area | Files | + | - |
|---|---|---|---|
| src/core | 253 | 42379 | 250 |
| src/editor | 117 | 13709 | 823 |
| tests/e2e | 80 (43 new specs) | 9063 | 250 |
| src/legacy-editor | 61 | 5466 | 311 |
| DOCS/INITIAL (changelog.d, roadmap) | 54 | 2532 | 542 |
| DOCS/UI | 31 | 1601 | 93 |
| scripts/pdf-content + other scripts | ~12 | ~3900 | 0 |
| src/app (new routes) | 3 | 905 | 0 |
| src/compiler | 4 | 134 | 0 |
| src/components (BranchedMenu) | 2 | 409 | 0 |
| bin/lazylayout-mcp | 3 | ~310 | 0 |
| .github/workflows, .githooks, reports/, BUSINESS/, tests/export-harness | misc | | |
| Root config | package.json (+9/-5), package-lock (+166/-1939), eslint.config.mjs (+33), CLAUDE.md (+4/-50), AGENTS.md (+2/-17), components.json (new), THIRD_PARTY_NOTICES.md |
| src/runtime, src/ai | 0 | | |

package.json: new scripts `verify`, `verify:full`, `mcp`, `test:canvas-contract`, `prepare` (sets git hooksPath); new deps `polygon-clipping`, `ws`, `@types/ws`; removed `@animate-ui/react`, `@base-ui/react`, `@floating-ui/react`, `radix-ui`.

New routes: `/editor/legacy` (`src/app/editor/legacy/page.tsx`, `LegacyStudioHeader.tsx`), `/editor/components-lab` (`src/app/editor/components-lab/page.tsx`, 531 lines, lab page).

## 3. UI changes on main (src/editor, to port into our new UI)

Main's `src/editor` is our UI + friend's wiring. For each item the file to read is the main path (use `git show origin/main:<path>`). U = user-visible.

### 3a. New stage features (all new files in `src/editor/stage/`)
| Feature | File | What it does | U |
|---|---|---|---|
| Value HUD | `ValueHud.tsx` | Live x/y/rotation/opacity next to dragged element in auto-key | yes |
| Motion path overlay | `MotionPathOverlay.tsx` | Editable bezier trajectories for position keyframes | yes |
| Onion skin | `OnionSkinOverlay.tsx` | Ghost frames before/after playhead (toggle not yet in toolbar per WIRING doc) | yes |
| Anchor/pins | `AnchorOverlay.tsx` | 9 preset + custom pin handle; drag with modifier only | yes |
| Corner pin / warp mesh | `CornerPinOverlay.tsx`, `WarpMeshOverlay.tsx` | Perspective corner-pin and mesh warp handles | yes |
| Draft path | `DraftPath.tsx` | Pen tool in-progress path preview | yes |
| Transition references | `TransitionReferences.tsx` | Visual refs for state transitions | yes |
| Device views / mirror frames | `deviceViews.ts`, `useMirrorViews.ts`, `presetBreakpoints.ts` | Phone/tablet/desktop side views of a page, mirrored frames, breakpoint presets | yes |
| Page sheet / measure / active page | `pageSheet.ts`, `pageMeasure.ts`, `activePage.ts` | Real-size page drawn via engine, hit boxes measured from drawn DOM | structural |
| Marquee, create-from-drag | `marquee.ts`, `createFromDrag.ts` | Drag-select and drag-to-create with live size | yes |
| Letters | `measureLetters.ts` | Per-letter measure (standing letters / 3D text) | yes |
| Modified | `Artboard.tsx`, `Stage.tsx`, `TransformOverlay.tsx`, `useStageTransform.ts`, `constants.ts`, `types.ts` | Engine-drawn canvas (`RenderLayer`), canvas contract (drag only with modifier for anchors) | yes |

### 3b. Canvas chrome / shell
| Item | File | What | U |
|---|---|---|---|
| Breakpoint bar | `shell/canvas-chrome/BreakpointBar.tsx` | Monitor/Tablet/Phone switch, add breakpoint width, "show all", responsive flag. Uses `useBreakpointStore`, `useBreakpointViewStore`, `breakpointsOf` | yes |
| Stage origin | `canvas-chrome/stageOrigin.ts` | Ruler/chrome origin sync | no |
| Insert commands | `canvas-chrome/insertCommands.ts` (M) | Insert tiles now create real layers | yes |
| Toolbar, CanvasChrome, Rulers (M) | `canvas-chrome/Toolbar.tsx`, `CanvasChrome.tsx`, `Rulers.tsx` | Image tool, snap toggles, grips, tool states. Pen/vector buttons still missing | yes |
| Connected command palette | `shell/ConnectedCommandPalette.tsx` | Ctrl+K backed by engine commands | yes |
| Shell wiring | `shell/EditorShell.tsx`, `useEditorActions.ts`, `RightPanelConnected.tsx`, `prototypeDocument.ts` | Mounts legacy `ExportDialog` and `AgentDialog` (imported from `@/legacy-editor/shell/`), installs transport driver/commands, autosave/lock | yes (Export, Agent pairing dialogs) |
| Left panel (M) | `left-panel/LayersTree.tsx`, `LeftPanel.tsx`, `LayerContextMenu.tsx`, `AssetsSection.tsx`, `types.ts`; `panels/layers/useLeftPanelData.ts`, `usePagesData.ts` | Real layers, pages (create/rename/delete), assets upload | yes |

### 3c. Inspector (src/editor/panels/details)
| Item | File | What | U |
|---|---|---|---|
| Component section | `sections/ComponentSection.tsx` (new) | Instance, detach, reset overrides, variant props add/remove | yes |
| Link section | `sections/LinkSection.tsx` (new) | Link kind none/page/anchor/url, pages from `core/pages` | yes |
| Cutout dialog | `CutoutDialog.tsx` (new) | Smart cutout: snap drawn shape to edges, depth estimate, depth layers | yes |
| Colour swatch | `controls/ColorSwatch.tsx` (new) | Swatch control | yes |
| Hooks | `hooks/effectsModel.ts`, `hooks/shapeProps.ts` (new), `useSelectionInspector.ts` (M) | Effects and shape props read/write document | no |
| Modified sections | Appearance, Fill, Stroke, Effects, Image, Layout, Position, Typography, Shape, Page, Background, Icon, Divider, Toggle, Accessibility, Object3D | Writes real document; gradient stops, per-side strokes, line ends; layout stack/grid/Hug/Fill; Z field sets z-index | yes |
| Motion inspectors | `panels/inspectors/LayerInspector.tsx`, `KeyframeInspector.tsx` | Animation category + trigger saved to document | yes |

### 3d. Timeline / motion
`panels/timeline/*` (Lane, Panel, Playhead, Ruler, Transport all M): transport on one clock, auto-key toggle, scheduler-phased playhead. `motion-model/sync.ts` (new), `store.ts`, `model.ts`, `types.ts` (M): document <-> motion-model sync. `motion/surface.ts` (M). Four new unit tests under `motion-model/__tests__/`.

### 3e. Components (design system)
New `components/Cursor.tsx`, `components/ScrollFade.tsx` (replace `components/imported/cursor|scroll-fade`, license replacement). Modified: CommandPalette, Menu, ModeTabs, NumberField, PageSwitcher, Popover, Select, TopBar, `index.ts`, `design-system/DesignSystemPage.tsx`, `demos/CanvasDemos2.tsx`.

### 3f. Features that exist ONLY in `src/legacy-editor` on main (no new-UI screen yet)
Main at `/editor/legacy` has these; they need design in our UI (read the legacy file):
| Feature | Main path |
|---|---|
| Pen/pencil/vector edit layer, vector bar | `canvas/vector/VectorEditLayer.tsx`, `useVectorEdit.ts`, `canvas/tools/pathTools.ts`, `panels/details/VectorBar.tsx` |
| Auto layout / grid / layout grids panels | `panels/details/AutoLayoutPanel.tsx`, `GridPanel.tsx`, `LayoutGridsPanel.tsx`, `canvas/overlay/GridOverlay.tsx`, `LayoutGridsOverlay.tsx` |
| Breakpoint canvas + views + preview bar | `canvas/BreakpointBar.tsx`, `BreakpointViews.tsx`, `PreviewBar.tsx`, `CanvasFrames.tsx` |
| Tokens / variables manager | `panels/tokens/TokenManager.tsx`, `panels/details/BindingsPanel.tsx` |
| Components list, overrides | `panels/assets/ComponentsList.tsx`, `panels/details/ComponentPanel.tsx`, `OverridesPanel.tsx` |
| Pages manager | `panels/pages/PagesPanel.tsx` |
| Sections/templates gallery | `shell/SectionsGallery.tsx` |
| Export dialog + code panels + Dev mode | `shell/ExportDialog.tsx`, `panels/export/ExportCodePanel.tsx`, `DevModePanel.tsx`, `panels/details/paint/ExportSettingsEditor.tsx` |
| Graph (curve) editor | `panels/graph/GraphEditorPanel.tsx`, `styles/graph-editor.css` |
| Agent pairing | `shell/AgentDialog.tsx`, `agent/agentConnection.ts` |
| Paint extras | `paint/SelectionToolsEditor.tsx`, `StrokeSettingsEditor.tsx`, `TextExtrasEditor.tsx` |
| Link panel | `panels/details/LinkPanel.tsx` |

Note: main's new editor already mounts the legacy `ExportDialog` and `AgentDialog` directly (stopgap, old styling).

## 4. Engine-side changes the UI connects to (src/core only; compiler +134 lines, runtime/ai none)

New modules (adds per area): editing (14: booleanGroups, layoutOps/Commands, vectorOps, networkOps, selectionTools, shapeBuilder, scaleLayers, splitText, standingLetters, outlineStroke, svgImportOps), paths (13: pen model, booleans, brush, pathFit, svgImport, vectorNetwork), geometry (11: affine, cornerPin, meshWarp, pins, parentTransforms, spatialPath, measure), store (11), export/site (11: static site export, layerExport, editorExport), timeline (7: graph, keyframeOps, lanes, onionSkin, tabs, compositionOps), templates (6: sections, starters, brand), pages (5: pages, pageOps, pageCommands, loadingPages, previewOps), layout (5: stack, grid, constraints, layoutGrids), components (5: instances, variantOps, componentCommands), tokens (4), scroll (4: model, ScrollDriver, scrollCommands, frameHost), devmode (4), breakpoints (4), agent (4: protocol, agentHost, agentCommands), image (cutout, smart), frames (devices, containerOps), text (textFeatures, textOps), document/editorOnly.ts (helper layers), animation/stackAdapter.ts.

New zustand stores (`src/core/store/`): `useModeStore`, `useBreakpointStore`, `useBreakpointViewStore`, `useDraftPathStore`, `useVectorEditStore`, `usePreviewStore`, `useFramePreviewStore`, `useExportUiStore`, `useAgentUiStore`, `useTemplatesUiStore`, `useStackDropStore`. Time: `core/time/transport`, `transportCommands`, `transportDriver`, `scheduler` (changed, 4 files).

Pattern: features are exposed as commands via `invokeCommand` from `@/core/commands` (e.g. pageCommands, layoutCommands, componentCommands, tokenCommands, breakpointCommands, scrollCommands, templateCommands, devCommands, exportCommands, agentCommands). UI should call these, not mutate the document.

New props/document keys seen in UI code: `breakpoints.responsive`, `render.role: helper`, `layout.auto`, `paint.fills`. Schema migration v5-to-v6 for motion (Exit/Focus/Stagger/LayoutTransition clips, `pointerMove`/`drag`/`time` triggers).

Other: MCP bridge `bin/lazylayout-mcp.ts` (+ `bridgeServer.ts`, `mcpServer.ts`, uses `ws`), run via `npm run mcp`; compiler emitters skip helper layers.

## 5. Conflicts (`git merge-tree --write-tree --name-only ui/redesign origin/main`)

Merge result tree 3378c3e5. **27 conflicted files**, all content conflicts, none are modify/delete or rename conflicts. 34 files changed on both sides in total (excluding handoffs); the other 7 auto-merged (ModeTabs, Popover, Select, `RowSettingsPopover`, `DesignSystemPage`, `LeftPanel`, `canvas-chrome/types.ts` were auto-merged).

| Area | Conflicting paths |
|---|---|
| Docs (2) | `DOCS/UI/DECISIONS.md`, `DOCS/UI/PARITY.md` |
| components (4) | `Menu.tsx`, `TopBar.tsx`, `index.ts` (src/editor/components/) ; `motion-model/store.ts` |
| Inspector hook + sections (8) | `panels/details/hooks/useSelectionInspector.ts`; sections: `AppearanceSection`, `FillSection`, `ImageSection`, `LayoutSection`, `PageSection`, `PositionSection`, `TypographySection` |
| Timeline (5) | `panels/timeline/TimelineLane`, `TimelinePanel`, `TimelinePlayhead`, `TimelineRuler`, `TimelineTransport` |
| Shell (6) | `shell/EditorShell.tsx`, `canvas-chrome/CanvasChrome.tsx`, `canvas-chrome/Toolbar.tsx`, `left-panel/LayersTree.tsx`, `right-panel/RightPanelSection.tsx` |
| Stage (3) | `stage/Artboard.tsx`, `stage/Stage.tsx`, `stage/index.ts` |

Not in conflict: `src/core`, `src/legacy-editor`, `src/app`, `src/compiler`, tests, package.json, eslint, CLAUDE.md (ours never touched them, so main's version wins cleanly). Note CLAUDE.md on main is main's own rules (the rebuild rules were moved there to `DOCS/UI/ORCHESTRATOR_RULES.md`/`WORKER_RULES.md`); after merge our CLAUDE.md/`@DOCS/UI/UI_RULES.md` import would be replaced by main's: check before merging.

Semantic (non-textual) risks:
- Ours rebuilt the sections with Tailwind `ll:` tokens and new components; main's sections are the old styling plus real document wiring. Taking "ours" in the 8 inspector conflicts would DROP the engine wiring; taking "theirs" drops our redesign. Needs manual port of main's hooks (`shapeProps.ts`, `effectsModel.ts`, `useSelectionInspector.ts`) onto our section markup.
- Stage: main's `Artboard.tsx` draws via the engine (`RenderLayer`) with measured hit boxes; our Stage files diverged. Port, do not pick a side.
- `TopBar`/`Menu`/`index.ts`: main adds Export/Agent dialog entry points and `Cursor`/`ScrollFade` exports (removes `components/imported/*`). Our design-system page references must follow.
- Removed deps (`radix-ui`, `@base-ui/react`, `@floating-ui/react`, `@animate-ui/react`): check ours does not import them (we were told no new deps; verify with a grep after merge).
- Git hook `prepare` script sets `core.hooksPath .githooks` (pre-push); eslint.config.mjs gained 33 lines (architecture guards for legacy-editor).
- main e2e specs assume main's `data-testid`s (`DOCS/UI/handoffs/e2e-testids.md` on main); our rebuilt DOM will break many of the 43 new/80 changed specs.
- main's `DOCS/UI/handoffs` (LATEST.md, etc.) and `PARITY.md` describe main's UI state, not ours.

## 6. Things to design next (priority order)

| # | Design item | Why | Effort |
|---|---|---|---|
| 1 | Breakpoint bar + responsive frames / device views / fold line / Preview (`BreakpointBar.tsx`, `deviceViews.ts`, `useMirrorViews.ts`) | Core responsive workflow; main already ships a bar in the new editor | M |
| 2 | Pen/pencil/vector edit tools, draft path, vector bar, boolean ops menu | Toolbar has no pen/vector yet; heavy engine support exists | L |
| 3 | Auto layout / grid / constraints / layout-grids controls (Layout section extension, grid overlay) | Engine in `core/layout`, only legacy UI | M |
| 4 | Export dialog + code export + Dev mode (replace mounted legacy `ExportDialog`) | Stopgap legacy dialog is live in main's shell | M |
| 5 | Tokens/variables manager + bindings | `core/tokens`; Theme & Tokens fields not connected | M |
| 6 | Components & variants: Components list, ComponentSection (instance, detach, variant props), overrides | New section on main; Insert > Components still sample | M |
| 7 | Motion overlays: value HUD, motion paths, onion skin toggle, anchor/pin handles, corner pin/warp mesh | New stage overlays user-visible in Motion mode | M |
| 8 | Agent pairing dialog (MCP) + Pages manager + Sections gallery / templates | Legacy dialog mounted; pages/sections only partly connected | S-M |
| 9 | Link section, Cutout/depth dialog, Cursor/ScrollFade components | New small inspector pieces; already exist in main's styling | S |
| 10 | Timeline additions: precomp/interaction tabs, graph (curve) editor panel, parenting pick-whip, blend modes/masks, effect stack, states/transitions (WIRING-53-80.md lists these as not wired) | Large Motion surface still absent even on main | L |

Suggested merge order: (a) merge in a scratch branch, take main for all non-editor paths, (b) per-file port of the 27 conflicts, (c) re-run e2e and map data-testids.

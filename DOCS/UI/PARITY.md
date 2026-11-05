# UI parity: the build queue

Everything the old UI has, so nothing is missed. The orchestrator works from the top of the table down. Files in `src/legacy-editor` are the reference. The new UI goes in `src/editor`.

- **Status:** `todo`, `wip`, `done` or `blocked`. This column is the record of what is left. Do not use a grep for it, because rebuilt components may still import non-visual logic from legacy.
- **Order:** foundations and the shell come first, because the new `EditorShell` hosts everything else. It mounts legacy panels until each is rebuilt, so one area can be swapped at a time.
- **Reference caveat:** `src/legacy-editor` includes the first top-bar and color experiments. The original UI, before them, is at commit `dcd7695`.
- **Not listed:** 22 legacy test files in `__tests__` folders (move or rewrite them with their area, and keep the logic ones) and 7 empty `.gitkeep` placeholders.

**Status, 2026-11-03:** read `DOCS/UI/BUILD_SESSION.md` first. It covers the two sessions (Opus for design, Sonnet for build), the build queue mapped to the prototype, and the rules workers keep breaking. Built and committed: foundations (five themes, tokens, Nook motion engine), 21 core components, and `/design-system`.

**Status, 2026-11-05 (PR #62 open on `integrate/main-into-new-ui`):**
- **Core Rebuild & Real Document:** Waves 0, 1, and 2 are built, checked against the prototype, and committed. The stage, layers tree, inspector, code view and timeline read and write the real engine document (commit `d7df6af`); initial projects auto-seed 16 prototype layers, and demo-data stopgaps (`PROTOTYPE_ELEMENTS`, `SAMPLE_STAGE_ELEMENTS`, `mockOverrides`) are completely removed. Edits persist to IndexedDB and undo/redo cleanly. The core prototype UI (Design, Motion, Code modes, top bar, left panel, canvas chrome, stage, timeline, inspectors, transitions, and 94 design system sections) is `done`.
- **Merge of `main` & Legacy Route:** `origin/main` (phases 39 to 81: pen and vector tools, auto layout, breakpoints, tokens, components and variants, MCP agent, templates, scroll model) was merged into the new UI branch (commit `ce037af`). Main's old-UI code lives under `src/legacy-editor` and the old editor stays reachable at `/editor/legacy` (`src/app/editor/legacy/page.tsx` and `LegacyStudioHeader.tsx`); `/editor` is the new editor. Pull Request #62 into `main` is open: https://github.com/NetPranav/LazyLayout/pull/62 (branch `integrate/main-into-new-ui`; `ui/redesign` also exists on GitHub and is older).
- **Cleanups & Bugfixes:** The two components with unverified licenses (Cursor, Scroll Fade) were replaced by our own code (commit `73edaba`); `src/editor/components/imported/` is completely removed; zero license blockers remain. Unused dependencies `@animate-ui/react`, `@base-ui/react`, `@floating-ui/react`, and `radix-ui` were removed (commits `58ae713` and `5cf6d24`) because `@animate-ui/react` broke `npm ci` in CI. Timeline playback running at ~3 fps of real speed was fixed with a sub-frame accumulator (commit `ea8ee24`).
- **E2E Test Suite:** The shared helper `tests/e2e/support/editor.ts` defaults to the NEW editor (`EDITOR_URL = "/editor"`) and exports `LEGACY_EDITOR_URL = "/editor/legacy"`; every spec names its target explicitly (29 specs from main target legacy). Full suite on production build: **199 passed, 65 skipped (`test.fixme` with written reasons), 0 failed, 0 flaky (264 tests total)**. Group handoffs: `DOCS/UI/handoffs/*-e2e-g1..g4.md`, `*-e2e-target-audit.md`, `*-fix-8-tests.md`, `*-legacy-e2e.md`, `*-playback-fix.md`, `*-merge-main.md`.
- **Known Gaps:**
  1. New-UI screens for main's features (pen and vector tools, auto layout, breakpoints, tokens, components and variants, templates, scroll model, export) do not exist yet in `src/editor`: they exist only at `/editor/legacy` and need designs from the design session (`DOCS/UI/design/REQUESTS.md`).
  2. Old-app areas with no new version (home page launcher/project hub, database studio, blueprint shell only, content browser, copilot, deployment, global search, history, pages manager, plugins, settings, state, versioning, dependencies, execution trace, render gallery, fonts) remain `todo` and need design direction.
  3. The 65 `test.fixme` tests remain skipped until their corresponding features are built.
  4. Responsive widths (1024 and 390) and reduced-motion compliance across all springs are not visually verified.
  5. The six non-default themes (White, Warm, Lilac, Noir, Graphite, Darkroom) not visually checked across all panels.
  6. Firefox compatibility: `NumberField` uses `field-sizing: content` (needs fallback or verification).
  7. Final side-by-side screenshots (Paper and Dark across Design/Motion/Code) not yet taken.
  8. Timeline header token is 44px (prototype task said 40).
  9. Lint: 0 errors (the one error in `src/legacy-editor/menus/UnifiedLogoMenu.tsx` was fixed in the merge review).

**Phase 1:** foundations, `design-system`, `shell`, `menus`. **Phase 2:** `canvas`, `stage`, `panels/layers`, `panels/details`, `panels/timeline`, `panels/motion`, `panels/code`, `panels/code-view`, `panels/console`, `styles`. **Phase 3:** `panels/launcher` and everything else.

| Area | Status | Location in `src/editor` | Legacy files | Bridged entry points / notes |
|---|---|---|---|---|
| `foundations` (tokens, type and spacing scales, base components) | done | `src/editor/styles/` (`tokens.css`, `tailwind.css`, `animations.css`), `src/editor/motion/` | new | Eight official themes, label colours, token blocks, Nook spring engine |
| `design-system` (the `/design-system` page, shows every component and its states) | done | `src/editor/design-system/`, `src/app/design-system/` | new | 94 interactive sections wired |
| `shell` | done | `src/editor/shell/` (`EditorShell.tsx`), `src/editor/components/TopBar.tsx` | 38 | `DetachedPanelShell.tsx` (bridge kept); legacy editor kept at `/editor/legacy` with `LegacyStudioHeader.tsx` |
| `menus` | done | `src/editor/components/` (`Menu.tsx`, `ContextMenu.tsx`, `Select.tsx`, `Popover.tsx`) | 4 | Rebuilt with Nook motion engine |
| `canvas` | done | `src/editor/shell/canvas-chrome/` (`Toolbar.tsx`, `Rulers.tsx`, `AiBox.tsx`, `InsertPanel.tsx`, `ViewOptionsPopover.tsx`, `ZoomControls.tsx`) | 20 | Rebuilt from prototype; main's vector and pen tools live in legacy at `/editor/legacy` |
| `stage` | done | `src/editor/stage/` (`Stage.tsx`, `StageViewport.tsx`, `SelectionOverlay.tsx`, `TransformHandles.tsx`, `HoverOutline.tsx`, `SnapGuides.tsx`) | 2 | Reads/writes real document (d7df6af) |
| `runtime` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/runtime/`) | 3 | - |
| `panels/ai` | wip | `src/editor/shell/canvas-chrome/AiBox.tsx`, `src/editor/shell/right-panel/AiChatView.tsx` | 3 | UI built from prototype; engine copilot integration pending; main's MCP agent lives in legacy |
| `panels/assets` | wip | `src/editor/shell/left-panel/` (`AssetsSection.tsx`, `AssetTile.tsx`, `AssetImage.tsx`) | 1 | UI built in left panel; asset pipeline and store integration pending |
| `panels/blueprint` | todo | `src/editor/panels/blueprint/BlueprintCanvas.tsx` | 8 | `BlueprintCanvas.tsx` (coming soon shell only for Logic and Data) |
| `panels/code` | done | `src/editor/panels/code-view/CodeInspector.tsx`, `src/editor/panels/inspectors/` | 1 | Rebuilt in Code mode right panel |
| `panels/code-view` | done | `src/editor/panels/code-view/` (`CodePanel.tsx`, `CodeEditor.tsx`, `ConsoleView.tsx`, `TraceView.tsx`) | 2 | Rebuilt from prototype; reads real document |
| `panels/common` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/common/`) | 1 | `PropertyBlueprintBindingControl.tsx` |
| `panels/console` | done | `src/editor/panels/console/OutputConsole.tsx` | 1 | Wraps `ConsoleView` & `TraceView` from `code-view` |
| `panels/content-browser` | todo | `src/editor/panels/content-browser/` | 4 | `ContentBlockShelf.tsx`, `ContentBrowser.tsx`, `AssetFileEditor.tsx` (bridges) |
| `panels/copilot` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/copilot/`) | 1 | `AiPromptBar.tsx` |
| `panels/curves` | todo | `src/editor` (EasingEditor ported in `panels/inspectors/`; dedicated panel not rebuilt) | 2 | `CurveEditor.tsx`, `SpringEditor.tsx` |
| `panels/database` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/database/`) | 10 | Needs design |
| `panels/dependencies` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/dependencies/`) | 2 | `ReferenceViewerPanel.tsx` |
| `panels/deployment` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/deployment/`) | 5 | Needs design |
| `panels/details` | done | `src/editor/panels/details/`, `src/editor/shell/right-panel/` (`DetailsInspector.tsx`, sections, controls) | 46 | Rebuilt from prototype; reads real document; main's auto layout, breakpoints, tokens in legacy |
| `panels/execution-trace` | todo | `src/editor` (TraceView built inside code-view; standalone panel not rebuilt) | 1 | `ExecutionTracePanel.tsx` |
| `panels/global-search` | todo | `src/editor` (no new version yet; `CommandPalette` built in components) | 2 | `GlobalSearchPanel.tsx` |
| `panels/history` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/history/`) | 2 | `UndoHistoryPanel.tsx` |
| `panels/launcher` | todo | `src/editor/panels/launcher/` (project hub home page) | 6 | `ProjectHub.tsx`, `TechConfigurator.tsx`, `archetypeData.ts` (bridges) |
| `panels/layers` | done | `src/editor/shell/left-panel/` (`LayersTree.tsx`), `src/editor/panels/layers/` | 1 | Rebuilt from prototype; reads real document |
| `panels/motion` | done | `src/editor/panels/inspectors/` (`KeyframeInspectorView.tsx`, `EasingEditor.tsx`, `LayerInspector.tsx`, `CompositionInspector.tsx`) | 1 | Rebuilt from prototype |
| `panels/pages-manager` | todo | `src/editor` (PageSwitcher dropdown built; full manager not rebuilt) | 4 | `NavigationFlowDiagram.tsx`, `PagesManager.tsx`, `RouteCard.tsx` |
| `panels/plugins` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/plugins/`) | 2 | `PluginManager.tsx` |
| `panels/sequencer` | todo | `src/editor/panels/sequencer/TimelineSequencer.tsx` | 8 | `TimelineSequencer.tsx` (bridge to legacy) |
| `panels/settings` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/settings/`) | 1 | `ProjectSettings.tsx` |
| `panels/state` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/state/`) | 1 | `StateMatrixViewer.tsx` |
| `panels/timeline` | done | `src/editor/panels/timeline/`, `src/editor/motion-model/` | 1 | Rebuilt from prototype; reads real document; subframe accumulator fixed 3 fps playback bug (ea8ee24) |
| `panels/versioning` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/panels/versioning/`) | 2 | `VersionControlPanel.tsx` |
| `stage-lab` | todo | `src/editor/stage-lab/` | 2 | `CanvasLab.tsx`, `StageLab.tsx` (bridges) |
| `render-gallery` | todo | `src/editor/render-gallery/` | 1 | `RenderGallery.tsx` (bridge) |
| `fonts` | todo | `src/editor` (no new version yet; legacy in `src/legacy-editor/fonts/`) | 2 | `FontSync.tsx`, `useFontSync.ts` |
| `styles` | done | `src/editor/styles/` (`tokens.css`, `tailwind.css`, `animations.css`, `globals.css`) | 23 | Replaced by new token and utility architecture |

## Files per area

### `shell` (38)
`shell/AiDockColumn.tsx`, `shell/AiDockOverlays.tsx`, `shell/CanvasChrome.tsx`, `shell/CollaboratorAvatarStack.tsx`, `shell/CommandPalette.tsx`, `shell/DetachedPanelShell.tsx`, `shell/DockCornerSplitter.tsx`, `shell/DockSplitter.tsx`, `shell/DockTabBar.tsx`, `shell/DockTree.tsx`, `shell/DockZone.tsx`, `shell/EditorShell.tsx`, `shell/FullPageDock.tsx`, `shell/LayoutsMenu.tsx`, `shell/MainToolbar.tsx`, `shell/OutputLogDrawer.tsx`, `shell/ParityBadge.tsx`, `shell/PersistenceUi.tsx`, `shell/ReadOnlyBanner.tsx`, `shell/StatusBar.tsx`, `shell/StudioCenterToolbar.tsx`, `shell/StudioHeader.tsx`, `shell/TearOffDragOverlay.tsx`, `shell/TransportBar.tsx`, `shell/WorkspaceTabStrip.tsx`, `shell/afterTrackPanels.tsx`, `shell/dockTabs.ts`, `shell/hooks/useAiDock.ts`, `shell/hooks/useDockLayers.ts`, `shell/hooks/useFullPageDock.ts`, `shell/hooks/useProjectFiles.ts`, `shell/hooks/useProjectLock.ts`, `shell/hooks/useShellCommands.ts`, `shell/hooks/useWorkspace.ts`, `shell/panels/PanelHost.tsx`, `shell/panels/builtins.tsx`, `shell/panels/context.ts`, `shell/panels/registry.ts`

### `menus` (4)
`menus/MenuDropdown.tsx`, `menus/UnifiedLogoMenu.tsx`, `menus/WindowMenu.tsx`, `menus/menuModel.tsx`

### `canvas` (20)
`canvas/AssetNotice.tsx`, `canvas/CanvasContextMenu.tsx`, `canvas/CanvasFrames.tsx`, `canvas/CanvasRulers.tsx`, `canvas/CollabCursorOverlay.tsx`, `canvas/FloatingDock.tsx`, `canvas/Scene3DViewport.tsx`, `canvas/WasmCableCanvas.tsx`, `canvas/WhiteboardCanvas.tsx`, `canvas/ZoomControls.tsx`, `canvas/guides.ts`, `canvas/overlay/OverlayController.ts`, `canvas/overlay/OverlayLayer.tsx`, `canvas/snapEnv.ts`, `canvas/text/TextEditor.tsx`, `canvas/text/domText.ts`, `canvas/tools/toolRuntime.ts`, `canvas/tools/useToolKeys.ts`, `canvas/transformModel.ts`, `canvas/useFrames.ts`

### `stage` (2)
`stage/StageFrame.tsx`, `stage/StageHost.tsx`

### `runtime` (3)
`runtime/SandboxHost.tsx`, `runtime/escapeHtml.ts`, `runtime/frameBridge.ts`

### `panels/ai` (3)
`DiffPreview.tsx`, `MotionAICoPilot.tsx`, `index.ts`

### `panels/assets` (1)
`AssetsPanel.tsx`

### `panels/blueprint` (8)
`ActionPaletteModal.tsx`, `BlueprintCanvas.tsx`, `CommentBox.tsx`, `MyBlueprintPanel.tsx`, `NodeCard.tsx`, `PinHandle.tsx`, `RerouteNode.tsx`, `ValidationPanel.tsx`

### `panels/code` (1)
`CodeInspector.tsx`

### `panels/code-view` (2)
`LiveCodeInspector.tsx`, `index.ts`

### `panels/common` (1)
`PropertyBlueprintBindingControl.tsx`

### `panels/console` (1)
`OutputConsole.tsx`

### `panels/content-browser` (4)
`AssetFileEditor.tsx`, `ContentBlockShelf.tsx`, `ContentBrowser.tsx`, `stackTreeData.ts`

### `panels/copilot` (1)
`AiPromptBar.tsx`

### `panels/curves` (2)
`CurveEditor.tsx`, `SpringEditor.tsx`

### `panels/database` (10)
`DatabaseCenterStage.tsx`, `DatabaseDesigner.tsx`, `DatabaseDetailsPanel.tsx`, `DatabaseLatchPickerModal.tsx`, `DatabaseLeftExplorer.tsx`, `DatabaseStatusBar.tsx`, `DatabaseStudio.tsx`, `EntityTableCard.tsx`, `FieldEditor.tsx`, `MockDataGrid.tsx`

### `panels/dependencies` (2)
`ReferenceViewerPanel.tsx`, `index.ts`

### `panels/deployment` (5)
`DeploymentDashboard.tsx`, `DeploymentHistory.tsx`, `DomainManager.tsx`, `ProviderSelector.tsx`, `index.ts`

### `panels/details` (46)
`AddComponentPalette.tsx`, `AlignBar.tsx`, `AssetDetailsInspector.tsx`, `DetailsInspector.tsx`, `EnvironmentInspector.tsx`, `FontPicker.tsx`, `SectionRail.tsx`, `TextProperties.tsx`, `controls/AssetReferencePicker.tsx`, `controls/BezierCurveModal.tsx`, `controls/BoxModelDiagram.tsx`, `controls/ColorField.tsx`, `controls/EasingCurveSelector.tsx`, `controls/GradientEditor.tsx`, `controls/JsonObjectEditor.tsx`, `controls/KeyframeTimeline.tsx`, `controls/NumberField.tsx`, `controls/ScrubNumber.tsx`, `controls/ScrubNumberInput.tsx`, `controls/ShadowEditor.tsx`, `controls/StateVariablePicker.tsx`, `controls/TextAlignToggle.tsx`, `controls/TransformOriginPicker.tsx`, `paint/ColorPicker.tsx`, `paint/EffectsEditor.tsx`, `paint/ImageFillControls.tsx`, `paint/ImageSourcePicker.tsx`, `paint/PaintEditor.tsx`, `paint/SwatchPopover.tsx`, `pro/ProFace.tsx`, `sections/AnimationEditor.tsx`, `sections/AppearanceEditor.tsx`, `sections/BackgroundSection.tsx`, `sections/ButtonStateEditor.tsx`, `sections/ContainerLayoutEditor.tsx`, `sections/DataBindingEditor.tsx`, `sections/DividerSection.tsx`, `sections/ImagePropertiesEditor.tsx`, `sections/InputValidationEditor.tsx`, `sections/LayoutSpacingEditor.tsx`, `sections/MaterialInspectorSection.tsx`, `sections/MediaSection.tsx`, `sections/SvgVectorSection.tsx`, `sections/TextContentEditor.tsx`, `sections/TypographyEditor.tsx`, `simple/SimpleFace.tsx`

### `panels/execution-trace` (1)
`ExecutionTracePanel.tsx`

### `panels/global-search` (2)
`GlobalSearchPanel.tsx`, `index.ts`

### `panels/history` (2)
`UndoHistoryPanel.tsx`, `index.ts`

### `panels/launcher` (6)
`ArchetypePicker.tsx`, `LazyLayoutLogo.tsx`, `ProjectHub.tsx`, `ScopeCard.tsx`, `TechConfigurator.tsx`, `archetypeData.ts`

### `panels/layers` (1)
`LayersPanel.tsx`

### `panels/motion` (1)
`MotionInspector.tsx`

### `panels/pages-manager` (4)
`NavigationFlowDiagram.tsx`, `PagesManager.tsx`, `RouteCard.tsx`, `index.ts`

### `panels/plugins` (2)
`PluginManager.tsx`, `index.ts`

### `panels/sequencer` (8)
`AnimationExportPreview.tsx`, `KeyframeTrack.tsx`, `MotionSequencer.tsx`, `PlayheadControls.tsx`, `ScrollTriggerBar.tsx`, `StaggerManager.tsx`, `TimelineSequencer.tsx`, `TrackHeader.tsx`

### `panels/settings` (1)
`ProjectSettings.tsx`

### `panels/state` (1)
`StateMatrixViewer.tsx`

### `panels/timeline` (1)
`TimelinePanel.tsx`

### `panels/versioning` (2)
`VersionControlPanel.tsx`, `index.ts`

### `stage-lab` (2)
`stage-lab/CanvasLab.tsx`, `stage-lab/StageLab.tsx`

### `render-gallery` (1)
`render-gallery/RenderGallery.tsx`

### `fonts` (2)
`fonts/FontSync.tsx`, `fonts/useFontSync.ts`

### `styles` (23)
`styles/ai-copilot.css`, `styles/animations.css`, `styles/assets.css`, `styles/code-inspector.css`, `styles/database-studio.css`, `styles/detached.css`, `styles/dock.css`, `styles/forms.css`, `styles/fullpage-dock.css`, `styles/globals.css`, `styles/launcher.css`, `styles/layers.css`, `styles/menus.css`, `styles/paint.css`, `styles/panels.css`, `styles/pro-face.css`, `styles/sequencer.css`, `styles/showcase.css`, `styles/simple-face.css`, `styles/timeline.css`, `styles/tokens.css`, `styles/top-bar.css`, `styles/whiteboard.css`

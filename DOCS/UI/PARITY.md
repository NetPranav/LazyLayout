# UI parity: the build queue

Everything the old UI has, so nothing is missed. The orchestrator works from the top of the table down. Files in `src/legacy-editor` are the reference. The new UI goes in `src/editor`.

- **Status:** `todo`, `wip`, `done` or `blocked`. This column is the record of what is left. Do not use a grep for it, because rebuilt components may still import non-visual logic from legacy.
- **Order:** foundations and the shell come first, because the new `EditorShell` hosts everything else. It mounts legacy panels until each is rebuilt, so one area can be swapped at a time.
- **Reference caveat:** `src/legacy-editor` includes the first top-bar and color experiments. The original UI, before them, is at commit `dcd7695`.
- **Not listed:** 22 legacy test files in `__tests__` folders (move or rewrite them with their area, and keep the logic ones) and 7 empty `.gitkeep` placeholders.

**Status as of 2026-10-31 (pushed to origin):** done so far: Tailwind base (`ll:` prefix), Geist fonts, dark-first semantic palette, the `/design-system` page, the shell top bar at `/editor`, and 12 imported components (as-is, restyle later). Next: shell step 2 (left rail and panel), then canvas toolbar, right panel, timeline, `menus`, project hub. Phase 1 checks (lint, build, e2e) have not been run yet. Imported component licenses are unverified (see `COMPONENT_SOURCES.md`).

**Phase 1:** foundations, `design-system`, `shell`, `menus`. **Phase 2:** `canvas`, `stage`, `panels/layers`, `panels/details`, `panels/timeline`. **Phase 3:** `panels/launcher` and everything else.

| Area | Status | Legacy files | Bridged entry points now in `src/editor` |
|---|---|---|---|
| `foundations` (tokens, type and spacing scales, base components) | wip | new | - |
| `design-system` (the `/design-system` page, shows every component and its states) | wip | new | - |
| `shell` | wip | 38 | `EditorShell.tsx`, `DetachedPanelShell.tsx` |
| `menus` | todo | 4 | - |
| `canvas` | todo | 20 | - |
| `stage` | todo | 2 | - |
| `runtime` | todo | 3 | - |
| `panels/ai` | todo | 3 | - |
| `panels/assets` | todo | 1 | - |
| `panels/blueprint` | todo | 8 | `BlueprintCanvas.tsx` |
| `panels/code` | todo | 1 | - |
| `panels/code-view` | todo | 2 | - |
| `panels/common` | todo | 1 | - |
| `panels/console` | todo | 1 | `OutputConsole.tsx` |
| `panels/content-browser` | todo | 4 | `ContentBlockShelf.tsx`, `ContentBrowser.tsx`, `AssetFileEditor.tsx` |
| `panels/copilot` | todo | 1 | - |
| `panels/curves` | todo | 2 | - |
| `panels/database` | todo | 10 | - |
| `panels/dependencies` | todo | 2 | - |
| `panels/deployment` | todo | 5 | - |
| `panels/details` | todo | 46 | - |
| `panels/execution-trace` | todo | 1 | - |
| `panels/global-search` | todo | 2 | - |
| `panels/history` | todo | 2 | - |
| `panels/launcher` | todo | 6 | `ProjectHub.tsx`, `TechConfigurator.tsx`, `archetypeData.ts` |
| `panels/layers` | todo | 1 | - |
| `panels/motion` | todo | 1 | - |
| `panels/pages-manager` | todo | 4 | - |
| `panels/plugins` | todo | 2 | - |
| `panels/sequencer` | todo | 8 | `TimelineSequencer.tsx` |
| `panels/settings` | todo | 1 | - |
| `panels/state` | todo | 1 | - |
| `panels/timeline` | todo | 1 | - |
| `panels/versioning` | todo | 2 | - |
| `stage-lab` | todo | 2 | `CanvasLab.tsx`, `StageLab.tsx` |
| `render-gallery` | todo | 1 | `RenderGallery.tsx` |
| `fonts` | todo | 2 | - |
| `styles` | todo | 23 | `globals.css`, `animations.css` |

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

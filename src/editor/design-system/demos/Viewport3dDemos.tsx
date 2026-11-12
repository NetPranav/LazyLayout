"use client";

/**
 * ============================================================================
 * 3D VIEWPORT CHROME & PANELS DEMOS (Task B2-W2-2b)
 * ============================================================================
 * Interactive demos for:
 *   1. AdjustLastOperationPanel (Blender-style parameter tweaking HUD)
 *   2. ShadingBar (Wireframe, Solid, Material preview, Rendered, and X-Ray)
 *   3. OverlaysMenu (Overlays popover dropdown)
 *   4. ViewportStats (Object, vertex, face, triangle, and GPU memory metrics)
 * ============================================================================
 */

import React, { useState } from "react";
import { AdjustLastOperationPanel } from "../../components/AdjustLastOperationPanel";
import { ShadingBar } from "../../components/ShadingBar";
import { OverlaysMenu } from "../../components/OverlaysMenu";
import { ViewportStats } from "../../components/ViewportStats";
import { Button } from "../../components/Button";
import { SnapBar } from "../../viewport3d/SnapBar";
import { ViewCube } from "../../viewport3d/ViewCube";
import { GizmoOverlay } from "../../viewport3d/GizmoOverlay";
import { ViewportInteraction } from "../../viewport3d/ViewportInteraction";
import { Properties3d } from "../../panels/details/properties3d";
import { AddMenu3d, AddMenuButton, openAddMenu } from "../../viewport3d/AddMenu3d";
import { PrimitiveHandles } from "../../viewport3d/PrimitiveHandles";
import { TextPanel3d } from "../../viewport3d/TextPanel3d";
import { Outliner3d } from "../../panels/layers/Outliner3d";
import { LayerContextMenuContent } from "../../shell/left-panel/LayerContextMenu";
import { useViewportStore } from "../../../core/render/scene3d/viewportStore";
import { recordLastOperation, clearLastOperation } from "../../../core/3d/commands/lastOperation";
import { getDocument } from "../../../core/store/useDocumentStore";

export function AdjustLastOperationPanelDemo() {
  const [activeTitle, setActiveTitle] = useState<string>("Add Cylinder");

  const simulateAddCylinder = () => {
    setActiveTitle("Add Cylinder");
    recordLastOperation({
      id: "3d.add.cylinder",
      title: "Add Cylinder",
      args: {
        vertices: 32,
        radius: 1,
        depth: 2,
        name: "Cylinder",
        location: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      docBefore: getDocument(),
    });
  };

  const simulateAddSphere = () => {
    setActiveTitle("Add Sphere");
    recordLastOperation({
      id: "3d.add.sphere",
      title: "Add Sphere",
      args: {
        segments: 32,
        rings: 16,
        radius: 1,
        name: "Sphere",
      },
      docBefore: getDocument(),
    });
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Adjust Last Operation Panel (Blender-style HUD)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Dynamic parameter tweaking panel with typed controls (integers, floats, toggles, vector3s).
          Re-runs operations while preserving 1 single undo step.
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:gap-2">
        <Button variant="secondary" size="sm" onClick={simulateAddCylinder}>
          Simulate &ldquo;Add Cylinder&rdquo;
        </Button>
        <Button variant="secondary" size="sm" onClick={simulateAddSphere}>
          Simulate &ldquo;Add Sphere&rdquo;
        </Button>
        <Button variant="ghost" size="sm" onClick={() => clearLastOperation()}>
          Clear Operation
        </Button>
      </div>

      <div className="ll:p-4 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:min-h-80 ll:relative ll:overflow-hidden">
        <span className="ll:text-micro ll:text-muted ll:block ll:mb-2">
          Viewport Bottom-Left Region ({activeTitle})
        </span>
        <AdjustLastOperationPanel />
      </div>
    </div>
  );
}

export function ShadingBarDemo() {
  const settings = useViewportStore((s) => s.settings);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Shading Bar & X-Ray Toggle
        </h3>
        <p className="ll:text-small ll:text-muted">
          4 viewport shading buttons (Wireframe, Solid, Material preview, Rendered) plus an X-Ray toggle.
          Registered on central command bus with shortcuts Shift+Z and Alt+Z.
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:justify-between ll:p-4 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
        <ShadingBar />
        <div className="ll:text-micro ll:font-mono ll:text-secondary">
          Active Shading: <strong className="ll:text-primary">{settings.shading}</strong> | X-Ray:{" "}
          <strong className="ll:text-primary">{settings.xray ? "ON" : "OFF"}</strong>
        </div>
      </div>
    </div>
  );
}

export function OverlaysMenuDemo() {
  const overlays = useViewportStore((s) => s.settings.overlays);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Overlays Popover Menu
        </h3>
        <p className="ll:text-small ll:text-muted">
          Blender-style overlays popover for toggling grid, axes, origins, face orientation, normals, wireframe on shaded, and statistics.
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:justify-between ll:p-4 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:min-h-56">
        <OverlaysMenu />
        <div className="ll:text-micro ll:font-mono ll:text-secondary ll:max-w-xs">
          Grid: {overlays.grid ? "ON" : "OFF"} | Axes: {overlays.axes ? "ON" : "OFF"} | Stats:{" "}
          {overlays.stats ? "ON" : "OFF"}
        </div>
      </div>
    </div>
  );
}

export function ViewportStatsDemo() {
  const statsEnabled = useViewportStore((s) => s.settings.overlays.stats);
  const setSettings = useViewportStore((s) => s.setSettings);

  const toggleStats = () => {
    setSettings((prev) => ({
      ...prev,
      overlays: {
        ...prev.overlays,
        stats: !prev.overlays.stats,
      },
    }));
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Viewport Statistics Readout
        </h3>
        <p className="ll:text-small ll:text-muted">
          Real-time deterministic statistics (objects, vertices, faces, triangles, memory bytes) computed by `sceneStats`.
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:gap-2">
        <Button variant="secondary" size="sm" onClick={toggleStats}>
          {statsEnabled ? "Hide Statistics" : "Show Statistics"}
        </Button>
      </div>

      <div className="ll:p-4 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:min-h-48 ll:relative">
        <span className="ll:text-micro ll:text-muted ll:block ll:mb-2">
          Viewport HUD Area
        </span>
        <ViewportStats />
      </div>
    </div>
  );
}

export function SnapBarDemo() {
  const snap = useViewportStore((s) => s.snap);
  const pivot = useViewportStore((s) => s.pivot);
  const orientation = useViewportStore((s) => s.orientation);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          3D Snap Bar Header Strip (ROADMAP Phase 3D-017)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Header toolbar with snap magnet toggle (Shift+Tab), snap target (grid, vertex, edge, face, increment), pivot points (median, individual, cursor, active), and orientations (global, local, normal, view, cursor).
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:justify-between ll:p-4 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
        <SnapBar />
        <div className="ll:text-micro ll:font-mono ll:text-secondary">
          Snap: {snap.enabled ? "ON" : "OFF"} ({snap.target}) | Pivot: {pivot} | Orient: {orientation}
        </div>
      </div>
    </div>
  );
}

export function ViewCubeDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          3D Navigation ViewCube (ROADMAP Phase 3D-014)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Interactive orientation cube widget that rotates with camera pitch and yaw. Click any face to align to standard orthographic views (Top, Front, Right, Back, Left, Bottom).
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:justify-center ll:p-8 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:min-h-48">
        <ViewCube size={64} />
      </div>
    </div>
  );
}

export function GizmoOverlayDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          3D Transform Gizmo Overlay (ROADMAP Phase 3D-016)
        </h3>
        <p className="ll:text-small ll:text-muted">
          SVG overlay rendering constant pixel-size gizmo handles (Translate X/Y/Z, rotation rings, plane handles) with hit testing and single-undo commit.
        </p>
      </div>

      <div className="ll:relative ll:w-full ll:h-64 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <GizmoOverlay width={400} height={256} mode="translate" />
      </div>
    </div>
  );
}

export function ViewportInteractionLayerDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          3D Viewport Interaction Layer (ROADMAP Phases 3D-014 – 3D-017)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Transparent interaction surface over the scene canvas. Captures middle-mouse camera navigation (orbit, pan, dolly), object picking, box select, 3D cursor placement, and modal G/R/S transforms.
        </p>
      </div>

      <div className="ll:relative ll:w-full ll:h-72 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <ViewportInteraction sceneId="scn_demo" width={600} height={288} />
      </div>
    </div>
  );
}

export function Properties3dDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Blender-Style 3D Properties Editor (ROADMAP Phase 3D-022, 3D-023, 3D-030)
        </h3>
        <p className="ll:text-small ll:text-muted">
          8-tab properties inspector with Simple/Pro faces, thumbnail Looks strip, modifier stack,
          Euler transform inputs, and GPU budget readouts.
        </p>
      </div>

      <div className="ll:w-80 ll:h-[520px] ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:shadow-sm">
        <Properties3d activeId="obj_default_cube" />
      </div>
    </div>
  );
}

export function AddMenu3dDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Blender-Style Add Menu & Header Button (ROADMAP Phase 3D-025, 3D-026)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Shift+A or Header &ldquo;Add&rdquo; button opens menu with Mesh primitives, 3D Text, Lights, Camera, and Empty. Searchable via live typing filter.
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:gap-3">
        <AddMenuButton />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openAddMenu({ x: 120, y: 120 })}
        >
          Open Menu at (120, 120)
        </Button>
      </div>
      <AddMenu3d />
    </div>
  );
}

export function PrimitiveHandlesDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Parametric Primitive Handles (ROADMAP Phase 3D-025)
        </h3>
        <p className="ll:text-small ll:text-muted">
          SVG diamonds rendered on selected procedural primitives. Dragging recalculates closest ray-to-axis point and commits 1 undo step.
        </p>
      </div>

      <div className="ll:relative ll:w-full ll:h-48 ll:bg-surface-bar ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <PrimitiveHandles width={480} height={192} />
        <div className="ll:p-4 ll:text-micro ll:text-muted">
          Select an active primitive in 3D scene to preview handles
        </div>
      </div>
    </div>
  );
}

export function TextPanel3dDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          3D Text Floating Properties Panel (ROADMAP Phase 3D-026)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Floating parameters for 3D text (text, size, depth, bevel, resolution, alignment, spacing) with one-click Convert to Mesh.
        </p>
      </div>

      <div className="ll:w-64">
        <TextPanel3d />
      </div>
    </div>
  );
}

export function Outliner3dDemo() {
  const doc = getDocument();
  const sceneId = Object.keys(doc.scenes ?? {})[0] ?? "demo_scene";

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          3D Outliner Tree in Layers Panel (ROADMAP Phase 3D-021 & 3D-024)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Hierarchical scene tree with visibility, selectability, and render toggles; inline renaming; drag-and-drop reparenting; shared data block badges with &ldquo;Make single user&rdquo;; and copy/paste attributes.
        </p>
      </div>

      <div className="ll:w-64 ll:h-[420px] ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
        <Outliner3d sceneId={sceneId} />
      </div>
    </div>
  );
}

export function Make3dMenuDemo() {
  const [lastAction, setLastAction] = useState<string>("");

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Make 3D from 2D Layer Context Menu (ROADMAP Phase 3D-029)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Right-click context menu options: Extrude, Inflate, Lathe, Plane. Enabled when a 3D scene exists; disabled with reason &quot;Insert a 3D scene first&quot; when no scene exists.
        </p>
      </div>

      <div className="ll:flex ll:gap-6">
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-caption ll:font-medium ll:text-secondary">Enabled (Scene Exists)</span>
          <div className="ll:w-60 ll:p-1 ll:border ll:border-border ll:rounded-md ll:bg-surface-panel ll:shadow-soft">
            <LayerContextMenuContent
              selectionCount={1}
              hasScene={true}
              onAction={(a) => setLastAction(`Enabled menu -> ${a}`)}
              onToggleHidden={() => {}}
              onToggleLocked={() => {}}
            />
          </div>
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-caption ll:font-medium ll:text-secondary">Disabled (No 3D Scene)</span>
          <div className="ll:w-60 ll:p-1 ll:border ll:border-border ll:rounded-md ll:bg-surface-panel ll:shadow-soft">
            <LayerContextMenuContent
              selectionCount={1}
              hasScene={false}
              onAction={(a) => setLastAction(`Disabled menu -> ${a}`)}
              onToggleHidden={() => {}}
              onToggleLocked={() => {}}
            />
          </div>
        </div>
      </div>

      {lastAction && (
        <span className="ll:text-nano ll:font-mono ll:text-primary">
          Action triggered: {lastAction}
        </span>
      )}
    </div>
  );
}

export function Viewport3dDemos() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <Outliner3dDemo />
      <Make3dMenuDemo />
      <AddMenu3dDemo />
      <PrimitiveHandlesDemo />
      <TextPanel3dDemo />
      <Properties3dDemo />
      <ViewportInteractionLayerDemo />
      <SnapBarDemo />
      <ViewCubeDemo />
      <GizmoOverlayDemo />
      <AdjustLastOperationPanelDemo />
      <ShadingBarDemo />
      <OverlaysMenuDemo />
      <ViewportStatsDemo />
    </div>
  );
}

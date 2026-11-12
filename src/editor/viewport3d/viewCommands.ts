/**
 * ============================================================================
 * 3D VIEWPORT COMMANDS (ROADMAP Phases 3D-014 – 3D-017, Canonical B2-ids)
 * ============================================================================
 * Registers all canonical 3D commands with `defineCommand`:
 *   - 3d.view.*: front, back, left, right, top, bottom, toggle_ortho,
 *     frame_selected, frame_all, camera
 *   - 3d.select.*: all, none, invert, linked, similar, box
 *   - 3d.transform.*: translate, rotate, scale
 *   - 3d.cursor.*: place, reset
 *   - 3d.snap.toggle
 *   - 3d.shading.*: wireframe, solid, material, rendered, toggle_xray
 *   - 3d.overlay.*: toggle_grid, toggle_stats
 *   - 3d.mode.toggle_edit
 *
 * All registered under category "3D" and guarded by `editingScene3d`.
 * ============================================================================
 */

import { defineCommand } from "@/core/commands";
import { getDocument } from "@/core/store/useDocumentStore";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import {
  setStandardView,
  toggleOrtho,
  frameAll,
  viewFromObjectCamera,
  type StandardView,
  type BoundingBox3d,
} from "@/core/3d/camera/viewCamera";
import {
  selectAll,
  selectNone,
  invert,
  selectLinked,
  selectSimilar,
} from "@/core/3d/pick/select";
import { resetCursor } from "@/core/3d/snap/cursor";
import { vec3 } from "@/core/3d/math";
import { worldMatrix } from "@/core/3d/hierarchy";
import type { TransformMode } from "@/core/3d/transform/typed";

type TransformTrigger = (mode: TransformMode) => void;
let activeTransformTrigger: TransformTrigger | null = null;

export function registerTransformTrigger(fn: TransformTrigger): () => void {
  activeTransformTrigger = fn;
  return () => {
    if (activeTransformTrigger === fn) activeTransformTrigger = null;
  };
}

export function triggerModalTransform(mode: TransformMode): void {
  if (activeTransformTrigger) {
    activeTransformTrigger(mode);
  }
}

type BoxSelectTrigger = () => void;
let activeBoxSelectTrigger: BoxSelectTrigger | null = null;

export function registerBoxSelectTrigger(fn: BoxSelectTrigger): () => void {
  activeBoxSelectTrigger = fn;
  return () => {
    if (activeBoxSelectTrigger === fn) activeBoxSelectTrigger = null;
  };
}

export function triggerBoxSelect(): void {
  if (activeBoxSelectTrigger) {
    activeBoxSelectTrigger();
  }
}

function getActiveSceneObjectIds(): string[] {
  const store = useViewportStore.getState();
  const sceneId = store.editingSceneId;
  if (!sceneId) return [];
  const doc = getDocument();
  const scene = doc.scenes?.[sceneId];
  if (!scene || !scene.objects) return [];
  return [...scene.objects];
}

function getObjectBounds(objectId: string): BoundingBox3d | null {
  const doc = getDocument();
  const obj = doc.objects?.[objectId];
  if (!obj) return null;

  const wMat = worldMatrix(doc, objectId);
  // Center point
  const cx = wMat[12];
  const cy = wMat[13];
  const cz = wMat[14];

  // If mesh is available, calculate bounding box transformed by world matrix
  if (obj.dataId && doc.meshes?.[obj.dataId]) {
    const mesh = doc.meshes[obj.dataId];
    const pos = mesh.positions;
    if (pos && pos.length >= 3) {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < pos.length; i += 3) {
        const lx = pos[i];
        const ly = pos[i + 1];
        const lz = pos[i + 2];
        const wx = wMat[0] * lx + wMat[4] * ly + wMat[8] * lz + wMat[12];
        const wy = wMat[1] * lx + wMat[5] * ly + wMat[9] * lz + wMat[13];
        const wz = wMat[2] * lx + wMat[6] * ly + wMat[10] * lz + wMat[14];
        if (wx < minX) minX = wx;
        if (wy < minY) minY = wy;
        if (wz < minZ) minZ = wz;
        if (wx > maxX) maxX = wx;
        if (wy > maxY) maxY = wy;
        if (wz > maxZ) maxZ = wz;
      }
      return { min: vec3(minX, minY, minZ), max: vec3(maxX, maxY, maxZ) };
    }
  }

  // Fallback box of size 1 around origin
  const half = 0.5;
  return {
    min: vec3(cx - half, cy - half, cz - half),
    max: vec3(cx + half, cy + half, cz + half),
  };
}

/**
 * Registers all canonical 3D viewport commands with the application command bus.
 * Returns an unregister cleanup function.
 */
export function registerViewport3dCommands(): () => void {
  const category = "3D";
  const whenEditing = (ctx: { editingScene3d?: boolean }) => Boolean(ctx.editingScene3d);
  const unregisters: (() => void)[] = [];

  const add = (fn: () => void) => unregisters.push(fn);

  // 1. Standard Views
  const views: Array<{ id: string; view: StandardView; title: string; keybinding?: string }> = [
    { id: "3d.view.front", view: "front", title: "View Front", keybinding: "Numpad1" },
    { id: "3d.view.back", view: "back", title: "View Back", keybinding: "Ctrl+Numpad1" },
    { id: "3d.view.right", view: "right", title: "View Right", keybinding: "Numpad3" },
    { id: "3d.view.left", view: "left", title: "View Left", keybinding: "Ctrl+Numpad3" },
    { id: "3d.view.top", view: "top", title: "View Top", keybinding: "Numpad7" },
    { id: "3d.view.bottom", view: "bottom", title: "View Bottom", keybinding: "Ctrl+Numpad7" },
  ];

  for (const { id, view, title, keybinding } of views) {
    add(
      defineCommand({
        id,
        title,
        category,
        keybinding,
        when: whenEditing,
        run: () => {
          useViewportStore.getState().setCamera((c) => setStandardView(c, view));
          return { ok: true, view };
        },
      })
    );
  }

  // 2. Toggle Ortho
  add(
    defineCommand({
      id: "3d.view.toggle_ortho",
      title: "Toggle Orthographic/Perspective",
      category,
      keybinding: "Numpad5",
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setCamera((c) => toggleOrtho(c));
        return { ok: true };
      },
    })
  );

  // 3. Frame Selected
  add(
    defineCommand({
      id: "3d.view.frame_selected",
      title: "Frame Selected",
      category,
      keybinding: "Numpad.",
      when: whenEditing,
      run: () => {
        const store = useViewportStore.getState();
        const selected = store.selection.selected;
        if (selected.length === 0) return { ok: false, reason: "No selection" };

        const boxes: BoundingBox3d[] = [];
        for (const id of selected) {
          const b = getObjectBounds(id);
          if (b) boxes.push(b);
        }

        if (boxes.length === 0) return { ok: false };
        store.setCamera((c) => frameAll(c, boxes));
        return { ok: true };
      },
    })
  );

  // 4. Frame All
  add(
    defineCommand({
      id: "3d.view.frame_all",
      title: "Frame All",
      category,
      keybinding: "Home",
      when: whenEditing,
      run: () => {
        const allIds = getActiveSceneObjectIds();
        const boxes: BoundingBox3d[] = [];
        for (const id of allIds) {
          const b = getObjectBounds(id);
          if (b) boxes.push(b);
        }

        if (boxes.length === 0) {
          // Default framing
          boxes.push({ min: vec3(-1, -1, -1), max: vec3(1, 1, 1) });
        }

        useViewportStore.getState().setCamera((c) => frameAll(c, boxes));
        return { ok: true };
      },
    })
  );

  // 5. Active Camera View
  add(
    defineCommand({
      id: "3d.view.camera",
      title: "Active Camera View",
      category,
      keybinding: "Numpad0",
      when: whenEditing,
      run: () => {
        const store = useViewportStore.getState();
        const sceneId = store.editingSceneId;
        if (!sceneId) return { ok: false };
        const doc = getDocument();
        const scene = doc.scenes?.[sceneId];
        if (!scene?.activeCamera) return { ok: false, reason: "No active camera" };

        const camObj = doc.objects?.[scene.activeCamera];
        if (!camObj) return { ok: false, reason: "Camera object not found" };

        const nextCam = viewFromObjectCamera(camObj, doc);
        store.setCamera(nextCam);
        return { ok: true };
      },
    })
  );

  // 6. Selection Commands
  add(
    defineCommand({
      id: "3d.select.all",
      title: "Select All 3D",
      category,
      keybinding: "a",
      when: whenEditing,
      run: () => {
        const allIds = getActiveSceneObjectIds();
        useViewportStore.getState().setSelection((s) => selectAll(s, allIds));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.select.none",
      title: "Select None 3D",
      category,
      keybinding: "Alt+a",
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSelection(() => selectNone());
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.select.invert",
      title: "Invert Selection 3D",
      category,
      keybinding: "Ctrl+i",
      when: whenEditing,
      run: () => {
        const allIds = getActiveSceneObjectIds();
        useViewportStore.getState().setSelection((s) => invert(s, allIds));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.select.linked",
      title: "Select Linked 3D",
      category,
      when: whenEditing,
      run: () => {
        const doc = getDocument();
        useViewportStore.getState().setSelection((s) => selectLinked(s, doc));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.select.similar",
      title: "Select Similar 3D",
      category,
      when: whenEditing,
      run: () => {
        const doc = getDocument();
        useViewportStore.getState().setSelection((s) => selectSimilar(s, doc, "type"));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.select.box",
      title: "Box Select 3D",
      category,
      keybinding: "b",
      when: whenEditing,
      run: () => {
        triggerBoxSelect();
        return { ok: true };
      },
    })
  );

  // 7. Modal Transform Commands (G / R / S)
  add(
    defineCommand({
      id: "3d.transform.translate",
      title: "Translate 3D",
      category,
      keybinding: "g",
      when: whenEditing,
      run: () => {
        triggerModalTransform("translate");
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.transform.rotate",
      title: "Rotate 3D",
      category,
      keybinding: "r",
      when: whenEditing,
      run: () => {
        triggerModalTransform("rotate");
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.transform.scale",
      title: "Scale 3D",
      category,
      keybinding: "s",
      when: whenEditing,
      run: () => {
        triggerModalTransform("scale");
        return { ok: true };
      },
    })
  );

  // 8. 3D Cursor Commands
  add(
    defineCommand({
      id: "3d.cursor.place",
      title: "Place 3D Cursor",
      category,
      when: whenEditing,
      run: () => {
        // Shift+Right-Click in ViewportInteraction directly triggers placeCursor
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.cursor.reset",
      title: "Reset 3D Cursor",
      category,
      keybinding: "Shift+c",
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setCursor(resetCursor());
        return { ok: true };
      },
    })
  );

  // 9. Snapping Toggle
  add(
    defineCommand({
      id: "3d.snap.toggle",
      title: "Toggle 3D Snapping",
      category,
      keybinding: "Shift+Tab",
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSnap((s) => ({ ...s, enabled: !s.enabled }));
        return { ok: true };
      },
    })
  );

  // 10. Shading & Overlays
  add(
    defineCommand({
      id: "3d.shading.wireframe",
      title: "Shading Wireframe",
      category,
      keybinding: "Shift+z",
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSettings((s) => ({ ...s, mode: "wireframe" }));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.shading.solid",
      title: "Shading Solid",
      category,
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSettings((s) => ({ ...s, mode: "solid" }));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.shading.material",
      title: "Shading Material",
      category,
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSettings((s) => ({ ...s, mode: "material" }));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.shading.rendered",
      title: "Shading Rendered",
      category,
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSettings((s) => ({ ...s, mode: "rendered" }));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.shading.toggle_xray",
      title: "Toggle X-Ray",
      category,
      keybinding: "Alt+z",
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSettings((s) => ({ ...s, xray: !s.xray }));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.overlay.toggle_grid",
      title: "Toggle Grid Overlay",
      category,
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSettings((s) => ({
          ...s,
          overlays: { ...s.overlays, grid: !s.overlays.grid },
        }));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.overlay.toggle_stats",
      title: "Toggle Stats Overlay",
      category,
      when: whenEditing,
      run: () => {
        useViewportStore.getState().setSettings((s) => ({
          ...s,
          overlays: { ...s.overlays, stats: !s.overlays.stats },
        }));
        return { ok: true };
      },
    })
  );

  add(
    defineCommand({
      id: "3d.mode.toggle_edit",
      title: "Toggle Edit Mode",
      category,
      keybinding: "Tab",
      when: whenEditing,
      run: () => {
        // Toggle scene edit or future mesh edit mode
        return { ok: true };
      },
    })
  );

  return () => {
    for (const unreg of unregisters) {
      unreg();
    }
  };
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  applyOverlays,
  OVERLAYS_GROUP_NAME,
  GRID_NAME,
  AXES_NAME,
  ORIGINS_NAME,
  CURSOR_NAME,
  NORMALS_NAME,
  WIRE_SHADED_NAME,
  OUTLINES_NAME,
  getOutlineColor,
} from "../overlays";
import { DEFAULT_VIEWPORT_SETTINGS, type ViewportSettings } from "../../../3d/viewport/settings";
import { EMPTY_SELECTION, createSelection3d } from "../../../3d/pick/select";
import { resetCursor } from "../../../3d/snap/cursor";
import { vec3, quat } from "../../../3d/math";

describe("Phase 3D-019: Viewport Overlays", () => {
  it("getOutlineColor returns a valid 4-element RGBA tuple", () => {
    const col = getOutlineColor();
    assert.equal(col.length, 4);
    assert.ok(col[0] >= 0 && col[0] <= 1);
    assert.ok(col[1] >= 0 && col[1] <= 1);
    assert.ok(col[2] >= 0 && col[2] <= 1);
    assert.equal(col[3], 1.0);
  });

  it("adds overlays group to the scene with default grid, axes, and cursor", () => {
    const scene = new THREE.Scene();
    const cursor = resetCursor();
    applyOverlays(scene, DEFAULT_VIEWPORT_SETTINGS, EMPTY_SELECTION, cursor);

    const group = scene.getObjectByName(OVERLAYS_GROUP_NAME) as THREE.Group | undefined;
    assert.ok(group, "Overlay group exists in scene");

    const grid = group.getObjectByName(GRID_NAME);
    assert.ok(grid, "Grid object exists in overlay group");
    assert.equal(grid.visible, true);

    const axes = group.getObjectByName(AXES_NAME);
    assert.ok(axes, "Axes object exists in overlay group");
    assert.equal(axes.visible, true);

    const cursorObj = group.getObjectByName(CURSOR_NAME);
    assert.ok(cursorObj, "Cursor object exists in overlay group");
    assert.equal(cursorObj.visible, true);
  });

  it("toggles grid and axes visibility off when settings specify false", () => {
    const scene = new THREE.Scene();
    const cursor = resetCursor();
    const settings: ViewportSettings = {
      ...DEFAULT_VIEWPORT_SETTINGS,
      overlays: {
        ...DEFAULT_VIEWPORT_SETTINGS.overlays,
        grid: false,
        axes: false,
      },
    };

    applyOverlays(scene, settings, EMPTY_SELECTION, cursor);

    const group = scene.getObjectByName(OVERLAYS_GROUP_NAME) as THREE.Group;
    const grid = group.getObjectByName(GRID_NAME);
    assert.ok(grid);
    assert.equal(grid.visible, false);

    const axes = group.getObjectByName(AXES_NAME);
    assert.ok(axes);
    assert.equal(axes.visible, false);
  });

  it("positions and rotates the 3D cursor according to Cursor3d", () => {
    const scene = new THREE.Scene();
    const cursor = {
      position: vec3(2, 3, 4),
      rotation: quat(0, 0, 0.7071068, 0.7071068),
    };

    applyOverlays(scene, DEFAULT_VIEWPORT_SETTINGS, EMPTY_SELECTION, cursor);

    const group = scene.getObjectByName(OVERLAYS_GROUP_NAME) as THREE.Group;
    const cursorObj = group.getObjectByName(CURSOR_NAME);
    assert.ok(cursorObj);

    assert.equal(cursorObj.position.x, 2);
    assert.equal(cursorObj.position.y, 3);
    assert.equal(cursorObj.position.z, 4);
    assert.ok(Math.abs(cursorObj.quaternion.z - 0.7071068) < 1e-4);
  });

  it("creates object origins dots for scene objects", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.name = "obj_cube";
    mesh.position.set(10, 20, 30);
    scene.add(mesh);

    const settings: ViewportSettings = {
      ...DEFAULT_VIEWPORT_SETTINGS,
      overlays: {
        ...DEFAULT_VIEWPORT_SETTINGS.overlays,
        origins: true,
      },
    };

    applyOverlays(scene, settings, EMPTY_SELECTION, resetCursor());

    const group = scene.getObjectByName(OVERLAYS_GROUP_NAME) as THREE.Group;
    const origins = group.getObjectByName(ORIGINS_NAME) as THREE.Points | undefined;
    assert.ok(origins, "Origins points object exists");
    assert.equal(origins.visible, true);
    assert.ok(origins.geometry.attributes.position.count >= 1);
  });

  it("creates selection outline for selected objects", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.name = "obj_selected_mesh";
    scene.add(mesh);

    const selection = createSelection3d({
      active: "obj_selected_mesh",
      selected: ["obj_selected_mesh"],
    });

    applyOverlays(scene, DEFAULT_VIEWPORT_SETTINGS, selection, resetCursor());

    const group = scene.getObjectByName(OVERLAYS_GROUP_NAME) as THREE.Group;
    const outlines = group.getObjectByName(OUTLINES_NAME) as THREE.Group | undefined;
    assert.ok(outlines, "Outlines group exists");
    assert.equal(outlines.children.length, 1, "One outline mesh created for selected object");
  });

  it("creates vertex normals lines when enabled", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.name = "box_1";
    scene.add(mesh);

    const settings: ViewportSettings = {
      ...DEFAULT_VIEWPORT_SETTINGS,
      overlays: {
        ...DEFAULT_VIEWPORT_SETTINGS.overlays,
        normals: true,
      },
    };

    applyOverlays(scene, settings, EMPTY_SELECTION, resetCursor());

    const group = scene.getObjectByName(OVERLAYS_GROUP_NAME) as THREE.Group;
    const normals = group.getObjectByName(NORMALS_NAME);
    assert.ok(normals, "Normals overlay exists");
  });

  it("creates wireframe on shaded when enabled", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.name = "box_shaded";
    scene.add(mesh);

    const settings: ViewportSettings = {
      ...DEFAULT_VIEWPORT_SETTINGS,
      shading: "solid",
      overlays: {
        ...DEFAULT_VIEWPORT_SETTINGS.overlays,
        wireOnShaded: true,
      },
    };

    applyOverlays(scene, settings, EMPTY_SELECTION, resetCursor());

    const group = scene.getObjectByName(OVERLAYS_GROUP_NAME) as THREE.Group;
    const wire = group.getObjectByName(WIRE_SHADED_NAME);
    assert.ok(wire, "Wireframe on shaded overlay exists");
  });
});

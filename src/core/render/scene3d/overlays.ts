/**
 * ============================================================================
 * 3D VIEWPORT OVERLAYS (Phase 3D-019)
 * ============================================================================
 * Three.js visual overlays for the 3D scene:
 *   - Ground grid on XY plane (Z = 0) with distance fading
 *   - Colored axes lines (Red X, Green Y, Blue Z)
 *   - Object origins rendered as distinct dots
 *   - Face-orientation diagnostic (blue front, red back)
 *   - Vertex and face normal vectors (lines)
 *   - Wireframe on shaded geometry
 *   - 3D cursor (red-and-white ring and crosshairs)
 *   - Selection outline (inverted normal hull with theme token color)
 * ============================================================================
 */

import * as THREE from "three";
import type { ViewportSettings } from "../../3d/viewport/settings";
import type { Selection3d } from "../../3d/pick/select";
import type { Cursor3d } from "../../3d/snap/cursor";
import {
  FACE_ORIENTATION_VERTEX_SHADER,
  FACE_ORIENTATION_FRAGMENT_SHADER,
  OUTLINE_VERTEX_SHADER,
  OUTLINE_FRAGMENT_SHADER,
} from "../../3d/viewport/shaders";

export const OVERLAYS_GROUP_NAME = "__ll_overlays__";
export const GRID_NAME = "__ll_overlay_grid__";
export const AXES_NAME = "__ll_overlay_axes__";
export const ORIGINS_NAME = "__ll_overlay_origins__";
export const CURSOR_NAME = "__ll_overlay_cursor__";
export const NORMALS_NAME = "__ll_overlay_normals__";
export const WIRE_SHADED_NAME = "__ll_overlay_wire_shaded__";
export const OUTLINES_NAME = "__ll_overlay_outlines__";

let cachedOutlineColor: [number, number, number, number] | null = null;

/**
 * Reads the selection outline color from active CSS tokens once,
 * falling back to orange if running outside browser or token absent.
 */
export function getOutlineColor(): [number, number, number, number] {
  if (cachedOutlineColor) return cachedOutlineColor;
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const style = getComputedStyle(document.documentElement);
      const raw =
        style.getPropertyValue("--ll-pen-mark").trim() ||
        style.getPropertyValue("--ll-label-4").trim();
      if (raw) {
        const c = new THREE.Color(raw);
        cachedOutlineColor = [c.r, c.g, c.b, 1.0];
        return cachedOutlineColor;
      }
    } catch {
      // Fallback below
    }
  }
  cachedOutlineColor = [1.0, 0.55, 0.0, 1.0];
  return cachedOutlineColor;
}

/**
 * Builds or retrieves the root overlays group on the Three.js scene.
 */
function getOrCreateOverlayGroup(threeScene: THREE.Scene): THREE.Group {
  let group = threeScene.getObjectByName(OVERLAYS_GROUP_NAME) as THREE.Group | undefined;
  if (!group) {
    group = new THREE.Group();
    group.name = OVERLAYS_GROUP_NAME;
    group.renderOrder = 999;
    threeScene.add(group);
  }
  return group;
}

/**
 * Creates a ground grid on the XY plane (Z = 0) since Z is up.
 */
function createGridObject(): THREE.Object3D {
  const size = 40;
  const divisions = 40;
  const grid = new THREE.GridHelper(size, divisions, 0x666666, 0x333333);
  grid.name = GRID_NAME;
  // Rotate so grid lies flat on Z = 0 (XY plane) instead of XZ plane
  grid.rotation.x = Math.PI / 2;
  const mat = grid.material as THREE.LineBasicMaterial;
  if (mat) {
    mat.transparent = true;
    mat.opacity = 0.5;
    mat.depthWrite = false;
  }
  return grid;
}

/**
 * Creates colored axes lines (X red, Y green, Z blue).
 */
function createAxesObject(): THREE.Object3D {
  const group = new THREE.Group();
  group.name = AXES_NAME;

  const axisLen = 30;
  const positions: number[] = [];
  const colors: number[] = [];

  // X Axis (Red)
  positions.push(-axisLen, 0, 0, axisLen, 0, 0);
  colors.push(0.95, 0.25, 0.25, 0.95, 0.25, 0.25);

  // Y Axis (Green)
  positions.push(0, -axisLen, 0, 0, axisLen, 0);
  colors.push(0.25, 0.95, 0.25, 0.25, 0.95, 0.25);

  // Z Axis (Blue)
  positions.push(0, 0, -axisLen, 0, 0, axisLen);
  colors.push(0.3, 0.55, 1.0, 0.3, 0.55, 1.0);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geom, mat);
  group.add(lines);
  return group;
}

/**
 * Creates the 3D Cursor: a red-and-white dashed ring with center crosshair.
 */
function createCursorObject(): THREE.Group {
  const cursorGroup = new THREE.Group();
  cursorGroup.name = CURSOR_NAME;

  const radius = 0.3;
  const segments = 32;
  const ringPositions: number[] = [];
  const ringColors: number[] = [];

  for (let i = 0; i < segments; i++) {
    const theta1 = (i / segments) * Math.PI * 2;
    const theta2 = ((i + 1) / segments) * Math.PI * 2;

    const x1 = Math.cos(theta1) * radius;
    const y1 = Math.sin(theta1) * radius;
    const x2 = Math.cos(theta2) * radius;
    const y2 = Math.sin(theta2) * radius;

    ringPositions.push(x1, y1, 0, x2, y2, 0);

    // Alternate red and white segments
    const isRed = Math.floor(i / 2) % 2 === 0;
    const r = isRed ? 0.95 : 1.0;
    const g = isRed ? 0.2 : 1.0;
    const b = isRed ? 0.2 : 1.0;

    ringColors.push(r, g, b, r, g, b);
  }

  // Crosshairs along X, Y, Z
  const arm = 0.45;
  const crossPositions: number[] = [
    -arm, 0, 0, arm, 0, 0,
    0, -arm, 0, 0, arm, 0,
    0, 0, -arm, 0, 0, arm,
  ];
  const crossColors: number[] = [
    0.95, 0.3, 0.3, 0.95, 0.3, 0.3, // Red X
    0.3, 0.95, 0.3, 0.3, 0.95, 0.3, // Green Y
    0.3, 0.5, 1.0, 0.3, 0.5, 1.0,  // Blue Z
  ];

  const ringGeom = new THREE.BufferGeometry();
  ringGeom.setAttribute("position", new THREE.Float32BufferAttribute(ringPositions, 3));
  ringGeom.setAttribute("color", new THREE.Float32BufferAttribute(ringColors, 3));

  const ringLines = new THREE.LineSegments(
    ringGeom,
    new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })
  );

  const crossGeom = new THREE.BufferGeometry();
  crossGeom.setAttribute("position", new THREE.Float32BufferAttribute(crossPositions, 3));
  crossGeom.setAttribute("color", new THREE.Float32BufferAttribute(crossColors, 3));

  const crossLines = new THREE.LineSegments(
    crossGeom,
    new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })
  );

  cursorGroup.add(ringLines);
  cursorGroup.add(crossLines);

  return cursorGroup;
}

/**
 * Creates normal visualization lines for mesh vertices.
 */
function createNormalsObject(threeScene: THREE.Scene): THREE.Object3D {
  const group = new THREE.Group();
  group.name = NORMALS_NAME;

  const positions: number[] = [];
  const normalLen = 0.2;

  threeScene.traverse((obj) => {
    if (obj.name.startsWith("__ll_") || !(obj instanceof THREE.Mesh)) return;
    const geom = obj.geometry;
    if (!geom || !geom.attributes.position || !geom.attributes.normal) return;

    obj.updateMatrixWorld(true);
    const posAttr = geom.attributes.position;
    const normAttr = geom.attributes.normal;
    const count = posAttr.count;

    const vPos = new THREE.Vector3();
    const vNorm = new THREE.Vector3();

    // Sample vertices
    const step = Math.max(1, Math.floor(count / 200));
    for (let i = 0; i < count; i += step) {
      vPos.fromBufferAttribute(posAttr, i).applyMatrix4(obj.matrixWorld);
      vNorm.fromBufferAttribute(normAttr, i).transformDirection(obj.matrixWorld);

      positions.push(vPos.x, vPos.y, vPos.z);
      positions.push(
        vPos.x + vNorm.x * normalLen,
        vPos.y + vNorm.y * normalLen,
        vPos.z + vNorm.z * normalLen
      );
    }
  });

  if (positions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, depthWrite: false });
    group.add(new THREE.LineSegments(geom, mat));
  }

  return group;
}

/**
 * Creates wireframe overlay on top of shaded geometry.
 */
function createWireOnShadedObject(threeScene: THREE.Scene): THREE.Object3D {
  const group = new THREE.Group();
  group.name = WIRE_SHADED_NAME;

  const wireMat = new THREE.LineBasicMaterial({
    color: 0x222222,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });

  threeScene.traverse((obj) => {
    if (obj.name.startsWith("__ll_") || !(obj instanceof THREE.Mesh)) return;
    const geom = obj.geometry;
    if (!geom) return;

    try {
      const wireGeom = new THREE.WireframeGeometry(geom);
      const wireMesh = new THREE.LineSegments(wireGeom, wireMat);
      wireMesh.matrix.copy(obj.matrixWorld);
      wireMesh.matrixAutoUpdate = false;
      group.add(wireMesh);
    } catch {
      // Ignore non-indexable geometry
    }
  });

  return group;
}

/**
 * Updates object origins dots in the scene.
 */
function updateOriginsObject(group: THREE.Group, threeScene: THREE.Scene): void {
  let originsObj = group.getObjectByName(ORIGINS_NAME) as THREE.Points | undefined;
  const positions: number[] = [];

  threeScene.traverse((obj) => {
    if (obj.name.startsWith("__ll_") || obj === threeScene) return;
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Group) {
      if (obj.name) {
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        positions.push(wp.x, wp.y, wp.z);
      }
    }
  });

  if (!originsObj) {
    const geom = new THREE.BufferGeometry();
    if (positions.length > 0) {
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    }
    const mat = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 6,
      sizeAttenuation: false,
      depthTest: false,
    });
    originsObj = new THREE.Points(geom, mat);
    originsObj.name = ORIGINS_NAME;
    group.add(originsObj);
  } else {
    originsObj.geometry.dispose();
    const newGeom = new THREE.BufferGeometry();
    if (positions.length > 0) {
      newGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    }
    originsObj.geometry = newGeom;
  }
}

/**
 * Updates selection outlines using the inverted hull outline shader.
 */
function updateSelectionOutlines(
  group: THREE.Group,
  threeScene: THREE.Scene,
  selection: Selection3d
): void {
  let outlinesGroup = group.getObjectByName(OUTLINES_NAME) as THREE.Group | undefined;
  if (!outlinesGroup) {
    outlinesGroup = new THREE.Group();
    outlinesGroup.name = OUTLINES_NAME;
    group.add(outlinesGroup);
  }

  // Clear existing outline meshes
  while (outlinesGroup.children.length > 0) {
    const child = outlinesGroup.children[0];
    outlinesGroup.remove(child);
    if ("geometry" in child) (child as THREE.Mesh).geometry.dispose();
    if ("material" in child) {
      const mat = (child as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  }

  if (selection.selected.length === 0) return;

  const outlineColor = getOutlineColor();

  for (const objId of selection.selected) {
    const targetObj = threeScene.getObjectByName(objId);
    if (!targetObj || !(targetObj instanceof THREE.Mesh)) continue;

    const geom = targetObj.geometry;
    if (!geom) continue;

    const outlineMat = new THREE.RawShaderMaterial({
      vertexShader: OUTLINE_VERTEX_SHADER,
      fragmentShader: OUTLINE_FRAGMENT_SHADER,
      uniforms: {
        uModelMatrix: { value: targetObj.matrixWorld },
        uViewMatrix: { value: new THREE.Matrix4() },
        uProjectionMatrix: { value: new THREE.Matrix4() },
        uNormalMatrix: { value: new THREE.Matrix3() },
        uOutlineWidth: { value: 0.02 },
        uOutlineColor: { value: new THREE.Vector4(...outlineColor) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      glslVersion: THREE.GLSL3,
    });

    const outlineMesh = new THREE.Mesh(geom.clone(), outlineMat);
    outlineMesh.matrix.copy(targetObj.matrixWorld);
    outlineMesh.matrixAutoUpdate = false;
    outlinesGroup.add(outlineMesh);
  }
}

/**
 * Applies face-orientation diagnostic materials if enabled.
 */
function updateFaceOrientation(threeScene: THREE.Scene, enabled: boolean): void {
  const FACE_MAT_KEY = "__ll_face_mat__";
  const ORIG_MAT_KEY = "__ll_orig_mat__";

  threeScene.traverse((obj) => {
    if (obj.name.startsWith("__ll_") || !(obj instanceof THREE.Mesh)) return;

    if (enabled) {
      if (!obj.userData[ORIG_MAT_KEY]) {
        obj.userData[ORIG_MAT_KEY] = obj.material;
      }
      let faceMat = obj.userData[FACE_MAT_KEY] as THREE.RawShaderMaterial | undefined;
      if (!faceMat) {
        faceMat = new THREE.RawShaderMaterial({
          vertexShader: FACE_ORIENTATION_VERTEX_SHADER,
          fragmentShader: FACE_ORIENTATION_FRAGMENT_SHADER,
          uniforms: {
            uModelMatrix: { value: obj.matrixWorld },
            uViewMatrix: { value: new THREE.Matrix4() },
            uProjectionMatrix: { value: new THREE.Matrix4() },
            uFrontColor: { value: new THREE.Vector4(0.18, 0.44, 0.88, 1.0) }, // Front Blue
            uBackColor: { value: new THREE.Vector4(0.88, 0.18, 0.18, 1.0) },  // Back Red
          },
          side: THREE.DoubleSide,
          glslVersion: THREE.GLSL3,
        });
        obj.userData[FACE_MAT_KEY] = faceMat;
      }
      obj.material = faceMat;
    } else {
      if (obj.userData[ORIG_MAT_KEY]) {
        obj.material = obj.userData[ORIG_MAT_KEY] as THREE.Material;
        delete obj.userData[ORIG_MAT_KEY];
      }
    }
  });
}

/**
 * Main export: applies all viewport overlays based on current settings,
 * selection, and 3D cursor state.
 */
export function applyOverlays(
  threeScene: THREE.Scene,
  settings: ViewportSettings,
  selection: Selection3d,
  cursor: Cursor3d
): void {
  const group = getOrCreateOverlayGroup(threeScene);
  const overlays = settings.overlays;

  // 1. Grid
  let gridObj = group.getObjectByName(GRID_NAME);
  if (!gridObj) {
    gridObj = createGridObject();
    group.add(gridObj);
  }
  gridObj.visible = Boolean(overlays.grid);

  // 2. Axes
  let axesObj = group.getObjectByName(AXES_NAME);
  if (!axesObj) {
    axesObj = createAxesObject();
    group.add(axesObj);
  }
  axesObj.visible = Boolean(overlays.axes);

  // 3. Origins
  let originsObj = group.getObjectByName(ORIGINS_NAME);
  if (!originsObj) {
    updateOriginsObject(group, threeScene);
    originsObj = group.getObjectByName(ORIGINS_NAME);
  } else if (overlays.origins) {
    updateOriginsObject(group, threeScene);
  }
  if (originsObj) {
    originsObj.visible = Boolean(overlays.origins);
  }

  // 4. 3D Cursor
  let cursorObj = group.getObjectByName(CURSOR_NAME) as THREE.Group | undefined;
  if (!cursorObj) {
    cursorObj = createCursorObject();
    group.add(cursorObj);
  }
  cursorObj.position.set(cursor.position[0], cursor.position[1], cursor.position[2]);
  cursorObj.quaternion.set(
    cursor.rotation[0],
    cursor.rotation[1],
    cursor.rotation[2],
    cursor.rotation[3]
  );
  cursorObj.visible = true;

  // 5. Normals
  let normalsObj = group.getObjectByName(NORMALS_NAME);
  if (normalsObj) {
    group.remove(normalsObj);
    (normalsObj as THREE.Group).traverse((child) => {
      if ("geometry" in child) (child as THREE.LineSegments).geometry.dispose();
      if ("material" in child) ((child as THREE.LineSegments).material as THREE.Material).dispose();
    });
  }
  if (overlays.normals) {
    normalsObj = createNormalsObject(threeScene);
    group.add(normalsObj);
  }

  // 6. Wireframe on shaded
  let wireObj = group.getObjectByName(WIRE_SHADED_NAME);
  if (wireObj) {
    group.remove(wireObj);
    (wireObj as THREE.Group).traverse((child) => {
      if ("geometry" in child) (child as THREE.LineSegments).geometry.dispose();
      if ("material" in child) ((child as THREE.LineSegments).material as THREE.Material).dispose();
    });
  }
  if (overlays.wireOnShaded && settings.shading !== "wireframe") {
    wireObj = createWireOnShadedObject(threeScene);
    group.add(wireObj);
  }

  // 7. Face orientation
  updateFaceOrientation(threeScene, overlays.faceOrientation);

  // 8. Selection outline
  updateSelectionOutlines(group, threeScene, selection);
}

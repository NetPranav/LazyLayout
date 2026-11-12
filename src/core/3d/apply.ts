/**
 * ============================================================================
 * 3D TRANSFORM BAKING & ORIGIN OPERATIONS
 * ============================================================================
 * Pure TypeScript implementation of Blender-style:
 *   - applyTransform: bakes selected components (location, rotation, scale)
 *     into the mesh geometry and resets them on the object transform.
 *   - setOriginToGeometry: centers origin on mesh bounding box.
 *   - setOriginToPoint: relocates origin to a world or local point.
 *   - setOriginToCenterOfMass: centers origin on volume centroid via signed
 *     tetrahedra (falling back to vertex mean for open or zero-volume meshes).
 *
 * Invariant: The visual object does not move — world positions of all mesh
 * vertices remain identical down to machine precision (< 1e-9).
 * ============================================================================
 */

import type { MotionDocument, Object3d, Mesh3d } from "../document/schema";
import { userCount } from "../document/dataBlocks";
import { createId } from "../ids";
import {
  type Mat4,
  type Vec3,
  compose,
  identity,
  invert,
  multiply,
  transformPoint,
  transformDirection,
  vec3,
} from "./math";
import { localMatrix, worldMatrix } from "./hierarchy";

export interface ApplyTransformOptions {
  location?: boolean;
  rotation?: boolean;
  scale?: boolean;
}

/**
 * Transforms a list of normal vectors (directions) by the inverse-transpose
 * of the 3x3 linear submatrix of mBake, normalizing each output.
 */
function transformNormals(normals: number[], mBake: Mat4): number[] {
  const inv = invert(mBake);
  // Normal matrix = (invBake)^T (upper 3x3 transpose)
  // Column-major inv:
  // col 0: inv[0], inv[1], inv[2]
  // col 1: inv[4], inv[5], inv[6]
  // col 2: inv[8], inv[9], inv[10]
  // Transpose (inv)^T:
  // col 0: inv[0], inv[4], inv[8]
  // col 1: inv[1], inv[5], inv[9]
  // col 2: inv[2], inv[6], inv[10]
  const nMat = identity();
  nMat[0] = inv[0]; nMat[1] = inv[4]; nMat[2] = inv[8];
  nMat[4] = inv[1]; nMat[5] = inv[5]; nMat[6] = inv[9];
  nMat[8] = inv[2]; nMat[9] = inv[6]; nMat[10] = inv[10];

  const out = new Array<number>(normals.length);
  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
    const tx = nMat[0] * nx + nMat[4] * ny + nMat[8] * nz;
    const ty = nMat[1] * nx + nMat[5] * ny + nMat[9] * nz;
    const tz = nMat[2] * nx + nMat[6] * ny + nMat[10] * nz;
    const len = Math.hypot(tx, ty, tz);
    if (len > 0) {
      out[i] = tx / len;
      out[i + 1] = ty / len;
      out[i + 2] = tz / len;
    } else {
      out[i] = nx;
      out[i + 1] = ny;
      out[i + 2] = nz;
    }
  }
  return out;
}

/**
 * Bakes the chosen transform parts (location, rotation, scale) into the object's
 * mesh geometry and resets the chosen parts on the transform.
 * World-space vertices stay identical.
 */
export function applyTransform(
  doc: MotionDocument,
  objectId: string,
  options: ApplyTransformOptions
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object "${objectId}" not found in document.`);
  }

  const applyLoc = options.location ?? false;
  const applyRot = options.rotation ?? false;
  const applyScl = options.scale ?? false;

  if (!applyLoc && !applyRot && !applyScl) {
    return doc;
  }

  const mOld = localMatrix(obj);

  // New transform with chosen parts reset
  const newLoc: [number, number, number] = applyLoc
    ? [0, 0, 0]
    : [obj.transform.location[0], obj.transform.location[1], obj.transform.location[2]];

  const newRot: [number, number, number, number] = applyRot
    ? [0, 0, 0, 1]
    : [
        obj.transform.rotationQuat[0],
        obj.transform.rotationQuat[1],
        obj.transform.rotationQuat[2],
        obj.transform.rotationQuat[3],
      ];

  const newScl: [number, number, number] = applyScl
    ? [1, 1, 1]
    : [obj.transform.scale[0], obj.transform.scale[1], obj.transform.scale[2]];

  const mNew = compose(newLoc, newRot, newScl);
  // M_bake = M_new^-1 * M_old
  const invMNew = invert(mNew);
  const mBake = multiply(invMNew, mOld);

  // Update mesh if present
  let targetMeshId = obj.dataId;
  const mesh = targetMeshId ? doc.meshes?.[targetMeshId] : undefined;

  let updatedMesh: Mesh3d | undefined;
  if (mesh && mesh.positions) {
    const newPositions = new Array<number>(mesh.positions.length);
    const pTemp = vec3();

    for (let i = 0; i < mesh.positions.length; i += 3) {
      pTemp[0] = mesh.positions[i];
      pTemp[1] = mesh.positions[i + 1];
      pTemp[2] = mesh.positions[i + 2];

      const pOut = transformPoint(mBake, pTemp);
      newPositions[i] = pOut[0];
      newPositions[i + 1] = pOut[1];
      newPositions[i + 2] = pOut[2];
    }

    let newNormals: number[] | undefined;
    if (mesh.normals && (applyRot || applyScl)) {
      newNormals = transformNormals(mesh.normals, mBake);
    } else if (mesh.normals) {
      newNormals = [...mesh.normals];
    }

    // Check if mesh is shared across multiple users
    const isShared = targetMeshId ? userCount(doc, "mesh", targetMeshId) > 1 : false;
    if (isShared) {
      targetMeshId = createId("msh");
    }

    updatedMesh = {
      ...mesh,
      id: targetMeshId!,
      positions: newPositions,
      ...(newNormals ? { normals: newNormals } : {}),
    };
  }

  // Update object transform
  const updatedObj: Object3d = {
    ...obj,
    transform: {
      location: newLoc,
      rotationQuat: newRot,
      scale: newScl,
    },
    dataId: targetMeshId,
  };

  if (applyLoc && updatedObj.delta?.location) {
    updatedObj.delta = { ...updatedObj.delta, location: [0, 0, 0] };
  }
  if (applyRot && updatedObj.delta?.rotationQuat) {
    updatedObj.delta = { ...updatedObj.delta, rotationQuat: [0, 0, 0, 1] };
  }
  if (applyScl && updatedObj.delta?.scale) {
    updatedObj.delta = { ...updatedObj.delta, scale: [1, 1, 1] };
  }

  // Mutate in-place on doc & return new document
  if (doc.objects) {
    doc.objects[objectId] = updatedObj;
  }
  if (doc.meshes && updatedMesh && targetMeshId) {
    doc.meshes[targetMeshId] = updatedMesh;
  }

  return {
    ...doc,
    objects: {
      ...doc.objects,
      [objectId]: updatedObj,
    },
    meshes: {
      ...doc.meshes,
      ...(updatedMesh && targetMeshId ? { [targetMeshId]: updatedMesh } : {}),
    },
  };
}

/**
 * Shifts the origin of an object to local point O_local.
 * Translates mesh vertices by -O_local and shifts object location by R * (S * O_local)
 * so world positions remain identical.
 */
function shiftOriginLocal(
  doc: MotionDocument,
  objectId: string,
  oLocal: [number, number, number]
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object "${objectId}" not found in document.`);
  }

  const ox = oLocal[0], oy = oLocal[1], oz = oLocal[2];
  if (ox === 0 && oy === 0 && oz === 0) {
    return doc;
  }

  // 1. Shift mesh vertices by -O_local
  let targetMeshId = obj.dataId;
  const mesh = targetMeshId ? doc.meshes?.[targetMeshId] : undefined;
  let updatedMesh: Mesh3d | undefined;

  if (mesh && mesh.positions) {
    const newPositions = new Array<number>(mesh.positions.length);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      newPositions[i] = mesh.positions[i] - ox;
      newPositions[i + 1] = mesh.positions[i + 1] - oy;
      newPositions[i + 2] = mesh.positions[i + 2] - oz;
    }

    const isShared = targetMeshId ? userCount(doc, "mesh", targetMeshId) > 1 : false;
    if (isShared) {
      targetMeshId = createId("msh");
    }

    updatedMesh = {
      ...mesh,
      id: targetMeshId!,
      positions: newPositions,
    };
  }

  // 2. Adjust object location: deltaL = R * (S * O_local)
  const rsMat = compose([0, 0, 0], obj.transform.rotationQuat, obj.transform.scale);
  const deltaL = transformDirection(rsMat, oLocal);

  const updatedObj: Object3d = {
    ...obj,
    transform: {
      ...obj.transform,
      location: [
        obj.transform.location[0] + deltaL[0],
        obj.transform.location[1] + deltaL[1],
        obj.transform.location[2] + deltaL[2],
      ],
    },
    dataId: targetMeshId,
  };

  if (doc.objects) {
    doc.objects[objectId] = updatedObj;
  }
  if (doc.meshes && updatedMesh && targetMeshId) {
    doc.meshes[targetMeshId] = updatedMesh;
  }

  return {
    ...doc,
    objects: {
      ...doc.objects,
      [objectId]: updatedObj,
    },
    meshes: {
      ...doc.meshes,
      ...(updatedMesh && targetMeshId ? { [targetMeshId]: updatedMesh } : {}),
    },
  };
}

/**
 * Sets the object's origin to its geometry center (bounding box midpoint).
 * The visual object does not move in world space.
 */
export function setOriginToGeometry(
  doc: MotionDocument,
  objectId: string
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object "${objectId}" not found in document.`);
  }

  const mesh = obj.dataId ? doc.meshes?.[obj.dataId] : undefined;
  if (!mesh || !mesh.positions || mesh.positions.length === 0) {
    return doc;
  }

  const pos = mesh.positions;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const center: [number, number, number] = [
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5,
  ];

  return shiftOriginLocal(doc, objectId, center);
}

export interface SetOriginPointOptions {
  /**
   * Coordinate space of point: "world" (default) or "local".
   */
  space?: "world" | "local";
}

/**
 * Sets the object's origin to an arbitrary point (world point by default).
 * Vertices and transform are adjusted so world positions remain identical.
 */
export function setOriginToPoint(
  doc: MotionDocument,
  objectId: string,
  point: ArrayLike<number>,
  options: SetOriginPointOptions = {}
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object "${objectId}" not found in document.`);
  }

  const space = options.space ?? "world";
  let oLocal: [number, number, number];

  if (space === "local") {
    oLocal = [point[0] ?? 0, point[1] ?? 0, point[2] ?? 0];
  } else {
    // Convert world point to local space: O_local = W_world^-1 * point
    const w = worldMatrix(doc, objectId);
    const invW = invert(w);
    const localPt = transformPoint(invW, point);
    oLocal = [localPt[0], localPt[1], localPt[2]];
  }

  return shiftOriginLocal(doc, objectId, oLocal);
}

function computeVertexMean(positions: number[]): [number, number, number] {
  const numVerts = positions.length / 3;
  if (numVerts === 0) return [0, 0, 0];

  let sumX = 0, sumY = 0, sumZ = 0;
  for (let i = 0; i < positions.length; i += 3) {
    sumX += positions[i];
    sumY += positions[i + 1];
    sumZ += positions[i + 2];
  }
  return [sumX / numVerts, sumY / numVerts, sumZ / numVerts];
}

/**
 * Sets the object's origin to its center of mass.
 * Uses signed tetrahedra volume integration for closed meshes;
 * automatically detects open meshes or zero-volume meshes and falls back to vertex mean.
 * Vertices and transform are adjusted so world positions remain identical.
 */
export function setOriginToCenterOfMass(
  doc: MotionDocument,
  objectId: string
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object "${objectId}" not found in document.`);
  }

  const mesh = obj.dataId ? doc.meshes?.[obj.dataId] : undefined;
  if (!mesh || !mesh.positions || mesh.positions.length < 9) {
    return doc;
  }

  const pos = mesh.positions;
  const indices = mesh.indices;
  const numTriangles = indices ? Math.floor(indices.length / 3) : Math.floor(pos.length / 9);

  if (numTriangles === 0) {
    return shiftOriginLocal(doc, objectId, computeVertexMean(pos));
  }

  const getIdx = (triIdx: number, vertInTri: number): number => {
    if (indices) {
      return indices[triIdx * 3 + vertInTri];
    }
    return triIdx * 3 + vertInTri;
  };

  // Check whether mesh is closed (each undirected edge must appear exactly 2 times)
  const edgeCounts = new Map<string, number>();
  for (let i = 0; i < numTriangles; i++) {
    const i1 = getIdx(i, 0);
    const i2 = getIdx(i, 1);
    const i3 = getIdx(i, 2);

    const e1 = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
    const e2 = i2 < i3 ? `${i2}_${i3}` : `${i3}_${i2}`;
    const e3 = i3 < i1 ? `${i3}_${i1}` : `${i1}_${i3}`;

    edgeCounts.set(e1, (edgeCounts.get(e1) ?? 0) + 1);
    edgeCounts.set(e2, (edgeCounts.get(e2) ?? 0) + 1);
    edgeCounts.set(e3, (edgeCounts.get(e3) ?? 0) + 1);
  }

  let isOpen = false;
  for (const count of edgeCounts.values()) {
    if (count !== 2) {
      isOpen = true;
      break;
    }
  }

  if (isOpen) {
    // Open mesh: fall back to vertex mean as specified
    return shiftOriginLocal(doc, objectId, computeVertexMean(pos));
  }

  // Closed mesh: evaluate signed tetrahedra volume and centroid
  let totalVolume = 0;
  let weightedX = 0, weightedY = 0, weightedZ = 0;

  for (let i = 0; i < numTriangles; i++) {
    const i1 = getIdx(i, 0);
    const i2 = getIdx(i, 1);
    const i3 = getIdx(i, 2);

    const x1 = pos[i1 * 3], y1 = pos[i1 * 3 + 1], z1 = pos[i1 * 3 + 2];
    const x2 = pos[i2 * 3], y2 = pos[i2 * 3 + 1], z2 = pos[i2 * 3 + 2];
    const x3 = pos[i3 * 3], y3 = pos[i3 * 3 + 1], z3 = pos[i3 * 3 + 2];

    // Signed volume = (p1 . (p2 x p3)) / 6
    const crossX = y2 * z3 - y3 * z2;
    const crossY = z2 * x3 - z3 * x2;
    const crossZ = x2 * y3 - x3 * y2;

    const det = x1 * crossX + y1 * crossY + z1 * crossZ;
    const vTet = det / 6.0;

    totalVolume += vTet;

    // Centroid of tetrahedron with origin: (p1 + p2 + p3) / 4
    const cX = (x1 + x2 + x3) * 0.25;
    const cY = (y1 + y2 + y3) * 0.25;
    const cZ = (z1 + z2 + z3) * 0.25;

    weightedX += vTet * cX;
    weightedY += vTet * cY;
    weightedZ += vTet * cZ;
  }

  if (Math.abs(totalVolume) < 1e-12) {
    // Near-zero or degenerate volume: fall back to vertex mean
    return shiftOriginLocal(doc, objectId, computeVertexMean(pos));
  }

  const centerOfMass: [number, number, number] = [
    weightedX / totalVolume,
    weightedY / totalVolume,
    weightedZ / totalVolume,
  ];

  return shiftOriginLocal(doc, objectId, centerOfMass);
}

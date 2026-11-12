/**
 * ============================================================================
 * 3D PROCEDURAL PRIMITIVE MESH GENERATORS (Phase 3D-011)
 * ============================================================================
 * Pure procedural mesh generators returning { positions: Float32Array, indices: Uint32Array }.
 *
 * Invariants:
 *   - Outward-facing counter-clockwise winding (right-hand rule).
 *   - Unit size by default (width/height/depth or radius = 1).
 *   - Closed meshes are watertight 2-manifolds (every edge is shared by exactly 2 triangles).
 *   - Signed volume of closed meshes is strictly positive.
 *   - Pure TypeScript, zero DOM/Three.js dependencies.
 * ============================================================================
 */

export interface PrimitiveMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/**
 * Calculates the signed volume of a closed triangle mesh using tetrahedra divergence summation.
 * Positive volume indicates consistent outward-facing CCW winding.
 */
export function computeSignedVolume(positions: ArrayLike<number>, indices: ArrayLike<number>): number {
  let totalVolume = 0;
  const numTriangles = Math.floor(indices.length / 3);
  for (let i = 0; i < numTriangles; i++) {
    const i1 = indices[i * 3];
    const i2 = indices[i * 3 + 1];
    const i3 = indices[i * 3 + 2];

    const x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2];
    const x2 = positions[i2 * 3], y2 = positions[i2 * 3 + 1], z2 = positions[i2 * 3 + 2];
    const x3 = positions[i3 * 3], y3 = positions[i3 * 3 + 1], z3 = positions[i3 * 3 + 2];

    // Signed volume of tetrahedron formed by triangle and origin: (v1 . (v2 x v3)) / 6
    const crossX = y2 * z3 - y3 * z2;
    const crossY = z2 * x3 - z3 * x2;
    const crossZ = x2 * y3 - x3 * y2;

    const det = x1 * crossX + y1 * crossY + z1 * crossZ;
    totalVolume += det / 6.0;
  }
  return totalVolume;
}

/**
 * Checks whether every undirected edge in a triangle mesh is shared by exactly two triangles (watertight 2-manifold).
 */
export function isWatertightMesh(indices: ArrayLike<number>): boolean {
  const edgeCounts = new Map<string, number>();
  const numTriangles = Math.floor(indices.length / 3);
  if (numTriangles === 0) return false;

  for (let i = 0; i < numTriangles; i++) {
    const i1 = indices[i * 3];
    const i2 = indices[i * 3 + 1];
    const i3 = indices[i * 3 + 2];

    const e1 = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
    const e2 = i2 < i3 ? `${i2}_${i3}` : `${i3}_${i2}`;
    const e3 = i3 < i1 ? `${i3}_${i1}` : `${i1}_${i3}`;

    edgeCounts.set(e1, (edgeCounts.get(e1) ?? 0) + 1);
    edgeCounts.set(e2, (edgeCounts.get(e2) ?? 0) + 1);
    edgeCounts.set(e3, (edgeCounts.get(e3) ?? 0) + 1);
  }

  for (const count of edgeCounts.values()) {
    if (count !== 2) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 1. CUBE
// ---------------------------------------------------------------------------

export interface CubeOptions {
  size?: number;
  width?: number;
  height?: number;
  depth?: number;
}

export function cube(options?: number | CubeOptions): PrimitiveMesh {
  let w = 1, h = 1, d = 1;
  if (typeof options === "number") {
    w = options; h = options; d = options;
  } else if (options) {
    if (options.size !== undefined) {
      w = options.size; h = options.size; d = options.size;
    }
    if (options.width !== undefined) w = options.width;
    if (options.height !== undefined) h = options.height;
    if (options.depth !== undefined) d = options.depth;
  }

  const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;

  const positions = new Float32Array([
    -hw, -hh, -hd, // 0: left bottom back
     hw, -hh, -hd, // 1: right bottom back
     hw,  hh, -hd, // 2: right top back
    -hw,  hh, -hd, // 3: left top back
    -hw, -hh,  hd, // 4: left bottom front
     hw, -hh,  hd, // 5: right bottom front
     hw,  hh,  hd, // 6: right top front
    -hw,  hh,  hd, // 7: left top front
  ]);

  const indices = new Uint32Array([
    // Front (+Z)
    4, 5, 6,  4, 6, 7,
    // Back (-Z)
    1, 0, 3,  1, 3, 2,
    // Top (+Y)
    7, 6, 2,  7, 2, 3,
    // Bottom (-Y)
    0, 1, 5,  0, 5, 4,
    // Right (+X)
    5, 1, 2,  5, 2, 6,
    // Left (-X)
    0, 4, 7,  0, 7, 3,
  ]);

  return { positions, indices };
}

// ---------------------------------------------------------------------------
// 2. UV SPHERE
// ---------------------------------------------------------------------------

export interface UvSphereOptions {
  radius?: number;
  segments?: number;
  rings?: number;
}

export function uvSphere(
  segmentsOrOptions: number | UvSphereOptions = 32,
  ringsArg = 16,
  radiusArg = 1
): PrimitiveMesh {
  let segments = 32;
  let rings = 16;
  let radius = 1;

  if (typeof segmentsOrOptions === "object") {
    segments = Math.max(3, segmentsOrOptions.segments ?? 32);
    rings = Math.max(2, segmentsOrOptions.rings ?? 16);
    radius = segmentsOrOptions.radius ?? 1;
  } else {
    segments = Math.max(3, segmentsOrOptions);
    rings = Math.max(2, ringsArg);
    radius = radiusArg;
  }

  const vertexCount = 2 + (rings - 1) * segments;
  const positions = new Float32Array(vertexCount * 3);

  // Top pole (index 0)
  positions[0] = 0;
  positions[1] = radius;
  positions[2] = 0;

  let vPtr = 3;
  for (let r = 1; r < rings; r++) {
    const theta = (r / rings) * Math.PI;
    const y = radius * Math.cos(theta);
    const sinTheta = Math.sin(theta);
    for (let s = 0; s < segments; s++) {
      const phi = (s / segments) * 2 * Math.PI;
      const x = radius * sinTheta * Math.cos(phi);
      const z = radius * sinTheta * Math.sin(phi);
      positions[vPtr++] = x;
      positions[vPtr++] = y;
      positions[vPtr++] = z;
    }
  }

  // Bottom pole (last index)
  const botIdx = vertexCount - 1;
  positions[vPtr++] = 0;
  positions[vPtr++] = -radius;
  positions[vPtr++] = 0;

  // Triangles: segments for top cap + 2 * segments * (rings - 2) for body + segments for bottom cap
  const triangleCount = 2 * segments * (rings - 1);
  const indices = new Uint32Array(triangleCount * 3);
  let iPtr = 0;

  // Top cap (fan from top pole index 0)
  for (let s = 0; s < segments; s++) {
    const nextS = (s + 1) % segments;
    indices[iPtr++] = 0;
    indices[iPtr++] = 1 + nextS;
    indices[iPtr++] = 1 + s;
  }

  // Intermediate rings
  for (let r = 1; r < rings - 1; r++) {
    const curRingStart = 1 + (r - 1) * segments;
    const nextRingStart = curRingStart + segments;
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      const a = curRingStart + s;
      const b = curRingStart + nextS;
      const c = nextRingStart + s;
      const d = nextRingStart + nextS;

      indices[iPtr++] = a;
      indices[iPtr++] = b;
      indices[iPtr++] = d;

      indices[iPtr++] = a;
      indices[iPtr++] = d;
      indices[iPtr++] = c;
    }
  }

  // Bottom cap (fan to bottom pole)
  const lastRingStart = 1 + (rings - 2) * segments;
  for (let s = 0; s < segments; s++) {
    const nextS = (s + 1) % segments;
    const a = lastRingStart + s;
    const b = lastRingStart + nextS;
    indices[iPtr++] = a;
    indices[iPtr++] = b;
    indices[iPtr++] = botIdx;
  }

  return { positions, indices };
}

// ---------------------------------------------------------------------------
// 3. CYLINDER
// ---------------------------------------------------------------------------

export interface CylinderOptions {
  vertices?: number;
  depth?: number;
  radius?: number;
  radiusTop?: number;
  radiusBottom?: number;
}

export function cylinder(
  verticesOrOptions: number | CylinderOptions = 32,
  depthArg = 2,
  radiusArg = 1
): PrimitiveMesh {
  let vertices = 32;
  let depth = 2;
  let rTop = 1;
  let rBot = 1;

  if (typeof verticesOrOptions === "object") {
    vertices = Math.max(3, verticesOrOptions.vertices ?? 32);
    depth = verticesOrOptions.depth ?? 2;
    rTop = verticesOrOptions.radiusTop ?? verticesOrOptions.radius ?? 1;
    rBot = verticesOrOptions.radiusBottom ?? verticesOrOptions.radius ?? 1;
  } else {
    vertices = Math.max(3, verticesOrOptions);
    depth = depthArg;
    rTop = radiusArg;
    rBot = radiusArg;
  }

  const halfDepth = depth * 0.5;
  // Vertex layout:
  // 0: top center
  // 1 .. vertices: top ring
  // 1 + vertices: bottom center
  // 2 + vertices .. 1 + 2 * vertices: bottom ring
  const totalVerts = 2 + 2 * vertices;
  const positions = new Float32Array(totalVerts * 3);

  // Top center
  positions[0] = 0;
  positions[1] = halfDepth;
  positions[2] = 0;

  // Top ring
  let ptr = 3;
  for (let s = 0; s < vertices; s++) {
    const phi = (s / vertices) * 2 * Math.PI;
    positions[ptr++] = rTop * Math.cos(phi);
    positions[ptr++] = halfDepth;
    positions[ptr++] = rTop * Math.sin(phi);
  }

  // Bottom center
  const botCenter = 1 + vertices;
  positions[ptr++] = 0;
  positions[ptr++] = -halfDepth;
  positions[ptr++] = 0;

  // Bottom ring
  const botRingStart = 2 + vertices;
  for (let s = 0; s < vertices; s++) {
    const phi = (s / vertices) * 2 * Math.PI;
    positions[ptr++] = rBot * Math.cos(phi);
    positions[ptr++] = -halfDepth;
    positions[ptr++] = rBot * Math.sin(phi);
  }

  // Triangles: vertices (top cap) + vertices (bottom cap) + 2 * vertices (side) = 4 * vertices
  const indices = new Uint32Array(vertices * 4 * 3);
  let iPtr = 0;

  // Top cap (outward normal +Y)
  for (let s = 0; s < vertices; s++) {
    const nextS = (s + 1) % vertices;
    indices[iPtr++] = 0;
    indices[iPtr++] = 1 + nextS;
    indices[iPtr++] = 1 + s;
  }

  // Bottom cap (outward normal -Y)
  for (let s = 0; s < vertices; s++) {
    const nextS = (s + 1) % vertices;
    indices[iPtr++] = botCenter;
    indices[iPtr++] = botRingStart + s;
    indices[iPtr++] = botRingStart + nextS;
  }

  // Side quads
  for (let s = 0; s < vertices; s++) {
    const nextS = (s + 1) % vertices;
    const t1 = 1 + s;
    const t2 = 1 + nextS;
    const b1 = botRingStart + s;
    const b2 = botRingStart + nextS;

    indices[iPtr++] = t1;
    indices[iPtr++] = t2;
    indices[iPtr++] = b1;

    indices[iPtr++] = t2;
    indices[iPtr++] = b2;
    indices[iPtr++] = b1;
  }

  return { positions, indices };
}

// ---------------------------------------------------------------------------
// 4. CONE
// ---------------------------------------------------------------------------

export interface ConeOptions {
  vertices?: number;
  depth?: number;
  radius?: number;
}

export function cone(
  verticesOrOptions: number | ConeOptions = 32,
  depthArg = 2,
  radiusArg = 1
): PrimitiveMesh {
  let vertices = 32;
  let depth = 2;
  let radius = 1;

  if (typeof verticesOrOptions === "object") {
    vertices = Math.max(3, verticesOrOptions.vertices ?? 32);
    depth = verticesOrOptions.depth ?? 2;
    radius = verticesOrOptions.radius ?? 1;
  } else {
    vertices = Math.max(3, verticesOrOptions);
    depth = depthArg;
    radius = radiusArg;
  }

  const halfDepth = depth * 0.5;
  // Layout:
  // 0: apex (0, halfDepth, 0)
  // 1: base center (0, -halfDepth, 0)
  // 2 .. 1 + vertices: base ring
  const totalVerts = 2 + vertices;
  const positions = new Float32Array(totalVerts * 3);

  // Apex
  positions[0] = 0;
  positions[1] = halfDepth;
  positions[2] = 0;

  // Base center
  positions[3] = 0;
  positions[4] = -halfDepth;
  positions[5] = 0;

  // Base ring
  let ptr = 6;
  for (let s = 0; s < vertices; s++) {
    const phi = (s / vertices) * 2 * Math.PI;
    positions[ptr++] = radius * Math.cos(phi);
    positions[ptr++] = -halfDepth;
    positions[ptr++] = radius * Math.sin(phi);
  }

  // Triangles: vertices (side fan) + vertices (base fan) = 2 * vertices
  const indices = new Uint32Array(vertices * 2 * 3);
  let iPtr = 0;

  // Side fan (from apex)
  for (let s = 0; s < vertices; s++) {
    const nextS = (s + 1) % vertices;
    indices[iPtr++] = 0;
    indices[iPtr++] = 2 + nextS;
    indices[iPtr++] = 2 + s;
  }

  // Base cap fan (from base center, outward normal -Y)
  for (let s = 0; s < vertices; s++) {
    const nextS = (s + 1) % vertices;
    indices[iPtr++] = 1;
    indices[iPtr++] = 2 + s;
    indices[iPtr++] = 2 + nextS;
  }

  return { positions, indices };
}

// ---------------------------------------------------------------------------
// 5. PLANE
// ---------------------------------------------------------------------------

export interface PlaneOptions {
  size?: number;
  width?: number;
  height?: number;
}

export function plane(options?: number | PlaneOptions): PrimitiveMesh {
  let w = 2, h = 2;
  if (typeof options === "number") {
    w = options; h = options;
  } else if (options) {
    if (options.size !== undefined) {
      w = options.size; h = options.size;
    }
    if (options.width !== undefined) w = options.width;
    if (options.height !== undefined) h = options.height;
  }

  const hw = w * 0.5;
  const hh = h * 0.5;

  // Flat quad on XZ plane with normal facing +Y
  const positions = new Float32Array([
    -hw, 0,  hh, // 0: bottom-left
     hw, 0,  hh, // 1: bottom-right
     hw, 0, -hh, // 2: top-right
    -hw, 0, -hh, // 3: top-left
  ]);

  const indices = new Uint32Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  return { positions, indices };
}

// ---------------------------------------------------------------------------
// 6. TORUS
// ---------------------------------------------------------------------------

export interface TorusOptions {
  radius?: number; // major radius
  tube?: number;   // minor radius
  radialSegments?: number;
  tubularSegments?: number;
}

export function torus(
  radiusOrOptions: number | TorusOptions = 1,
  tubeArg = 0.25,
  radialSegmentsArg = 16,
  tubularSegmentsArg = 32
): PrimitiveMesh {
  let radius = 1;
  let tube = 0.25;
  let radialSegments = 16;
  let tubularSegments = 32;

  if (typeof radiusOrOptions === "object") {
    radius = radiusOrOptions.radius ?? 1;
    tube = radiusOrOptions.tube ?? 0.25;
    radialSegments = Math.max(3, radiusOrOptions.radialSegments ?? 16);
    tubularSegments = Math.max(3, radiusOrOptions.tubularSegments ?? 32);
  } else {
    radius = radiusOrOptions;
    tube = tubeArg;
    radialSegments = Math.max(3, radialSegmentsArg);
    tubularSegments = Math.max(3, tubularSegmentsArg);
  }

  const totalVerts = radialSegments * tubularSegments;
  const positions = new Float32Array(totalVerts * 3);
  let vPtr = 0;

  for (let i = 0; i < tubularSegments; i++) {
    const u = (i / tubularSegments) * 2 * Math.PI;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    for (let j = 0; j < radialSegments; j++) {
      const v = (j / radialSegments) * 2 * Math.PI;
      const cosV = Math.cos(v);
      const sinV = Math.sin(v);

      const x = (radius + tube * cosV) * cosU;
      const y = tube * sinV;
      const z = (radius + tube * cosV) * sinU;

      positions[vPtr++] = x;
      positions[vPtr++] = y;
      positions[vPtr++] = z;
    }
  }

  const totalTriangles = tubularSegments * radialSegments * 2;
  const indices = new Uint32Array(totalTriangles * 3);
  let iPtr = 0;

  for (let i = 0; i < tubularSegments; i++) {
    const nextI = (i + 1) % tubularSegments;
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;

      const a = i * radialSegments + j;
      const b = nextI * radialSegments + j;
      const c = i * radialSegments + nextJ;
      const d = nextI * radialSegments + nextJ;

      // CCW outward orientation
      indices[iPtr++] = a;
      indices[iPtr++] = d;
      indices[iPtr++] = b;

      indices[iPtr++] = a;
      indices[iPtr++] = c;
      indices[iPtr++] = d;
    }
  }

  return { positions, indices };
}

// ---------------------------------------------------------------------------
// 7. ICOSPHERE
// ---------------------------------------------------------------------------

export interface IcosphereOptions {
  radius?: number;
  subdivisions?: number;
}

export function icosphere(
  subdivisionsOrOptions: number | IcosphereOptions = 2,
  radiusArg = 1
): PrimitiveMesh {
  let subdivisions = 2;
  let radius = 1;

  if (typeof subdivisionsOrOptions === "object") {
    subdivisions = Math.max(0, Math.min(8, subdivisionsOrOptions.subdivisions ?? 2));
    radius = subdivisionsOrOptions.radius ?? 1;
  } else {
    subdivisions = Math.max(0, Math.min(8, subdivisionsOrOptions));
    radius = radiusArg;
  }

  // Base icosahedron
  const phi = (1 + Math.sqrt(5)) * 0.5;

  const baseVerts: [number, number, number][] = [
    [-1,  phi,  0],
    [ 1,  phi,  0],
    [-1, -phi,  0],
    [ 1, -phi,  0],

    [ 0, -1,  phi],
    [ 0,  1,  phi],
    [ 0, -1, -phi],
    [ 0,  1, -phi],

    [ phi,  0, -1],
    [ phi,  0,  1],
    [-phi,  0, -1],
    [-phi,  0,  1],
  ];

  // Base 20 faces with CCW outward winding
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],

    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],

    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],

    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  // Dynamic vertex list for subdivisions
  const vertices: [number, number, number][] = baseVerts.map(([x, y, z]) => {
    const len = Math.hypot(x, y, z);
    return [x / len, y / len, z / len];
  });

  const midpointCache = new Map<string, number>();

  function getMidpoint(idxA: number, idxB: number): number {
    const min = Math.min(idxA, idxB);
    const max = Math.max(idxA, idxB);
    const key = `${min}_${max}`;
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;

    const vA = vertices[idxA];
    const vB = vertices[idxB];
    const mx = (vA[0] + vB[0]) * 0.5;
    const my = (vA[1] + vB[1]) * 0.5;
    const mz = (vA[2] + vB[2]) * 0.5;
    const len = Math.hypot(mx, my, mz);
    const midIdx = vertices.length;
    vertices.push([mx / len, my / len, mz / len]);
    midpointCache.set(key, midIdx);
    return midIdx;
  }

  for (let s = 0; s < subdivisions; s++) {
    midpointCache.clear();
    const nextFaces: [number, number, number][] = [];
    for (let f = 0; f < faces.length; f++) {
      const [v0, v1, v2] = faces[f];
      const m01 = getMidpoint(v0, v1);
      const m12 = getMidpoint(v1, v2);
      const m20 = getMidpoint(v2, v0);

      nextFaces.push([v0, m01, m20]);
      nextFaces.push([v1, m12, m01]);
      nextFaces.push([v2, m20, m12]);
      nextFaces.push([m01, m12, m20]);
    }
    faces = nextFaces;
  }

  const positions = new Float32Array(vertices.length * 3);
  for (let i = 0; i < vertices.length; i++) {
    positions[i * 3] = vertices[i][0] * radius;
    positions[i * 3 + 1] = vertices[i][1] * radius;
    positions[i * 3 + 2] = vertices[i][2] * radius;
  }

  const indices = new Uint32Array(faces.length * 3);
  for (let i = 0; i < faces.length; i++) {
    indices[i * 3] = faces[i][0];
    indices[i * 3 + 1] = faces[i][1];
    indices[i * 3 + 2] = faces[i][2];
  }

  return { positions, indices };
}

/**
 * ============================================================================
 * EDIT MESH: PURE TYPESCRIPT BMESH DATA STRUCTURE (Phase 3D-013)
 * ============================================================================
 * Boundary-representation geometry structure modeled after Blender's BMesh:
 *   - Vertices (BMVert): 3D coordinates, index, unique id, optional attributes, incident edges.
 *   - Edges (BMEdge): exactly two endpoints (v1, v2), radial cycle of face loops.
 *   - Faces (BMFace): n-gons (len >= 3) composed of closed face-loop corners.
 *   - Loops (BMLoop): face corner referencing vertex v, edge e, face f, next/prev
 *     around the face perimeter, and radialNext/radialPrev around edge e.
 *
 * Supports general n-gon ear-clipping triangulation, attribute layers, topological
 * editing operations (add/remove, split, dissolve, extrude, flip), and fast invariant
 * validation.
 * ============================================================================
 */

export interface BMVert {
  id: number;
  index: number;
  co: [number, number, number];
  attributes?: Record<string, number[]>;
  edge?: BMEdge | null;
}

export interface BMEdge {
  index: number;
  v1: BMVert;
  v2: BMVert;
  l: BMLoop | null;
}

export interface BMFace {
  index: number;
  l: BMLoop;
  len: number;
  attributes?: Record<string, number[]>;
}

export interface BMLoop {
  index: number;
  v: BMVert;
  e: BMEdge;
  f: BMFace;
  next: BMLoop;
  prev: BMLoop;
  radialNext: BMLoop;
  radialPrev: BMLoop;
  attributes?: Record<string, number[]>;
}

export interface TriangulatedMesh {
  positions: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
}

export interface MeshBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface IMeshDirtyTracker {
  markVertexDirty(vertexIndex: number): void;
  markTopologyDirty(): void;
  toTrianglesIncremental(mesh: EditMesh): TriangulatedMesh;
}

interface BoundarySegment {
  vA: BMVert;
  vB: BMVert;
  edge: BMEdge;
}

/**
 * Generates an undirected canonical edge key using permanent vertex IDs.
 */
function edgeKey(id1: number, id2: number): string {
  return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
}

export class EditMesh {
  verts: BMVert[] = [];
  edges: BMEdge[] = [];
  faces: BMFace[] = [];

  private edgeMap = new Map<string, BMEdge>();
  private nextVertId = 0;
  private nextLoopId = 0;
  private tracker: IMeshDirtyTracker | null = null;

  // ---------------------------------------------------------------------------
  // Tracker Attachment
  // ---------------------------------------------------------------------------

  attachTracker(tracker: IMeshDirtyTracker): void {
    this.tracker = tracker;
    this.tracker.markTopologyDirty();
  }

  getTracker(): IMeshDirtyTracker | null {
    return this.tracker;
  }

  detachTracker(): void {
    this.tracker = null;
  }

  // ---------------------------------------------------------------------------
  // Vertices
  // ---------------------------------------------------------------------------

  addVert(
    position: [number, number, number] | ArrayLike<number>,
    attributes?: Record<string, number[]>
  ): BMVert {
    const v: BMVert = {
      id: this.nextVertId++,
      index: this.verts.length,
      co: [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0],
      attributes: attributes ? { ...attributes } : undefined,
      edge: null,
    };
    this.verts.push(v);
    this.tracker?.markTopologyDirty();
    return v;
  }

  moveVert(
    vert: BMVert,
    newPosition: [number, number, number] | ArrayLike<number>
  ): void {
    vert.co[0] = newPosition[0] ?? 0;
    vert.co[1] = newPosition[1] ?? 0;
    vert.co[2] = newPosition[2] ?? 0;
    this.tracker?.markVertexDirty(vert.index);
  }

  removeVert(vert: BMVert): void {
    // 1. Remove all incident edges (which in turn removes incident faces)
    const incidentEdges: BMEdge[] = [];
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      if (e.v1 === vert || e.v2 === vert) {
        incidentEdges.push(e);
      }
    }
    for (let i = 0; i < incidentEdges.length; i++) {
      if (this.edges.includes(incidentEdges[i])) {
        this.removeEdge(incidentEdges[i]);
      }
    }

    // 2. Remove vert from this.verts
    const idx = this.verts.indexOf(vert);
    if (idx !== -1) {
      this.verts.splice(idx, 1);
      // Re-index remaining vertices to maintain contiguous 0..V-1 indices
      for (let i = 0; i < this.verts.length; i++) {
        this.verts[i].index = i;
      }
    }

    this.tracker?.markTopologyDirty();
  }

  // ---------------------------------------------------------------------------
  // Edges
  // ---------------------------------------------------------------------------

  findEdge(v1: BMVert, v2: BMVert): BMEdge | undefined {
    return this.edgeMap.get(edgeKey(v1.id, v2.id));
  }

  addEdge(v1: BMVert, v2: BMVert): BMEdge {
    if (v1 === v2) {
      throw new Error(`Cannot create degenerate edge with identical vertex endpoints (${v1.index})`);
    }
    const key = edgeKey(v1.id, v2.id);
    const existing = this.edgeMap.get(key);
    if (existing) {
      return existing;
    }

    const edge: BMEdge = {
      index: this.edges.length,
      v1,
      v2,
      l: null,
    };
    this.edges.push(edge);
    this.edgeMap.set(key, edge);

    if (!v1.edge) v1.edge = edge;
    if (!v2.edge) v2.edge = edge;

    this.tracker?.markTopologyDirty();
    return edge;
  }

  removeEdge(edge: BMEdge): void {
    // 1. Remove all faces using this edge
    if (edge.l !== null) {
      const facesToRemove: BMFace[] = [];
      let curr = edge.l;
      do {
        if (!facesToRemove.includes(curr.f)) {
          facesToRemove.push(curr.f);
        }
        curr = curr.radialNext;
      } while (curr !== edge.l);

      for (let i = 0; i < facesToRemove.length; i++) {
        if (this.faces.includes(facesToRemove[i])) {
          this.removeFace(facesToRemove[i]);
        }
      }
      edge.l = null;
    }

    // 2. Remove from edgeMap using immutable vertex IDs
    const key = edgeKey(edge.v1.id, edge.v2.id);
    this.edgeMap.delete(key);

    // 3. Remove from this.edges
    const idx = this.edges.indexOf(edge);
    if (idx !== -1) {
      this.edges.splice(idx, 1);
      for (let i = 0; i < this.edges.length; i++) {
        this.edges[i].index = i;
      }
    }

    // 4. Update vertex incident edge references
    if (edge.v1.edge === edge) {
      edge.v1.edge = this.findAnyIncidentEdge(edge.v1);
    }
    if (edge.v2.edge === edge) {
      edge.v2.edge = this.findAnyIncidentEdge(edge.v2);
    }

    this.tracker?.markTopologyDirty();
  }

  private findAnyIncidentEdge(v: BMVert): BMEdge | null {
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      if (e.v1 === v || e.v2 === v) {
        return e;
      }
    }
    return null;
  }

  splitEdge(edge: BMEdge, factor = 0.5): { vert: BMVert; edge: BMEdge } {
    const v1 = edge.v1;
    const v2 = edge.v2;

    const midCo: [number, number, number] = [
      v1.co[0] + factor * (v2.co[0] - v1.co[0]),
      v1.co[1] + factor * (v2.co[1] - v1.co[1]),
      v1.co[2] + factor * (v2.co[2] - v1.co[2]),
    ];

    const vMid = this.addVert(midCo);

    // Remove old edge mapping (v1.id, v2.id)
    this.edgeMap.delete(edgeKey(v1.id, v2.id));

    // Update existing edge to connect (v1, vMid)
    edge.v2 = vMid;
    this.edgeMap.set(edgeKey(v1.id, vMid.id), edge);

    // Create new edge connecting (vMid, v2)
    const newEdge: BMEdge = {
      index: this.edges.length,
      v1: vMid,
      v2: v2,
      l: null,
    };
    this.edges.push(newEdge);
    this.edgeMap.set(edgeKey(vMid.id, v2.id), newEdge);

    if (!vMid.edge) vMid.edge = edge;
    if (v2.edge === edge) v2.edge = newEdge;

    // Collect all loops in edge's radial cycle before modifying
    const loops: BMLoop[] = [];
    if (edge.l !== null) {
      let curr = edge.l;
      do {
        loops.push(curr);
        curr = curr.radialNext;
      } while (curr !== edge.l);
    }

    // Insert new loop into each adjacent face corner
    for (let i = 0; i < loops.length; i++) {
      const l = loops[i];
      if (l.v === v1) {
        // l goes v1 -> vMid (uses edge). New loop goes vMid -> v2 (uses newEdge)
        const origNext = l.next;
        const lNew: BMLoop = {
          index: this.nextLoopId++,
          v: vMid,
          e: newEdge,
          f: l.f,
          next: origNext,
          prev: l,
          radialNext: null as unknown as BMLoop,
          radialPrev: null as unknown as BMLoop,
        };
        lNew.radialNext = lNew;
        lNew.radialPrev = lNew;

        l.next = lNew;
        origNext.prev = lNew;
        l.f.len++;

        // Add lNew to newEdge's radial cycle
        this.linkLoopRadial(newEdge, lNew);
      } else {
        // l was at v2 (goes v2 -> v1).
        // First segment v2 -> vMid now uses newEdge. Second segment vMid -> v1 uses edge.
        this.unlinkLoopRadial(edge, l);
        this.linkLoopRadial(newEdge, l);

        const origNext = l.next;
        const lNew: BMLoop = {
          index: this.nextLoopId++,
          v: vMid,
          e: edge,
          f: l.f,
          next: origNext,
          prev: l,
          radialNext: null as unknown as BMLoop,
          radialPrev: null as unknown as BMLoop,
        };
        lNew.radialNext = lNew;
        lNew.radialPrev = lNew;

        l.next = lNew;
        origNext.prev = lNew;
        l.f.len++;

        // Add lNew to edge's radial cycle
        this.linkLoopRadial(edge, lNew);
      }
    }

    this.tracker?.markTopologyDirty();
    return { vert: vMid, edge: newEdge };
  }

  dissolveEdge(edge: BMEdge): BMFace | null {
    if (edge.l === null) {
      this.removeEdge(edge);
      return null;
    }

    // Collect loops using edge
    const loopsOnEdge: BMLoop[] = [];
    let curr = edge.l;
    do {
      loopsOnEdge.push(curr);
      curr = curr.radialNext;
    } while (curr !== edge.l);

    if (loopsOnEdge.length !== 2) {
      // Only 2-manifold adjacent faces can be merged into an n-gon
      return null;
    }

    const l1 = loopsOnEdge[0];
    const l2 = loopsOnEdge[1];
    const f1 = l1.f;
    const f2 = l2.f;

    if (f1 === f2) {
      return null;
    }

    // In order to dissolve an edge, adjacent faces must have opposite manifold winding along the edge
    if (l1.v === l2.v) {
      return null;
    }

    // Verify merging does not create duplicate vertices:
    // f1 and f2 must share EXACTLY the 2 endpoints of this edge
    const f1Verts = new Set<BMVert>();
    let walk1 = f1.l;
    do {
      f1Verts.add(walk1.v);
      walk1 = walk1.next;
    } while (walk1 !== f1.l);

    let sharedCount = 0;
    let walk2 = f2.l;
    do {
      if (f1Verts.has(walk2.v)) {
        sharedCount++;
      }
      walk2 = walk2.next;
    } while (walk2 !== f2.l);

    if (sharedCount !== 2) {
      return null;
    }

    // Unlink l1 and l2 from edge's radial cycle
    this.unlinkLoopRadial(edge, l1);
    this.unlinkLoopRadial(edge, l2);

    // Splice loop cycles together:
    // l1 goes from Va to Vb. l2 goes from Vb to Va.
    // l1.prev -> l2.next, l2.prev -> l1.next
    const l1Prev = l1.prev;
    const l1Next = l1.next;
    const l2Prev = l2.prev;
    const l2Next = l2.next;

    l1Prev.next = l2Next;
    l2Next.prev = l1Prev;

    l2Prev.next = l1Next;
    l1Next.prev = l2Prev;

    // Reparent all loops of f2 to f1
    let updateF = l2Next;
    while (updateF !== l1Next) {
      updateF.f = f1;
      updateF = updateF.next;
    }

    f1.l = l1Next;
    f1.len = f1.len + f2.len - 2;

    // Clean up isolated loops l1 and l2 so no dangling references remain
    l1.f = null as unknown as BMFace;
    l1.e = null as unknown as BMEdge;
    l1.next = l1;
    l1.prev = l1;
    l2.f = null as unknown as BMFace;
    l2.e = null as unknown as BMEdge;
    l2.next = l2;
    l2.prev = l2;

    // Delete f2
    f2.l = null as unknown as BMLoop;
    f2.len = 0;
    const f2Idx = this.faces.indexOf(f2);
    if (f2Idx !== -1) {
      this.faces.splice(f2Idx, 1);
      for (let i = 0; i < this.faces.length; i++) {
        this.faces[i].index = i;
      }
    }

    // Delete dissolved edge
    this.edgeMap.delete(edgeKey(edge.v1.id, edge.v2.id));
    const eIdx = this.edges.indexOf(edge);
    if (eIdx !== -1) {
      this.edges.splice(eIdx, 1);
      for (let i = 0; i < this.edges.length; i++) {
        this.edges[i].index = i;
      }
    }

    if (edge.v1.edge === edge) {
      edge.v1.edge = this.findAnyIncidentEdge(edge.v1);
    }
    if (edge.v2.edge === edge) {
      edge.v2.edge = this.findAnyIncidentEdge(edge.v2);
    }

    this.tracker?.markTopologyDirty();
    return f1;
  }

  // ---------------------------------------------------------------------------
  // Faces
  // ---------------------------------------------------------------------------

  addFace(verts: BMVert[], attributes?: Record<string, number[]>): BMFace {
    if (verts.length < 3) {
      throw new Error(`Face must have at least 3 vertices, got ${verts.length}`);
    }

    // Check for duplicate vertices in input
    const seen = new Set<BMVert>();
    for (let i = 0; i < verts.length; i++) {
      if (seen.has(verts[i])) {
        throw new Error(`Face contains repeated vertex ${verts[i].index}`);
      }
      seen.add(verts[i]);
    }

    const n = verts.length;
    const faceEdges: BMEdge[] = [];
    for (let i = 0; i < n; i++) {
      const vCurr = verts[i];
      const vNext = verts[(i + 1) % n];
      faceEdges.push(this.addEdge(vCurr, vNext));
    }

    const faceLoops: BMLoop[] = [];
    const face: BMFace = {
      index: this.faces.length,
      l: null as unknown as BMLoop,
      len: n,
      attributes: attributes ? { ...attributes } : undefined,
    };

    for (let i = 0; i < n; i++) {
      const loop: BMLoop = {
        index: this.nextLoopId++,
        v: verts[i],
        e: faceEdges[i],
        f: face,
        next: null as unknown as BMLoop,
        prev: null as unknown as BMLoop,
        radialNext: null as unknown as BMLoop,
        radialPrev: null as unknown as BMLoop,
      };
      loop.radialNext = loop;
      loop.radialPrev = loop;
      faceLoops.push(loop);
    }

    // Link face loop cycle
    for (let i = 0; i < n; i++) {
      faceLoops[i].next = faceLoops[(i + 1) % n];
      faceLoops[i].prev = faceLoops[(i - 1 + n) % n];
    }
    face.l = faceLoops[0];

    // Link radial cycle for each loop around its edge
    for (let i = 0; i < n; i++) {
      this.linkLoopRadial(faceEdges[i], faceLoops[i]);
    }

    this.faces.push(face);
    this.tracker?.markTopologyDirty();
    return face;
  }

  removeFace(face: BMFace): void {
    if (!face.l || face.len === 0) return;

    // Collect all loops of face into an array before unlinking
    let l = face.l;
    const loops: BMLoop[] = [];
    for (let i = 0; i < face.len; i++) {
      loops.push(l);
      l = l.next;
    }

    // Unlink all loops from their edges' radial cycles and clean up loop fields
    for (let i = 0; i < loops.length; i++) {
      const loop = loops[i];
      this.unlinkLoopRadial(loop.e, loop);
      loop.f = null as unknown as BMFace;
      loop.e = null as unknown as BMEdge;
      loop.next = loop;
      loop.prev = loop;
    }

    face.l = null as unknown as BMLoop;
    face.len = 0;

    const idx = this.faces.indexOf(face);
    if (idx !== -1) {
      this.faces.splice(idx, 1);
      for (let i = 0; i < this.faces.length; i++) {
        this.faces[i].index = i;
      }
    }

    this.tracker?.markTopologyDirty();
  }

  flipFace(face: BMFace): void {
    const n = face.len;
    const loops: BMLoop[] = [];
    let curr = face.l;
    for (let i = 0; i < n; i++) {
      loops.push(curr);
      curr = curr.next;
    }

    // Unlink all loops from their radial cycles
    for (let i = 0; i < n; i++) {
      this.unlinkLoopRadial(loops[i].e, loops[i]);
    }

    // Reversed vertex ordering: v0, vn-1, vn-2, ..., v1
    const newVerts: BMVert[] = [loops[0].v];
    for (let i = n - 1; i >= 1; i--) {
      newVerts.push(loops[i].v);
    }

    // Reassign vertices, edges, and re-insert into radial cycles
    for (let i = 0; i < n; i++) {
      const vCurr = newVerts[i];
      const vNext = newVerts[(i + 1) % n];
      loops[i].v = vCurr;
      loops[i].e = this.addEdge(vCurr, vNext);
      this.linkLoopRadial(loops[i].e, loops[i]);
    }

    this.tracker?.markTopologyDirty();
  }

  extrudeFaces(
    faces: BMFace[],
    offset: [number, number, number] | ArrayLike<number>
  ): BMFace[] {
    if (faces.length === 0) return [];

    const faceSet = new Set(faces);
    const vertSet = new Set<BMVert>();

    // Collect all vertices in the extruded face set
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      let l = f.l;
      for (let j = 0; j < f.len; j++) {
        vertSet.add(l.v);
        l = l.next;
      }
    }

    // Find boundary segments: oriented directed edges belonging to exactly 1 face in faceSet
    const boundarySegments: BoundarySegment[] = [];

    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      let l = f.l;
      for (let j = 0; j < f.len; j++) {
        let facesInSelectionSharingEdge = 0;
        if (l.e.l !== null) {
          let r = l.e.l;
          do {
            if (faceSet.has(r.f)) {
              facesInSelectionSharingEdge++;
            }
            r = r.radialNext;
          } while (r !== l.e.l);
        }

        if (facesInSelectionSharingEdge === 1) {
          boundarySegments.push({
            vA: l.v,
            vB: l.next.v,
            edge: l.e,
          });
        }
        l = l.next;
      }
    }

    // Create new offset vertices
    const off: [number, number, number] = [
      offset[0] ?? 0,
      offset[1] ?? 0,
      offset[2] ?? 0,
    ];
    const vertMap = new Map<BMVert, BMVert>();
    for (const v of vertSet) {
      const newV = this.addVert([
        v.co[0] + off[0],
        v.co[1] + off[1],
        v.co[2] + off[2],
      ]);
      vertMap.set(v, newV);
    }

    // Create side quad faces along the boundary
    for (let i = 0; i < boundarySegments.length; i++) {
      const seg = boundarySegments[i];
      const vA = seg.vA;
      const vB = seg.vB;
      const vAPrime = vertMap.get(vA)!;
      const vBPrime = vertMap.get(vB)!;
      // CCW quad: vA -> vB -> vB' -> vA'
      this.addFace([vA, vB, vBPrime, vAPrime]);
    }

    // Create new cap faces at the offset and remove the original faces
    const capFaces: BMFace[] = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const capVerts: BMVert[] = [];
      let l = f.l;
      for (let j = 0; j < f.len; j++) {
        capVerts.push(vertMap.get(l.v)!);
        l = l.next;
      }
      this.removeFace(f);
      const capFace = this.addFace(capVerts, f.attributes);
      capFaces.push(capFace);
    }

    this.tracker?.markTopologyDirty();
    return capFaces;
  }

  // ---------------------------------------------------------------------------
  // Radial Cycle Helpers
  // ---------------------------------------------------------------------------

  private linkLoopRadial(edge: BMEdge, loop: BMLoop): void {
    loop.e = edge;
    if (edge.l === null) {
      edge.l = loop;
      loop.radialNext = loop;
      loop.radialPrev = loop;
    } else {
      loop.radialNext = edge.l.radialNext;
      loop.radialPrev = edge.l;
      edge.l.radialNext.radialPrev = loop;
      edge.l.radialNext = loop;
    }
  }

  private unlinkLoopRadial(edge: BMEdge, loop: BMLoop): void {
    if (edge.l === null) return;
    if (loop.radialNext === loop) {
      if (edge.l === loop) {
        edge.l = null;
      }
    } else {
      loop.radialPrev.radialNext = loop.radialNext;
      loop.radialNext.radialPrev = loop.radialPrev;
      if (edge.l === loop) {
        edge.l = loop.radialNext;
      }
    }
    loop.radialNext = loop;
    loop.radialPrev = loop;
  }

  // ---------------------------------------------------------------------------
  // Attribute Layers
  // ---------------------------------------------------------------------------

  setVertexAttribute(vert: BMVert, name: string, data: number[]): void {
    if (!vert.attributes) vert.attributes = {};
    vert.attributes[name] = data;
  }

  getVertexAttribute(vert: BMVert, name: string): number[] | undefined {
    return vert.attributes?.[name];
  }

  setFaceAttribute(face: BMFace, name: string, data: number[]): void {
    if (!face.attributes) face.attributes = {};
    face.attributes[name] = data;
  }

  getFaceAttribute(face: BMFace, name: string): number[] | undefined {
    return face.attributes?.[name];
  }

  setLoopAttribute(loop: BMLoop, name: string, data: number[]): void {
    if (!loop.attributes) loop.attributes = {};
    loop.attributes[name] = data;
  }

  getLoopAttribute(loop: BMLoop, name: string): number[] | undefined {
    return loop.attributes?.[name];
  }

  // ---------------------------------------------------------------------------
  // Bounds
  // ---------------------------------------------------------------------------

  bounds(): MeshBounds {
    if (this.verts.length === 0) {
      return { min: [0, 0, 0], max: [0, 0, 0] };
    }
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < this.verts.length; i++) {
      const c = this.verts[i].co;
      if (c[0] < minX) minX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[2] < minZ) minZ = c[2];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] > maxY) maxY = c[1];
      if (c[2] > maxZ) maxZ = c[2];
    }

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    };
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  validate(): string[] {
    const errors: string[] = [];
    const vertSet = new Set(this.verts);
    const edgeSet = new Set(this.edges);
    const faceSet = new Set(this.faces);

    // 1. Edge endpoints exist & v1 !== v2
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      if (e.v1 === e.v2) {
        errors.push(`Edge ${i} has identical vertex endpoints (${e.v1.index})`);
      }
      if (!vertSet.has(e.v1) || !vertSet.has(e.v2)) {
        errors.push(`Edge ${i} endpoints do not exist in mesh vertices`);
      }
    }

    // 2. No duplicate edge between the same two verts (checked via permanent vertex IDs)
    const seenEdges = new Set<string>();
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const key = edgeKey(e.v1.id, e.v2.id);
      if (seenEdges.has(key)) {
        errors.push(`Duplicate edge found between vertices ${e.v1.index} and ${e.v2.index}`);
      }
      seenEdges.add(key);
    }

    // 3. Faces have >= 3 verts, no repeated vert, and face loop cycle closed
    const allFaceLoops = new Set<BMLoop>();

    for (let i = 0; i < this.faces.length; i++) {
      const f = this.faces[i];
      if (f.len < 3) {
        errors.push(`Face ${i} has fewer than 3 vertices (len = ${f.len})`);
      }
      if (!f.l) {
        errors.push(`Face ${i} has null start loop`);
        continue;
      }

      const faceVerts = new Set<BMVert>();
      let l = f.l;
      let count = 0;
      const visited = new Set<BMLoop>();

      do {
        if (visited.has(l)) {
          errors.push(`Face ${i} loop cycle malformed or closed prematurely`);
          break;
        }
        visited.add(l);
        allFaceLoops.add(l);

        if (l.f !== f) {
          errors.push(`Loop ${l.index} points to wrong face (expected ${i})`);
        }
        if (!faceSet.has(l.f)) {
          errors.push(`Loop ${l.index} face does not exist in mesh faces`);
        }
        if (!edgeSet.has(l.e)) {
          errors.push(`Loop ${l.index} references edge not in mesh`);
        }
        if (!vertSet.has(l.v)) {
          errors.push(`Loop ${l.index} references vertex not in mesh`);
        }
        if (faceVerts.has(l.v)) {
          errors.push(`Face ${i} contains repeated vertex ${l.v.index}`);
        }
        faceVerts.add(l.v);

        if (l.next.prev !== l || l.prev.next !== l) {
          errors.push(`Face ${i} loop cycle broken next/prev consistency at loop ${l.index}`);
        }

        count++;
        l = l.next;
        if (count > this.faces.length * 100 + 1000) {
          errors.push(`Face ${i} loop cycle did not close`);
          break;
        }
      } while (l !== f.l);

      if (count !== f.len) {
        errors.push(`Face ${i} loop count (${count}) does not match f.len (${f.len})`);
      }
    }

    // 4. Radial cycle of each edge contains exactly its loops
    const loopsByEdge = new Map<BMEdge, Set<BMLoop>>();
    for (const l of allFaceLoops) {
      let s = loopsByEdge.get(l.e);
      if (!s) {
        s = new Set<BMLoop>();
        loopsByEdge.set(l.e, s);
      }
      s.add(l);
    }

    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const expectedLoops = loopsByEdge.get(e) ?? new Set<BMLoop>();

      if (e.l === null) {
        if (expectedLoops.size > 0) {
          errors.push(`Edge ${i} has e.l === null but is referenced by ${expectedLoops.size} face loops`);
        }
      } else {
        const radialVisited = new Set<BMLoop>();
        let r = e.l;
        let rCount = 0;
        do {
          if (radialVisited.has(r)) {
            errors.push(`Edge ${i} radial cycle malformed`);
            break;
          }
          radialVisited.add(r);

          if (r.e !== e) {
            errors.push(`Loop ${r.index} in Edge ${i} radial cycle points to another edge`);
          }
          if (r.radialNext.radialPrev !== r || r.radialPrev.radialNext !== r) {
            errors.push(`Edge ${i} radial cycle broken next/prev consistency at loop ${r.index}`);
          }

          rCount++;
          r = r.radialNext;
          if (rCount > allFaceLoops.size + 10) {
            errors.push(`Edge ${i} radial cycle did not close`);
            break;
          }
        } while (r !== e.l);

        if (radialVisited.size !== expectedLoops.size) {
          errors.push(`Edge ${i} radial cycle count (${radialVisited.size}) !== expected (${expectedLoops.size})`);
        }
        for (const l of expectedLoops) {
          if (!radialVisited.has(l)) {
            errors.push(`Loop ${l.index} is missing from Edge ${i} radial cycle`);
          }
        }
      }
    }

    return errors;
  }

  // ---------------------------------------------------------------------------
  // Conversion: fromTriangles / toTriangles
  // ---------------------------------------------------------------------------

  static fromTriangles(
    positions: ArrayLike<number>,
    indices: ArrayLike<number>,
    options?: {
      normals?: ArrayLike<number>;
      uvs?: ArrayLike<number>;
    }
  ): EditMesh {
    const mesh = new EditMesh();
    const vertCount = Math.floor(positions.length / 3);
    for (let i = 0; i < vertCount; i++) {
      mesh.addVert([
        positions[i * 3 + 0],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      ]);
    }

    const triCount = Math.floor(indices.length / 3);
    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3 + 0];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];
      const v0 = mesh.verts[i0];
      const v1 = mesh.verts[i1];
      const v2 = mesh.verts[i2];

      if (!v0 || !v1 || !v2 || v0 === v1 || v1 === v2 || v2 === v0) {
        continue;
      }

      const face = mesh.addFace([v0, v1, v2]);

      if (options?.uvs) {
        let l = face.l;
        mesh.setLoopAttribute(l, "uv", [options.uvs[i0 * 2], options.uvs[i0 * 2 + 1]]);
        l = l.next;
        mesh.setLoopAttribute(l, "uv", [options.uvs[i1 * 2], options.uvs[i1 * 2 + 1]]);
        l = l.next;
        mesh.setLoopAttribute(l, "uv", [options.uvs[i2 * 2], options.uvs[i2 * 2 + 1]]);
      }
      if (options?.normals) {
        let l = face.l;
        mesh.setLoopAttribute(l, "normal", [
          options.normals[i0 * 3],
          options.normals[i0 * 3 + 1],
          options.normals[i0 * 3 + 2],
        ]);
        l = l.next;
        mesh.setLoopAttribute(l, "normal", [
          options.normals[i1 * 3],
          options.normals[i1 * 3 + 1],
          options.normals[i1 * 3 + 2],
        ]);
        l = l.next;
        mesh.setLoopAttribute(l, "normal", [
          options.normals[i2 * 3],
          options.normals[i2 * 3 + 1],
          options.normals[i2 * 3 + 2],
        ]);
      }
    }

    return mesh;
  }

  fromTriangles(
    positions: ArrayLike<number>,
    indices: ArrayLike<number>,
    options?: {
      normals?: ArrayLike<number>;
      uvs?: ArrayLike<number>;
    }
  ): this {
    const loaded = EditMesh.fromTriangles(positions, indices, options);
    this.verts = loaded.verts;
    this.edges = loaded.edges;
    this.faces = loaded.faces;
    this.edgeMap = (loaded as unknown as { edgeMap: Map<string, BMEdge> }).edgeMap;
    this.nextVertId = (loaded as unknown as { nextVertId: number }).nextVertId;
    this.nextLoopId = (loaded as unknown as { nextLoopId: number }).nextLoopId;
    this.tracker?.markTopologyDirty();
    return this;
  }

  toTriangles(): TriangulatedMesh {
    const vCount = this.verts.length;
    const positions = new Float32Array(vCount * 3);
    for (let i = 0; i < vCount; i++) {
      const co = this.verts[i].co;
      positions[i * 3 + 0] = co[0];
      positions[i * 3 + 1] = co[1];
      positions[i * 3 + 2] = co[2];
    }

    const indexList: number[] = [];

    for (let fIdx = 0; fIdx < this.faces.length; fIdx++) {
      const face = this.faces[fIdx];
      if (face.len === 3) {
        const l0 = face.l;
        const l1 = l0.next;
        const l2 = l1.next;
        indexList.push(l0.v.index, l1.v.index, l2.v.index);
      } else if (face.len === 4) {
        // Quad fast-path: 2 triangles
        const l0 = face.l;
        const l1 = l0.next;
        const l2 = l1.next;
        const l3 = l2.next;
        indexList.push(l0.v.index, l1.v.index, l2.v.index);
        indexList.push(l0.v.index, l2.v.index, l3.v.index);
      } else if (face.len > 4) {
        // N-gon ear-clipping triangulation
        const triIndices = this.triangulateNgon(face);
        for (let k = 0; k < triIndices.length; k++) {
          indexList.push(triIndices[k]);
        }
      }
    }

    const indices = new Uint32Array(indexList);
    return { positions, indices };
  }

  toTrianglesIncremental(tracker?: IMeshDirtyTracker): TriangulatedMesh {
    const activeTracker = tracker ?? this.tracker;
    if (activeTracker) {
      return activeTracker.toTrianglesIncremental(this);
    }
    return this.toTriangles();
  }

  // ---------------------------------------------------------------------------
  // N-gon Ear Clipping Triangulation
  // ---------------------------------------------------------------------------

  private triangulateNgon(face: BMFace): number[] {
    const n = face.len;
    const verts: BMVert[] = [];
    let curr = face.l;
    for (let i = 0; i < n; i++) {
      verts.push(curr.v);
      curr = curr.next;
    }

    // 1. Compute Newell polygon face normal in 3D
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) {
      const c = verts[i].co;
      const next = verts[(i + 1) % n].co;
      nx += (c[1] - next[1]) * (c[2] + next[2]);
      ny += (c[2] - next[2]) * (c[0] + next[0]);
      nz += (c[0] - next[0]) * (c[1] + next[1]);
    }

    // 2. Project onto dominant plane
    const absX = Math.abs(nx);
    const absY = Math.abs(ny);
    const absZ = Math.abs(nz);

    const pts2d: [number, number][] = [];
    if (absZ >= absX && absZ >= absY) {
      for (let i = 0; i < n; i++) {
        pts2d.push([verts[i].co[0], verts[i].co[1]]);
      }
    } else if (absY >= absX && absY >= absZ) {
      for (let i = 0; i < n; i++) {
        pts2d.push([verts[i].co[0], verts[i].co[2]]);
      }
    } else {
      for (let i = 0; i < n; i++) {
        pts2d.push([verts[i].co[1], verts[i].co[2]]);
      }
    }

    // 3. Compute 2D polygon signed area
    let signedArea = 0;
    for (let i = 0; i < n; i++) {
      const p1 = pts2d[i];
      const p2 = pts2d[(i + 1) % n];
      signedArea += p1[0] * p2[1] - p2[0] * p1[1];
    }
    const isCCW = signedArea >= 0;

    // 4. Ear clipping loop
    const remaining: number[] = [];
    for (let i = 0; i < n; i++) {
      remaining.push(i);
    }

    const resultVertexIndices: number[] = [];
    let safety = n * 4;

    while (remaining.length > 3 && safety-- > 0) {
      let earFound = false;
      const count = remaining.length;

      for (let i = 0; i < count; i++) {
        const prevIdx = remaining[(i - 1 + count) % count];
        const currIdx = remaining[i];
        const nextIdx = remaining[(i + 1) % count];

        const a = pts2d[prevIdx];
        const b = pts2d[currIdx];
        const c = pts2d[nextIdx];

        // Convexity check
        const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (isCCW ? cross <= 1e-12 : cross >= -1e-12) {
          continue; // Reflex vertex
        }

        // Point-in-triangle check
        let isEar = true;
        for (let j = 0; j < count; j++) {
          const testIdx = remaining[j];
          if (testIdx === prevIdx || testIdx === currIdx || testIdx === nextIdx) {
            continue;
          }
          const pt = pts2d[testIdx];
          if (this.pointInTriangle2D(pt, a, b, c, isCCW)) {
            isEar = false;
            break;
          }
        }

        if (isEar) {
          resultVertexIndices.push(
            verts[prevIdx].index,
            verts[currIdx].index,
            verts[nextIdx].index
          );
          remaining.splice(i, 1);
          earFound = true;
          break;
        }
      }

      if (!earFound) {
        // Fallback: cut the first triangle to prevent infinite loop on degraded geometry
        resultVertexIndices.push(
          verts[remaining[0]].index,
          verts[remaining[1]].index,
          verts[remaining[2]].index
        );
        remaining.splice(1, 1);
      }
    }

    if (remaining.length === 3) {
      resultVertexIndices.push(
        verts[remaining[0]].index,
        verts[remaining[1]].index,
        verts[remaining[2]].index
      );
    }

    return resultVertexIndices;
  }

  private pointInTriangle2D(
    p: [number, number],
    a: [number, number],
    b: [number, number],
    c: [number, number],
    isCCW: boolean
  ): boolean {
    const cp1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const cp2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
    const cp3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);

    if (isCCW) {
      return cp1 >= -1e-12 && cp2 >= -1e-12 && cp3 >= -1e-12;
    } else {
      return cp1 <= 1e-12 && cp2 <= 1e-12 && cp3 <= 1e-12;
    }
  }
}

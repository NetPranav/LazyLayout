/**
 * ============================================================================
 * MESH BINARY ENCODING & DECODING (ROADMAP_3D Phase 3D-007)
 * ============================================================================
 * High-performance, deterministic little-endian binary layout for large mesh
 * geometry stored in the asset store.
 *
 * Binary Layout:
 *   [0..3]   Magic: 4 bytes "LZ3D" (0x44335a4c little-endian)
 *   [4..7]   Version: Uint32 = 1
 *   [8..11]  vertexCount: Uint32 (number of vertices; positions has vertexCount * 3 Float32s)
 *   [12..15] indexCount: Uint32 (number of triangle index integers, Uint32)
 *   [16..]   Positions: Float32Array (vertexCount * 3 floats, 12 bytes per vertex)
 *   [...]    Indices: Uint32Array (indexCount ints, 4 bytes per index)
 *
 * Performance target: 1,000,000 vertices encode + decode in well under 1 s (typically < 50 ms).
 * ============================================================================
 */

export interface MeshData {
  positions: Float32Array | number[];
  indices?: Uint32Array | number[];
  normals?: Float32Array | number[];
  uvs?: Float32Array | number[];
}

export interface DecodedMesh {
  positions: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  faceCount: number;
}

export const MESH_BINARY_MAGIC = 0x44335a4c; // "LZ3D" in little-endian
export const MESH_BINARY_VERSION = 1;
export const HEADER_SIZE = 16;

/**
 * Encodes mesh positions and indices into a compact, little-endian binary payload.
 */
export function encodeMesh(mesh: MeshData | { positions?: number[]; indices?: number[] }): { bytes: Uint8Array } {
  const posArray = mesh.positions;
  if (!posArray) {
    throw new Error("Cannot encode mesh: positions are required.");
  }
  const posCount = posArray.length;
  if (posCount % 3 !== 0) {
    throw new Error(`Cannot encode mesh: positions length (${posCount}) must be a multiple of 3.`);
  }
  const vertexCount = posCount / 3;

  const indArray = mesh.indices;
  const indexCount = indArray ? indArray.length : 0;

  const posByteLength = posCount * 4;
  const indByteLength = indexCount * 4;
  const totalBytes = HEADER_SIZE + posByteLength + indByteLength;

  const buffer = new ArrayBuffer(totalBytes);
  const dataView = new DataView(buffer);

  // Write header (little-endian)
  dataView.setUint32(0, MESH_BINARY_MAGIC, true);
  dataView.setUint32(4, MESH_BINARY_VERSION, true);
  dataView.setUint32(8, vertexCount, true);
  dataView.setUint32(12, indexCount, true);

  // Write positions
  if (posArray instanceof Float32Array) {
    new Uint8Array(buffer, HEADER_SIZE, posByteLength).set(
      new Uint8Array(posArray.buffer, posArray.byteOffset, posByteLength)
    );
  } else {
    const floatView = new Float32Array(buffer, HEADER_SIZE, posCount);
    floatView.set(posArray);
  }

  // Write indices
  if (indArray && indexCount > 0) {
    const indOffset = HEADER_SIZE + posByteLength;
    if (indArray instanceof Uint32Array) {
      new Uint8Array(buffer, indOffset, indByteLength).set(
        new Uint8Array(indArray.buffer, indArray.byteOffset, indByteLength)
      );
    } else {
      const uintView = new Uint32Array(buffer, indOffset, indexCount);
      uintView.set(indArray);
    }
  }

  return { bytes: new Uint8Array(buffer) };
}

/**
 * Decodes little-endian mesh binary bytes into typed arrays and counts.
 */
export function decodeMesh(bytes: Uint8Array): DecodedMesh {
  if (bytes.byteLength < HEADER_SIZE) {
    throw new Error(`Invalid mesh binary: buffer too small (${bytes.byteLength} bytes < ${HEADER_SIZE} bytes header).`);
  }

  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = dataView.getUint32(0, true);
  if (magic !== MESH_BINARY_MAGIC) {
    throw new Error(`Invalid mesh binary: bad magic number (got 0x${magic.toString(16)}, expected 0x${MESH_BINARY_MAGIC.toString(16)}).`);
  }

  const version = dataView.getUint32(4, true);
  if (version !== MESH_BINARY_VERSION) {
    throw new Error(`Unsupported mesh binary version: ${version}.`);
  }

  const vertexCount = dataView.getUint32(8, true);
  const indexCount = dataView.getUint32(12, true);

  const posCount = vertexCount * 3;
  const posBytes = posCount * 4;
  const indBytes = indexCount * 4;
  const expectedTotal = HEADER_SIZE + posBytes + indBytes;

  if (bytes.byteLength < expectedTotal) {
    throw new Error(`Invalid mesh binary: truncated buffer (${bytes.byteLength} < ${expectedTotal}).`);
  }

  // Extract positions
  const posSrc = new Float32Array(bytes.buffer, bytes.byteOffset + HEADER_SIZE, posCount);
  const positions = new Float32Array(posSrc);

  // Extract indices
  const indSrc = new Uint32Array(bytes.buffer, bytes.byteOffset + HEADER_SIZE + posBytes, indexCount);
  const indices = new Uint32Array(indSrc);

  const faceCount = Math.floor(indexCount / 3);

  return {
    positions,
    indices,
    vertexCount,
    faceCount,
  };
}

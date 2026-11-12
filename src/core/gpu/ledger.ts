/**
 * ROADMAP_3D 3D-003 (was Main 174): the GPU memory ledger. Every texture, buffer, render target and program the
 * compositor's users create is written down here with its owner and its size, and crossed out when it is freed. The
 * debug view lists what the GPU holds by layer; tests check that mounting and unmounting returns it to zero.
 * Pure bookkeeping: no GL calls (the resource helpers in `resources.ts` call it).
 */

export type GpuResourceKind = "texture" | "buffer" | "program" | "framebuffer" | "renderbuffer";

export interface LedgerEntry {
  id: number;
  owner: string;
  kind: GpuResourceKind;
  bytes: number;
  label?: string;
}

export interface OwnerTotal {
  owner: string;
  count: number;
  bytes: number;
}

export class GpuLedger {
  private readonly entries = new Map<number, LedgerEntry>();
  private readonly byHandle = new WeakMap<object, number>();
  private nextId = 1;
  private listeners = new Set<() => void>();

  /** Writes a resource down. `handle` (the GL object) lets `release` find it again. Returns its id. */
  track(handle: object, owner: string, kind: GpuResourceKind, bytes: number, label?: string): number {
    const existing = this.byHandle.get(handle);
    if (existing !== undefined) {
      // re-tracking a handle (a texture re-uploaded at a new size) replaces its size
      const e = this.entries.get(existing)!;
      e.bytes = Math.max(0, bytes);
      e.owner = owner;
      this.emit();
      return existing;
    }
    const id = this.nextId++;
    this.entries.set(id, { id, owner, kind, bytes: Math.max(0, bytes), label });
    this.byHandle.set(handle, id);
    this.emit();
    return id;
  }

  /** Crosses a resource out. Unknown handles are ignored. */
  release(handle: object): void {
    const id = this.byHandle.get(handle);
    if (id === undefined) return;
    this.byHandle.delete(handle);
    this.entries.delete(id);
    this.emit();
  }

  /** Crosses out everything an owner holds (its context was lost, or it unmounted without freeing). */
  releaseOwner(owner: string): number {
    let n = 0;
    for (const [id, e] of this.entries) if (e.owner === owner) {
      this.entries.delete(id);
      n++;
    }
    if (n) this.emit();
    return n;
  }

  totalBytes(prefix = ""): number {
    let b = 0;
    for (const e of this.entries.values()) if (e.owner.startsWith(prefix)) b += e.bytes;
    return b;
  }

  count(prefix = ""): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.owner.startsWith(prefix)) n++;
    return n;
  }

  /** What each owner holds, largest first. */
  byOwner(): OwnerTotal[] {
    const m = new Map<string, OwnerTotal>();
    for (const e of this.entries.values()) {
      const t = m.get(e.owner) ?? { owner: e.owner, count: 0, bytes: 0 };
      t.count++;
      t.bytes += e.bytes;
      m.set(e.owner, t);
    }
    return [...m.values()].sort((a, b) => b.bytes - a.bytes);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

/** Bytes per texel for the formats the compositor's users create. */
export const BYTES_PER_TEXEL: Record<string, number> = {
  RGBA8: 4,
  RGBA16F: 8,
  RGBA32F: 16,
  R16F: 2,
  R32F: 4,
  DEPTH24_STENCIL8: 4,
  DEPTH_COMPONENT24: 4,
};

/** Size of a texture with its mip chain (a full chain adds a third). */
export function textureBytes(width: number, height: number, format: string, mipmaps = false): number {
  const base = Math.max(1, width) * Math.max(1, height) * (BYTES_PER_TEXEL[format] ?? 4);
  return Math.round(mipmaps ? (base * 4) / 3 : base);
}

/** The one ledger for the page. */
export const gpuLedger = new GpuLedger();

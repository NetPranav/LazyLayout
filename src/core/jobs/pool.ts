/**
 * ROADMAP_3D 3D-006: a pool of workers for heavy work (cloth, meshes, baking). Jobs carry typed arrays (transferred, not
 * copied), have priorities, can be cancelled, report progress and are cached by key. The pool never touches the DOM: it
 * is given a worker factory, so the same code runs against real Workers in the browser and against fakes in tests.
 *
 * Cancelling a running job terminates its worker and starts a fresh one: a loop that is busy computing cannot see a
 * flag, so the only prompt way to stop it is to end the worker. Queued jobs are simply removed.
 */

export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}
export type WorkerFactory = () => WorkerLike;

/** What a worker sends back. */
export type WorkerMessage = { id: number; type: "progress"; progress: number } | { id: number; type: "done"; result: unknown; transfer?: never } | { id: number; type: "error"; message: string };

export class JobCancelled extends Error {
  constructor(readonly jobId: number) {
    super(`job ${jobId} was cancelled`);
    this.name = "JobCancelled";
  }
}

export interface JobOptions {
  /** Higher runs first; ties run in the order submitted. Default 0. */
  priority?: number;
  /** Results are cached by this key (a hash of the inputs); the same key in flight shares one run. */
  key?: string;
  onProgress?: (progress: number) => void;
  /** Buffers to transfer to the worker (they are unusable by the caller afterwards). */
  transfer?: Transferable[];
}

export interface JobHandle<T> {
  readonly id: number;
  readonly promise: Promise<T>;
  /** Stops it: removed from the queue, or its worker terminated. The promise rejects with `JobCancelled`. */
  cancel(): void;
  /** Whether the result came from the cache without running. */
  readonly cached: boolean;
}

interface Job {
  id: number;
  key: string | null;
  kind: string;
  payload: unknown;
  options: JobOptions;
  priority: number;
  seq: number;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  listeners: Array<(p: number) => void>;
}

export interface PoolStats {
  workers: number;
  busy: number;
  queued: number;
  completed: number;
  cancelled: number;
  cacheHits: number;
  respawns: number;
}

export class JobPool {
  private readonly slots: Array<{ worker: WorkerLike; job: Job | null }> = [];
  private readonly queue: Job[] = [];
  private readonly cache = new Map<string, unknown>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private nextId = 1;
  private seq = 0;
  private stats_ = { completed: 0, cancelled: 0, cacheHits: 0, respawns: 0 };
  /** How many results are kept. */
  cacheLimit = 24;

  constructor(private readonly factory: WorkerFactory, readonly size = 2) {}

  run<T>(kind: string, payload: unknown, options: JobOptions = {}): JobHandle<T> {
    const id = this.nextId++;
    const key = options.key ? `${kind}:${options.key}` : null;
    if (key && this.cache.has(key)) {
      const hit = this.cache.get(key) as T;
      // refresh its place (least recently used goes first)
      this.cache.delete(key);
      this.cache.set(key, hit);
      this.stats_.cacheHits++;
      options.onProgress?.(1);
      return { id, promise: Promise.resolve(hit), cancel() {}, cached: true };
    }
    if (key && this.inFlight.has(key)) {
      this.stats_.cacheHits++;
      return { id, promise: this.inFlight.get(key) as Promise<T>, cancel() {}, cached: false };
    }
    let job!: Job;
    const promise = new Promise<T>((resolve, reject) => {
      job = { id, key, kind, payload, options, priority: options.priority ?? 0, seq: this.seq++, resolve: resolve as (v: unknown) => void, reject, listeners: options.onProgress ? [options.onProgress] : [] };
    });
    if (key) {
      this.inFlight.set(key, promise);
      promise.then(
        (v) => {
          if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
          this.cache.set(key, v);
          while (this.cache.size > this.cacheLimit) this.cache.delete(this.cache.keys().next().value as string);
        },
        () => {
          if (this.inFlight.get(key) === promise) this.inFlight.delete(key); // a newer run of the same key may already be there
        },
      );
    }
    this.queue.push(job);
    this.pump();
    return { id, promise, cached: false, cancel: () => this.cancel(job) };
  }

  stats(): PoolStats {
    return { workers: this.slots.length, busy: this.slots.filter((s) => s.job).length, queued: this.queue.length, ...this.stats_ };
  }

  /** Ends every worker (the page is closing, or a test is done). Pending jobs are cancelled. */
  dispose(): void {
    for (const job of [...this.queue]) this.cancel(job);
    for (const slot of this.slots) {
      if (slot.job) this.cancel(slot.job);
      slot.worker.terminate();
    }
    this.slots.length = 0;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private spawn(): { worker: WorkerLike; job: Job | null } {
    const worker = this.factory();
    const slot = { worker, job: null as Job | null };
    worker.onmessage = (e) => this.onMessage(slot, e.data as WorkerMessage);
    worker.onerror = () => {
      const job = slot.job;
      if (!job) return;
      slot.job = null;
      job.reject(new Error(`the worker failed while running ${job.kind}`));
      this.replace(slot);
      this.pump();
    };
    return slot;
  }

  /** A worker that was ended (cancel, failure) is replaced by a fresh one in the same place. */
  private replace(slot: { worker: WorkerLike; job: Job | null }): void {
    const i = this.slots.indexOf(slot);
    if (i < 0) return;
    this.stats_.respawns++;
    this.slots[i] = this.spawn();
  }

  private pump(): void {
    while (this.queue.length > 0) {
      let slot = this.slots.find((s) => !s.job);
      if (!slot && this.slots.length < this.size) {
        slot = this.spawn();
        this.slots.push(slot);
      }
      if (!slot) return;
      // highest priority first, then first submitted
      let best = 0;
      for (let i = 1; i < this.queue.length; i++) {
        const a = this.queue[i];
        const b = this.queue[best];
        if (a.priority > b.priority || (a.priority === b.priority && a.seq < b.seq)) best = i;
      }
      const job = this.queue.splice(best, 1)[0];
      slot.job = job;
      slot.worker.postMessage({ id: job.id, kind: job.kind, payload: job.payload }, job.options.transfer);
    }
  }

  private onMessage(slot: { worker: WorkerLike; job: Job | null }, m: WorkerMessage): void {
    const job = slot.job;
    if (!job || m.id !== job.id) return; // a late message from a cancelled job
    if (m.type === "progress") {
      for (const l of job.listeners) l(m.progress);
      return;
    }
    slot.job = null;
    if (m.type === "done") {
      this.stats_.completed++;
      job.resolve(m.result);
    } else job.reject(new Error(m.message));
    this.pump();
  }

  private cancel(job: Job): void {
    // forget the shared run now, not a microtask later: a caller that cancels and re-runs in one tick (a remounting effect) must start fresh, not join the run being cancelled
    if (job.key) this.inFlight.delete(job.key);
    const q = this.queue.indexOf(job);
    if (q >= 0) {
      this.queue.splice(q, 1);
      this.stats_.cancelled++;
      job.reject(new JobCancelled(job.id));
      return;
    }
    const slot = this.slots.find((s) => s.job === job);
    if (!slot) return; // already finished
    slot.job = null;
    this.stats_.cancelled++;
    slot.worker.terminate();
    job.reject(new JobCancelled(job.id));
    this.replace(slot);
    this.pump();
  }
}

import { JobPool, type WorkerLike } from "./pool";

export * from "./pool";

let pool: JobPool | null = null;

/** The page's job pool (browser only): `Math.max(1, cores - 1)` workers, at most 3, each running `jobs.worker.ts`. */
export function jobPool(): JobPool | null {
  if (pool) return pool;
  if (typeof Worker === "undefined") return null;
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  pool = new JobPool(() => new Worker(new URL("./jobs.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike, Math.min(3, Math.max(1, cores - 1)));
  return pool;
}

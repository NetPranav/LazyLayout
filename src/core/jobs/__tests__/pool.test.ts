import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JobPool, JobCancelled, type WorkerLike } from "../pool";

/** A worker that finishes a job after `ms` (or never, when `hang`), reporting progress halfway. Counts how many were made. */
function fakeFactory(opts: { ms?: number; hang?: boolean } = {}) {
  const made: Array<{ terminated: boolean; ran: string[] }> = [];
  const factory = (): WorkerLike => {
    const rec = { terminated: false, ran: [] as string[] };
    made.push(rec);
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      terminate() {
        rec.terminated = true;
      },
      postMessage(message) {
        const m = message as { id: number; kind: string; payload: { n?: number } };
        rec.ran.push(m.kind);
        if (opts.hang) return;
        setTimeout(() => !rec.terminated && w.onmessage?.({ data: { id: m.id, type: "progress", progress: 0.5 } }), (opts.ms ?? 5) / 2);
        setTimeout(() => !rec.terminated && w.onmessage?.({ data: { id: m.id, type: "done", result: { kind: m.kind, n: m.payload.n } } }), opts.ms ?? 5);
      },
    };
    return w;
  };
  return { factory, made };
}

describe("3D-006: the worker job pool", () => {
  it("runs a job and resolves with its result, reporting progress", async () => {
    const { factory } = fakeFactory();
    const pool = new JobPool(factory, 1);
    const seen: number[] = [];
    const r = await pool.run<{ n: number }>("a", { n: 7 }, { onProgress: (p) => seen.push(p) }).promise;
    assert.equal(r.n, 7);
    assert.deepEqual(seen, [0.5]);
    pool.dispose();
  });

  it("runs the highest priority first, then in the order submitted", async () => {
    const { factory, made } = fakeFactory({ ms: 4 });
    const pool = new JobPool(factory, 1);
    const first = pool.run("first", { n: 0 });
    const lows = [pool.run("low1", { n: 1 }), pool.run("low2", { n: 2 })];
    const high = pool.run("high", { n: 3 }, { priority: 5 });
    await Promise.all([first.promise, high.promise, ...lows.map((l) => l.promise)]);
    assert.deepEqual(made[0].ran, ["first", "high", "low1", "low2"]);
    pool.dispose();
  });

  it("cancelling a queued job removes it; it never runs", async () => {
    const { factory, made } = fakeFactory({ ms: 4 });
    const pool = new JobPool(factory, 1);
    const a = pool.run("a", {});
    const b = pool.run("b", {});
    b.cancel();
    await assert.rejects(b.promise, JobCancelled);
    await a.promise;
    assert.deepEqual(made[0].ran, ["a"]);
    pool.dispose();
  });

  it("cancelling a running job ends its worker, starts a fresh one, and the next job runs on it", async () => {
    const { factory, made } = fakeFactory({ ms: 4 });
    const pool = new JobPool(factory, 1);
    // make the first job hang by using a second factory behaviour: here the job is long
    const hungFactory = fakeFactory({ hang: true });
    const hungPool = new JobPool(hungFactory.factory, 1);
    const hung = hungPool.run("burn", {});
    const after = hungPool.run("after", {});
    hung.cancel();
    await assert.rejects(hung.promise, JobCancelled);
    assert.equal(hungFactory.made[0].terminated, true, "the busy worker was ended");
    assert.equal(hungFactory.made.length, 2, "and replaced");
    assert.deepEqual(hungFactory.made[1].ran, ["after"], "the queued job ran on the fresh worker");
    after.cancel();
    await assert.rejects(after.promise, JobCancelled);
    hungPool.dispose();
    pool.dispose();
    assert.equal(made.length, 0);
  });

  it("caches by key: the second run doesn't reach a worker, and the same key in flight shares one run", async () => {
    const { factory, made } = fakeFactory({ ms: 4 });
    const pool = new JobPool(factory, 2);
    const a = pool.run<{ n: number }>("k", { n: 1 }, { key: "x" });
    const dup = pool.run<{ n: number }>("k", { n: 1 }, { key: "x" });
    assert.equal(await a.promise, await dup.promise);
    const hit = pool.run("k", { n: 1 }, { key: "x" });
    assert.equal(hit.cached, true);
    assert.deepEqual(await hit.promise, await a.promise);
    assert.equal(made.reduce((n, w) => n + w.ran.length, 0), 1);
    assert.equal(pool.stats().cacheHits, 2);
    pool.dispose();
  });

  it("keeps the cache to its limit, dropping the least recently used", async () => {
    const { factory } = fakeFactory({ ms: 1 });
    const pool = new JobPool(factory, 1);
    pool.cacheLimit = 2;
    for (const k of ["a", "b", "c"]) await pool.run("k", { n: 1 }, { key: k }).promise;
    assert.equal(pool.run("k", {}, { key: "c" }).cached, true);
    assert.equal(pool.run("k", {}, { key: "a" }).cached, false, "a was evicted");
    pool.dispose();
  });

  it("uses up to its size in workers at once", async () => {
    const { factory, made } = fakeFactory({ ms: 8 });
    const pool = new JobPool(factory, 3);
    const jobs = [1, 2, 3, 4].map((n) => pool.run("j", { n }));
    assert.equal(pool.stats().busy, 3);
    await Promise.all(jobs.map((j) => j.promise));
    assert.equal(made.length, 3);
    pool.dispose();
  });
  it("a job cancelled and re-run with the same key in one tick starts fresh instead of joining the cancelled run", async () => {
    const { factory } = fakeFactory({ ms: 20 });
    const pool = new JobPool(factory, 1);
    const first = pool.run("a", { n: 1 }, { key: "k" });
    const swallowed = first.promise.catch(() => undefined);
    first.cancel();
    const second = pool.run<{ n: number }>("a", { n: 2 }, { key: "k" });
    assert.equal((await second.promise).n, 2);
    await swallowed;
    pool.dispose();
  });
});

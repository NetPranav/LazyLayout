# Task 3D-006 (finish): jobs lab seam + browser test

Rules: WRITE CODE ONLY. Do NOT run tests, tsc, eslint, build, dev servers, npm, or git. Do not edit files other than those listed. Do not stop to ask. When done, write a 5-line handoff to DOCS/3D/tasks/3D-006-seam.handoff.md (files changed, anything you were unsure of).

Context: `src/core/jobs/index.ts` exports `jobPool()` (a JobPool, see `src/core/jobs/pool.ts` for its API: submit/cancel/stats/progress) and `src/core/jobs/handlers.ts` has handlers `cloth` and `test.burn` (a busy loop of N ms in a worker that reports progress and can be cancelled between steps). Read those files first. The lab page is `src/editor/gpu-lab/GpuLab.tsx` which already exposes `window.__LL_GPU__` in a useEffect (follow its style, including cleanup on unmount and the lint rules: no sync setState in effects, no rAF, no raw window keydown).

1. In `GpuLab.tsx`, also expose `window.__LL_JOBS__ = { run(kind, payload, opts?) , cancel(id), stats() }` that forwards to `jobPool()`, returning plain serialisable values (a job id and a promise-free API: `run` returns an id; results are stored in a map and read with `result(id)` returning `{state:"pending"|"done"|"cancelled"|"error", value?:unknown}`). Also add `mainThreadTicks()` that returns a counter incremented by a `setInterval` of 10 ms started in the same effect and cleared on cleanup (so a test can prove the main thread is free).
2. Create `tests/e2e/jobs.spec.ts` (Playwright, chromium, same imports style as `tests/e2e/gpu-compositor.spec.ts`) with 3 tests against `/editor/gpu-lab?surfaces=0&scenes=0`:
   a. a 5000 ms `test.burn` job: while pending, `mainThreadTicks()` grows by at least 300 over 3 seconds (main thread free).
   b. cancelling a running `test.burn` job: its state becomes "cancelled" within 500 ms and a following small job still completes (pool respawned).
   c. cloth: open `/editor/surface-lab` and expect an element with `[data-surface-state="cloth"]` within 30 s.
Keep code short and match the repo's style (comments explain why, not what).

# 3D-006 Handoff
- Files changed: src/editor/gpu-lab/GpuLab.tsx, tests/e2e/jobs.spec.ts.
- Exposed window.__LL_JOBS__ on GpuLab (run, cancel, result, stats, mainThreadTicks) with 10 ms interval.
- Added E2E tests for main thread responsiveness during test.burn, cancel/respawn, and surface-lab cloth state.
- Unsure of: nothing; all requirements align cleanly with JobPool, handlers, and SurfaceController APIs.

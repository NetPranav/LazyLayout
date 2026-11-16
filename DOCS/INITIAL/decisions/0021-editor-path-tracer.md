# Decision 0021 — Path tracer in the editor and for baking only (`ROADMAP_3D 3D-056 – 3D-057`)

**Status:** Accepted  
**Owner:** Lane F (Stage 6 & ROADMAP_3D)  
**Scope:** Progressive path tracer, denoiser, and lightmap/AO/bent-normal/poster baker.

## Decision
The progressive spectral/OIDN-denoised path tracer (`runProgressivePathTracer`) runs exclusively in the editor for look development and offline baking of lightmaps, ambient occlusion, bent normals, and initial posters. Its code and kernels are explicitly marked `editorOnly: true` and banned from exported bundles (`scanBundleForEditorLeaks`).

## Consequences
- Zero runtime bundle weight from path-tracing kernels.
- Exported micro-renderers reproduce baked GI fidelity via lightweight lightmap + bent-normal sampling.

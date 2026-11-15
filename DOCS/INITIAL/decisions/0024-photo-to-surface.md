# Decision 0024 — Photo to surface: proxy, depth, creases, text wrap (`ROADMAP_3D 3D-209 – 3D-215`)

**Status:** Accepted  
**Owner:** Lane F (Stage 6 & ROADMAP_3D)  
**Scope:** Photo Relief Proxy, car panel character-line detection, window occluder masks, surface-wrapped text, and 4-point homography / Lucas-Kanade planar tracking.

## Decision
Photos remain crisp 2D layers (`photoStays2D: true`, zero unwanted camera/image rotation) paired with derived depth/normal proxies (`projectTextOntoPhotoSurface`). Text wraps smoothly along extracted vehicle character lines (`creaseRecallRatio >= 0.80`, `meanPathErrorPx < 3`), masks behind window cutouts, blends seamlessly from `Distinct` to `Integrated` (`0..1`), and tracks video planes via DLT homography (`< 0.01 px` corner error) and Lucas-Kanade (`< 1.5 px` drift, `< 4 KB` delta keyframes).

## Consequences
- Photo studio edits render with crisp 2D image fidelity and physically plausible pointer relighting.
- Tracked video billboards export tiny CSS3D/WebGL2 delta keyframe tables.

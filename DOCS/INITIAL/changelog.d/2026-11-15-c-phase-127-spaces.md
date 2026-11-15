### Phase 127 (2.5D spaces): perspective and depth

#### Added
- A **3D space** section:
  - a frame or group made a space, with Perspective, a vanishing point and a viewing angle;
  - a child's Depth and Tilt;
  - an Orbit preview.
- Drawn with CSS 3D (`perspective()` around the vanishing point, `preserve-3d`), so the export needs no 3D library.
- On the canvas: the vanishing point and a selected child's depth as handles, and the orbit drag (a look only).
- Commands `space.make`, `space.release`, `space.set`, `space.setDepth`.
- `spaceOps.test.ts` (4 tests) and `tests/e2e/space-25d.spec.ts`.

#### Fixed
- An overlay drag inside the stage was taken over by the stage's marquee after its first move. Overlay parts that take drags are now marked as canvas chrome.

#### Not done
- Hit areas stay flat.
- Depth isn't passed through nested groups.
- Firefox and WebKit not run locally.

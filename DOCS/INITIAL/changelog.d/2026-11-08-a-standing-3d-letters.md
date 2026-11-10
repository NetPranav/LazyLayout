### Task F (Standing 3D letters with thickness): 3D text letters standing upright on a perspective ground plane

Added `transform.translateZ` and `transform.style3d` ("flat" | "preserve3d") layer properties to establish a shared 3D rendering context in CSS transforms across canvas and export. Implemented commands `text.standLetters`, `text.extrudeLetters`, and `text.removeDepth` to allow splitting text into letters standing upright on a ground plane with stacked solid 3D depth.

#### Added
- `transform.translateZ` (px) and `transform.style3d` ("flat" | "preserve3d") canonical properties in `properties.ts`.
- `bottom center` option for `transform.origin` in `properties.ts` and `constants.ts`.
- Shared CSS 3D stage rendering in `geometry.ts`: emits `transform-style: preserve-3d` and avoids flattening properties (overflow clipping, opacity < 1, filters).
- `text.standLetters` command: tilts letters group as a 3D ground plane (`perspective: 900`, `rotateX: 55`, `style3d: preserve3d`) and stands each letter upright (`rotateX: -55`, `origin: "bottom center"`).
- `text.extrudeLetters` command: adds N (8) depth copies behind each letter with `translateZ = -i * depth / N` and 35% darker colour, organized in collapsed `<letter> depth` sub-groups.
- `text.removeDepth` command: cleanly cleans up all depth sub-groups and restores clean letters.
- Typography panel controls: "Stand letters up" button, "Give letters depth" button, "Remove depth" button, and 3D depth slider.
- Position inspector: exposed `Translate Z` and `3D Space` controls in `PositionMore`.
- Unit test suites for pure depth helpers (`standingLetters.test.ts`) and CSS produced (`standingLettersCss.test.ts`).
- Playwright E2E spec `tests/e2e/new-ui-standing-letters.spec.ts`.

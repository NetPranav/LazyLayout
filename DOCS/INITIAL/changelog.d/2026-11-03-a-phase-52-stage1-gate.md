### Phase 52 (Stage 1 gate: the design journey): four journeys as Playwright scripts, and what they found

`tests/e2e/stage1-gate.spec.ts` runs four user journeys and a pan-and-zoom probe in Chromium, Firefox and WebKit.

#### Added
- Journey A (a Figma user): two frames; a card with auto layout and a constraint, edited on the canvas, with a text style and a colour style, made a component with three variants; an instance at size L; a Mobile override that leaves Desktop alone; a pen-drawn icon.
- Journey B (a Wix user): three pages from the section templates, linked navigation that reaches all three, every section inside the page at Mobile, and Preview that goes to a page when its link is clicked.
- Journey C (output): the ZIP of a starter site downloads, and a saved project file opens as a new project with the same document. (The five-width comparison with the canvas and the Next and Vite builds are the Phase 49 gate.)
- Journey D (an agent): Claude, through the MCP bridge, adds a pricing section with three cards after the user approves it; a rejected change builds nothing; the section is one undo step.
- A probe: five frames of 200 layers, panned and zoomed, with the frame times recorded. On CI it runs in Chromium (median 16.7 ms) and Firefox (17 ms); in WebKit it takes about 7 minutes there, so it is skipped on CI.

#### Not done
- **WebKit does not hold 60 fps** on that probe (median about 33 ms on a Mac; Chromium and Firefox hold 16.7 ms). The probe's ceilings only catch a collapse.
- The one recorded manual run, and rewriting `SCHEMA_REFERENCE.md`, `CONVENTIONS.md` and `FOLDER_STRUCTURE_AND_DATA_HIERARCHY.md` to match the code. `UI.md` and `PANELS.md` are left for the UI rebuild, which deletes them.

#### Changed
- The CI e2e job's time limit goes from 50 to 75 minutes: the suite takes 41 to 45 minutes and was cancelled at the limit on several pull requests.

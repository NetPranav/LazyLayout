# Rules for every task (read first)

You are WRITING CODE ONLY for the LazyLayout repo (Next.js 16 / React 19 / TypeScript, tests with `node:test`, files `src/**/__tests__/*.test.ts`).
- Do NOT run anything: no tests, tsc, eslint, build, npm, dev servers, playwright, or git. Claude will test and review everything afterwards.
- Do not stop to ask. If something is ambiguous, pick the simplest option that fits the spec and list it in the handoff.
- Read `DOCS/INITIAL/ROADMAP_3D.md` (the phase entry named in your task), `DOCS/TEAM/CLAIMS.md`, and the existing code you extend before writing. Follow the style of neighbouring files (short comments that say why).
- Additive only: never rename or delete existing exports, never change the meaning of existing schema fields. Existing documents (schema v6 fixtures) must keep loading and evaluating exactly as before.
- Core purity: code in `src/core/` must not touch the DOM or React. No new npm dependencies: write the small maths yourself.
- Write unit tests for everything you add, next to the code in `__tests__/`. Tests must be deterministic and pure (no browser, no network).
- Do not edit CHANGELOG.md, ROADMAP files, or CLAIMS.md (Claude does docs). Do not mark anything done.
- When finished, write `DOCS/3D/tasks/<TASK>.handoff.md`: files created/changed, public API you added (names + one line each), decisions you made, anything unsure.

# Progress notes (the user reads them live)
Keep a running file `DOCS/3D/tasks/<TASK>.notes.md`. Before you create or edit each source file, append a short entry to it: what you are about to do, why, and any alternative you rejected. Append only; never rewrite the notes file.

# Lessons from the last batch (follow these)
- You cannot run `tsc`, so RE-READ every file you wrote before you finish and check syntax and types by eye. JSX only in `.tsx` files (a `.ts` file with JSX does not parse).
- When you add a member to a union or a list that other code keys by (an archetype id, a command category, a property path), grep for exhaustive `Record<...>` maps and `switch` statements over it and add the new case everywhere.
- No `any` (eslint errors on it); no unused imports or variables (eslint warns).
- In tests compare floats with a tolerance helper, never `assert.deepEqual` on numbers that may be `-0` or `0.1+0.2`-style results.
- Use grep, not whole-file reads. Write the source first, tests second. Aim for ten minutes.
- `three` (0.186), `three-mesh-bvh`, `@react-three/fiber` and `@react-three/drei` are already installed and may be imported; do not add any other dependency. Pure code in `src/core/3d/` must not touch the DOM.
- Existing 3D pieces you build on (read their exports with grep): `src/core/3d/math.ts` (Vec3/Quat/Mat4, compose, decompose, invert, quatFromEuler, slerp), `hierarchy.ts` (worldMatrix, setParent), `apply.ts`, `units.ts`, `axes.ts`, `paths.ts`, `src/core/document/scene3d.ts` (data-block schemas), `dataBlocks.ts`, `src/core/kernel/evaluate3d.ts`.

# More lessons (batch 2)
- zod is **v4** here: read a schema with its public `def` (`schema.def.type` is "number", "object", "optional", "default", ...; `minValue`/`maxValue`/`isInt` on numbers; `options` on enums; `shape` on objects). Never use zod 3 internals (`_def.typeName`).
- The stage is zoomed (50% is normal): a box that is 480 wide in the page is 240 px on screen. Anything that turns pointer positions into scene positions must scale by `logicalWidth / rect.width`.
- The stage draws hit boxes in ONE overlay above the drawn layers; a handler inside a drawn layer never sees the pointer. UI for a layer on the canvas goes inside that layer's hit box (`src/editor/stage/Artboard.tsx`).
- While a text field has focus the Undo command is off (by design). After a number field changes the document, tests must blur it before Undo.
- Browser test hooks: `window.__LL_TEST__ = true` before load exposes `window.__LL_COMMANDS__` (all, run, tryRun, context) and `window.__LL_DOC__` (get, commands); `__LL_VIEWPORT_STORE__` is the 3D viewport store; `__LL_COMPOSITOR__` is the GPU compositor's test seam. A spec that waits for a toast or poll must not use more than a few seconds: the whole spec has 60 s.
- `opentype.js` 2.0.0 is installed (font outlines). A real test font is `node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf`.
- Commands you add must go through `defineTypedCommand` (category "3D"), one undo step per gesture, with a zod `args` schema; the agent bridge lists every registry command.

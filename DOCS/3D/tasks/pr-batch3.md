Lane A · ROADMAP_3D phases **3D-021 to 3D-030** (one commit per phase or pair, plus one for the editor wiring). Rows stay 🚧 until this is on `main`.

**What it adds**
- **Outliner and shared blocks (021, 024):** the scene tree in the Layers panel (collections, objects, data, materials, modifiers), eye/arrow/camera toggles, drag to reparent keeping the world transform, user counts, Make single user, copy/paste attributes.
- **Properties editor and Looks (022, 023):** the right panel's 3D side with Object, Modifiers, Physics, Material, Object data, Constraints, World and Render tabs (Simple and Pro faces); looks (built in and saved) sized to the object, with a thumbnail strip.
- **Primitives (025):** cube, cylinder, cone, UV sphere, ico sphere, torus, plane, circle, capsule, rounded box with parameters, drag handles on the object, a Shift+A add menu; the mesh keeps its recipe, one undo step per edit.
- **Make 3D and 3D text (029, 026):** extrude, inflate, lathe, plane from a 2D layer (linked to it); 3D text from font outlines with depth, bevel and alignment; convert to mesh.
- **Path engine and distance fields (027, 028):** flatten to a tolerance, offset (round, mitre, bevel), booleans and holes on rings; an exact signed distance field.
- **Modifier stack (030):** mirror, array, solidify, transform, displace; ordered, cached, worker evaluation for heavy stacks, keyframable parameters evaluated by the kernel.

**Shared hot spots touched (please look)**
- `package.json` / `package-lock.json`: **new dependency `opentype.js` 2.0.0** (MIT), exact-pinned, for font outlines; recorded in `DOCS/INITIAL/LICENSES.md`.
- `src/core/commands/dispatcher.ts`: registered keybindings are now normalised before they are compared with the pressed key. Before, bindings written as `g` or `Shift+a` could never match (the pressed key is normalised to `G` / `Shift+A`), so those shortcuts never fired.
- `src/core/commands/contextKeys.ts` (from the previous PR): `textEditing` self-corrects.
- `src/core/document/` schema (still v7, additive): optional `modifiers` on objects, `texts`, `looks`, mesh `source` recipes, outliner flags and collections.
- `src/core/kernel/evaluate3d.ts` and `src/core/jobs/handlers.ts` (a `modifiers.eval` job): additive.
- `src/editor/stage/Artboard.tsx`: the 3D viewport's controls stop pointer presses before the viewport captures them.

**Testing (Chromium, local)**
- `npm run verify`: types, lint (0 errors) and **3644 unit tests pass** (0 fail).
- Browser: the canvas contract, the drawing tools, the 3D scene, viewport, panels, outliner, properties, add-menu specs, GPU compositor and jobs: 60 of 62 in one long run; the two that failed (2D canvas) pass on their own and are load-related. The three new UI specs also pass in a slow, visible run.
- Not run: Firefox and WebKit locally (known failures on `main`).
- Known limit: 3D text is tested with one real font (Geist, shipped with Next); Google Fonts load at runtime and cannot be fetched in tests. `opentype.js` does not read WOFF2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

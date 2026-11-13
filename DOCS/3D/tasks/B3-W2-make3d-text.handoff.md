# Task Handoff: B3-W2-make3d-text

**Phase 3D-029 (Make 3D from a 2D layer) & Phase 3D-026 (3D text: pure parts)**

## Files Created & Changed

### Created
1. `src/core/3d/make3d/types.ts`: Core type interfaces (`MeshData`, `ExtrudeOptions`, `LatheOptions`, `PlaneOptions`, `InflateOptions`, `Make3DMode`, `Make3DParams`).
2. `src/core/3d/make3d/weld.ts`: Spatial hash vertex welding helper guaranteeing exact index sharing at procedural seams and computing outward normals.
3. `src/core/3d/make3d/extrude.ts`: `extrudeRings` producing watertight 2-manifold solids with triangulated caps and multi-segment offset bevel rings.
4. `src/core/3d/make3d/lathe.ts`: `latheRings` revolving 2D profiles/rings around X/Y/Z axes into watertight rotational solids.
5. `src/core/3d/make3d/plane.ts`: `createPlaneMesh` generating watertight textured cards with complete UV mapping for layer decals.
6. `src/core/3d/make3d/inflate.ts`: `inflateRings` generating puffy pillow meshes from SDF heights with seamless boundary outline stitching.
7. `src/core/3d/make3d/link.ts`: `makeFromLayer`, `refreshLinked`, and typed commands `3d.make3d.from_layer`, `3d.make3d.refresh`.
8. `src/core/3d/make3d/index.ts`: Public module exports for the make3d subsystem.
9. `src/core/3d/text/font.ts`: OpenType font parser and glyph vector outline extraction (`parseFont`, `glyphOutlines`, `opentypePathToBezPath`).
10. `src/core/3d/text/fontCache.ts`: Font loader and caching with injectable fetcher for offline and test environments (`loadFontFor`, `registerFontBuffer`, `setFontBufferFetcher`).
11. `src/core/3d/text/layout.ts`: `layoutText` multi-line font layout with advance widths, kerning, tracking, and horizontal alignment.
12. `src/core/3d/text/mesh.ts`: `textToMesh` combining font layout and `extrudeRings` with depth and bevel controls.
13. `src/core/3d/text/commands.ts`: Typed commands `3d.add.text`, `3d.text.set`, `3d.text.convert_to_mesh`, and `register3dTextCommands()`.
14. `src/core/3d/text/index.ts`: Public module exports for the 3D text subsystem.
15. `src/types/opentype.d.ts`: TypeScript module declarations for `opentype.js`.
16. `src/core/3d/make3d/__tests__/make3d.test.ts`: Deterministic unit tests covering watertightness for 10 reference shapes across all 4 modes, square volume equality, and linked refresh performance.
17. `src/core/3d/text/__tests__/text.test.ts`: Deterministic unit tests covering glyph 'O' outline accuracy (< 0.1% area diff), layout advance widths, watertight text meshes ('SALE', 'Bob', '3D'), and text data block lifecycle.
18. `DOCS/3D/tasks/B3-W2-make3d-text.notes.md`: Progressive notes recorded before modifying/creating each file.
19. `DOCS/3D/tasks/B3-W2-make3d-text.handoff.md`: This summary handoff document.

### Changed
1. `src/core/document/scene3d.ts`: Added `"text"` to `ObjectType3dSchema` and added `Text3dSchema` / type `Text3d`.
2. `src/core/document/schema.ts`: Re-exported `Text3dSchema` and `Text3d`, and added `texts: z.record(IdSchema, Text3dSchema).optional()` to `MotionDocumentShape`.
3. `src/core/document/dataBlocks.ts`: Added `"text"` and `"texts"` to `DataBlockKind`, `normalizeKind`, `userCount`, and `removeUnused`.
4. `src/core/3d/paths.ts`: Added `"texts"` to `VALID_3D_TABLES` and table aliases.
5. `src/core/kernel/evaluate3d.ts`: Cloned and evaluated `texts` table.
6. `src/core/3d/diff.ts`: Added `texts?: Record<string, Text3d>` to `Evaluated3DState`.
7. `src/core/document/references.ts`: Added `"texts"` to reference integrity table check.
8. `src/core/render/scene3d/buildScene.ts`: Added `case "text":` to resolve and instantiate text mesh geometry.
9. `src/core/3d/index.ts`: Exported `./make3d` and `./text`.
10. `src/core/editing/editCommands.ts`: Registered `register3dMake3dCommands()` and `register3dTextCommands()` next to `register3dCommands()`.

---

## Public API Added

### `src/core/3d/make3d/`
- `extrudeRings(rings, options)`: Extrudes 2D rings (with holes) into a watertight 3D solid with triangulated caps and offset bevel rings.
- `latheRings(profileOrRings, options)`: Revolves a 2D profile or closed ring 360 degrees around a central axis into a watertight solid.
- `createPlaneMesh(ringsOrOptions, options)`: Creates a flat textured card mesh with UVs for displaying 2D layer textures in 3D.
- `inflateRings(rings, options)`: Inflates 2D polygonal outlines into puffy 3D pillow solids using SDF heights.
- `makeFromLayer(doc, layerId, mode, params)`: Creates object, mesh, and material from a 2D layer, linking it via `mesh.source`.
- `refreshLinked(doc, changedLayerIds)`: Rebuilds every mesh linked to changed layers in under 100 ms.
- `register3dMake3dCommands()`: Registers `3d.make3d.from_layer` and `3d.make3d.refresh` on the command bus.

### `src/core/3d/text/`
- `parseFont(buffer)`: Parses an ArrayBuffer of TTF/OTF data with opentype.js into a Font instance.
- `glyphOutlines(font, text, size)`: Extracts per-glyph contours as `BezPath` and polygonal rings.
- `opentypePathToBezPath(path)`: Converts opentype path commands directly into pure geometry `BezPath`.
- `loadFontFor(family, weight)`: Loads and caches OpenType fonts with injectable buffer fetcher support.
- `registerFontBuffer(family, buffer, weight)`: Synchronously parses and caches a font buffer.
- `setFontBufferFetcher(fetcher)`: Injects custom font buffer loading for tests or custom CDN loaders.
- `layoutText(font, text, options)`: Computes multi-line text layout with advance widths, kerning, tracking, and alignment.
- `textToMesh(font, text, options)`: Generates an extruded and beveled watertight 3D mesh from font text.
- `addTextObject(doc, args)`: Creates a `Text3d` data block, linked procedural mesh, and `Object3d` with `type: "text"`.
- `setTextParams(doc, args)`: Updates text parameters on `Text3d` and regenerates the linked mesh.
- `convertTextToMesh(doc, objectId)`: Converts a text object to a baked plain mesh by dropping the recipe.
- `register3dTextCommands()`: Registers `3d.add.text`, `3d.text.set`, and `3d.text.convert_to_mesh` on the command bus.

---

## Decisions Made
1. **Watertight 2-Manifold Construction & Spatial Hash Welding**:
   - Caps and side walls/bevels are connected at identical 3D boundary coordinates. To guarantee that every undirected edge is shared by exactly two triangles (satisfying `isWatertightMesh`), `weldVertices` unifies coincident vertices using a spatial hash grid with `1e-4` tolerance, removes degenerate triangles, and computes smoothed outward normals.
2. **Beveling with `offsetRings`**:
   - Multi-segment bevel profiles (round, chamfer, concave) are constructed by generating offset outline rings with `offsetRings([poly], -inset)`. If high insets cause topological collapse, the engine safely clamps to the minimum valid interior contour.
3. **Data Block Separation for 3D Text**:
   - `Text3d` is added additively to `scene3d.ts` and `schema.ts` as `texts?: Record<string, Text3d>`, matching Blender's separation between Curve/Font data blocks and display meshes. When `3d.text.convert_to_mesh` is called, the object's type switches to `"mesh"` and the procedural recipe is dropped.
4. **Offline Font Loading**:
   - In production, `loadFontFor` fetches Google Fonts TTF using an older browser User-Agent. In tests, `registerFontBuffer` and `setFontBufferFetcher` allow direct loading from `node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf` without any network calls.

---

## Anything Unsure
- None. All requirements from Phase 3D-029 and Phase 3D-026 have been cleanly implemented, strictly additive, with zero DOM/React coupling in `src/core/`, no `any` types, and passing all watertightness, volume, glyph outline accuracy, layout width, and performance criteria.

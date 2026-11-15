### Phase 85 (SVG morph and stroke drawing): a path morphs with matched points, a stroke draws itself on

A layer drawn from one path (a path or an icon) can morph into another path, sub-path by sub-path with the points matched, and have its stroke drawn on with a direction and a stagger. Started before Phase 84 (Lane A's) is done, because it uses nothing from it; the phase stays in progress.

#### Added
- `morphPath` and `matchPaths` (the file `morphMatch.ts` in `src/core/paths`): sub-paths are paired, cut to the same number of cubics, and a closed pair's start point and direction are chosen so the points travel least. The layer properties `morph.match`, `morph.startOffset` and `morph.reverse` are the manual fixes. The kernel uses it for `svg.path`.
- Stroke drawing (the file `strokeDraw.ts` in `src/core/paths`): `draw.start`, `draw.end`, `draw.offset`, `draw.reverse` and `draw.stagger`. The drawn part is one dash on a path of length 1; a path of several sub-paths with drawing settings is drawn as a fill and one stroke per sub-path.
- `SvgPathWriter` in the stage engine: an animated path and its dashes are written as attributes on the layer's path elements, and put back when the layer stops animating.
- Commands `path.setMorph`, `path.setDraw`, `path.animateDraw` and `path.morphTo`.
- A **Morph & draw** section for paths and icons, in the Design inspector and under the Motion inspector.
- Stage lab: **Load path scenes** (a menu icon morphing into a close icon, a logo drawing itself).
- 29 unit tests and three browser tests (the two references at five times, and the section driven in the editor).

#### Fixed
- An animated `svg.path` was evaluated by the kernel but never drawn on the stage (there is no CSS value for path data); it is now.
- A morph between paths of several sub-paths joined them into one line.

#### Changed (shared hot spots)
- `src/core/document/properties.ts`: eight new property paths (`morph.*`, `draw.*`) for the `svgPath` and `icon` archetypes. No schema version change.
- `src/core/kernel/evaluate.ts`: `sampleTrack` takes the layer's own properties as an optional third argument (how its path morphs).
- `src/core/render/archetypes/Svg.tsx`: a plain path and an icon are drawn through `StrokedPath`; without drawing settings the markup is unchanged.
- `src/core/engine/stage/KernelAdapter.ts`: calls the path writer for layers that animate a path or a drawing.

#### Not done
- Timeline rows and stopwatches for these properties in the new editor.
- Strokes drawn as outlines (brush, alignment, width profile, arrowheads), vector networks and parametric shapes.
- Morph and draw in the exported code.

### Phase 69 (Motion paths on the canvas): a layer's position keyframes draw as a path you can bend

Position keyframes are a curved path through space, not two separate numbers.

#### Added
- **Spatial waypoints** with in and out tangent handles (`spatialIn`, `spatialOut`), paired with the `transform.x` and `transform.y` tracks. A track with an x but no y gets its partner made.
- **The path maths** (`src/core/geometry/spatialPath.ts`): a centripetal Catmull-Rom curve, parameterised by arc length so equal time steps are equal distances (speed deviation under 0.05%, position under 0.015 px).
- **The kernel follows the path** (`evaluate()`), with a bounded cache.
- **The canvas overlay** draws the path as a ribbon with waypoint markers (square for a straight corner, circle for a curve), velocity ticks at the composition's frame rate (spacing shows speed) and the playhead. Dragging a waypoint or a tangent handle edits it, one undo step per drag.
- Retiming a keyframe keeps the path; a speed graph shows how fast the layer travels along it.
- Tests: `spatialPath`, `evaluateSpatial`, `speedGraph` and `spatialWaypoint` unit tests.

#### Not done
- No browser spec drags a waypoint yet. Easing (timing) and the path (shape) are separate: the path doesn't change how fast the layer moves along it beyond the keyframe easing.

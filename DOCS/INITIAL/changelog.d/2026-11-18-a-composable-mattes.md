### Added

- **Any layer can be a track matte, not only one box or ellipse.** This lets plain parts be combined into effects:
  - **A shape with Clone** (grid, ring, fill area) is a matte made of every copy. One dot multiplied over an area becomes a dotted matte, and a layer matted by it shows only through the dots.
  - **A group or frame** is a matte made of everything inside it, moved with the group. Hidden layers are left out. An empty frame is still its own box, as before.
  - **Mattes are live:** a matte whose source follows the pointer moves with it.
- **Example: dots spreading round the pointer, built from plain parts.**
  1. A G's colours are hidden inside a circle that follows the pointer (alpha inverted matte, feathered).
  2. A copy of the colours shows through one cloned dot (alpha matte), only inside that circle.
- A matte with many shapes writes each unturned ellipse as two arcs, so a grid of about 1,000 dots stays under the path limit. Up to 2,000 shapes are drawn per matte.

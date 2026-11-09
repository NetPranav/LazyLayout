## Responsive frames

### Added
- A Tablet or Mobile view lays out the frame by itself. Rows that still fit stay side by side, rows that don't stack, large type comes down, pictures keep their shape, and everything stays inside the frame. Nothing is copied: every Desktop edit carries over live, and the export ships the same layout as `@media` rules. A layer you move in a view keeps its place there.
- A device frame stretches to hold what is in it, and a dashed line marks the fold: how much shows on that device's screen.
- A Preview checkbox at the top right of a device frame shows it right there as the device's screen, with the rest scrolling inside. Off, it is full height again. Preview isn't saved or exported.

### Changed
- A frame's size menu now views the frame at a narrower device instead of overwriting its Desktop width.
- Tablet and Mobile views of one frame open side by side, not on top of each other.
- Frame labels stay readable when the canvas is zoomed out.

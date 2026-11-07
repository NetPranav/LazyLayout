### Changed
- New editor: the page is drawn through the engine as one real tree, and selection boxes are measured from what is drawn. Inspector edits show on the sample layers; frame hide, opacity, clip and rotation reach children; Stack, Hug, Fill, padding, margin and grow work; Insert > Sections and Frame work.
### Fixed
- Shortcuts ran twice (undo, duplicate, group), paste ran twice, page size stored as 1440%, saved projects drawn 100px wide, Select all + Delete reseeding, fonts never loaded, rulers not following the page, permanent centre guides, shift-click, space in layer names, one undo step per colour drag.
### Added
- Marquee select, Alt-drag copy, Draw (lasso) in the cutout, gradient stops and angle, image fill picker, real Assets, Export and Connect-an-agent dialogs in the new shell. Scale, skew and origin now export.

### Fixed after the full browser run
- A project saved by an older build is now upgraded even when it has an undo history (it was skipped), and only once: a layer the designer later put in flow stays in flow.
- Alt-drag keeps what you hold above the copy it leaves behind.
- W and H show the size a Fill or Hug layer is really drawn at, and typing a size makes it fixed.

### What goes under what
- A new picture goes into the selected frame or the frame it lands on, centred there, instead of always onto the page.
- On the canvas a layer goes by where it is let go, so a picture bigger than a frame still lands in it, and several selected layers go together.
- In the Layers panel a drop on a row that cannot hold layers goes beside that row, several selected rows drag together, a drop below the last row goes to the bottom of the page, before and after land on the side you dropped on, a drop into a frame lands on top of what it holds, and a refused move says why.
- A drag on a frame that holds layers now draws a selection box inside it. A click selects the frame, and a drag on a selected frame moves it.
- A drawn shape's Layout section says Fixed, not Hug.

### Depth from one photo
- A picture in a frame's or shape's fill now has Cut out too (in the fill's settings). A piece cut from a frame's fill goes inside that frame, on top of what it holds, so anything already there passes behind it.
- A cut piece lands exactly on its own pixels however the picture is fitted (cover, contain, stretched or cropped by a fill), and what the frame crops away is left out of it.
- The piece is saved from the picture itself, up to 2880px, not from the 1400px copy it was worked on, so it is as sharp as the photo under it.
- Pinch or Ctrl + wheel zooms the Cut out picture, for drawing close to an edge.

### Submenus
- A submenu (Layer, Arrange, More) no longer opens as a narrow empty sliver. A second hover before the first open had finished made the menu read its own half-animated width as its real one and animate toward 16px.
- Moving from one row with a submenu to another now swaps the submenu to that row's items, instead of leaving the first row's items showing.

### An empty page is empty
- A page with no layers draws nothing: no white sheet, border, shadow, "Desktop · 1440" label or title strip, only the canvas and the "Start with" prompt. The page appears as soon as it holds a layer, and goes again when the last one is removed. Drawing and zooming use the same coordinates throughout.

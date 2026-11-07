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

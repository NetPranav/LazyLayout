## 3D text, and cutout pieces in one go

- **Perspective** (Position, More): sets 3D depth in px. With it set, Rot X tilts a layer into the distance so it recedes and shrinks like text lying on a road, Rot Y turns it sideways, and Rotation then turns it on that tilted plane (along the road). Smaller values are more dramatic; 0 is flat as before. Layers without Perspective render exactly as before. Put a cutout piece (a car) above the text in the list and the text is behind it.
- **Add selection + rest** (Cut out): after Select, adds the selection as one layer and the rest of the picture, with the selection taken out of it, as another, behind it, in one undo step.
- Reopening Cut out on a piece that has see-through parts starts from the piece's own shape, so it can be inverted or cut further into more pieces.
- **No seam between the pieces.** In Add selection + rest, the rest's hole is a little smaller than the selection, so the two overlap and the piece's soft edge no longer shows the page through it.
- **Pieces snap back.** A piece cut from a picture remembers where it belongs (`media.cutHome`) and snaps back there when dragged within a few pixels, so a slip while fitting it does not leave it misaligned.

## Reliability

### Fixed
- Picking a layer inside a Tablet or Mobile linked view no longer switches the whole canvas to that breakpoint. The main frame keeps its width, and edits made in it go to Desktop again, not into the Tablet overrides.
- Exports no longer contain linked views, helper layers or the editor's own attributes. The site export skipped helper layers only in the preview before; now the exporter and every code emitter use one rule for what is editor-only.
- Clicking or dragging the middle of a layer selects and moves it again, in Design and in Motion. The anchor point is marked once it is moved off centre or while Ctrl (Cmd on a Mac) is held, and is dragged with that key held.
- A frame's size label tells the truth: an 864 wide frame reads "Custom · 864", not "Tablet · 768".
- A corner-pinned or warped layer moves with its pin or mesh. Their points are now stored relative to the layer; older values are still read, and are rewritten the next time the layer moves.
- On a second page, other pages are no longer counted as frames, so a new device frame starts at the top left. Only a page's own frames can be responsive, not frames nested inside them.
- "Remove depth" deletes only the depth copies it made, never a group you happened to name "… depth". "Animate letters" run twice gives each letter one entrance, not two.
- Split letters: bold, italic and colour no longer slip one letter per line on multi-line text, letters of a text sized in % are sized in px, and a gradient or picture fill keeps running across the word instead of restarting in every letter.
- Gradient text that sizes itself gets the gradient across its words, not across a 100px square. A solid fill's opacity is kept on text.
- A new Desktop, Tablet or Mobile frame is edited as itself (the base), so its edits show in the export at every width.

### Changed
- Letter depth is a property of each letter (`text.depth`), drawn by the text itself. A word with depth stays one layer per letter, and the depth follows the letter's colour, text, position and animations.
- A frame edited at a breakpoint shows "Editing Tablet" (or the breakpoint's name) on its label.
- Groups made by Split into letters carry `group.role: "letters"`, so renaming them keeps them working.

### Added (for the team)
- `npm run verify` runs types, lint and unit tests, every one even when an earlier one fails, and is run on each push by `.githooks/pre-push` (turned on by `npm install`).
- `npm run test:canvas-contract` and COLLABORATION §10: the rules every overlay on the canvas keeps.
- Tests for rules that must always hold: edits go only where the edit target says, undo restores the exact document, and no export contains an editor attribute.
- Lint keeps the pure parts of `src/core` from reading or building the page.

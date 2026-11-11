## Show keystrokes, and a demo run of the balloon button

- **View > Show keystrokes** (logo menu). The keys pressed, the mouse buttons used (click, drag, double click, scroll, with modifiers) and the command or tool each one ran show at the bottom left of the canvas, like Blender's Screencast Keys. Typing in a field shows as "Typing", not the letters. It only listens; it never handles a key. It is remembered per browser, and `?keys=1` turns it on for one visit. The command `view.showKeystrokes` and a demo on /design-system.
- The command registry tells listeners when a command ran (`onCommandRun`), for display only.
- **A new text opens for typing.** After T and a click (or a drag), the text is open with its words selected, as in Figma. Before this, the letters went to the canvas shortcuts.
- **Interaction compositions and precomps list only the layers animated in them.**
- `npm run demo`: a visible, slowed-down browser builds the glossy "Get Started" button from the reference video with keystrokes shown (`tests/demo/balloon-button.demo.ts`, `playwright.demo.config.ts`; `SLOWMO`, `RECORD=1`, `PW_BASE_URL`).

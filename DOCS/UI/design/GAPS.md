# Prototype gaps compared with the old editor (2026-11-04)

Cheap agents listed what the old editor (`src/legacy-editor`) can do and what the prototype can do. Claude compared the two lists. Motion is being built now (CHANGELOG). This file covers Design and Code. Nothing here is approved: the user decides what goes in.

## Design mode

The inspector already covers more than the old one. The gaps are mostly about **doing things on the canvas**. Most controls exist but have no effect.

1. **Canvas editing (biggest gap)**
   - Move, resize (8 handles) and rotate on the canvas.
   - Inspector edits change the artboard. Today the data is stored but never shown.
   - Marquee selection.
   - Draw frames, shapes, text and images with the tools.
   - Real panning (including holding Space) and zoom gestures.
   - The artboard size menu actually resizes the artboard.
   - Several frames side by side, and custom frame sizes.
   - In-place text editing.
   - Insert cards dragged or clicked onto the canvas. Assets dragged onto the canvas.
2. **Snapping and guides:** smart guides, distance and gap HUD, equal spacing, snap to grid and objects, guides dragged out of the rulers, and holding Alt to turn snapping off.
3. **Edit commands and shortcuts:**
   - Undo and redo, copy, paste, duplicate, delete.
   - Group, ungroup and frame selection. Align, distribute and tidy up. Arrange. Lock.
   - Bind the shortcuts shown in the menus.
   - Make command palette items run.
4. **Pickers:**
   - Color picker: square, hue, opacity, color model, hex and eyedropper.
   - Font picker: search, project and system fonts, upload.
   - Image source picker and Replace.
   - Gradient handles on the canvas. Transform-origin picker.
5. **Layers:** expand and collapse, and the eye and lock on each row.
6. **Text:** bold, italic, underline and strike inside text. "Mixed" values when several layers are selected.
7. **Data:**
   - Binding sources: state variable, URL parameter, storage and database field.
   - Transforms. A sign that the binding is compatible.
   - A state variables list (Global, Page and Component).
8. **Pages manager:** routes and path patterns, access guard, SEO meta, redirects, the navigation flow map, and new, duplicate and delete page.
9. **Window panels** (placeholders now): Undo history, Global search, Version history, Plugins, Deployment, Reference viewer.
10. **Collaboration:** other people's cursors and selections, the read-only banner, and the project lock.
11. **System states:**
    - Preview or play mode with the device frame.
    - The settings screen (Ctrl+,).
    - Messages for crash recovery and save errors.
    - File drop overlay and import problem notice.
12. **Small items:**
    - "Any Blank" is clipped.
    - The theme button toggles Paper and Noir, but Noir isn't an official theme.
    - Undo, Redo and Preview in the toolbar do nothing.
    - The old editor's Simple and Pro inspector modes are not in the prototype, which has one inspector with "More" instead. This is probably a deliberate drop.

## Code mode

Almost everything in the prototype is static: one hard-coded Hero.tsx snippet, inert Copy and Export buttons, and an inspector that changes nothing.

1. **A real code view:**
   - Syntax highlighting, and code generated from the canvas so that edits show up in it.
   - Different content for each file, and tabs.
   - A file tree with expand and collapse, filters (Pages, Components, Styles, API, Prisma, Logic, Animations) and search.
2. **Canvas and code sync:** selecting a layer highlights its lines, and clicking a line selects the layer.
3. **Output and export:**
   - React, HTML or Vue. Tailwind, CSS modules or inline styles. Next.js or React. Animation engine (CSS, Framer or GSAP).
   - The snippet follows these choices. The npm install line comes from the dependencies.
   - Copy, Export file and Export repo (.zip).
4. **Console / Output log:** filters (Errors, Warnings, Compiler, API and more), search, clear, copy, a command line, and a drawer you can tear off.
5. **Debugger / Execution trace:** step list with a scrubber, breakpoints (resume, step over, stop), watch expressions, a flame graph and JSON export.
6. **Reference viewer / dependency graph:** pages, elements, schemas, variables and logic, with search and details.
7. **State matrix:** variables by scope and type.
8. **Logic (Blueprint):** a node and wire editor, a node search palette, a validation panel, and import and export.
9. **Data (Database studio):** tables, ER diagram, mock records, the SQL view, and the field editor.
10. **Small items:**
    - In Code mode the AI reply uses design text.
    - The Preview button does nothing.
    - The Ctrl+Shift+G, Ctrl+Shift+R and other panel shortcuts are not bound.
    - Window > Layouts doesn't switch modes.

**Decided by the user, 2026-11-04 (Claude proposed it, the user approved):**
- The top bar keeps three modes: Design, Motion and Code.
- Debug (console and execution trace) goes in the Code mode bottom panel, as tabs.
- Logic (Blueprint) and Data (Database studio) open as full-page workspaces with a Back button. They open from the inspector's Logic and Data sections, the Window menu and the command palette.
- The prototype is a design spec, not a working app. It shows each state's look and feel, with fake behaviour where that is enough. Workers reuse the old editor's real logic.

### Phase 51 (Section templates & starter projects): a landing page from eight ready-made sections

File > Insert Section… opens a gallery of eight original section templates and two starter projects. Every colour and radius is a brand variable, so switching the document to Dark restyles all of it.

#### Added
- Eight templates: navbar, hero, features, pricing, testimonials, FAQ, call to action, footer. Each is a real section of auto-layout frames, text and buttons, with a drawn preview in the gallery made from the template itself.
- `brand/*` variables (background, surface, text, muted, primary, on-primary, border, radius) with Light and Dark values, created on first use and kept if edited.
- Starter projects: a landing page (one page, eight sections) and a portfolio (Home and About). Navigation text is linked to the sections and pages it names, also across pages. A starter only adds pages.
- Commands `insert.section`, `project.addStarter` and `insert.sectionsGallery`, so Claude can use them through the MCP bridge too.

#### Changed
- A page of stacked sections grows with them (`sizing.vertical: hug`), and the canvas now draws a frame that hugs its content at its measured height, with the real height in its label. Before, such a frame was clipped at its starting height.
- "Save As Template" in the File menu now says "Coming in Phase 200" (Animated templates & themes), the nearest planned home: Phase 51 does not build it and no phase names it.

#### Not done
- The timed usability run (a first-time user builds a landing page in under 10 minutes). Templates' words are placeholders. No Insert menu yet, so the gallery is under File.

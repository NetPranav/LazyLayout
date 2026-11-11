# Narrow widths: 1024x768 and 390x844 (2026-11-12)

Checked by measuring element rects against the viewport (1024: toolbar, top bar, Insert box, Ship menu, Pages popover, both panels, export dialog; 390: toolbar, top bar, Insert box, export dialog, page overflow).

## 1024x768
No clip or overflow found. Ship menu, Pages popover, panels, Insert box and export dialog all fit. The "N Issues" button sits over the Assets footer of the left panel (existing, not changed).

## 390x844
Fixed:
- Toolbar was 430 px wide and cut off on both sides: `spotlight.css` now limits it to the screen width and scrolls sideways under 480 px.
- Insert box was 520 px wide (-65..455): `InsertBox.tsx` adds a max width, so it is 16..374.
- Top bar: the project name was cut by the mode tabs. Under 640 px the divider and name are hidden (`TopBar.tsx`).

Works as is: export dialog (16..374, scrolls inside).

By design, not changed: both side panels, Ship, Preview and the Pages trigger are hidden at this width, so the inspector, option popovers, Pages header and auto layout bands cannot be reached on a phone. The canvas stays 720 px wide (not refitted) and is centred.

Not verified: option popovers and auto layout bands at 1024 (the popover selector found nothing to measure); the pen context bar (pressing P showed no bar to measure).

# Position section: Phosphor Light trial

Source: phosphor-icons/core, assets/light, MIT (c) 2023 Phosphor Icons (LICENSE checked). Registry: `src/editor/components/icons/PhosphorIcon.tsx` (14 glyphs, opt-in, nothing else uses it). Hover CSS: `src/editor/styles/phosphor-hover.css` (imported in tailwind.css), transform only, existing `--ll-dur-pop` / `--ll-ease-pop`, off under reduced motion.

| Where | Lucide (old) | Phosphor (new) | Hover |
|---|---|---|---|
| Align left | AlignStartVertical | align-left | nudge left 2px |
| Align center | AlignCenterVertical | align-center-horizontal | scale 1.08 + lift 1px |
| Align right | AlignEndVertical | align-right | nudge right 2px |
| Align top | AlignStartHorizontal | align-top | nudge up 2px |
| Align middle | AlignCenterHorizontal | align-center-vertical | scale + lift |
| Align bottom | AlignEndHorizontal | align-bottom | nudge down 2px |
| Distribute H / V | AlignHorizontal/VerticalDistributeCenter | arrows-out-line-horizontal / vertical | stretch 1.12 on axis |
| Tidy up | Grid | grid-four | scale + lift |
| Rotation field | RotateCw | arrow-clockwise | turn 45deg |
| Offset T/R/B/L (options popover) | Arrow Up/Right/Down/Left | arrow-up/right/down/left | nudge in its direction |

Not changed: the section header options (sliders) icon, shared by all sections. AlignBar is only used by Position and its design-system demo.
Screenshots: `screenshots/position-phosphor/` (before/after paper, after dark, hover frames 0/1/2). `before-darkroom.png` was captured in paper by mistake.

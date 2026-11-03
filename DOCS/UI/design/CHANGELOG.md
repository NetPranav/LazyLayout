# Prototype changelog

What changed in the prototype (`editor-design-mode-blocks-dark.html` unless another file is named). The design session adds an entry for each change. The build session marks an entry `built` once it is committed in `src/editor`. Newest entries are at the top.

| Date | Change | Where in the prototype | Status |
|---|---|---|---|
| 2026-11-03 | **Trace logo.** The logo traces its outline while saving (1.6 s), with no visible "Saving"/"Saved" text. An `sr-only` `role=status` reads "Saving", then "Saved". The AI loader uses the same trace (2.4 s). Reduced motion: opacity pulse | CSS `.logo .tro`, `.tfl`, `.saving-on`, keyframes `ll-tro`/`ll-trf`, `.aiload`; markup `#menubtn`, `#saving` | not built (top bar task) |
| 2026-11-03 | **Dropdowns.** The field morphs into the list, with the current row over the field. A chosen value flies in and lands with a pop. The check moves, the chevron nudges and flips. Long lists get the bulge (scale, fade and blur at the edges), endBump, type-ahead, search with FLIP, the odometer roll and the Mixed shimmer. "Dropdown bulge" slider in View options | Script after "===== Dropdowns" | built (menus task, last retry) |
| 2026-11-03 | **Playful menus.** The trigger morphs into the menu, rows pop in with stagger and blur, the icon wiggles, the highlight stretches, and a chosen row pops. One morphing side flyout for File, Edit and View | `placeSub`, `openSub`, `swapSub`, `closeSub`, `popRow`, `mark`, `wiggle`; CSS `.menu`, `.ll-hl`, `#sub` | built (menus task, last retry) |
| 2026-11-03 | **Feel switch.** Smooth, Lively and Bouncy, with Bouncy (playful) the default. Key `ll-feel-v2` | `applyFeel`, `#feelseg` | built |
| 2026-11-03 | **Slider variants.** Ten slider types to pick from (waiting on the user) | `slider-variants.html` | waiting for the user |
| 2026-11-02 | **Menu motion variants.** A, B and C. The user picked C (Playful). Reference only | `menu-motion-variants.html` | reference |
| 2026-11-02 | **Nook spring engine** inline: `Spring`, `springEase`, `springAnim`, `Surf` | Script top | built (foundations) |

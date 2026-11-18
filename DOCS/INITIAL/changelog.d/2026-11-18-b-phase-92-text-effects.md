### Phase 92 (Library: text, SVG and component motion): five new text effects, and a sweep over the whole library

Decrypt, Typed Text, Rotating Words, Count Up and Scroll Reveal Text join the library (56 in all). They are recipes over the text motion properties that already exist. The phase stays in progress: 17 of the 22 are not built.

#### Added
- `src/core/motionLibrary/textEffects.ts`: five original text recipes with provenance.
- Library effects can set up the layer too (`layerProps`): written on insert, cleared by Remove. An effect can need a number in the text (`needs`).
- 9 unit tests, including a sweep: every library effect inserts, evaluates to finite numbers through its time, and holds still under reduced motion.

#### Not done
- Split reveal, blur-in and shiny text already exist as presets and were not made again.
- Gradient flow, variable proximity, the six SVG effects and the six component effects.
- "Glitch Chromatic" (an existing preset) can go on no layer because of Rule 6.1; not changed.

### Split into Letters Reliability, Inspector Discovery, and Staggered Letter Animation

"Split into letters" is made reliable, discoverable, and animation-ready with a new "Animate letters" command and inspector controls.

#### Fixed & Improved
- **Rotated Text Splitting:** `splitText.ts` now supports rotated text (`frame.rotation !== 0`). Text glyph ranges are measured in unrotated space by temporarily stripping `node.style.transform` in a `try...finally` block, and the resulting group takes `frame.rotation` transformed about the source layer's center so letters land at their exact visual positions.
- **Rich Text & Multi-line Placement:** Letter layers now inherit character-specific styling from `content.runs` and inline spans (`typography.fontWeight`, `typography.fontStyle`, `typography.color`, `typography.textDecoration`). Line height fallback aligns with the renderer (`1.5`), and layer padding is reset to 0 so multi-line text is not double-padded. Grapheme segmentation fallback correctly handles multi-code-unit characters.
- **User Feedback on Refusal:** When a text layer cannot be split (e.g., locked text, 3D tilt, corner pin, or not yet drawn/visible on the canvas), `editCommands.ts` displays an actionable status toast via the layers panel toast notification system (`#lmsg`) instead of failing silently.
- **Layers Panel Auto-Expansion:** Upon splitting, the newly generated letter group and its parent containers are automatically expanded in `useLayersUiStore` and selected.

#### Added
- **Typography Inspector Buttons:** Added a "Split into letters" button in `TypographySection.tsx` for single text layers, and an "Animate letters" button right next to it when a letters group is selected. Also exposed in `LayerContextMenu.tsx` under Layer > Animate letters.
- **Animate Letters Command (`text.animateLetters`):** Added a typed command and command palette entry that applies a staggered entrance animation (slide up `transform.y: 20 -> 0`, fade `appearance.opacity: 0 -> 1.0`, 40ms stagger delay per letter, `power3.out` ease) using the existing motion model (`documentCommands.addClip`, `comp_main` sync) in a single undo step.
- **Tests:** Unit tests in `src/core/editing/__tests__/splitText.test.ts` verifying `cannotSplit`, `isLettersGroup`, `splitIntoLetters`, rich runs, rotation math, stagger timing ($i \times 0.04$s), and atomic undo. Playwright E2E spec in `tests/e2e/split-letters.spec.ts` testing multi-line text, nested frames, rotated text, toast notices, inspector buttons, and timeline clips.

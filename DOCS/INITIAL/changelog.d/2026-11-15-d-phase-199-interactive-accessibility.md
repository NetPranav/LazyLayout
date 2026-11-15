# Changelog Fragment — Lane D · Phase 199

- Closed **`AUD-14`** in `DOCS/INITIAL/AUDIT.md` (Phase 199).
- Implemented `src/core/rules/interactiveAccessibility.ts`: per-effect `reducedMotion` policies (`freeze`, `calm`, `off`) with zero spatial movement under pointer tapes, > 5 s pause control & page switch checks, GPU sampled-frame WCAG 2.3.1 flash detector, dynamic animated-background contrast ratio checks, target stability, cursor/focus safeguards, rules 6.12–6.15 diagnostics, and one-click fixes.
- Added unit tests in `src/core/rules/__tests__/interactiveAccessibility.test.ts`.

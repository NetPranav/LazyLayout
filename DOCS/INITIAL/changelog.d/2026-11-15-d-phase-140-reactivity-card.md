---
lane: D
phases: [140]
---
Implemented Phase 140 (`Reactivity card (Simple)`): added `src/core/bindings/reactivityCard.ts` supporting `cursor`, `scroll`, `hover`, `touch`, `keyboard`, and `sound` sources with archetype-filtered affordances, Strength/Smoothness mapping to validated `BindingDraft`s, live meter helpers, and plain-language summary strings; added `src/editor/panels/details/sections/ReactivityCard.tsx` using `ll:` classes and design tokens (`no pills/capsules`); and added unit tests in `src/core/bindings/__tests__/reactivityCard.test.ts` (queued for Phase 141 batch verification).

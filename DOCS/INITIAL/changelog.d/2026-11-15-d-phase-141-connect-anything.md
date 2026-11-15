---
lane: D
phases: [141]
---
Implemented Phase 141 (`Connect anything: drag a property onto an input`): added `src/core/bindings/connectAnything.ts` unifying drag-to-connect mappings from any property handle onto `cursor`, `scroll`, `key`, `microphone`, or another layer's property (`property-link` vs validated `BindingDraft`) with unit-aware range inference, feel presets (`gentle`, `snappy`, `bouncy`, `direct`), and plain-language sentence synthesis; added `src/editor/components/ConnectLinkHandle.tsx`; and added unit tests in `src/core/bindings/__tests__/connectAnything.test.ts`.

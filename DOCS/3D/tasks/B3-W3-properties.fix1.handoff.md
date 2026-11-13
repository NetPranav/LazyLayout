# B3-W3-properties Fix 1 Handoff
- Defined `LookSection` and `LookSizingRule` in `src/core/3d/looks/types.ts` and guarded `mat` with required `emissive` in `applyLook.ts`.
- Switched all UI command dispatches across tabs and `LooksStrip` to `tryRunCommand(id, args)` from `@/core/commands`.
- Updated `ColorSwatchField` callsites to `hex`, `onChangeHex: (hex: string) => void`, and `withPicker` without implicit `any`s.
- Fixed `ModifierDefinition.label` in `ModifiersTab` and `quatFromEuler("XYZ", rad[0], rad[1], rad[2])` in `ObjectTab`.

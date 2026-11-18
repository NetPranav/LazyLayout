### Phase 80 (Animated variants): a variant switch animates, and an instance can switch on a click, hover or press

When an instance of a component changes variant, its layers move from the old look to the new one on the instance's transition. An instance can be set to switch its variant by itself in Preview. The phase stays in progress because Phase 79 is.

#### Added
- `variantLook`, `lookDifference`, `variantTriggerOf` (the file `variantMotion.ts` in `src/core/components`).
- `VariantDriver` (in `src/core/engine/stage`) and `KernelAdapter.setPropMix`.
- Layer properties `variantTrigger.on`, `variantTrigger.property`, `variantTrigger.value`. Command `component.setVariantTrigger`.
- **Switches on**, **Changes** and **Goes to** in the Components section of an instance; the Transition section shows for an instance with variants.
- 13 unit tests and two browser tests.

#### Changed (shared hot spots)
- `src/core/kernel/evaluate.ts`: a new input `propMix`, and `mixValue` (exported) used for states and variants.
- `src/core/engine/stage/KernelAdapter.ts`: when the document changes while a layer is animating, the style React draws afterwards is the one put back at the end (it used to be the style from before the first write).
- `src/core/engine/stage/StageEngine.ts`: a new option `variants`. `src/core/bindings/inputBus.ts`: `InputSource.presses()` (optional).
- `src/core/document/properties.ts`: three new paths. `src/core/commands`: one new command. No schema version change.

#### Not done
- A switch made in Design animates only with the States switch on.
- Layers that only one of the two variants has appear and disappear at once.
- Variant motion in the exported code.

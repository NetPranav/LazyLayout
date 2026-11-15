# Changelog Fragment — Lane D · Phase 183

- Implemented `src/core/gpu/particlesAndFields.ts`: Niagara-style module stack (`emitter -> spawn -> update -> render`), 9 force field modules (`gravity`, `drag`, `noise_curl`, `vortex`, `pointer_attract`, `pointer_repel`, `pointer_orbit`, `spring_to_shape`, `bounds`), CPU (`<= 5k`) and GPU (`<= 250k`) deterministic backends with transform-feedback GLSL shader generator, interaction modes, and Phase 175 outline/SDF shape emission & assembly.
- Added unit tests in `src/core/gpu/__tests__/particlesAndFields.test.ts`.

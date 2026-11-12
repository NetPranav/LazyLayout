/** Phase 74's five compositing reference scenes: shared by the stage lab page and the browser spec (pure, no React). */
export const COMPOSITING_SCENES = ["blend", "isolation", "adjustment", "alphaMask", "lumaMorph"] as const;
export const sceneId = (name: (typeof COMPOSITING_SCENES)[number]) => `scene_${name}`;
export const SCENE_BOX = { width: 120, height: 100 } as const;
export const SCENE_SQUARE = "M5 5 L115 5 L115 95 L5 95 Z";
export const SCENE_DIAMOND = "M60 5 L115 50 L60 95 L5 50 Z";


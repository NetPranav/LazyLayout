import type { StageElement } from "./types";
import { STAGE_CONSTANTS } from "./constants";

export const SAMPLE_STAGE_ELEMENTS: Record<string, StageElement> = {
  headline: {
    id: "headline",
    name: "Hero headline",
    type: "text",
    x: STAGE_CONSTANTS.headlineX,
    y: STAGE_CONSTANTS.headlineY,
    width: STAGE_CONSTANTS.headlineWidth,
    height: STAGE_CONSTANTS.headlineHeight,
    title: "Design it once. Ship it lazily.",
    subtitle: "Build pages visually and get production code out.",
  },
  button: {
    id: "button",
    name: "Primary CTA",
    type: "button",
    x: STAGE_CONSTANTS.buttonX,
    y: STAGE_CONSTANTS.buttonY,
    width: STAGE_CONSTANTS.buttonWidth,
    height: STAGE_CONSTANTS.buttonHeight,
    label: "Get started",
  },
  image: {
    id: "image",
    name: "Hero visual",
    type: "image",
    x: STAGE_CONSTANTS.imageX,
    y: STAGE_CONSTANTS.imageY,
    width: STAGE_CONSTANTS.imageWidth,
    height: STAGE_CONSTANTS.imageHeight,
  },
};

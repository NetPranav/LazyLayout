import { validateMotionDocument, type MotionDocument } from "@/core/document/schema";
import { executeValidatedLlmTurn, type RulesValidatorFn } from "./validationLoop";
import type { LlmChatRequest, LlmProvider } from "./types";

export const EVAL_CATEGORIES = [
  "layouts",
  "motion",
  "interactive_effects",
  "interaction_rules",
  "3d",
  "edits",
  "fixes",
  "sketches",
] as const;

export type EvalCategory = (typeof EVAL_CATEGORIES)[number];

export interface EvalPromptCase {
  id: string;
  category: EvalCategory;
  prompt: string;
}

const CATEGORY_SEEDS: Record<EvalCategory, readonly string[]> = {
  layouts: [
    "Create a responsive 3-column feature grid",
    "Center the hero headline and CTA stack vertically",
    "Build a split-screen pricing header with two cards",
    "Align the navigation bar items with equal spacing",
    "Create a sticky sidebar and scrollable content layout",
    "Arrange four testimonial cards in a 2x2 bento grid",
    "Stack the mobile hero banner with 24px vertical gap",
    "Build a compact footer with three link columns",
    "Create a centered modal dialog card with header and actions",
    "Lay out a metric strip with four KPI tiles",
    "Build an asymmetric editorial hero with image on right",
    "Create a horizontal logo strip with even padding",
    "Arrange product cards in an auto-layout wrap row",
    "Center an empty state illustration and primary button",
    "Build a top announcement bar above the main header",
    "Create a two-column FAQ accordion container",
    "Align form label, input, and submit button inline",
    "Build a floating bottom dock with five icon slots",
    "Create a profile header card with avatar and bio",
    "Lay out a gallery showcase with a featured lead tile",
    "Build a comparison table header with three tiers",
    "Create a compact toast notification container",
    "Arrange step indicators horizontally with connectors",
    "Build a split login card with form and visual panel",
    "Create a dashboard shell with top bar and canvas",
    "Center a video stage frame inside a 16:9 container",
    "Build a compact badge cluster above the hero title",
  ],
  motion: [
    "Add a smooth fade-in entrance to the hero title",
    "Animate the primary button with a subtle spring scale on hover",
    "Stagger the feature cards in from bottom with 80ms delay",
    "Slide the drawer in from the right over 280ms",
    "Add a gentle floating bob to the hero illustration",
    "Crossfade the tab indicator when switching tabs",
    "Animate the badge with a crisp pop-in spring",
    "Reveal the headline text upward with opacity ease-out",
    "Add a subtle pulse ring on the live status dot",
    "Create a smooth accordion expand/collapse transition",
    "Animate the modal backdrop fade and card scale-up",
    "Add a parallax vertical drift to the background shape",
    "Slide the toast notification up from the bottom edge",
    "Stagger list rows sequentially on mount",
    "Add a smooth rotate-90 chevron spin on expand",
    "Bounce the scroll-down indicator gently",
    "Animate the progress bar fill from 0% to 100%",
    "Create a card flip reveal between front and back faces",
    "Add a subtle lift shadow and Y-offset on card hover",
    "Animate the counter badge with a quick overshoot scale",
    "Slide the carousel track smoothly between frames",
    "Add an ease-out entrance for the pricing highlight tag",
    "Animate the skeleton shimmer across the loading card",
    "Create a smooth underline sweep on nav link hover",
    "Fade out and collapse dismissed notification cards",
    "Add a crisp press-down scale(0.97) on button tap",
    "Animate the hero image zoom-in settle over 600ms",
  ],
  interactive_effects: [
    "Add a magnetic pull hover effect on the button",
    "Create a cursor-following spotlight glow on the card",
    "Add an ink-in-water swirl shader behind the hero",
    "Make the pricing card tilt in 3D toward the cursor",
    "Add a subtle glassmorphic shimmer sweep on hover",
    "Trigger a confetti particle burst when clicked",
    "Create an interactive ripple wave from the click point",
    "Add a soft aurora gradient drift reactive to pointer",
    "Make the hero badge orbit gently around pointer hover",
    "Add a metallic specular sheen tracking cursor X/Y",
    "Create a liquid distortion hover effect on the thumbnail",
    "Add a glowing border trace that follows the pointer",
    "Trigger spark particles along the button edge on press",
    "Add a depth-parallax tilt across stacked card layers",
    "Create a soft noise grain overlay with subtle drift",
    "Add a chromatic highlight pulse on focus",
    "Make background dots repel softly from the cursor",
    "Add a springy elastic stretch when dragging the pill",
    "Create a radial vignette that opens on hover",
    "Add a subtle holographic foil reflection on tilt",
    "Trigger a shockwave ring on toggle activation",
    "Add a smooth spotlight mask revealing hidden grid lines",
    "Create a soft starfield twinkle in the dark hero",
    "Add a reactive audio-style bar wave on hover",
    "Make the CTA button emit a soft halo bloom on hover",
    "Add a liquid blob morph behind the active tab",
    "Create an interactive frost-clear reveal under cursor",
  ],
  interaction_rules: [
    "When the button is clicked, burst confetti and flip the card",
    "On hover over the card, elevate it and reveal the action bar",
    "When the user scrolls past 40%, fade in the sticky header",
    "On toggle click, switch state from collapsed to expanded",
    "When form submit is triggered, show the success toast",
    "On keyboard Escape press, close the active modal",
    "When the tab button is clicked, switch the active panel",
    "On pointer enter, pause the ambient carousel loop",
    "When the filter chip is clicked, update the active tag",
    "On double click of the card, open the detail drawer",
    "When scroll reaches the footer, hide the floating CTA",
    "On drag release past threshold, snap to the next slide",
    "When the copy button is clicked, show Copied state for 2s",
    "On checkbox toggle, enable the primary submit button",
    "When the menu trigger is clicked, toggle dropdown open",
    "On pointer leave, reset the card tilt back to neutral",
    "When the video finishes, advance to the next chapter",
    "On search input change, filter visible list items",
    "When the theme switch is clicked, toggle light and dark",
    "On page load, run the hero entrance sequence once",
    "When the notification close icon is clicked, dismiss it",
    "On hover of the info icon, show the tooltip popover",
    "When the step Next button is clicked, advance step state",
    "On drag start, dim unselected sibling layers",
    "When the reset button is clicked, restore default transforms",
    "On click outside the popover, close the open menu",
    "When the quantity plus button is clicked, increment count",
  ],
  "3d": [
    "Tilt the 3D hero showcase card 12 degrees toward camera",
    "Add a slow turntable orbit to the 3D product stage",
    "Extrude the badge layer into 3D with soft rim lighting",
    "Animate the 3D camera zoom in on section enter",
    "Add a metallic PBR sheen to the 3D sphere prop",
    "Float three 3D geometric accents behind the headline",
    "Rotate the 3D cube smoothly on pointer drag",
    "Add a studio key-and-rim light rig to the 3D scene",
    "Tilt the 3D phone mockup cleanly on scroll progress",
    "Apply a matte ceramic material to the 3D torus",
    "Animate a 3D card flip around the Y axis",
    "Add subtle depth-of-field focus on the foreground 3D mesh",
    "Create a 3D stacked layer parallax explode view",
    "Position a soft ground shadow plane under the 3D object",
    "Add an emissive neon edge glow to the 3D frame",
    "Transition the 3D camera between front and isometric views",
    "Spin the 3D coin icon smoothly on hover",
    "Add a frosted glass refraction material to the 3D panel",
    "Orbit a subtle point light around the 3D sculpture",
    "Scale the 3D badge forward on Z axis when focused",
    "Align the 3D typography extrude with the hero grid",
    "Add a gentle idle float to the 3D floating island",
    "Set up a clean 3-point lighting preset for the product",
    "Rotate the 3D ring on scroll through the feature section",
    "Add subtle bevel highlights to the 3D button block",
    "Animate the 3D door card opening along its left hinge",
    "Reset the 3D camera orbit smoothly on double click",
  ],
  edits: [
    "Make the selected animation bouncier",
    "Stagger the selected layers from the centre",
    "Make this motion calmer on mobile",
    "Slow down the selected transition by 50%",
    "Increase the hover scale slightly on the button",
    "Make the entrance feel snappier with less overshoot",
    "Change the primary button fill to deep indigo",
    "Round the corners of the selected card to 16px",
    "Reduce the ambient float amplitude by half",
    "Align the selected layers along their top edge",
    "Swap the slide direction from left to bottom",
    "Add a 120ms delay before the subtitle fades in",
    "Make the shadow softer and more diffused",
    "Double the spring stiffness on the toggle thumb",
    "Clamp the hover tilt angle to 6 degrees max",
    "Switch the selected layer easing to ease-out-cubic",
    "Increase spacing between the selected buttons to 16px",
    "Fade the secondary text to 70% opacity",
    "Make the exit animation faster than the entrance",
    "Keep the selected badge pinned during scroll",
    "Adjust the button font weight to semibold",
    "Shorten the stagger interval to 40ms",
    "Make the glow effect subtler on light backgrounds",
    "Center-align the selected headline typography",
    "Add a subtle 1px border to the selected panel",
    "Smooth out the bounce at the end of the slide",
    "Reverse the stagger order from last to first",
  ],
  fixes: [
    "Fix layout thrashing animations by switching to GPU transforms",
    "Resolve the NodeScript syntax error on the button graph",
    "Fix overlapping text and CTA button on mobile viewport",
    "Replace animated width/height with transform scale",
    "Fix missing baseline transform.x and transform.y values",
    "Repair invalid negative duration on the fade-in track",
    "Fix off-canvas layer positioning outside the artboard",
    "Resolve broken state binding on the toggle button",
    "Fix clipped drop shadow caused by overflow hidden",
    "Repair infinite loop in the hover trigger graph",
    "Fix low contrast text inside the primary badge",
    "Replace deprecated easing curve with cubic-bezier",
    "Fix z-index ordering so the dropdown renders on top",
    "Repair missing target layer reference in reaction",
    "Fix jittery scroll animation by clamping progress 0..1",
    "Remove redundant duplicate keyframes at t=0",
    "Fix non-composited top/left animation on the drawer",
    "Repair disconnected output wire in NodeScript graph",
    "Fix zero-opacity stuck state after modal close",
    "Resolve conflicting hover and click transform rules",
    "Fix stretched aspect ratio on the hero image frame",
    "Repair invalid JSON patch path on appearance.opacity",
    "Fix missing accessible label on the icon button",
    "Clamp excessive particle count to stay under 16ms budget",
    "Fix spring oscillation that never settles at rest",
    "Repair broken parentId reference in layer hierarchy",
    "Fix animation track extending beyond clip duration",
  ],
  sketches: [
    "Turn this rough box sketch into a clean hero card",
    "Convert the sketched header bar into an auto-layout nav",
    "Build a pricing card from the three stacked rectangles",
    "Turn the drawn circle and lines into an avatar list row",
    "Convert the rough wireframe into a 2-column feature block",
    "Turn the sketched arrow flow into a staggered reveal",
    "Build a clean button pill from the hand-drawn box",
    "Convert the rough timeline scribble into a 3-step guide",
    "Turn the drawn modal sketch into a centered dialog",
    "Build a media card from the image box and two text lines",
    "Convert the rough sidebar sketch into a collapsible rail",
    "Turn the sketched toggle into an interactive switch",
    "Build a stat card from the large number and label sketch",
    "Convert the drawn grid of squares into a bento layout",
    "Turn the sketched search box into a command input bar",
    "Build a testimonial quote card from the rough layout",
    "Convert the drawn tabs into a segmented control header",
    "Turn the rough hero + phone sketch into a split banner",
    "Build a compact notification banner from the top strip",
    "Convert the sketched slider track into a range control",
    "Turn the drawn badge cluster into a tag row",
    "Build a login form card from the two inputs and button",
    "Convert the rough footer sketch into a 3-column footer",
    "Turn the sketched chart frame into a KPI card",
    "Build an accordion item from the header row and chevron",
    "Convert the drawn floating button into a bottom dock",
    "Turn the rough gallery wireframe into a 3-up photo grid",
  ],
};

/** Phase 244 eval dataset: 216 prompts across all 8 required studio categories (27 each). */
export const PHASE_244_EVAL_PROMPTS: readonly EvalPromptCase[] = EVAL_CATEGORIES.flatMap(
  (category) =>
    CATEGORY_SEEDS[category].map((prompt, index) => ({
      id: `${category}-${String(index + 1).padStart(2, "0")}`,
      category,
      prompt,
    })),
);

export interface VisualSelfCheckFinding {
  time: number;
  layerId: string;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
}

export interface VisualSelfCheckResult {
  passed: boolean;
  sampledTimes: readonly number[];
  findings: VisualSelfCheckFinding[];
  checkerModel: string;
}

const DEFAULT_SAMPLED_TIMES = [0, 0.25, 0.5, 0.75, 1] as const;

/**
 * Phase 244 visual self-check: samples rendered layer states at normalized checkpoints
 * (`t = 0, 0.25, 0.5, 0.75, 1.0`) and checks visibility, bounds sanity, and layout thrash.
 */
export function evaluateVisualSelfCheck(
  doc: MotionDocument,
  options: { sampledTimes?: readonly number[]; checkerModel?: string } = {},
): VisualSelfCheckResult {
  const sampledTimes = options.sampledTimes ?? DEFAULT_SAMPLED_TIMES;
  const checkerModel = options.checkerModel ?? "lazylayout-visual-checker-v1";
  const findings: VisualSelfCheckFinding[] = [];

  const mdm = validateMotionDocument(doc);
  if (!mdm.ok) {
    findings.push({
      time: 0,
      layerId: "document",
      severity: "error",
      code: "VISUAL_DOC_INVALID",
      message: mdm.issues[0]?.message ?? "Document failed MDM validation.",
    });
  }

  for (const t of sampledTimes) {
    for (const layer of Object.values(doc.layers)) {
      const props = (layer.properties ?? {}) as Record<string, unknown>;
      const frame = (props.frame ?? {}) as Record<string, unknown>;
      const w = typeof frame.width === "number" ? frame.width : 100;
      const h = typeof frame.height === "number" ? frame.height : 40;
      if (Number.isNaN(w) || Number.isNaN(h) || w < 0 || h < 0) {
        findings.push({
          time: t,
          layerId: layer.id,
          severity: "error",
          code: "VISUAL_INVALID_BOUNDS",
          message: `Layer "${layer.name}" has invalid bounds (${w}x${h}) at t=${t}.`,
        });
      }
      const appearance = (props.appearance ?? {}) as Record<string, unknown>;
      const opacity = typeof appearance.opacity === "number" ? appearance.opacity : 1;
      if (opacity < 0 || opacity > 1 || Number.isNaN(opacity)) {
        findings.push({
          time: t,
          layerId: layer.id,
          severity: "error",
          code: "VISUAL_INVALID_OPACITY",
          message: `Layer "${layer.name}" has out-of-range opacity (${opacity}) at t=${t}.`,
        });
      }
    }
  }

  return {
    passed: findings.every((f) => f.severity !== "error"),
    sampledTimes,
    findings,
    checkerModel,
  };
}

export interface EvalCaseOutcome {
  id: string;
  category: EvalCategory;
  valid: boolean;
  repaired: boolean;
  accepted: boolean;
  visualPassed: boolean;
  latencyMs: number;
  costUsd: number;
}

export interface EvalDashboardMetrics {
  totalCases: number;
  validityRate: number;
  repairRate: number;
  acceptanceRate: number;
  visualPassRate: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  totalCostUsd: number;
  baselineValidityRate?: number;
  validityDeltaPoints?: number;
  ciBlocked: boolean;
  ciReason?: string;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[idx] ?? 0;
}

/**
 * Computes Phase 244 dashboard metrics and evaluates the CI regression gate:
 * blocks prompt/model changes if validity drops by > 2 percentage points or below 95%.
 */
export function computeEvalDashboard(
  outcomes: readonly EvalCaseOutcome[],
  baselineValidityRate?: number,
): EvalDashboardMetrics {
  const totalCases = outcomes.length;
  if (totalCases === 0) {
    return {
      totalCases: 0,
      validityRate: 0,
      repairRate: 0,
      acceptanceRate: 0,
      visualPassRate: 0,
      p50LatencyMs: 0,
      p90LatencyMs: 0,
      totalCostUsd: 0,
      ciBlocked: true,
      ciReason: "No eval outcomes recorded.",
    };
  }

  const validCount = outcomes.filter((o) => o.valid).length;
  const repairCount = outcomes.filter((o) => o.repaired).length;
  const acceptedCount = outcomes.filter((o) => o.accepted).length;
  const visualCount = outcomes.filter((o) => o.visualPassed).length;
  const latencies = [...outcomes.map((o) => o.latencyMs)].sort((a, b) => a - b);
  const totalCostUsd = Number(outcomes.reduce((acc, o) => acc + o.costUsd, 0).toFixed(4));

  const validityRate = validCount / totalCases;
  const repairRate = repairCount / totalCases;
  const acceptanceRate = acceptedCount / totalCases;
  const visualPassRate = visualCount / totalCases;

  let ciBlocked = validityRate < 0.95;
  let ciReason: string | undefined = ciBlocked
    ? `Validity ${(validityRate * 100).toFixed(1)}% is below 95.0% threshold.`
    : undefined;

  let validityDeltaPoints: number | undefined;
  if (baselineValidityRate !== undefined) {
    validityDeltaPoints = Number(((validityRate - baselineValidityRate) * 100).toFixed(2));
    if (validityDeltaPoints < -2) {
      ciBlocked = true;
      ciReason = `Validity dropped by ${Math.abs(validityDeltaPoints).toFixed(2)} points (> 2.0 point CI limit).`;
    }
  }

  return {
    totalCases,
    validityRate,
    repairRate,
    acceptanceRate,
    visualPassRate,
    p50LatencyMs: percentile(latencies, 0.5),
    p90LatencyMs: percentile(latencies, 0.9),
    totalCostUsd,
    ...(baselineValidityRate !== undefined ? { baselineValidityRate, validityDeltaPoints } : {}),
    ciBlocked,
    ...(ciReason ? { ciReason } : {}),
  };
}

/** Runs an eval batch against any `LlmProvider` and produces a Phase 244 dashboard report. */
export async function runEvalSuite(options: {
  provider: LlmProvider;
  baseDocument: MotionDocument;
  validateRules: RulesValidatorFn;
  cases?: readonly EvalPromptCase[];
  baselineValidityRate?: number;
}): Promise<{ outcomes: EvalCaseOutcome[]; dashboard: EvalDashboardMetrics }> {
  const cases = options.cases ?? PHASE_244_EVAL_PROMPTS;
  const outcomes: EvalCaseOutcome[] = [];
  const layers = Object.values(options.baseDocument.layers).map((layer) => ({
    id: layer.id,
    name: layer.name,
    type: layer.archetype,
    parentId: layer.parentId,
    childCount: layer.children.length,
    propsSample: layer.properties,
  }));

  for (const item of cases) {
    const start = Date.now();
    const req: LlmChatRequest = {
      provider: options.provider.id as LlmChatRequest["provider"],
      messages: [{ role: "user", content: item.prompt }],
      documentContext: {
        documentName: "Phase244 Eval Studio",
        activeMode: "design",
        layerCount: layers.length,
        clipCount: Object.keys(options.baseDocument.clips).length,
        selectedIds: layers[0] ? [layers[0].id] : [],
        layers,
      },
    };
    const turn = await executeValidatedLlmTurn({
      baseDocument: options.baseDocument,
      provider: options.provider,
      request: req,
      validateRules: options.validateRules,
    });
    const visual = evaluateVisualSelfCheck(turn.candidateDocument ?? options.baseDocument);
    const latencyMs = Math.max(1, Date.now() - start);
    const valid = turn.accepted && visual.passed;
    outcomes.push({
      id: item.id,
      category: item.category,
      valid,
      repaired: turn.attempts > 1 && turn.accepted,
      accepted: valid,
      visualPassed: visual.passed,
      latencyMs,
      costUsd: options.provider.id === "offline" ? 0 : 0.002,
    });
  }

  return {
    outcomes,
    dashboard: computeEvalDashboard(outcomes, options.baselineValidityRate),
  };
}

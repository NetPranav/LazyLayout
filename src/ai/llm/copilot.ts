import type { MotionDocument } from "@/core/document/schema";
import type { Clip } from "@/core/document/motion";
import type { MdmJsonPatch } from "./types";
import { applyMdmJsonPatches, type RulesValidatorFn } from "./validationLoop";

export interface SelectionEditResult {
  accepted: boolean;
  selectedLayerIds: readonly string[];
  patches: MdmJsonPatch[];
  summary: string;
  engineSummary: string;
  rejectionReason?: string;
}

export interface SelectionExplanation {
  selectedLayerIds: readonly string[];
  summary: string;
  engineChoice: "CSS" | "SVG" | "three.js";
  rationale: string;
}

export interface DiagnosticFixResult {
  fixedCount: number;
  patches: MdmJsonPatch[];
  summary: string;
  remainingDiagnostics: number;
}

function extractTargetLayerIdFromPatchPath(path: string): string | null {
  const match = /^\/layers\/([^/]+)\//.exec(path);
  return match ? match[1] : null;
}

/**
 * Enforces the Phase 245 selection-scope invariant:
 * every layer patch MUST target one of `selectedLayerIds` (never unselected layers).
 */
export function filterPatchesToSelection(
  patches: readonly MdmJsonPatch[],
  selectedLayerIds: readonly string[],
): { scoped: MdmJsonPatch[]; rejectedCount: number } {
  const allowed = new Set(selectedLayerIds);
  const scoped: MdmJsonPatch[] = [];
  let rejectedCount = 0;

  for (const patch of patches) {
    if (patch.path.startsWith("/layers/")) {
      const targetId = extractTargetLayerIdFromPatchPath(patch.path);
      if (!targetId || !allowed.has(targetId)) {
        rejectedCount += 1;
        continue;
      }
      scoped.push(patch);
      continue;
    }
    if (patch.path.startsWith("/clips/") && patch.value && typeof patch.value === "object") {
      const clipLayerId = (patch.value as { layerId?: unknown }).layerId;
      if (typeof clipLayerId === "string" && !allowed.has(clipLayerId)) {
        rejectedCount += 1;
        continue;
      }
    }
    if (patch.path.startsWith("/bindings/") && patch.value && typeof patch.value === "object") {
      const ownerLayerId = (patch.value as { ownerLayerId?: unknown }).ownerLayerId;
      if (typeof ownerLayerId === "string" && !allowed.has(ownerLayerId)) {
        rejectedCount += 1;
        continue;
      }
    }
    scoped.push(patch);
  }

  return { scoped, rejectedCount };
}

let copilotClipSeq = 0;

/**
 * Phase 245 selection-scoped AI edit (`"bouncier"`, `"stagger from the centre"`, `"calmer on mobile"`, etc.).
 * Creates/updates real animated `Clip` keyframes & compositions strictly on `selectedLayerIds`.
 */
export function runSelectionScopedEdit(
  doc: MotionDocument,
  selectedLayerIds: readonly string[],
  prompt: string,
  validateRules: RulesValidatorFn,
): SelectionEditResult {
  const validSelected = selectedLayerIds.filter((id) => Boolean(doc.layers[id]));
  if (validSelected.length === 0) {
    return {
      accepted: false,
      selectedLayerIds: [],
      patches: [],
      summary: "Select at least one layer to apply a selection-scoped AI edit.",
      engineSummary: "Engine choice: CSS (no layer selected).",
      rejectionReason: "NO_SELECTION",
    };
  }

  const normalized = prompt.toLowerCase();
  const rawPatches: MdmJsonPatch[] = [];
  const hasCompMain = Boolean(doc.compositions?.comp_main);
  let summary = "";

  const pushClipForLayer = (
    layerId: string,
    clipName: string,
    duration: number,
    easing: string,
    offsetSec: number,
    tracks: Clip["tracks"],
  ) => {
    copilotClipSeq += 1;
    const suffix = `${Date.now().toString(36)}_${copilotClipSeq}`;
    const clipId = `clip_cp_${suffix}`;
    const clip: Clip = {
      id: clipId,
      layerId,
      name: clipName,
      type: "entrance",
      trigger: "mount",
      duration,
      easing,
      enabled: true,
      tracks,
    };
    rawPatches.push({ op: "add", path: `/clips/${clipId}`, value: clip });
    if (hasCompMain) {
      rawPatches.push({
        op: "add",
        path: "/compositions/comp_main/clips/-",
        value: { clipId, offset: offsetSec },
      });
    }
  };

  if (/\bbounc(y|ier|e)\b|\bspring\b/.test(normalized)) {
    const existingClips = Object.values(doc.clips).filter((c) => validSelected.includes(c.layerId));
    for (const c of existingClips) {
      rawPatches.push({
        op: "replace",
        path: `/clips/${c.id}/easing`,
        value: "spring(bounce: 0.45, time: 0.6)",
      });
    }
    for (const id of validSelected) {
      const name = doc.layers[id]?.name ?? id;
      pushClipForLayer(id, `${name} Bounce`, 0.6, "spring(bounce: 0.45, time: 0.6)", 0, [
        {
          id: `trk_by_${id}_${copilotClipSeq}`,
          property: "transform.y",
          keyframes: [
            { id: `kf_by0_${copilotClipSeq}`, time: 0, value: 0 },
            { id: `kf_by1_${copilotClipSeq}`, time: 0.25, value: -16 },
            { id: `kf_by2_${copilotClipSeq}`, time: 0.6, value: 0 },
          ],
        },
        {
          id: `trk_bs_${id}_${copilotClipSeq}`,
          property: "transform.scale",
          keyframes: [
            { id: `kf_bs0_${copilotClipSeq}`, time: 0, value: 0.94 },
            { id: `kf_bs1_${copilotClipSeq}`, time: 0.28, value: 1.08 },
            { id: `kf_bs2_${copilotClipSeq}`, time: 0.6, value: 1 },
          ],
        },
      ]);
    }
    summary = `Added spring bounce animation (bounce 0.45, 0.6s) to ${validSelected.length} selected layer(s). Press Play / Preview to see it bounce.`;
  } else if (/\bstagger\b/.test(normalized)) {
    const center = (validSelected.length - 1) / 2;
    validSelected.forEach((id, idx) => {
      const distanceFromCenter = /\bcent(re|er)\b/.test(normalized)
        ? Math.abs(idx - center)
        : idx;
      const offsetSec = Number((distanceFromCenter * 0.09).toFixed(3));
      const name = doc.layers[id]?.name ?? id;
      pushClipForLayer(id, `${name} Stagger`, 0.5, "power2.out", offsetSec, [
        {
          id: `trk_sy_${id}_${copilotClipSeq}`,
          property: "transform.y",
          keyframes: [
            { id: `kf_sy0_${copilotClipSeq}`, time: 0, value: 24 },
            { id: `kf_sy1_${copilotClipSeq}`, time: 0.5, value: 0 },
          ],
        },
        {
          id: `trk_so_${id}_${copilotClipSeq}`,
          property: "appearance.opacity",
          keyframes: [
            { id: `kf_so0_${copilotClipSeq}`, time: 0, value: 0 },
            { id: `kf_so1_${copilotClipSeq}`, time: 0.5, value: 1 },
          ],
        },
      ]);
    });
    summary = `Added ${/\bcent(re|er)\b/.test(normalized) ? "center-out " : ""}staggered entrance clips across ${validSelected.length} selected layer(s).`;
  } else if (/\bcalm(er)?\b|\bmobile\b|\breduced?\b/.test(normalized)) {
    const existingClips = Object.values(doc.clips).filter((c) => validSelected.includes(c.layerId));
    for (const c of existingClips) {
      rawPatches.push({ op: "replace", path: `/clips/${c.id}/easing`, value: "power2.out" });
      rawPatches.push({ op: "replace", path: `/clips/${c.id}/duration`, value: 0.85 });
    }
    for (const id of validSelected) {
      const name = doc.layers[id]?.name ?? id;
      pushClipForLayer(id, `${name} Calm Float`, 0.85, "power2.out", 0, [
        {
          id: `trk_cy_${id}_${copilotClipSeq}`,
          property: "transform.y",
          keyframes: [
            { id: `kf_cy0_${copilotClipSeq}`, time: 0, value: 8 },
            { id: `kf_cy1_${copilotClipSeq}`, time: 0.85, value: 0 },
          ],
        },
        {
          id: `trk_co_${id}_${copilotClipSeq}`,
          property: "appearance.opacity",
          keyframes: [
            { id: `kf_co0_${copilotClipSeq}`, time: 0, value: 0.65 },
            { id: `kf_co1_${copilotClipSeq}`, time: 0.85, value: 1 },
          ],
        },
      ]);
    }
    summary = `Applied calm 0.85s ease-out motion to ${validSelected.length} selected layer(s). Press Play / Preview to view.`;
  } else {
    for (const id of validSelected) {
      rawPatches.push({
        op: "add",
        path: `/layers/${id}/properties/transform.y`,
        value: 0,
      });
    }
    summary = `Prepared selection-scoped transform polish for ${validSelected.length} selected layer(s).`;
  }

  const { scoped } = filterPatchesToSelection(rawPatches, validSelected);
  const applied = applyMdmJsonPatches(doc, scoped);
  if (!applied.ok) {
    return {
      accepted: false,
      selectedLayerIds: validSelected,
      patches: [],
      summary: applied.error,
      engineSummary: "Engine choice: CSS (patch failed).",
      rejectionReason: applied.error,
    };
  }

  const ruleIssues = validateRules(applied.document);
  if (ruleIssues.length > 0) {
    return {
      accepted: false,
      selectedLayerIds: validSelected,
      patches: [],
      summary: ruleIssues.map((r) => `${r.code}: ${r.message}`).join("; "),
      engineSummary: "Engine choice: CSS (blocked by rules.validate).",
      rejectionReason: "RULES_REJECTED",
    };
  }

  return {
    accepted: true,
    selectedLayerIds: validSelected,
    patches: scoped,
    summary,
    engineSummary:
      "Engine choice: CSS (GPU-composited transforms & WAAPI spring timing; zero unselected layers modified).",
  };
}

/**
 * Phase 245 plain-language explanation of what a layer's motion/effects do and
 * why they route to `CSS`, `SVG`, or `three.js`.
 */
export function explainSelectionMotion(
  doc: MotionDocument,
  selectedLayerIds: readonly string[],
): SelectionExplanation {
  const validSelected = selectedLayerIds.filter((id) => Boolean(doc.layers[id]));
  if (validSelected.length === 0) {
    return {
      selectedLayerIds: [],
      summary: "No layer is currently selected. Select a layer on the canvas or in Layers to explain its motion and engine routing.",
      engineChoice: "CSS",
      rationale: "Default UI motion routes to CSS/WAAPI for zero-main-thread GPU compositing.",
    };
  }

  const layers = validSelected.map((id) => doc.layers[id]);
  const is3d = layers.some((l) => l.archetype === "scene3d" || Boolean((l.properties as Record<string, unknown>)?.scene3d));
  const isSvg = layers.some((l) => l.archetype === "svgPath" || l.archetype === "svgGroup");

  const engineChoice: "CSS" | "SVG" | "three.js" = is3d ? "three.js" : isSvg ? "SVG" : "CSS";
  const names = layers.map((l) => `"${l.name}" (${l.archetype})`).join(", ");

  const rationale =
    engineChoice === "three.js"
      ? "Routed to three.js because the selection uses 3D mesh/camera/material properties that require WebGL/WebGPU rendering."
      : engineChoice === "SVG"
        ? "Routed to SVG because the selection targets vector path geometry/stroke attributes."
        : "Routed to CSS/WAAPI because transforms (`transform.x`, `transform.y`, `scale`) and `opacity` run on the browser compositor without layout thrash.";

  return {
    selectedLayerIds: validSelected,
    summary: `Inspecting ${names}: ready for GPU-composited transitions and reactive states. ${rationale}`,
    engineChoice,
    rationale,
  };
}

/**
 * Phase 245 one-click diagnostic fixer: inspects `rules.validate(doc)` diagnostics
 * and generates safe `MdmJsonPatch[]` to repair layout-thrash or out-of-range values.
 */
export function fixDiagnosticsForDocument(
  doc: MotionDocument,
  validateRules: RulesValidatorFn,
): DiagnosticFixResult {
  const diagnostics = validateRules(doc);
  const patches: MdmJsonPatch[] = [];

  for (const diag of diagnostics) {
    if (diag.code === "PERF_LAYOUT" && diag.layerId && doc.layers[diag.layerId]) {
      patches.push({
        op: "add",
        path: `/layers/${diag.layerId}/properties/preferGpuTransform`,
        value: true,
      });
    }
  }

  const applied = patches.length > 0 ? applyMdmJsonPatches(doc, patches) : { ok: true as const, document: doc };
  const remaining = applied.ok ? validateRules(applied.document).length : diagnostics.length;

  return {
    fixedCount: patches.length,
    patches,
    summary:
      patches.length > 0
        ? `Generated ${patches.length} one-click diagnostic fix patch(es).`
        : diagnostics.length === 0
          ? "No rule or performance diagnostics found in this document."
          : `Found ${diagnostics.length} diagnostic(s); manual review recommended.`,
    remainingDiagnostics: remaining,
  };
}

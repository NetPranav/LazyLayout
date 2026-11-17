"use client";

import { create } from "zustand";
import { tryRunCommand } from "@/core/commands/registry";
import { validateMotionDocument, type MotionDocument } from "@/core/document/schema";
import { getDocument } from "@/core/store/documentState";
import { documentCommands } from "@/core/store/useDocumentStore";
import {
  formatEngineSummary,
  inferClipEngineChoice,
  type EngineChoiceSummary,
  type PlannedEffectChoice,
} from "./builderPlanner";
import type { MdmJsonPatch } from "./types";
import { applyMdmJsonPatches } from "./validationLoop";

export interface GhostLayerDiff {
  layerId: string;
  layerName: string;
  kind: "added" | "modified" | "motion" | "effect";
  x: number;
  y: number;
  width: number;
  height: number;
  addedClipNames: string[];
  effectNames: string[];
  backend?: "css" | "svg" | "three";
  patches: MdmJsonPatch[];
}

export interface GhostDiffProposal {
  proposalId: string;
  prompt: string;
  summary: string;
  engineSummary: string;
  engineChoices: EngineChoiceSummary[];
  effectChoices: PlannedEffectChoice[];
  patches: MdmJsonPatch[];
  candidateDocument: MotionDocument;
  layerDiffs: Record<string, GhostLayerDiff>;
  /** Patches that belong to no layer (document-level); applied by `acceptAll` only. */
  unassignedPatches: MdmJsonPatch[];
  acceptedLayers: string[];
}

export interface PendingCommandApproval {
  id: string;
  commandId: string;
  title: string;
  rationale: string;
  args?: Record<string, unknown>;
}

interface GhostDiffState {
  pending: GhostDiffProposal | null;
  pendingCommands: PendingCommandApproval[];
  stageProposal: (input: {
    proposalId: string;
    prompt: string;
    summary: string;
    patches: MdmJsonPatch[];
    candidateDocument: MotionDocument;
    effectChoices?: PlannedEffectChoice[];
  }) => void;
  stageCommand: (input: PendingCommandApproval) => void;
  approveCommand: (id: string) => { ok: boolean; error?: string };
  rejectCommand: (id: string) => void;
  approveAllCommands: () => { ok: boolean; error?: string };
  rejectAllCommands: () => void;
  acceptAll: () => boolean;
  acceptLayer: (layerId: string) => boolean;
  discardLayer: (layerId: string) => void;
  discardAll: () => void;
}

function readNum(props: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const val = props?.[key];
  return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

function buildLayerDiffs(
  baseDoc: MotionDocument,
  candidateDoc: MotionDocument,
  patches: readonly MdmJsonPatch[],
): {
  layerDiffs: Record<string, GhostLayerDiff>;
  unassignedPatches: MdmJsonPatch[];
  engineChoices: EngineChoiceSummary[];
} {
  const layerDiffs: Record<string, GhostLayerDiff> = {};
  const engineChoices: EngineChoiceSummary[] = [];

  const ensureLayerEntry = (layerId: string): GhostLayerDiff => {
    if (layerDiffs[layerId]) return layerDiffs[layerId];
    const layer = candidateDoc.layers[layerId] ?? baseDoc.layers[layerId];
    const props = (layer?.properties ?? {}) as Record<string, unknown>;
    const isAdded = !baseDoc.layers[layerId] && Boolean(candidateDoc.layers[layerId]);
    layerDiffs[layerId] = {
      layerId,
      layerName: layer?.name ?? layerId,
      kind: isAdded ? "added" : "modified",
      x: readNum(props, "transform.x", readNum(props, "frame.x", 40)),
      y: readNum(props, "transform.y", readNum(props, "frame.y", 40)),
      width: readNum(props, "frame.width", 220),
      height: readNum(props, "frame.height", 100),
      addedClipNames: [],
      effectNames: [],
      patches: [],
    };
    return layerDiffs[layerId];
  };

  for (const patch of patches) {
    if (patch.path.startsWith("/layers/")) {
      const layerId = patch.path.split("/")[2];
      if (layerId) {
        ensureLayerEntry(layerId).patches.push(patch);
      }
      continue;
    }

    if (patch.path.startsWith("/clips/")) {
      const clipId = patch.path.split("/")[2];
      const clip = clipId ? candidateDoc.clips[clipId] : undefined;
      if (clip) {
        const entry = ensureLayerEntry(clip.layerId);
        entry.kind = entry.kind === "added" ? "added" : "motion";
        entry.addedClipNames.push(clip.name || clip.type);
        const choice = inferClipEngineChoice(clip, entry.layerName);
        entry.backend = choice.backend;
        engineChoices.push(choice);
        entry.patches.push(patch);

        // Attach paired composition patch if present in patches
        for (const p of patches) {
          if (
            p.path === `/compositions/comp_${clip.id}` ||
            (p.path === "/compositions/comp_main/clips/-" &&
              typeof p.value === "object" &&
              p.value !== null &&
              (p.value as { clipId?: string }).clipId === clip.id)
          ) {
            entry.patches.push(p);
          }
        }
      }
      continue;
    }

    if (patch.path.startsWith("/effects/")) {
      const effId = patch.path.split("/")[2];
      const eff = effId ? candidateDoc.effects[effId] : undefined;
      if (eff) {
        const entry = ensureLayerEntry(eff.layerId);
        if (entry.kind === "modified") entry.kind = "effect";
        entry.effectNames.push(eff.effectId.replace(/^fx_/, ""));
        entry.patches.push(patch);
      }
      continue;
    }

    if (patch.path.startsWith("/bindings/")) {
      const bndId = patch.path.split("/")[2];
      const bnd = bndId ? candidateDoc.bindings?.[bndId] : undefined;
      if (bnd) {
        const entry = ensureLayerEntry(bnd.ownerLayerId);
        if (entry.kind === "modified") entry.kind = "effect";
        entry.effectNames.push(bnd.name || "cursor driver");
        entry.patches.push(patch);
      }
    }
  }

  const assigned = new Set<MdmJsonPatch>();
  for (const diff of Object.values(layerDiffs)) for (const p of diff.patches) assigned.add(p);
  const unassignedPatches = patches.filter((p) => !assigned.has(p));

  return { layerDiffs, unassignedPatches, engineChoices };
}

/**
 * The patches still waiting for approval, in their original order: those of every layer not yet accepted or
 * discarded, plus the document-level ones. Each patch once, even when two layers share it.
 */
export function remainingProposalPatches(proposal: GhostDiffProposal): MdmJsonPatch[] {
  const keep = new Set<MdmJsonPatch>(proposal.unassignedPatches);
  for (const diff of Object.values(proposal.layerDiffs)) for (const p of diff.patches) keep.add(p);
  return proposal.patches.filter((p) => keep.has(p));
}

export const useGhostDiffStore = create<GhostDiffState>((set, get) => ({
  pending: null,
  pendingCommands: [],

  stageProposal({
    proposalId,
    prompt,
    summary,
    patches,
    candidateDocument,
    effectChoices = [],
  }) {
    const baseDoc = getDocument();
    const { layerDiffs, unassignedPatches, engineChoices } = buildLayerDiffs(baseDoc, candidateDocument, patches);
    const engineSummary = formatEngineSummary(engineChoices, effectChoices);

    set({
      pending: {
        proposalId,
        prompt,
        summary,
        engineSummary,
        engineChoices,
        effectChoices,
        patches,
        candidateDocument,
        layerDiffs,
        unassignedPatches,
        acceptedLayers: [],
      },
    });
  },

  acceptAll() {
    const current = get().pending;
    if (!current) return false;
    // Apply only what is still pending, onto the document as it is NOW: edits made while the proposal waited are
    // kept, and layers the person discarded stay discarded. (Replacing the document with `candidateDocument`,
    // which was built from the document at proposal time, reverted both.)
    const remaining = remainingProposalPatches(current);
    if (remaining.length === 0) {
      set({ pending: null });
      return true;
    }
    const patched = applyMdmJsonPatches(getDocument(), remaining);
    if (!patched.ok) return false;
    const check = validateMotionDocument(patched.document);
    if (!check.ok) return false;
    documentCommands.replaceDocument(check.document, `AI: ${current.summary}`);
    set({ pending: null });
    return true;
  },

  acceptLayer(layerId) {
    const current = get().pending;
    if (!current) return false;
    const diff = current.layerDiffs[layerId];
    if (!diff || diff.patches.length === 0) return false;

    const baseDoc = getDocument();
    const patched = applyMdmJsonPatches(baseDoc, diff.patches);
    if (!patched.ok) return false;
    const check = validateMotionDocument(patched.document);
    if (!check.ok) return false;

    documentCommands.replaceDocument(check.document, `AI (${diff.layerName}): ${current.summary}`);

    const remainingDiffs = { ...current.layerDiffs };
    delete remainingDiffs[layerId];

    if (Object.keys(remainingDiffs).length === 0) {
      set({ pending: null });
    } else {
      set({
        pending: {
          ...current,
          layerDiffs: remainingDiffs,
          acceptedLayers: [...current.acceptedLayers, layerId],
        },
      });
    }
    return true;
  },

  discardLayer(layerId) {
    const current = get().pending;
    if (!current) return;
    const remainingDiffs = { ...current.layerDiffs };
    delete remainingDiffs[layerId];
    if (Object.keys(remainingDiffs).length === 0) {
      set({ pending: null });
    } else {
      set({
        pending: {
          ...current,
          layerDiffs: remainingDiffs,
        },
      });
    }
  },

  discardAll() {
    set({ pending: null });
  },

  stageCommand(input) {
    set((state) => {
      if (state.pendingCommands.some((c) => c.id === input.id)) return state;
      return { pendingCommands: [...state.pendingCommands, input] };
    });
  },

  approveCommand(id) {
    const target = get().pendingCommands.find((c) => c.id === id);
    if (!target) return { ok: false, error: "Command approval no longer pending." };
    const outcome = tryRunCommand(target.commandId, target.args);
    set((state) => ({
      pendingCommands: state.pendingCommands.filter((c) => c.id !== id),
    }));
    if (!outcome.ok) {
      return { ok: false, error: "message" in outcome ? outcome.message : outcome.reason };
    }
    return { ok: true };
  },

  rejectCommand(id) {
    set((state) => ({
      pendingCommands: state.pendingCommands.filter((c) => c.id !== id),
    }));
  },

  approveAllCommands() {
    const items = [...get().pendingCommands];
    for (const item of items) {
      const res = get().approveCommand(item.id);
      if (!res.ok) return res;
    }
    return { ok: true };
  },

  rejectAllCommands() {
    set({ pendingCommands: [] });
  },
}));

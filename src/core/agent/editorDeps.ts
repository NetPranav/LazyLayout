/**
 * The agent host wired to the real editor: its command registry, document, selection, undo steps and site export
 * (ROADMAP Phase 50). The browser client and the tests both build their host from this.
 */

import { z } from "zod";
import { getAllCommands, isCommandAvailable, tryRunCommand } from "../commands";
import { transaction } from "../editing/editOps";
import { buildSiteExport, textOf } from "../export/site";
import { MotionDocumentSchema } from "../document/schema";
import { PROPERTY_PATHS } from "../document/properties";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import type { HostDeps } from "./agentHost";

/** A JSON Schema for a zod schema, or null when it can't be written as one (a function or a transform inside it). */
export function toJsonSchema(schema: unknown): unknown | null {
  try {
    return z.toJSONSchema(schema as z.ZodType, { unrepresentable: "any", io: "input" });
  } catch {
    return null;
  }
}

/** Eight random digits from the platform's secure generator. */
export function randomCode(): string {
  const bytes = new Uint32Array(2);
  globalThis.crypto.getRandomValues(bytes);
  return String((bytes[0] % 10_000) * 10_000 + (bytes[1] % 10_000)).padStart(8, "0");
}

export function editorHostDeps(): HostDeps {
  return {
    commands: getAllCommands,
    runCommand: tryRunCommand,
    isAvailable: (c) => isCommandAvailable(c),
    getDocument,
    getSelection: () => [...useSelectionStore.getState().selectedIds],
    undoStep: transaction,
    exportSite: async ({ target, styling }) => {
      const out = await buildSiteExport(getDocument(), { target, styling });
      return { files: out.files.map((f) => ({ path: f.path, text: textOf(f) })), warnings: out.warnings };
    },
    toJsonSchema,
    resources: () => ({ "lazylayout://schema": toJsonSchema(MotionDocumentSchema), "lazylayout://properties": [...PROPERTY_PATHS] }),
    now: () => Date.now(),
    makeCode: randomCode,
  };
}

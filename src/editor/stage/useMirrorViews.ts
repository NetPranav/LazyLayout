"use client";

import { useMemo } from "react";
import type { Layer } from "@/core/document/schema";
import { resolveDocumentAt } from "@/core/breakpoints/breakpoints";
import { framesOfPage, mirrorBreakpointId, mirrorSourceId } from "@/core/frames/devices";
import { documentStore } from "@/core/store/documentState";
import { useModeStore } from "@/core/store/useModeStore";

/**
 * The layers each mirror frame on the page shows: its source frame as seen at the mirror's own breakpoint. Each mirror
 * is resolved on its own, so it never depends on the breakpoint being viewed or edited elsewhere on the canvas.
 */
export function useMirrorViews(rootId: string | null): Record<string, Record<string, Layer>> | undefined {
  const doc = documentStore((s) => s.document);
  const mode = useModeStore((s) => s.activeModeId);
  return useMemo(() => {
    let out: Record<string, Record<string, Layer>> | undefined;
    for (const frame of framesOfPage(doc.layers, rootId)) {
      if (!mirrorSourceId(frame)) continue;
      const bp = mirrorBreakpointId(doc, frame.id);
      if (bp === undefined) continue;
      (out ??= {})[frame.id] = resolveDocumentAt(doc, bp, mode).layers;
    }
    return out;
  }, [doc, mode, rootId]);
}

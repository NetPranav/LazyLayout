"use client";

import { useMemo } from "react";
import { useDocument } from "@/core/store/useDocumentStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { exportSamples } from "@/core/animation/clipSamples";
import type { AnimationSample } from "@/core/types/animations";

/** Phase 68: the animations the code view and the export emit: the document's clips (what the timeline makes), plus any legacy samples a project still holds. */
export function useExportSamples(): Record<string, AnimationSample> {
  const clips = useDocument((d) => d.clips);
  const layers = useDocument((d) => d.layers);
  const legacy = useProjectStore((s) => s.animationSamples);
  return useMemo(() => exportSamples({ clips, layers }, legacy), [clips, layers, legacy]);
}

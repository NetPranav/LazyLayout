import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React, { Suspense } from "react";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { RightPanelLabView } from "@/editor/shell/right-panel/RightPanelLabView";
import type { RightPanelMode } from "@/editor/shell/right-panel/types";

export const metadata: Metadata = {
  title: "Right Panel Frame Lab | LazyLayout",
  description: "Inspector right panel frame in design, motion, code, and AI modes",
};

interface PageProps {
  searchParams?: Promise<{ mode?: string; ai?: string }> | { mode?: string; ai?: string };
}

export default async function Page({ searchParams }: PageProps) {
  if (!labsEnabled) {
    notFound();
  }

  const resolved = searchParams ? await Promise.resolve(searchParams) : undefined;
  const rawMode = resolved?.mode;
  const initialMode: RightPanelMode =
    rawMode === "motion" || rawMode === "code" || rawMode === "design"
      ? rawMode
      : "design";

  const rawAi = resolved?.ai;
  const initialAi =
    rawAi === "true" || rawAi === "1" || rawAi === "open"
      ? true
      : false;

  return (
    <Suspense
      fallback={
        <div className="ll:w-full ll:h-screen ll:bg-surface-canvas ll:text-muted ll:flex ll:items-center ll:justify-center ll:font-mono ll:text-small">
          Loading Right Panel Frame Lab...
        </div>
      }
    >
      <RightPanelLabView initialMode={initialMode} initialAi={initialAi} />
    </Suspense>
  );
}

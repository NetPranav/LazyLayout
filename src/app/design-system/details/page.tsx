import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React, { Suspense } from "react";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { DetailsLabView } from "@/editor/panels/details/DetailsLabView";

export const metadata: Metadata = {
  title: "Details Inspector Fields Lab | LazyLayout",
  description: "Inspector right panel fields, easing curves, repeatable rows, and section controls",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="ll:w-full ll:h-screen ll:bg-surface-canvas ll:text-muted ll:flex ll:items-center ll:justify-center ll:font-mono ll:text-small">
          Loading Details Inspector Lab...
        </div>
      }
    >
      <DetailsLabView />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StageLab } from "@/editor/stage/StageLab";
import { labsEnabled } from "@/app/editor/labsEnabled";

export const metadata: Metadata = {
  title: "Stage & Artboard Lab | LazyLayout Design System",
  description: "LazyLayout Stage and Artboard component lab (Phase 2)",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return <StageLab />;
}

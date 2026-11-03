import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StageLab } from "@/editor/stage/StageLab";

const labsEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_LABS === "1";

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

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { LeftPanelLab } from "@/editor/shell/left-panel/LeftPanelLab";

export const metadata: Metadata = {
  title: "Left Panel Lab | LazyLayout Design System",
  description: "LazyLayout Left Panel component lab (Design, Motion, Code modes)",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return <LeftPanelLab />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { InspectorsLab } from "@/editor/panels/inspectors/InspectorsLab";

export const metadata: Metadata = {
  title: "Inspectors Lab | LazyLayout Design System",
  description: "Motion mode KeyframeInspector and Code mode CodeInspector lab and parity verification",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return <InspectorsLab />;
}

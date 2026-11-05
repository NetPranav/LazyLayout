import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { LayersLab } from "@/editor/panels/layers/LayersLab";

export const metadata: Metadata = {
  title: "Layers & Pages Wiring Lab | LazyLayout Design System",
  description: "Connected Layers and Pages LeftPanel data wiring lab",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return <LayersLab />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "../labsEnabled";
import { Scene3dLab } from "@/editor/scene3d-lab/Scene3dLab";

export const metadata: Metadata = {
  title: "Scene 3D lab | LazyLayout",
};

export default function Scene3dLabPage() {
  if (!labsEnabled) notFound();
  return <Scene3dLab />;
}

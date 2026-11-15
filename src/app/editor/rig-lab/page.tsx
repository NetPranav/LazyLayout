import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "../labsEnabled";
import { RigLab } from "@/editor/rig-lab/RigLab";

export const metadata: Metadata = {
  title: "Rig lab | LazyLayout",
};

export default function RigLabPage() {
  if (!labsEnabled) notFound();
  return <RigLab />;
}

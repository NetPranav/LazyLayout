import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "../labsEnabled";
import { InteractiveLab } from "@/editor/interactive-lab/InteractiveLab";

export const metadata: Metadata = {
  title: "Interactive lab | LazyLayout",
};

export default function InteractiveLabPage() {
  if (!labsEnabled) notFound();
  return <InteractiveLab />;
}

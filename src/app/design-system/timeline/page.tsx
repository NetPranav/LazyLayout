import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { TimelineLab } from "@/editor/panels/timeline/TimelineLab";

export const metadata: Metadata = {
  title: "Timeline Lab | LazyLayout Design System",
  description: "Motion mode TimelinePanel workstation lab and parity verification",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return <TimelineLab />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { ShellTopBarLab } from "./ShellTopBarLab";

export const metadata: Metadata = {
  title: "TopBar Lab | LazyLayout",
  description: "Standalone 1440x900 verification frame for TopBar component",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return <ShellTopBarLab />;
}

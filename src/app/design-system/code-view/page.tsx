import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { CodeViewLabView } from "@/editor/panels/code-view/CodeViewLabView";

export const metadata: Metadata = {
  title: "Code View & Console Lab | LazyLayout",
  description: "Code mode bottom panel, code inspector, and compiler console lab",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return <CodeViewLabView />;
}

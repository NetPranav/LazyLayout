import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { DesignSystemPage } from "@/editor/design-system/DesignSystemPage";

export const metadata: Metadata = {
  title: "Design System | LazyLayout",
  description: "LazyLayout Design System Foundations & Components",
};

export default function Page() {
  if (!labsEnabled) {
    notFound();
  }

  return <DesignSystemPage />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "@/app/editor/labsEnabled";
import { CanvasChromeLab } from "@/editor/shell/canvas-chrome/CanvasChromeLab";
import type { AiState } from "@/editor/shell/canvas-chrome/types";

export const metadata: Metadata = {
  title: "Canvas Chrome | LazyLayout Design System",
  description: "Canvas chrome verification and lab route",
};

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ searchParams }: PageProps) {
  if (!labsEnabled) {
    notFound();
  }

  const params = searchParams ? await searchParams : {};
  const rulers = typeof params.rulers === "string" ? params.rulers : undefined;
  const insert = typeof params.insert === "string" ? params.insert : undefined;
  const ai = typeof params.ai === "string" ? params.ai : undefined;
  const view = typeof params.view === "string" ? params.view : undefined;
  const theme = typeof params.theme === "string" ? params.theme : undefined;

  const initialShowRulers =
    rulers === "on" ? true : rulers === "off" ? false : false;
  const initialInsertOpen = insert === "open";
  const initialAiBoxOpen = ai === "open" || ai === "loading";
  const initialAiLoading = ai === "loading";
  const initialAiState: AiState =
    ai === "loading" ? "work" : ai === "done" ? "done" : "idle";
  const initialViewOptionsOpen = view === "open";
  const initialTheme = theme || "paper";

  return (
    <CanvasChromeLab
      initialShowRulers={initialShowRulers}
      initialInsertOpen={initialInsertOpen}
      initialAiBoxOpen={initialAiBoxOpen}
      initialAiLoading={initialAiLoading}
      initialAiState={initialAiState}
      initialViewOptionsOpen={initialViewOptionsOpen}
      initialTheme={initialTheme}
    />
  );
}
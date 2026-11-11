/**
 * GPU lab (ROADMAP_3D 3D-002 / 3D-003): many surfaces and test scenes on one page, for the compositor's browser tests
 * (context budget, sleeping, context loss). A developer route; nothing in the editor links to it.
 * `?surfaces=20&scenes=10&budget=6`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "../labsEnabled";
import { GpuLab } from "@/editor/gpu-lab/GpuLab";

export const metadata: Metadata = { title: "GPU lab | LazyLayout" };

export default async function GpuLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!labsEnabled) notFound();
  const p = await searchParams;
  const n = (k: string, d: number) => {
    const v = Number(Array.isArray(p[k]) ? p[k]![0] : p[k]);
    return Number.isFinite(v) && v >= 0 ? Math.min(200, Math.floor(v)) : d;
  };
  return <GpuLab surfaces={n("surfaces", 20)} scenes={n("scenes", 10)} budget={n("budget", 6)} />;
}

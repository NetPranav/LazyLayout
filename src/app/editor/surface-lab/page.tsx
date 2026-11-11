/**
 * Surface lab (ROADMAP S8): the reference button scene, drawn by the real renderer at the reference video's framing
 * (720 × 720), for the side-by-side comparison. A developer route; nothing in the editor links to it.
 * `?s.<property path>=<value>` overrides one of the button's properties (to try settings without a rebuild).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labsEnabled } from "../labsEnabled";
import { SurfaceLab } from "@/editor/surface-lab/SurfaceLab";

export const metadata: Metadata = { title: "Surface lab | LazyLayout" };

export default async function SurfaceLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!labsEnabled) notFound();
  const params = await searchParams;
  const overrides: Record<string, string | number> = {};
  for (const [k, raw] of Object.entries(params)) {
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (!k.startsWith("s.") || v === undefined) continue;
    overrides[k.slice(2)] = v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v;
  }
  return <SurfaceLab overrides={overrides} />;
}

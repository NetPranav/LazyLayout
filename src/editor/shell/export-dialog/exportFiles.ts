"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useLayers } from "@/core/store/useDocumentStore";
import type { EmittedFile } from "@/core/types/compiler";
import { repoFiles } from "@/editor/panels/code-view/codeExport";
import { compiledFilesToTree, type CompiledFile } from "@/editor/panels/code-view/useCompiledFiles";
import type { FileItem } from "@/editor/shell/left-panel/types";

export interface ExportFile {
  path: string;
  name: string;
  content: string;
  bytes: number;
  language: "tsx" | "typescript" | "css" | "json" | "prisma" | "markdown";
}

function languageOf(path: string): ExportFile["language"] {
  if (/\.tsx$/.test(path)) return "tsx";
  if (/\.(ts|js|mjs)$/.test(path)) return "typescript";
  if (/\.css$/.test(path)) return "css";
  if (/\.json$/.test(path)) return "json";
  if (/\.prisma$/.test(path)) return "prisma";
  return "markdown";
}

function categoryOf(type: EmittedFile["type"]): CompiledFile["cat"] {
  if (type === "page") return "Pages";
  if (type === "component") return "Components";
  if (type === "styles") return "Styles";
  return "Config";
}

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

/** The generated repository's files, as they would go into the .zip. Re-runs when the document or the project changes. */
export function useExportFiles(active: boolean): { files: ExportFile[]; tree: FileItem[] } {
  const pages = useProjectStore((s) => s.pages);
  const elements = useLayers();
  const databaseSchemas = useProjectStore((s) => s.databaseSchemas);
  const animationSamples = useProjectStore((s) => s.animationSamples);
  const blueprintGraphs = useProjectStore((s) => s.blueprintGraphs);

  return useMemo(() => {
    void pages;
    void elements;
    void databaseSchemas;
    void animationSamples;
    void blueprintGraphs;
    if (!active) return { files: [], tree: [] };
    const emitted = repoFiles();
    const seen = new Set<string>();
    const files: ExportFile[] = [];
    const asCompiled: CompiledFile[] = [];
    for (const f of emitted) {
      if (seen.has(f.path)) continue;
      seen.add(f.path);
      const cut = f.path.lastIndexOf("/");
      const name = cut < 0 ? f.path : f.path.slice(cut + 1);
      files.push({
        path: f.path,
        name,
        content: f.content,
        bytes: encoder ? encoder.encode(f.content).length : f.content.length,
        language: languageOf(f.path),
      });
      asCompiled.push({
        id: f.path,
        name,
        dir: cut < 0 ? "" : f.path.slice(0, cut),
        path: f.path,
        content: f.content,
        lang: "ts",
        cat: categoryOf(f.type),
        type: f.type,
      });
    }
    return { files, tree: compiledFilesToTree(asCompiled) };
  }, [active, pages, elements, databaseSchemas, animationSamples, blueprintGraphs]);
}

/** Every file path under a tree item (the item itself when it is a file). */
export function filePathsUnder(item: FileItem): string[] {
  if (!item.isFolder) return [item.id];
  return (item.children ?? []).flatMap(filePathsUnder);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

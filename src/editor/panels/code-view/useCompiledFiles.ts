"use client";

import { useExportSamples } from "@/editor/panels/code-view/useExportSamples";
import { useMemo } from "react";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useLayers } from "@/core/store/useDocumentStore";
import type { EmittedFile } from "@/core/types/compiler";
import type { FileItem } from "@/editor/shell/left-panel/types";
import { compileProjectFiles } from "./LiveCodeInspector";

export type CompiledLang = "tsx" | "css" | "json" | "ts";

export interface CompiledFile {
  /** The file's path is its id (unique in the project). */
  id: string;
  name: string;
  dir: string;
  path: string;
  content: string;
  lang: CompiledLang;
  cat: "Pages" | "Components" | "Styles" | "Config";
  type: EmittedFile["type"];
}

function langOf(path: string): CompiledLang {
  if (/\.css$/.test(path)) return "css";
  if (/\.json$/.test(path)) return "json";
  if (/\.tsx$/.test(path)) return "tsx";
  return "ts";
}

function catOf(type: EmittedFile["type"]): CompiledFile["cat"] {
  if (type === "page") return "Pages";
  if (type === "component") return "Components";
  if (type === "styles") return "Styles";
  return "Config";
}

/** The real compiler output for the current document: it re-runs whenever the layers or the project change. */
export function useCompiledFiles(): { files: CompiledFile[]; durationMs: number } {
  const pages = useProjectStore((s) => s.pages);
  const elements = useLayers();
  const databaseSchemas = useProjectStore((s) => s.databaseSchemas);
  const animationSamples = useExportSamples();
  const blueprintGraphs = useProjectStore((s) => s.blueprintGraphs);

  return useMemo(() => {
    const { files, durationMs } = compileProjectFiles({ pages, elements, databaseSchemas, animationSamples, blueprintGraphs });
    const seen = new Set<string>();
    const out: CompiledFile[] = [];
    for (const f of files) {
      if (seen.has(f.path)) continue;
      seen.add(f.path);
      const cut = f.path.lastIndexOf("/");
      out.push({
        id: f.path,
        name: cut < 0 ? f.path : f.path.slice(cut + 1),
        dir: cut < 0 ? "" : f.path.slice(0, cut),
        path: f.path,
        content: f.content,
        lang: langOf(f.path),
        cat: catOf(f.type),
        type: f.type,
      });
    }
    return { files: out, durationMs };
  }, [pages, elements, databaseSchemas, animationSamples, blueprintGraphs]);
}

/** Builds the files tree (folders and files) from the compiled files. */
export function compiledFilesToTree(files: CompiledFile[]): FileItem[] {
  const roots: FileItem[] = [];
  const folders = new Map<string, FileItem>();
  for (const f of files) {
    const parts = f.dir ? f.dir.split("/") : [];
    let siblings = roots;
    let parentId: string | null = null;
    let acc = "";
    parts.forEach((part, depth) => {
      acc = acc ? `${acc}/${part}` : part;
      let folder = folders.get(acc);
      if (!folder) {
        folder = { id: `dir:${acc}`, name: part, isFolder: true, level: depth, hasChildren: true, expanded: true, parentId, children: [] };
        folders.set(acc, folder);
        siblings.push(folder);
      }
      siblings = folder.children as FileItem[];
      parentId = folder.id;
    });
    siblings.push({ id: f.id, name: f.name, isFolder: false, level: parts.length, parentId, cat: f.cat, dir: f.dir });
  }
  return roots;
}

"use client";

import { GitExporter } from "@/compiler/export/GitExporter";
import { ZipPacker } from "@/compiler/export/ZipPacker";
import type { EmittedFile } from "@/core/types/compiler";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { getDocument } from "@/core/store/useDocumentStore";
import { useCodeFilesStore } from "./codeFilesStore";
import { consoleStore } from "@/editor/panels/console/consoleStore";
import { compileProjectFiles } from "./LiveCodeInspector";

/** The compiler's output for the document as it is right now (not a React hook: for menu and toolbar actions). */
export function compileNow() {
  const project = useProjectStore.getState();
  return compileProjectFiles({
    pages: project.pages,
    elements: getDocument().layers,
    databaseSchemas: project.databaseSchemas,
    animationSamples: project.animationSamples,
    blueprintGraphs: project.blueprintGraphs,
  });
}

function bundleNow() {
  const project = useProjectStore.getState();
  return GitExporter.packageProject(
    {
      pages: project.pages,
      elements: getDocument().layers,
      databaseSchemas: project.databaseSchemas,
      blueprintGraphs: project.blueprintGraphs,
      animationSamples: project.animationSamples,
    },
    { projectName: useProjectMetaStore.getState().projectName || "lazy-layout-app" },
  );
}

/** What the generated repository holds right now: file count, size and dependencies (from its own package.json). */
export function repoSummary(): { files: number; bytes: number; deps: string[]; name: string } {
  const bundle = bundleNow();
  let deps: string[] = [];
  const pkg = bundle.getFile("package.json");
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg.content) as { dependencies?: Record<string, string> };
      deps = Object.entries(parsed.dependencies ?? {}).map(([n, v]) => `${n}@${v}`);
    } catch {
      deps = [];
    }
  }
  return { files: bundle.manifest.totalFiles, bytes: bundle.manifest.totalBytes, deps, name: bundle.manifest.projectName };
}

/** Every file of the generated repository (what the Repo .zip holds), for the Export dialog. */
export function repoFiles(): EmittedFile[] {
  return bundleNow().files;
}

/** Downloads the generated repository as a .zip: all of it, or only the files whose paths are in `include`. Returns the file name. */
export function exportRepoZip(include?: ReadonlySet<string>): string {
  const bundle = bundleNow();
  const filename = `${bundle.manifest.projectName}.zip`;
  if (!include) {
    bundle.downloadZip(filename);
    return filename;
  }
  const packer = new ZipPacker();
  for (const file of bundle.files) {
    if (include.has(file.path)) packer.addFile(file.path, file.content);
  }
  packer.download(filename);
  return filename;
}

/** Downloads one generated file: the given repo path, else the one open in the Code page, else the first. */
export function exportCurrentFile(path?: string): { name: string; ok: boolean } {
  const { files } = path ? { files: repoFiles() } : compileNow();
  const activeId = path ?? useCodeFilesStore.getState().activeFileId;
  const file = files.find((f) => f.path === activeId) ?? files[0];
  if (!file || typeof document === "undefined") return { name: "", ok: false };
  const name = file.path.split("/").pop() || "file.txt";
  const url = URL.createObjectURL(new Blob([file.content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return { name, ok: true };
}

/** The `npm install` line for the generated repository's dependencies (read from its package.json). */
export function npmInstallCommand(): string {
  const { deps } = repoSummary();
  return deps.length > 0 ? `npm install ${deps.join(" ")}` : "npm install";
}

export async function copyNpmInstall(): Promise<{ cmd: string; ok: boolean }> {
  const cmd = npmInstallCommand();
  try {
    await navigator.clipboard.writeText(cmd);
    return { cmd, ok: true };
  } catch {
    return { cmd, ok: false }; // the browser refused clipboard access
  }
}

/** Run: compiles the document now and logs the real result (file count, time, and any compiler error) to the Console. */
export function logCompileRun(): void {
  try {
    const { files, durationMs } = compileNow();
    consoleStore.appendLog("info", "compiler", `Compiling ${files.length} file${files.length === 1 ? "" : "s"}`);
    consoleStore.appendLog("info", "compiler", `Compiled in ${durationMs} ms`);
  } catch (err) {
    consoleStore.appendLog("error", "compiler", `Compile failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

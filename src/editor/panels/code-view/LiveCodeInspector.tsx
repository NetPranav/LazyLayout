"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  FileCode,
  Database,
  Copy,
  Check,
  Download,
  Search,
  Zap,
  Globe,
  Layers,
  Sparkles,
  Code,
  FolderArchive,
  X,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { useProjectStore, ProjectStoreState } from "@/core/store/useProjectStore";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { useLayers } from "@/core/store/useDocumentStore";
import type { Layer } from "@/core/document/schema";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { DiagnosticBus } from "@/core/engine/DiagnosticBus";
import type { EmittedFile } from "@/core/types/compiler";
import { ReactComponentEmitter } from "@/compiler/emitters/ReactComponentEmitter";
import { StyleEmitter } from "@/compiler/emitters/StyleEmitter";
import { GSAPAnimationEmitter } from "@/compiler/emitters/GSAPAnimationEmitter";
import { PrismaSchemaEmitter } from "@/compiler/emitters/PrismaSchemaEmitter";
import { ApiRouteEmitter } from "@/compiler/emitters/ApiRouteEmitter";
import { LogicFlowEmitter } from "@/compiler/emitters/LogicFlowEmitter";
import { GitExporter } from "@/compiler/export/GitExporter";
import { errorMessage } from "@/core/errors";
import { SyntaxHighlighter } from "./SyntaxHighlighter";
import { CODE_VIEW_TIMINGS } from "./constants";
import { openExportDialog } from "@/editor/shell/export-dialog/useExportDialogStore";
import type { LiveCodeInspectorProps } from "./types";

type FileCategory =
  | "all"
  | "component"
  | "page"
  | "styles"
  | "api"
  | "schema"
  | "logic"
  | "animation";

const CATEGORY_TABS: { id: FileCategory; label: string }[] = [
  { id: "all", label: "All Files" },
  { id: "page", label: "Pages" },
  { id: "component", label: "Components" },
  { id: "styles", label: "Styles" },
  { id: "api", label: "API" },
  { id: "schema", label: "Prisma" },
  { id: "logic", label: "Logic" },
  { id: "animation", label: "Animations" },
];

export function compileProjectFiles(project: {
  pages: ProjectStoreState["pages"];
  elements: Record<string, Layer>;
  databaseSchemas: ProjectStoreState["databaseSchemas"];
  animationSamples: ProjectStoreState["animationSamples"];
  blueprintGraphs: ProjectStoreState["blueprintGraphs"];
}): { files: EmittedFile[]; durationMs: number } {
  const { pages, elements, databaseSchemas, animationSamples, blueprintGraphs } = project;
  const t0 = performance.now();
  const files: EmittedFile[] = [];

  try {
    // 1. Pages
    for (const page of Object.values(pages)) {
      if (page.rootElementId && elements[page.rootElementId]) {
        files.push(ReactComponentEmitter.emitPage(page, elements));
      }
    }

    // 2. Standalone Key Components
    for (const el of Object.values(elements)) {
      if (el.parentId === null && el.children && el.children.length > 0) {
        files.push(ReactComponentEmitter.emitComponent(el.id, elements));
      }
    }

    // 3. Styles (Tokens + Elements)
    files.push(
      StyleEmitter.emitTokens({
        colors: {
          canvasBg: "var(--ll-surface-canvas)",
          accentPrimary: "var(--ll-control-primary-bg)",
          textPrimary: "var(--ll-text-primary)",
          borderDefault: "var(--ll-border-color)",
        },
        wires: {
          exec: "var(--ll-text-primary)",
          string: "var(--ll-text-secondary)",
          number: "var(--ll-text-secondary)",
          boolean: "var(--ll-text-muted)",
        },
      })
    );
    files.push(StyleEmitter.emitProjectStyles(elements));

    // 4. Animations
    for (const sample of Object.values(animationSamples)) {
      files.push(GSAPAnimationEmitter.emitHook(sample));
    }

    // 5. Database & Prisma
    if (Object.keys(databaseSchemas).length > 0) {
      files.push(PrismaSchemaEmitter.emitSchema(databaseSchemas));
      files.push(PrismaSchemaEmitter.emitSqlMigration(databaseSchemas));
    }

    // 6. API Routes
    for (const schema of Object.values(databaseSchemas)) {
      files.push(ApiRouteEmitter.emitCollectionRoute(schema));
      files.push(ApiRouteEmitter.emitItemRoute(schema));
    }

    // 7. Logic Flows
    for (const graph of Object.values(blueprintGraphs)) {
      files.push(LogicFlowEmitter.emitLogicFlow(graph));
    }
  } catch (err) {
    DiagnosticBus.emit({
      channel: "CODEGEN_INTEGRITY_ERR",
      severity: "error",
      source: {
        panel: "Panel 16: Live Code Inspector",
        entityId: "compiler_engine",
      },
      message: `Failed to compile visual project AST: ${errorMessage(err)}`,
      suggestion: "Verify that all root elements, variables, and database schemas are properly defined.",
      isFixable: false,
    });
  }

  // Fallback if no files emitted
  if (files.length === 0) {
    files.push({
      path: "app/page.tsx",
      content: `export default function Page() {\n  return (\n    <main className="hero">\n      <h1>Design it once. Ship it lazily.</h1>\n    </main>\n  );\n}`,
      language: "typescript",
      type: "page",
    });
  }

  return { files, durationMs: Math.max(1, Math.round(performance.now() - t0)) };
}

function resolveFileIcon(type: string): React.ReactNode {
  switch (type) {
    case "page":
      return <Icon icon={Globe} size={13} className="ll:text-primary" />;
    case "component":
      return <Icon icon={Code} size={13} className="ll:text-primary" />;
    case "styles":
      return <Icon icon={Layers} size={13} className="ll:text-secondary" />;
    case "schema":
      return <Icon icon={Database} size={13} className="ll:text-secondary" />;
    case "api":
      return <Icon icon={Zap} size={13} className="ll:text-primary" />;
    case "animation":
      return <Icon icon={Sparkles} size={13} className="ll:text-secondary" />;
    default:
      return <Icon icon={FileCode} size={13} className="ll:text-muted" />;
  }
}

export const LiveCodeInspector: React.FC<LiveCodeInspectorProps> = ({
  className = "",
  style,
  files: propFiles,
  selectedFilePath: propSelectedPath,
  onSelectFilePath,
}) => {
  const pages = useProjectStore((s) => s.pages);
  const elements = useLayers();
  const databaseSchemas = useProjectStore((s) => s.databaseSchemas);
  const animationSamples = useProjectStore((s) => s.animationSamples);
  const blueprintGraphs = useProjectStore((s) => s.blueprintGraphs);
  const projectName = useProjectMetaStore((s) => s.projectName);
  const _selectedElementId = useSelectionStore((s) => s.selectedId);
  const selectElement = useSelectionStore((s) => s.select);

  const [internalSelectedPath, setInternalSelectedPath] = useState("app/page.tsx");
  const [activeCategory, setActiveCategory] = useState<FileCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [highlightedLineIndex, setHighlightedLineIndex] = useState<number | null>(null);

  const selectedFilePath = propSelectedPath ?? internalSelectedPath;

  const { files: compiledFiles, durationMs } = useMemo(() => {
    if (propFiles) {
      return { files: propFiles, durationMs: 1 };
    }
    return compileProjectFiles({
      pages,
      elements,
      databaseSchemas,
      animationSamples,
      blueprintGraphs,
    });
  }, [propFiles, pages, elements, databaseSchemas, animationSamples, blueprintGraphs]);

  const filteredFiles = useMemo(() => {
    return compiledFiles.filter((f) => {
      if (activeCategory !== "all" && f.type !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return f.path.toLowerCase().includes(q) || f.language.toLowerCase().includes(q);
      }
      return true;
    });
  }, [compiledFiles, activeCategory, searchQuery]);

  const activeFile = useMemo(() => {
    return (
      compiledFiles.find((f) => f.path === selectedFilePath) ||
      filteredFiles[0] ||
      compiledFiles[0] ||
      null
    );
  }, [compiledFiles, selectedFilePath, filteredFiles]);

  const handleSelectPath = (path: string) => {
    if (onSelectFilePath) {
      onSelectFilePath(path);
    } else {
      setInternalSelectedPath(path);
    }
  };

  const handleCopyCode = useCallback(() => {
    if (!activeFile) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(activeFile.content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), CODE_VIEW_TIMINGS.copyFeedbackMs);
  }, [activeFile]);

  const handleDownloadFile = useCallback(() => {
    if (!activeFile || typeof window === "undefined") return;
    const blob = new Blob([activeFile.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = activeFile.path.split("/").pop() || "file.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [activeFile]);

  const handleExportRepoZip = useCallback(() => {
    try {
      setIsExporting(true);
      const bundle = GitExporter.packageProject(
        {
          pages,
          elements,
          databaseSchemas,
          blueprintGraphs,
          animationSamples,
        },
        {
          projectName: projectName || "lazy-layout-app",
        }
      );
      bundle.downloadZip();
      setTimeout(() => setIsExporting(false), CODE_VIEW_TIMINGS.downloadFeedbackMs);
    } catch (err) {
      setIsExporting(false);
      DiagnosticBus.emit({
        channel: "CODEGEN_INTEGRITY_ERR",
        severity: "error",
        source: {
          panel: "Panel 16: Live Code Inspector",
          entityId: "git_exporter",
        },
        message: `Failed to package Git repository: ${errorMessage(err)}`,
      });
    }
  }, [pages, elements, databaseSchemas, blueprintGraphs, animationSamples, projectName]);

  const handleLineClick = useCallback(
    (lineIdx: number, lineText: string) => {
      setHighlightedLineIndex(lineIdx);
      for (const el of Object.values(elements)) {
        const shortId = el.id.replace(/^el_/, "");
        if (lineText.includes(shortId) || (el.name && lineText.includes(el.name))) {
          selectElement(el.id, "element");
          break;
        }
      }
    },
    [elements, selectElement]
  );

  return (
    <div
      role="region"
      aria-label="Live Code Inspector"
      className={`ll:flex ll:flex-col ll:w-full ll:h-full ll:min-w-0 ll:bg-surface-panel ll:border ll:border-border ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* Top Header Bar */}
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:px-3 ll:h-11 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:select-none">
        <div className="ll:flex ll:items-center ll:gap-2">
          <Icon icon={Code} size={15} className="ll:text-primary" />
          <span className="ll:font-sans ll:text-small ll:font-semibold ll:text-primary">
            Live Code Inspector
          </span>
          <span className="ll:font-mono ll:text-nano ll:text-muted ll:bg-surface-bar ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:border ll:border-border">
            Compiled in {durationMs}ms
          </span>
        </div>

        <div className="ll:flex ll:items-center ll:gap-1.5 ll:shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyCode}
            leftIcon={<Icon icon={copied ? Check : Copy} size={14} />}
          >
            {copied ? "Copied" : "Copy Code"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => openExportDialog(e.currentTarget)}
          >
            Export…
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownloadFile}
            leftIcon={<Icon icon={Download} size={14} />}
          >
            Export File
          </Button>

          <Button
            size="sm"
            variant="primary"
            loading={isExporting}
            onClick={handleExportRepoZip}
            leftIcon={<Icon icon={FolderArchive} size={14} />}
          >
            Export Repo (.zip)
          </Button>
        </div>
      </div>

      {/* Category Tabs Strip */}
      <div
        role="tablist"
        aria-label="File categories"
        className="ll:flex ll:items-center ll:gap-1 ll:px-3 ll:h-8 ll:border-b ll:border-border ll:bg-surface-bar ll:shrink-0 ll:select-none ll:overflow-x-auto"
      >
        {CATEGORY_TABS.map((tab) => {
          const count =
            tab.id === "all"
              ? compiledFiles.length
              : compiledFiles.filter((f) => f.type === tab.id).length;
          const isSelected = activeCategory === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveCategory(tab.id)}
              className={`ll:inline-flex ll:items-center ll:gap-1.5 ll:px-2 ll:h-6 ll:text-small ll:rounded-sm ll:transition-colors ll:duration-75 ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
                isSelected
                  ? "ll:bg-surface-raised ll:text-primary ll:font-semibold ll:border ll:border-border"
                  : "ll:bg-transparent ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
              }`}
            >
              <span>{tab.label}</span>
              <span className="ll:font-mono ll:text-nano ll:opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Main Split Body: File List (Left) + Code Viewer (Right) */}
      <div className="ll:flex ll:flex-1 ll:min-h-0 ll:overflow-hidden">
        {/* Left File List */}
        <div className="ll:w-60 ll:border-r ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:shrink-0 ll:min-h-0 ll:select-none">
          {/* Search Bar */}
          <div className="ll:p-2 ll:border-b ll:border-border">
            <div className="ll:relative ll:inline-flex ll:items-center ll:box-border ll:rounded-sm ll:border ll:border-border ll:bg-surface-panel ll:h-7 ll:px-2 ll:w-full ll:focus-within:border-primary">
              <Icon icon={Search} size={12} className="ll:text-muted ll:mr-1.5" />
              <input
                type="text"
                placeholder="Search files..."
                aria-label="Search files"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ll:w-full ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-small ll:font-sans ll:text-primary ll:placeholder:text-muted"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="ll:border-0 ll:bg-transparent ll:p-0 ll:cursor-pointer ll:text-muted ll:hover:text-primary"
                >
                  <Icon icon={X} size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Files List */}
          <div
            role="listbox"
            aria-label="Compiled files"
            className="ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:p-1.5 ll:flex ll:flex-col ll:gap-0.5"
          >
            {filteredFiles.map((file) => {
              const isSelected = activeFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectPath(file.path)}
                  className={`ll:flex ll:items-center ll:gap-2 ll:px-2 ll:h-7 ll:rounded-sm ll:text-small ll:font-mono ll:text-left ll:box-border ll:cursor-pointer ll:transition-colors ll:duration-75 ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
                    isSelected
                      ? "ll:bg-select-bg ll:text-select-fg ll:font-semibold ll:border ll:border-border"
                      : "ll:bg-transparent ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
                  }`}
                >
                  {resolveFileIcon(file.type)}
                  <span className="ll:truncate ll:flex-1">{file.path}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Code Viewer */}
        <div className="ll:flex-1 ll:flex ll:flex-col ll:min-w-0 ll:overflow-hidden ll:bg-surface-canvas">
          {activeFile && (
            <div className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:px-3 ll:h-8 ll:border-b ll:border-border ll:bg-surface-panel ll:font-mono ll:text-micro ll:text-secondary ll:shrink-0 ll:select-none">
              <div className="ll:flex ll:items-center ll:gap-2 ll:truncate">
                {resolveFileIcon(activeFile.type)}
                <span className="ll:font-medium ll:text-primary ll:truncate">
                  {activeFile.path}
                </span>
                <span className="ll:bg-surface-bar ll:border ll:border-border ll:text-muted ll:px-1 ll:py-0.25 ll:rounded-xs ll:uppercase ll:text-nano">
                  {activeFile.language}
                </span>
              </div>
              <div className="ll:flex ll:items-center ll:gap-3 ll:text-muted ll:shrink-0">
                <span>{activeFile.content.split("\n").length} lines</span>
                <span>{(activeFile.content.length / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          )}

          <div className="ll:flex-1 ll:min-h-0 ll:overflow-hidden ll:relative">
            {activeFile ? (
              <SyntaxHighlighter
                code={activeFile.content}
                language={activeFile.language}
                highlightedLine={highlightedLineIndex}
                onLineClick={handleLineClick}
                className="ll:h-full ll:w-full"
              />
            ) : (
              <div className="ll:flex ll:items-center ll:justify-center ll:h-full ll:text-muted ll:text-small">
                Select a file to inspect.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

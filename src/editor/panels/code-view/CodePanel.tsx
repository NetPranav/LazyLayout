"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  FileCode,
  Zap,
  Layers,
  FileText,
  Lock,
  Copy,
  Download,
  Maximize2,
  WrapText,
  MoreHorizontal,
  Check,
  X,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { useLayers } from "@/core/store/useDocumentStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { ZipPacker } from "@/compiler/export/ZipPacker";
import { SyntaxHighlighter } from "./SyntaxHighlighter";
import { ConsoleView } from "./ConsoleView";
import { TraceView } from "./TraceView";
import {
  cxGen,
  cxFiles,
  cxDiff,
  fName,
  fPath,
  fLang,
  fIcon,
  FILE_OF,
  DEFAULT_CODE_STATE,
  DEFAULT_DATA,
  DEFAULT_TYPE,
  DEFAULT_TXT,
  type CodeGeneratorState,
  type LayerModel,
  type TextModel,
} from "./codeGenerator";
import type { CodePanelProps, CodeTab, CodeFileTab } from "./types";

const VIEWS: Array<[CodeTab, string]> = [
  ["code", "Code"],
  ["console", "Console"],
  ["trace", "Trace"],
];

const CXT: Record<string, string> = {
  headline: "#el-text > b, [data-layer-id='headline'], [data-layer-id='el_headline']",
  subtitle: "#el-text .pg-sub, [data-layer-id='subtitle'], [data-layer-id='el_subtitle']",
  button: "#el-button, [data-layer-id='button'], [data-layer-id='el_button']",
  image: "#el-image, [data-layer-id='image'], [data-layer-id='el_image']",
  hero: "#artboard, [data-layer-id='hero'], [data-layer-id='el_hero']",
};

export const CodePanel: React.FC<CodePanelProps> = ({
  activeTab: controlledTab,
  onTabChange,
  activeFileId: controlledFileId,
  onSelectFile,
  files: propFiles,
  code: propCode,
  fileName: propFileName,
  highlightedLine: propHighlightedLine,
  onLineClick,
  onCopy,
  onExport,
  className = "",
  style,
}) => {
  // Tabs: Code / Console / Trace
  const [internalTab, setInternalTab] = useState<CodeTab>("code");
  const activeTab = controlledTab ?? internalTab;

  const handleTabSwitch = (t: CodeTab) => {
    if (onTabChange) onTabChange(t);
    else setInternalTab(t);
  };

  // Generator & Files state
  const [codeState] = useState<CodeGeneratorState>(DEFAULT_CODE_STATE);
  const [openTabs, setOpenTabs] = useState<string[]>(["hero", "features", "footer", "home"]);
  const [internalActiveFile, setInternalActiveFile] = useState<string>("hero");
  const [wrap, setWrap] = useState<boolean>(true);
  const [folds, setFolds] = useState<Record<number, boolean>>({});
  const [stickyScope, setStickyScope] = useState<{ label: string; line: number } | null>(null);
  const [curLine, setCurLine] = useState<number>(0);
  const [curCol, setCurCol] = useState<number>(0);
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [changedRanges, setChangedRanges] = useState<Record<number, [number, number]> | null>(null);
  const [errorCount] = useState<number>(2); // Console error count badge
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);

  const activeFileId = controlledFileId ?? internalActiveFile;

  // Real store connections
  const elements = useLayers();
  const selectedElementId = useSelectionStore((s) => s.selectedId);
  const selectElement = useSelectionStore((s) => s.select);
  const _activePageId = useProjectStore((s) => s.activePageId);

  // Derive model data from document store layers if present
  const dataModel = useMemo<Record<string, LayerModel>>(() => {
    const d = { ...DEFAULT_DATA };
    if (!elements || Object.keys(elements).length === 0) return d;
    for (const [id, el] of Object.entries(elements)) {
      const shortId = id.replace(/^el_/, "");
      if (d[shortId]) {
        const p = (el.properties || {}) as Record<string, any>;
        d[shortId] = {
          ...d[shortId],
          w: typeof p["frame.width"] === "number" ? p["frame.width"] : d[shortId].w,
          h: typeof p["frame.height"] === "number" ? p["frame.height"] : d[shortId].h,
          rad: typeof p["style.borderRadius"] === "number" ? p["style.borderRadius"] : d[shortId].rad,
          op: typeof p["style.opacity"] === "number" ? Math.round(p["style.opacity"] * 100) : d[shortId].op,
          fill: typeof p["style.fill"] === "string" ? String(p["style.fill"]).replace(/^#/, "") : d[shortId].fill,
        };
      }
    }
    return d;
  }, [elements]);

  const typeModel = useMemo<Record<string, TextModel>>(() => {
    const t = { ...DEFAULT_TYPE };
    if (!elements || Object.keys(elements).length === 0) return t;
    for (const [id, el] of Object.entries(elements)) {
      const shortId = id.replace(/^el_/, "");
      if (t[shortId]) {
        const p = (el.properties || {}) as Record<string, any>;
        t[shortId] = {
          ...t[shortId],
          size: typeof p["text.fontSize"] === "number" ? p["text.fontSize"] : t[shortId].size,
          weight: typeof p["text.fontWeight"] === "number" ? p["text.fontWeight"] : t[shortId].weight,
        };
      }
    }
    return t;
  }, [elements]);

  const txtModel = useMemo<Record<string, string>>(() => {
    const x = { ...DEFAULT_TXT };
    if (!elements || Object.keys(elements).length === 0) return x;
    for (const [id, el] of Object.entries(elements)) {
      const shortId = id.replace(/^el_/, "");
      if (x[shortId]) {
        const p = (el.properties || {}) as Record<string, any>;
        if (typeof p["text.content"] === "string") {
          x[shortId] = p["text.content"];
        }
      }
    }
    return x;
  }, [elements]);

  // Generate current file output
  const generatedFile = useMemo(() => {
    return cxGen(activeFileId, codeState, dataModel, typeModel, txtModel);
  }, [activeFileId, codeState, dataModel, typeModel, txtModel]);

  // Track previous text for diff flash
  const prevTextRef = useRef<string>(generatedFile.text);
  useEffect(() => {
    if (prevTextRef.current && prevTextRef.current !== generatedFile.text) {
      const oldLines = prevTextRef.current.split("\n");
      const newLines = generatedFile.text.split("\n");
      const diff = cxDiff(oldLines, newLines);
      if (diff.n > 0 && diff.n <= 24) {
        setChangedRanges(diff.m);
        const timer = setTimeout(() => setChangedRanges(null), 1300);
        return () => clearTimeout(timer);
      }
    }
    prevTextRef.current = generatedFile.text;
  }, [generatedFile.text]);

  // Active file display properties
  const displayCode = propCode ?? generatedFile.text;
  const displayLines = useMemo(() => {
    if (propCode) {
      return propCode.split("\n").map((t) => ({ t }));
    }
    return generatedFile.lines;
  }, [propCode, generatedFile.lines]);

  const displayFileName = propFileName ?? fName(activeFileId, codeState);
  const displayFilePath = fPath(activeFileId, codeState);

  // Sync canvas selection to code file and lines
  useEffect(() => {
    if (!selectedElementId) return;
    const short = selectedElementId.replace(/^el_/, "");
    const targetFile = FILE_OF[short];
    if (targetFile) {
      if (!openTabs.includes(targetFile)) {
        setOpenTabs((prev) => [...prev, targetFile]);
      }
      if (onSelectFile) {
        onSelectFile(targetFile);
      } else {
        setInternalActiveFile(targetFile);
      }
      const range = generatedFile.rg[short];
      if (range) {
        setCurLine(range[0]);
      }
    }
  }, [selectedElementId, openTabs, onSelectFile, generatedFile.rg]);

  // Outline element on canvas during line hover
  const handleLineHover = useCallback((ref: string | null) => {
    if (typeof document === "undefined") return;
    document.querySelectorAll(".ll-cxo").forEach((el) => el.classList.remove("ll-cxo"));
    if (!ref) return;
    const sel = CXT[ref];
    if (sel) {
      const target = document.querySelector(sel);
      if (target) {
        target.classList.add("ll-cxo");
      }
    }
  }, []);

  // Handle line click
  const handleLineClick = useCallback(
    (lineIdx: number, lineText: string, ref?: string | null) => {
      setCurLine(lineIdx);
      setCurCol(0);
      onLineClick?.(lineIdx, lineText);

      if (ref && selectElement) {
        selectElement(ref, "element");
      }
    },
    [onLineClick, selectElement]
  );

  const handleOpenTab = (fileId: string) => {
    if (!openTabs.includes(fileId)) {
      setOpenTabs((prev) => [...prev, fileId]);
    }
    if (onSelectFile) {
      onSelectFile(fileId);
    } else {
      setInternalActiveFile(fileId);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    const nextTabs = openTabs.filter((t) => t !== fileId);
    setOpenTabs(nextTabs);
    if (activeFileId === fileId) {
      const fallback = nextTabs[0] || "hero";
      if (onSelectFile) onSelectFile(fallback);
      else setInternalActiveFile(fallback);
    }
  };

  const handleCopyCurrentFile = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(displayCode);
    }
    onCopy?.(displayCode);
  };

  const handleDownloadFile = () => {
    if (onExport) {
      onExport(displayFileName, displayCode);
    } else {
      const blob = new Blob([displayCode], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = displayFileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportZip = () => {
    const packer = new ZipPacker();
    if (propFiles) {
      propFiles.forEach((f) => packer.addFile(f.name, f.content));
    } else {
      cxFiles(codeState).forEach((f) => {
        const gen = cxGen(f.id, codeState, dataModel, typeModel, txtModel);
        packer.addFile(fName(f.id, codeState), gen.text);
      });
    }
    packer.download("my-project.zip");
  };

  const handleFormat = () => {
    setIsFormatting(true);
    setTimeout(() => setIsFormatting(false), 480);
  };

  const toggleFold = (lineIdx: number) => {
    setFolds((prev) => ({
      ...prev,
      [lineIdx]: !prev[lineIdx],
    }));
  };

  const foldAll = (fold: boolean) => {
    if (!fold) {
      setFolds({});
      return;
    }
    const next: Record<number, boolean> = {};
    displayLines.forEach((_, idx) => {
      next[idx] = true;
    });
    setFolds(next);
  };

  const highlightedRanges = useMemo(() => {
    if (selectedElementId) {
      const short = selectedElementId.replace(/^el_/, "");
      const r = generatedFile.rg[short];
      if (r) return [r];
    }
    return [];
  }, [selectedElementId, generatedFile.rg]);

  const layerCount = Object.keys(generatedFile.rg).length;
  const genSourceLabel =
    activeFileId === "css"
      ? "Generated from the theme"
      : activeFileId === "pkg"
      ? "Generated from the project"
      : `Generated from ${layerCount} layer${layerCount === 1 ? "" : "s"}`;

  const langLabelMap: Record<string, string> = {
    tsx: codeState.ts ? "TypeScript React" : "JavaScript React",
    vue: "Vue",
    html: "HTML",
    css: "CSS",
    json: "JSON",
  };
  const activeLangLabel = langLabelMap[fLang(activeFileId, codeState)] || "TypeScript React";
  const fileSizeKB = (new Blob([displayCode]).size / 1024).toFixed(1);

  return (
    <section
      id="bottom"
      role="region"
      aria-label="Bottom panel"
      className={`ll-bottom ll:flex ll:flex-col ll:w-full ll:h-full ll:min-w-0 ll:bg-surface-panel ll:border-t ll:border-border ll:overflow-hidden ${
        isFullWidth ? "ll:fixed ll:inset-x-0 ll:bottom-0 ll:z-50 ll:h-code-full" : ""
      } ${className}`}
      style={style}
    >
      {/* Resizer Handle matching prototype .bsplit */}
      <div
        id="bsplit"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize panel"
        title="Drag to resize, double click to reset"
        className="ll-bsplit ll:h-1 ll:w-full ll:bg-transparent ll:hover:bg-border ll:cursor-row-resize ll:shrink-0 ll:transition-colors"
      />

      {/* 1. Header Toolbar (44px, matching prototype .ph.cxh) */}
      <div
        id="chead"
        role="toolbar"
        aria-label="Code header"
        className="ll-ph ll-cxh ll:h-11 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:pl-3 ll:pr-2 ll:border-b ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:select-none"
      >
        {/* Playful Segmented Control for Code / Console / Trace (32px high, matching prototype .pseg.cvseg) */}
        <div
          id="cvseg"
          role="tablist"
          aria-label="Bottom panel"
          className="ll-pseg ll-cvseg ll:flex ll:items-center ll:gap-0.5 ll:h-8 ll:p-0.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:shrink-0"
        >
          {VIEWS.map(([viewKey, viewLabel]) => {
            const isSelected = activeTab === viewKey;
            return (
              <button
                key={viewKey}
                role="tab"
                data-v={viewKey}
                aria-pressed={isSelected}
                aria-selected={isSelected}
                onClick={() => handleTabSwitch(viewKey)}
                className={`ll:relative ll:h-7 ll:px-3 ll:rounded-xs ll:font-sans ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ll:transition-colors ll:flex ll:items-center ll:gap-1.5 ${
                  isSelected
                    ? "ll:bg-control-active ll:text-primary"
                    : "ll:bg-transparent ll:text-muted ll:hover:text-primary"
                }`}
              >
                <span>{viewLabel}</span>
                {viewKey === "console" && errorCount > 0 && (
                  <span
                    id="cbadge"
                    className="ll-cbadge ll:font-mono ll:text-micro ll:leading-none ll:min-w-4 ll:h-4 ll:px-1 ll:flex ll:items-center ll:justify-center ll:border ll:border-primary ll:text-primary ll:rounded-xs"
                  >
                    {errorCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Separator between mode switch and file tabs */}
        {activeTab === "code" && (
          <i className="ll-tdiv ll:w-px ll:h-4 ll:bg-border ll:mx-1 ll:shrink-0" aria-hidden="true" />
        )}

        {/* Middle: Open File Tabs strip (.ctabs in prototype) */}
        {activeTab === "code" ? (
          <div
            role="tablist"
            aria-label="Open files"
            className="ll-ctabs ll:flex-1 ll:min-w-0 ll:flex ll:items-stretch ll:h-full ll:overflow-x-auto ll:gap-1"
          >
            {openTabs.map((tabId) => {
              const isSelected = activeFileId === tabId;
              const fileNameStr = fName(tabId, codeState);
              const fileIconKey = fIcon(tabId, codeState);

              return (
                <div
                  key={tabId}
                  role="tab"
                  tabIndex={0}
                  data-tab={tabId}
                  aria-selected={isSelected}
                  onClick={() => handleOpenTab(tabId)}
                  title={fPath(tabId, codeState)}
                  className={`ll-ctab ll:group ll:relative ll:flex ll:items-center ll:gap-1.5 ll:shrink-0 ll:h-full ll:px-3 ll:font-sans ll:text-small ll:font-medium ll:cursor-pointer ll:select-none ll:transition-colors ${
                    isSelected
                      ? "ll:text-primary ll:after:absolute ll:after:left-0 ll:after:right-0 ll:after:bottom-0 ll:after:h-0.5 ll:after:bg-primary"
                      : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
                  }`}
                >
                  <Icon
                    icon={
                      fileIconKey === "fcss"
                        ? Layers
                        : fileIconKey === "fjson"
                        ? FileText
                        : fileIconKey === "fvue"
                        ? Zap
                        : FileCode
                    }
                    size={14}
                    className="ll:shrink-0"
                  />
                  <span className="ll:whitespace-nowrap">{fileNameStr}</span>

                  {/* Close tab button */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Close ${fileNameStr}`}
                    title="Close"
                    onClick={(e) => handleCloseTab(e, tabId)}
                    className="ll-cx ll:w-4 ll:h-4 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:opacity-0 ll:group-hover:opacity-100 ll:hover:bg-surface-bar ll:hover:text-primary ll:border-0 ll:bg-transparent ll:cursor-pointer ll:p-0"
                  >
                    <Icon icon={X} size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ll:flex-1" />
        )}

        {/* Right Tools (.chr in prototype) */}
        <div className="ll-chr ll:flex ll:items-center ll:gap-1 ll:shrink-0">
          {activeTab === "code" && (
            <>
              {/* Word wrap toggle */}
              <button
                type="button"
                data-ca="wrap"
                aria-pressed={wrap}
                aria-label="Word wrap"
                title="Word wrap"
                onClick={() => setWrap((prev) => !prev)}
                className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:border-0 ll:cursor-pointer ll:transition-colors ${
                  wrap
                    ? "ll:bg-control-active ll:text-primary"
                    : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar"
                }`}
              >
                <Icon icon={WrapText} size={14} />
              </button>

              {/* Copy file button */}
              <button
                type="button"
                data-ca="copy"
                aria-label="Copy file"
                title="Copy file"
                onClick={handleCopyCurrentFile}
                className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
              >
                <Icon icon={Copy} size={14} />
              </button>

              {/* Download file button */}
              <button
                type="button"
                data-ca="dl"
                aria-label="Download file"
                title="Download file"
                onClick={handleDownloadFile}
                className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
              >
                <Icon icon={Download} size={14} />
              </button>

              <i className="ll-tdiv ll:w-px ll:h-4 ll:bg-border ll:mx-1 ll:shrink-0" aria-hidden="true" />
            </>
          )}

          {/* Full-width toggle */}
          <button
            type="button"
            id="tfw"
            data-ca="fw"
            aria-pressed={isFullWidth}
            aria-label="Full width (Shift+T)"
            title="Full width (Shift+T)"
            onClick={() => setIsFullWidth((prev) => !prev)}
            className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:border-0 ll:cursor-pointer ll:transition-colors ${
              isFullWidth
                ? "ll:bg-control-active ll:text-primary"
                : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar"
            }`}
          >
            <Icon icon={Maximize2} size={14} />
          </button>

          {/* More options menu */}
          <button
            type="button"
            id="cmore"
            data-ca="more"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-label="More code options"
            title="More"
            onClick={handleExportZip}
            className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
          >
            <Icon icon={MoreHorizontal} size={14} />
          </button>
        </div>
      </div>

      {/* 2. Body Area (.cbody in prototype) */}
      <div className="ll-cbody ll:flex-1 ll:min-h-0 ll:flex ll:flex-col ll:relative ll:bg-surface-panel ll:overflow-hidden">
        {activeTab === "console" ? (
          <ConsoleView
            onJumpToFile={(f, ln) => {
              handleOpenTab(f);
              handleTabSwitch("code");
              setCurLine(ln);
            }}
          />
        ) : activeTab === "trace" ? (
          <TraceView />
        ) : (
          <div className="ll-cpane ll:flex-1 ll:min-h-0 ll:flex ll:flex-col ll:relative ll:overflow-hidden">
            {/* Sub-header (.csub in prototype: height 28px, 11px mono, muted) */}
            <div className="ll-csub ll:h-7 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:px-4 ll:border-b ll:border-border ll:font-mono ll:text-micro ll:text-muted ll:select-none">
              <span className="ll-cpath ll:truncate" title={displayFilePath}>
                {displayFilePath.includes("/") ? `${displayFilePath.split("/").slice(0, -1).join(" / ")} / ` : ""}
                <b className="ll:font-medium ll:text-primary">{displayFileName}</b>
              </span>
              <div className="ll:flex-1" />
              <span className="ll-clock ll:flex ll:items-center ll:gap-1.5 ll:shrink-0 ll:whitespace-nowrap" title="Read only">
                <Icon icon={Lock} size={12} className="ll:text-muted" />
                <span>Edit on the canvas. Code updates live</span>
              </span>
            </div>

            {/* Sticky Scope Header (.cstick in prototype: height 24px, 11px mono) */}
            <button
              type="button"
              aria-label="Scroll to the start of this scope"
              onClick={() => {
                if (stickyScope) {
                  setCurLine(stickyScope.line);
                }
              }}
              className="ll-cstick ll:h-6 ll:shrink-0 ll:flex ll:items-center ll:justify-between ll:px-4 ll:bg-surface-panel ll:border-b ll:border-border ll:font-mono ll:text-micro ll:text-secondary ll:hover:text-primary ll:text-left ll:border-0 ll:cursor-pointer"
            >
              <span className="ll-csk ll:truncate">
                {stickyScope ? stickyScope.label : "Top level"}
              </span>
              {stickyScope && (
                <span className="ll-csl ll:text-muted ll:ml-auto">
                  Line {stickyScope.line + 1}
                </span>
              )}
            </button>

            {/* Code Editor Body (.cedit / .cscroll) */}
            <div className="ll-cedit ll:flex-1 ll:min-h-0 ll:relative ll:overflow-hidden">
              <SyntaxHighlighter
                lines={displayLines}
                language={fLang(activeFileId, codeState)}
                highlightedLine={propHighlightedLine ?? curLine}
                highlightedRanges={highlightedRanges}
                changedLines={changedRanges}
                wrap={wrap}
                folds={folds}
                onToggleFold={toggleFold}
                onLineClick={handleLineClick}
                onLineHover={handleLineHover}
                onStickyScopeChange={setStickyScope}
                className="ll:h-full ll:w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer Area (.tlf.cft in prototype: height 28px, 11px mono, muted) */}
      <div
        id="cfoot"
        className="ll-tlf ll-cft ll:h-7 ll:shrink-0 ll:flex ll:items-center ll:gap-4 ll:px-4 ll:border-t ll:border-border ll:bg-surface-panel ll:font-mono ll:text-micro ll:text-muted ll:select-none"
      >
        {activeTab === "code" ? (
          <>
            <span className="ll-tfb">{activeLangLabel}</span>
            <span className="ll-tfb" id="cpos">
              Ln {curLine + 1}, Col {curCol + 1}
            </span>
            <span className="ll-tfb">UTF-8</span>
            <span className="ll-tfb">
              {displayLines.length} lines · {fileSizeKB} KB
            </span>

            <div className="ll:flex-1" />

            <span className="ll-tfb">{genSourceLabel}</span>

            {/* Formatted status button */}
            <button
              type="button"
              onClick={handleFormat}
              className="ll-tfb ll-cfmt ll:flex ll:items-center ll:gap-1.5 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:cursor-pointer"
            >
              <Icon icon={Check} size={12} className="ll:text-primary" />
              <span>{isFormatting ? "Formatting..." : "Formatted"}</span>
            </button>
          </>
        ) : activeTab === "console" ? (
          <>
            <span className="ll-tfb">2 errors</span>
            <span className="ll-tfb">3 warnings</span>
            <span className="ll-tfb">12 messages</span>
            <div className="ll:flex-1" />
            <span className="ll-tfb">Type help for commands</span>
          </>
        ) : (
          <>
            <span className="ll-tfb">onClick Get started</span>
            <span className="ll-tfb">Step 5 of 9 · 151.4 ms</span>
            <div className="ll:flex-1" />
            <span className="ll-tfb">9 steps · 218.8 ms</span>
          </>
        )}
      </div>
    </section>
  );
};

export default CodePanel;

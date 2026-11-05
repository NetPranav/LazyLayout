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
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { ZipPacker } from "@/compiler/export/ZipPacker";
import { useMotionModel, motionActions } from "@/editor/motion-model";
import { SyntaxHighlighter } from "./SyntaxHighlighter";
import { useCodeModels } from "./useCodeModels";
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
  type CodeGeneratorState,
} from "./codeGenerator";
import type { CodePanelProps, CodeTab } from "./types";

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

const TFB =
  "ll-tfb ll:h-6 ll:px-1.5 ll:rounded-sm ll:flex ll:items-center ll:gap-1 ll:shrink-0 ll:whitespace-nowrap ll:font-mono ll:text-micro ll:font-medium ll:text-muted";

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
  const [openTabs, setOpenTabs] = useState<string[]>(["hero"]);
  const [internalActiveFile, setInternalActiveFile] = useState<string>("hero");
  const [wrap, setWrap] = useState<boolean>(true);
  const [folds, setFolds] = useState<Record<number, boolean>>({});
  const [stickyScope, setStickyScope] = useState<{ label: string; line: number } | null>(null);
  const [curLine, setCurLine] = useState<number>(0);
  const [curCol, setCurCol] = useState<number>(0);
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [changedRanges, setChangedRanges] = useState<Record<number, [number, number]> | null>(null);
  const [errorCount] = useState<number>(2); // Console error count badge
  const isFullWidth = useMotionModel((s) => s.fullWidth);

  const activeFileId = controlledFileId ?? internalActiveFile;

  // Real store connections
  const selectedElementId = useSelectionStore((s) => s.selectedId);
  const selectElement = useSelectionStore((s) => s.select);
  const _activePageId = useProjectStore((s) => s.activePageId);

  const { data: dataModel, type: typeModel, txt: txtModel } = useCodeModels();

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

  // Open the tab, active file and line of the selected canvas element (adjusted during render)
  const selectedShort = selectedElementId ? selectedElementId.replace(/^el_/, "") : null;
  const selectedTargetFile = selectedShort ? FILE_OF[selectedShort] : undefined;
  if (selectedTargetFile && !openTabs.includes(selectedTargetFile)) {
    setOpenTabs((prev) => [...prev, selectedTargetFile]);
  }
  const [selSync, setSelSync] = useState<{
    id: string | null;
    tabs: string[];
    cb: typeof onSelectFile;
    rg: typeof generatedFile.rg;
  } | null>(null);
  if (
    selectedTargetFile &&
    selectedShort &&
    (!selSync ||
      selSync.id !== selectedElementId ||
      selSync.tabs !== openTabs ||
      selSync.cb !== onSelectFile ||
      selSync.rg !== generatedFile.rg)
  ) {
    setSelSync({ id: selectedElementId, tabs: openTabs, cb: onSelectFile, rg: generatedFile.rg });
    if (!onSelectFile) setInternalActiveFile(selectedTargetFile);
    const range = generatedFile.rg[selectedShort];
    if (range) setCurLine(range[0]);
  }

  // Notify the controlling parent of the file for the selected canvas element
  useEffect(() => {
    if (selectedTargetFile && onSelectFile) onSelectFile(selectedTargetFile);
  }, [selectedElementId, openTabs, onSelectFile, generatedFile.rg, selectedTargetFile]);

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

  const _foldAll = (fold: boolean) => {
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
      className={`ll-bottom ll:flex ll:flex-col ll:w-full ll:h-full ll:min-w-0 ll:bg-surface-panel ll:border-t ll:border-border ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* 1. Header Toolbar (44px, matching prototype .ph.cxh) */}
      <div
        id="chead"
        role="toolbar"
        aria-label="Code header"
        className="ll-ph ll-cxh ll:h-11 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:pl-3 ll:pr-3 ll:border-b ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:select-none"
      >
        {/* Playful Segmented Control for Code / Console / Trace (32px high, matching prototype .pseg.cvseg) */}
        <div
          id="cvseg"
          role="tablist"
          aria-label="Bottom panel"
          className="ll-pseg ll-cvseg ll:flex ll:items-center ll:gap-0.5 ll:h-8 ll:p-0.5 ll:border ll:border-border ll:rounded-md ll:shrink-0"
        >
          {VIEWS.map(([viewKey, viewLabel]) => {
            const isSelected = activeTab === viewKey;
            return (
              <button
                key={viewKey}
                role="tab"
                data-v={viewKey}
                aria-selected={isSelected}
                onClick={() => handleTabSwitch(viewKey)}
                className={`ll:relative ll:h-mode-tab ll:px-2.5 ll:rounded-sm ll:font-sans ll:text-body ll:tracking-normal ll:font-medium ll:border-0 ll:cursor-pointer ll:transition-colors ll:flex ll:items-center ll:gap-1.5 ${
                  isSelected
                    ? "ll:bg-control-active ll:text-primary"
                    : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar"
                }`}
              >
                <span>{viewLabel}</span>
                {viewKey === "console" && errorCount > 0 && (
                  <span
                    id="cbadge"
                    className="ll-cbadge ll:font-mono ll:text-nano ll:font-medium ll:leading-3.5 ll:min-w-4 ll:h-4 ll:px-1 ll:ml-1.5 ll:text-center ll:border ll:border-current ll:rounded-sm"
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
            className="ll-ctabs ll:flex-1 ll:min-w-0 ll:flex ll:items-stretch ll:self-stretch ll:overflow-x-auto"
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
                  className={`ll-ctab ll:group ll:relative ll:flex ll:items-center ll:gap-1.5 ll:shrink-0 ll:h-full ll:pl-3 ll:pr-1 ll:font-sans ll:text-small ll:font-medium ll:whitespace-nowrap ll:cursor-pointer ll:select-none ll:transition-colors ${
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
                    className={`ll-cx ll:w-5 ll:h-5 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ${isSelected ? "ll:opacity-100" : "ll:opacity-0"} ll:group-hover:opacity-100 ll:hover:bg-surface-bar ll:hover:text-primary ll:border-0 ll:bg-transparent ll:cursor-pointer ll:p-0`}
                  >
                    <Icon icon={X} size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ll:flex-1" />
        )}

        {/* Right Tools (.chr in prototype) */}
        <div className="ll-chr ll:flex ll:items-center ll:gap-0.5 ll:shrink-0">
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
            onClick={() => motionActions.setFullWidth(!isFullWidth)}
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
            <div className="ll-csub ll:h-7 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:pl-4 ll:pr-2 ll:border-b ll:border-border ll:font-mono ll:text-micro ll:text-muted ll:select-none">
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
              className="ll-cstick ll:h-6 ll:shrink-0 ll:flex ll:items-center ll:gap-3 ll:pl-6 ll:pr-4 ll:bg-surface-panel ll:border-b ll:border-border ll:font-mono ll:text-micro ll:font-medium ll:text-secondary ll:hover:text-primary ll:text-left ll:cursor-pointer"
            >
              <span className="ll-csk ll:truncate">
                {stickyScope ? stickyScope.label : "Top level"}
              </span>
              {stickyScope && (
                <span className="ll-csl ll:font-normal ll:text-muted ll:ml-auto">
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
        className="ll-tlf ll-cft ll:h-7 ll:shrink-0 ll:flex ll:items-center ll:gap-3 ll:px-3 ll:border-t ll:border-border ll:bg-surface-panel ll:font-mono ll:text-micro ll:text-muted ll:select-none"
      >
        {activeTab === "code" ? (
          <>
            <span className={TFB}>{activeLangLabel}</span>
            <span className={TFB} id="cpos">
              Ln {curLine + 1}, Col {curCol + 1}
            </span>
            <span className={TFB}>UTF-8</span>
            <span className={TFB}>
              {displayLines.length} lines · {fileSizeKB} KB
            </span>

            <div className="ll:flex-1" />

            <span className={TFB}>{genSourceLabel}</span>

            {/* Formatted status button */}
            <button
              type="button"
              onClick={handleFormat}
              className={`ll-cfmt ${TFB} ll:bg-transparent ll:border-0 ll:text-secondary ll:cursor-default`}
            >
              <Icon icon={Check} size={12} className="ll:text-muted" />
              <span>{isFormatting ? "Formatting..." : "Formatted"}</span>
            </button>
          </>
        ) : activeTab === "console" ? (
          <>
            <span className={TFB}>2 errors</span>
            <span className={TFB}>3 warnings</span>
            <span className={TFB}>12 messages</span>
            <div className="ll:flex-1" />
            <span className={TFB}>Type help for commands</span>
          </>
        ) : (
          <>
            <span className={TFB}>onClick Get started</span>
            <span className={TFB}>Step 5 of 9 · 151.4 ms</span>
            <div className="ll:flex-1" />
            <span className={TFB}>9 steps · 218.8 ms</span>
          </>
        )}
      </div>
    </section>
  );
};

export default CodePanel;

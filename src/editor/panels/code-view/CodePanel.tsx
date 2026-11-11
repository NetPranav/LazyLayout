"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Code,
  Zap,
  Layers,
  FileText,
  Lock,
  Copy,
  Download,
  WrapText,
  MoreHorizontal,
  Check,
  X,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { BottomCollapseButton } from "@/editor/shell/BottomCollapseButton";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { ZipPacker } from "@/compiler/export/ZipPacker";
import { consoleStore, useConsoleLogs } from "@/editor/panels/console/consoleStore";
import { SyntaxHighlighter } from "./SyntaxHighlighter";
import { useCodeModels } from "./useCodeModels";
import { useCompiledFiles } from "./useCompiledFiles";
import { useCodeFilesStore } from "./codeFilesStore";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
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
  type GeneratedFile,
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
  "ll-tfb ll:h-6 ll:px-1.5 ll:rounded-sm ll:flex ll:items-center ll:gap-1 ll:shrink-0 ll:whitespace-nowrap ll:font-mono ll:text-micro ll:tracking-normal ll:font-medium ll:text-muted";

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
  onRun,
  className = "",
  style,
}) => {
  // Tabs: Code / Console / Trace
  const [internalTab, setInternalTab] = useState<CodeTab>("code");
  const activeTab = controlledTab ?? internalTab;

  const handleTabSwitch = useCallback((t: CodeTab) => {
    if (onTabChange) onTabChange(t);
    else setInternalTab(t);
  }, [onTabChange]);

  // Run (toolbar onRunCode -> runCode()): reveal the Console when the build line lands
  const runHandlerRef = useRef<() => void>(() => {});
  useEffect(() => {
    runHandlerRef.current = () => {
      if (onTabChange) onTabChange("console");
      else setInternalTab("console");
      onRun?.();
    };
  });
  useEffect(() => consoleStore.subscribeRun(() => runHandlerRef.current()), []);

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

  const consoleLogs = useConsoleLogs();
  const errorCount = useMemo(
    () => consoleLogs.filter((l) => l.lvl === "error").length,
    [consoleLogs]
  );
  const warnCount = useMemo(
    () => consoleLogs.filter((l) => l.lvl === "warn").length,
    [consoleLogs]
  );

  // Find in code state (.tbfind)
  const [isFindOpen, setIsFindOpen] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>("");
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // The real generated files (compiler output for the current document). The prototype generator is the fallback
  // only when the compiler yields no files, or when the caller passes its own files.
  const compiled = useCompiledFiles();
  const real = compiled.files.length > 0 && !propFiles;
  const storeActiveId = useCodeFilesStore((s) => s.activeFileId);
  const storeTabs = useCodeFilesStore((s) => s.openTabs);
  const openFileInStore = useCodeFilesStore((s) => s.openFile);
  const closeFileInStore = useCodeFilesStore((s) => s.closeFile);
  const projectName = useProjectMetaStore((s) => s.projectName);
  const compiledById = useMemo(() => new Map(compiled.files.map((f) => [f.id, f])), [compiled.files]);
  const realActiveId = storeActiveId && compiledById.has(storeActiveId) ? storeActiveId : (compiled.files[0]?.id ?? "");
  const realFile = real ? compiledById.get(realActiveId) : undefined;
  const tabsShown = real
    ? (storeTabs.filter((t) => compiledById.has(t)).length > 0 ? storeTabs.filter((t) => compiledById.has(t)) : [realActiveId])
    : openTabs;
  const nameOf = (id: string) => (real ? (compiledById.get(id)?.name ?? id) : fName(id, codeState));
  const pathOf = (id: string) => (real ? (compiledById.get(id)?.path ?? id) : fPath(id, codeState));
  const langOf = (id: string): "tsx" | "vue" | "html" | "css" | "json" =>
    real ? (compiledById.get(id)?.lang === "css" ? "css" : compiledById.get(id)?.lang === "json" ? "json" : "tsx") : fLang(id, codeState);
  const iconKeyOf = (id: string) => (real ? (compiledById.get(id)?.lang === "css" ? "fcss" : compiledById.get(id)?.lang === "json" ? "fjson" : "ftsx") : fIcon(id, codeState));

  const activeFileId = controlledFileId ?? (real ? realActiveId : internalActiveFile);

  // Real store connections
  const selectedElementId = useSelectionStore((s) => s.selectedId);
  const selectElement = useSelectionStore((s) => s.select);
  const _activePageId = useProjectStore((s) => s.activePageId);

  const { data: dataModel, type: typeModel, txt: txtModel } = useCodeModels();

  // Generate current file output
  const generatedFile = useMemo((): GeneratedFile => {
    if (realFile) {
      return {
        id: realFile.id,
        lines: realFile.content.split(/\r?\n/).map((t) => ({ t })),
        rg: {},
        lang: "tsx",
        text: realFile.content,
        deps: [],
        rules: [],
        kf: [],
        nodes: {},
        uses: {},
      };
    }
    return cxGen(activeFileId, codeState, dataModel, typeModel, txtModel);
  }, [realFile, activeFileId, codeState, dataModel, typeModel, txtModel]);

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

  const displayFileName = propFileName ?? nameOf(activeFileId);
  const displayFilePath = pathOf(activeFileId);

  // Compute all matches in displayLines for find bar (.tbfind)
  const matches = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q) return [];
    const list: Array<{ lineIndex: number; colIndex: number }> = [];
    displayLines.forEach((line, lineIdx) => {
      const lower = line.t.toLowerCase();
      let pos = 0;
      while ((pos = lower.indexOf(q, pos)) !== -1) {
        list.push({ lineIndex: lineIdx, colIndex: pos });
        pos += q.length;
      }
    });
    return list;
  }, [displayLines, findQuery]);

  const goToMatch = useCallback(
    (index: number) => {
      if (!matches.length) return;
      const safeIndex = (index + matches.length) % matches.length;
      setActiveMatchIndex(safeIndex);
      const targetMatch = matches[safeIndex];
      if (targetMatch) {
        setCurLine(targetMatch.lineIndex);
        setCurCol(targetMatch.colIndex);
      }
    },
    [matches]
  );

  // Focus find input when opened
  useEffect(() => {
    if (isFindOpen && findInputRef.current) {
      findInputRef.current.focus({ preventScroll: true });
      findInputRef.current.select();
    }
  }, [isFindOpen]);

  // Global keydown for Ctrl+F and Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsFindOpen(true);
        if (activeTab !== "code") {
          handleTabSwitch("code");
        }
      } else if (e.key === "Escape" && isFindOpen) {
        e.preventDefault();
        setIsFindOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFindOpen, activeTab, handleTabSwitch]);

  const handleFindInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        goToMatch(activeMatchIndex - 1);
      } else {
        goToMatch(activeMatchIndex + 1);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsFindOpen(false);
    }
  };

  // Open the tab, active file and line of the selected canvas element (adjusted during render)
  const selectedShort = selectedElementId ? selectedElementId.replace(/^el_/, "") : null;
  const selectedTargetFile = !real && selectedShort ? FILE_OF[selectedShort] : undefined;
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
    if (real) {
      openFileInStore(fileId);
      onSelectFile?.(fileId);
      return;
    }
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
    if (real) {
      closeFileInStore(fileId);
      return;
    }
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
      navigator.clipboard.writeText(displayCode).catch(() => {});
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
    if (real) {
      compiled.files.forEach((f) => packer.addFile(f.path, f.content));
      packer.download(`${projectName || "my-project"}.zip`);
      return;
    }
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
    real
      ? `Compiled from ${compiled.files.length} file${compiled.files.length === 1 ? "" : "s"} in ${compiled.durationMs} ms`
      : activeFileId === "css"
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
  const activeLangLabel = langLabelMap[langOf(activeFileId)] || "TypeScript React";
  const fileSizeKB = (new Blob([displayCode]).size / 1024).toFixed(1);

  return (
    <section
      id="bottom"
      role="region"
      aria-label="Bottom panel"
      data-testid="bottom-panel"
      className={`ll-bottom ll:font-sans ll:text-body ll:flex ll:flex-col ll:w-full ll:h-full ll:min-w-0 ll:bg-surface-panel ll:border-t ll:border-border ll:overflow-hidden ${className}`}
      style={style}
    >
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
                className={`ll:relative ll:h-mode-tab ll:px-3 ll:rounded-sm ll:font-sans ll:text-body ll:tracking-normal ll:font-medium ll:border-0 ll:cursor-pointer ll:flex ll:items-center ll:gap-1.5 ${
                  isSelected
                    ? "ll:bg-control-active ll:text-primary"
                    : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar"
                }`}
              >
                <span>{viewLabel}</span>
                {viewKey === "console" && errorCount > 0 && (
                  <span
                    id="cbadge"
                    style={{ borderColor: "currentColor" }}
                    className="ll-cbadge ll:font-mono ll:text-nano ll:font-medium ll:leading-3.5 ll:tracking-normal ll:min-w-4 ll:h-4 ll:px-1 ll:ml-1.5 ll:text-center ll:border ll:rounded-sm"
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
          <i className="ll-tdiv ll:w-px ll:h-5 ll:bg-border ll:mx-1 ll:shrink-0" aria-hidden="true" />
        )}

        {/* Middle: Open File Tabs strip (.ctabs in prototype) */}
        {activeTab === "code" ? (
          <div
            role="tablist"
            aria-label="Open files"
            className="ll-ctabs ctabs ll:flex-1 ll:min-w-0 ll:flex ll:items-stretch ll:self-stretch ll:overflow-x-auto"
          >
            {tabsShown.map((tabId) => {
              const isSelected = activeFileId === tabId;
              const fileNameStr = nameOf(tabId);
              const fileIconKey = iconKeyOf(tabId);

              return (
                <div
                  key={tabId}
                  role="tab"
                  tabIndex={0}
                  data-tab={tabId}
                  aria-selected={isSelected}
                  onClick={() => handleOpenTab(tabId)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      handleCloseTab(e, tabId);
                    }
                  }}
                  title={pathOf(tabId)}
                  className={`ll-ctab ctab ll:group ll:relative ll:flex ll:items-center ll:gap-1.5 ll:shrink-0 ll:h-full ll:pl-3 ll:pr-1 ll:font-sans ll:text-small ll:font-medium ll:whitespace-nowrap ll:cursor-pointer ll:select-none ${
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
                        : Code
                    }
                    size={14}
                    className="ll:shrink-0"
                  />
                  <span className="ll:whitespace-nowrap">{fileNameStr}</span>

                  {/* Close tab button */}
                  <button
                    type="button"
                    tabIndex={-1}
                    data-ca="closetab"
                    data-id={tabId}
                    aria-label={`Close ${fileNameStr}`}
                    title="Close"
                    onClick={(e) => handleCloseTab(e, tabId)}
                    className={`ll-cx cx ll:w-5 ll:h-5 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ${isSelected ? "ll:opacity-100" : "ll:opacity-0"} ll:group-hover:opacity-100 ll:hover:bg-control-active ll:hover:text-primary ll:border-0 ll:bg-transparent ll:cursor-pointer ll:px-1.5 ll:py-px`}
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
        <div className="ll-chr chr ll:flex ll:items-center ll:gap-0.5 ll:shrink-0">
          {activeTab === "code" && (
            <>
              {/* Find toggle button */}
              <button
                type="button"
                data-ca="find"
                aria-pressed={isFindOpen}
                aria-label="Find in code (Ctrl+F)"
                title="Find in code (Ctrl+F)"
                onClick={() => setIsFindOpen((prev) => !prev)}
                className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:border-0 ll:cursor-pointer ${
                  isFindOpen
                    ? "ll:bg-control-active ll:text-primary"
                    : "ll:bg-transparent ll:text-secondary ll:hover:text-primary ll:hover:bg-control-active"
                }`}
              >
                <Icon icon={Search} size={14} />
              </button>

              {/* Word wrap toggle */}
              <button
                type="button"
                data-ca="wrap"
                aria-pressed={wrap}
                aria-label="Word wrap"
                title="Word wrap"
                onClick={() => setWrap((prev) => !prev)}
                className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:border-0 ll:cursor-pointer ${
                  wrap
                    ? "ll:bg-control-active ll:text-primary"
                    : "ll:bg-transparent ll:text-secondary ll:hover:text-primary ll:hover:bg-control-active"
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
                className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:bg-transparent ll:border-0 ll:text-secondary ll:hover:text-primary ll:hover:bg-control-active ll:cursor-pointer"
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
                className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:bg-transparent ll:border-0 ll:text-secondary ll:hover:text-primary ll:hover:bg-control-active ll:cursor-pointer"
              >
                <Icon icon={Download} size={14} />
              </button>

              <i className="ll-tdiv ll:w-px ll:h-5 ll:bg-border ll:mx-1 ll:shrink-0" aria-hidden="true" />
            </>
          )}

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
            className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:bg-transparent ll:border-0 ll:text-secondary ll:hover:text-primary ll:hover:bg-control-active ll:cursor-pointer"
          >
            <Icon icon={MoreHorizontal} size={14} />
          </button>

          <i className="ll-tdiv ll:w-px ll:h-5 ll:bg-border ll:mx-1 ll:shrink-0" aria-hidden="true" />
          <BottomCollapseButton mode="code" />
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
            <div className="ll-csub ll:h-7 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:pl-4 ll:pr-2 ll:border-b ll:border-border ll:font-mono ll:text-micro ll:tracking-normal ll:text-muted ll:select-none">
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
              className={`ll-cstick cstick ll:h-6 ll:shrink-0 ll:flex ll:items-center ll:gap-3 ll:pl-6 ll:pr-4 ll:bg-surface-panel ll:border-b ll:border-border ll:font-mono ll:text-micro ll:tracking-normal ll:font-medium ll:hover:text-primary ll:text-left ${stickyScope ? "ll:text-secondary ll:cursor-pointer" : "ll:text-muted ll:cursor-default"}`}
            >
              <span className="ll-csk csk ll:truncate">
                {stickyScope ? stickyScope.label : "Top level"}
              </span>
              {stickyScope && (
                <span className="ll-csl csl ll:font-normal ll:text-muted ll:ml-auto">
                  Line {stickyScope.line + 1}
                </span>
              )}
            </button>

            {/* Find in code bar (.tbfind per prototype lines 822-824) */}
            {isFindOpen && (
              <div
                role="search"
                className="ll-tbfind tbfind ll:absolute ll:top-find-top ll:right-find-right ll:z-30 ll:flex ll:items-center ll:gap-1 ll:p-1 ll:pl-2 ll:bg-surface-float ll:border ll:border-border ll:rounded-md ll:shadow-floating"
              >
                <Icon icon={Search} size={13} className="ll:text-muted ll:shrink-0" />
                <input
                  ref={findInputRef}
                  type="text"
                  value={findQuery}
                  onChange={(e) => {
                    setFindQuery(e.target.value);
                    setActiveMatchIndex(0);
                  }}
                  onKeyDown={handleFindInputKeyDown}
                  placeholder="Find in code"
                  aria-label="Find in code"
                  spellCheck={false}
                  autoComplete="off"
                  className="ll:w-find-input ll:h-8 ll:px-2 ll:bg-surface-panel ll:border ll:border-border ll:focus:border-primary ll:rounded-sm ll:font-sans ll:text-small ll:text-primary ll:placeholder:text-muted ll:outline-none"
                />
                <span
                  className="ll-tbn tbn mono ll:min-w-6 ll:text-right ll:font-mono ll:text-micro ll:text-muted ll:px-1 ll:select-none"
                  aria-live="polite"
                >
                  {matches.length === 0 ? "0" : `${activeMatchIndex + 1}/${matches.length}`}
                </span>
                <button
                  type="button"
                  aria-label="Previous match"
                  title="Previous match (Shift+Enter)"
                  onClick={() => goToMatch(activeMatchIndex - 1)}
                  disabled={matches.length === 0}
                  className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:disabled:opacity-30 ll:cursor-pointer"
                >
                  <Icon icon={ChevronUp} size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Next match"
                  title="Next match (Enter)"
                  onClick={() => goToMatch(activeMatchIndex + 1)}
                  disabled={matches.length === 0}
                  className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:disabled:opacity-30 ll:cursor-pointer"
                >
                  <Icon icon={ChevronDown} size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Close find"
                  title="Close (Esc)"
                  onClick={() => setIsFindOpen(false)}
                  className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
                >
                  <Icon icon={X} size={13} />
                </button>
              </div>
            )}

            {/* Code Editor Body (.cedit / .cscroll) */}
            <div className="ll-cedit cedit ll:flex-1 ll:min-h-0 ll:relative ll:overflow-hidden">
              <SyntaxHighlighter
                lines={displayLines}
                language={langOf(activeFileId)}
                highlightedLine={propHighlightedLine ?? curLine}
                highlightedRanges={highlightedRanges}
                changedLines={changedRanges}
                searchQuery={isFindOpen ? findQuery : undefined}
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
        className="ll-tlf tlf cft ll-cft ll:h-7 ll:shrink-0 ll:flex ll:items-center ll:gap-3 ll:px-3 ll:border-t ll:border-border ll:bg-surface-panel ll:font-mono ll:text-micro ll:tracking-normal ll:text-muted ll:select-none"
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
              className={`ll-cfmt cfmt ${TFB} ll:bg-transparent ll:border-0 ll:text-secondary ll:cursor-default`}
            >
              <Icon icon={Check} size={12} className="ll:text-muted" />
              <span>{isFormatting ? "Formatting..." : "Formatted"}</span>
            </button>
          </>
        ) : activeTab === "console" ? (
          <>
            <span className={TFB}>{errorCount} error{errorCount === 1 ? "" : "s"}</span>
            <span className={TFB}>{warnCount} warning{warnCount === 1 ? "" : "s"}</span>
            <span className={TFB}>{consoleLogs.length} messages</span>
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

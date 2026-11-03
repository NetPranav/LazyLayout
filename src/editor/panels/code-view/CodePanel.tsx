"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  FileCode,
  Zap,
  Layers,
  FileText,
  Terminal,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { useLayers } from "@/core/store/useDocumentStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { ReactComponentEmitter } from "@/compiler/emitters/ReactComponentEmitter";
import { StyleEmitter } from "@/compiler/emitters/StyleEmitter";
import { GSAPAnimationEmitter } from "@/compiler/emitters/GSAPAnimationEmitter";
import { ZipPacker } from "@/compiler/export/ZipPacker";
import { SyntaxHighlighter } from "./SyntaxHighlighter";
import { ConsoleView } from "./ConsoleView";
import {
  SAMPLE_CODE_HERO,
  SAMPLE_CODE_ANIMATION,
  SAMPLE_CODE_STYLES,
  SAMPLE_CODE_README,
  CODE_VIEW_TIMINGS,
} from "./constants";
import type { CodePanelProps, CodeTab, CodeFileTab } from "./types";

const DEFAULT_FILES: CodeFileTab[] = [
  {
    id: "Hero.tsx",
    name: "Hero.tsx",
    language: "tsx",
    content: SAMPLE_CODE_HERO,
    icon: <Icon icon={FileCode} size={14} />,
  },
  {
    id: "useHeroAnimation.ts",
    name: "useHeroAnimation.ts",
    language: "typescript",
    content: SAMPLE_CODE_ANIMATION,
    icon: <Icon icon={Zap} size={14} />,
  },
  {
    id: "Hero.module.css",
    name: "Hero.module.css",
    language: "css",
    content: SAMPLE_CODE_STYLES,
    icon: <Icon icon={Layers} size={14} />,
  },
  {
    id: "README.md",
    name: "README.md",
    language: "markdown",
    content: SAMPLE_CODE_README,
    icon: <Icon icon={FileText} size={14} />,
  },
];

export const CodePanel: React.FC<CodePanelProps> = ({
  activeTab: propActiveTab,
  onTabChange,
  activeFileId: propActiveFileId,
  onSelectFile,
  files: propFiles,
  code: propCode,
  fileName: propFileName,
  highlightedLine,
  onLineClick,
  onCopy,
  onExport,
  className = "",
  style,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<CodeTab>("code");
  const [internalActiveFileId, setInternalActiveFileId] = useState<string>("Hero.tsx");
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const activeTab = propActiveTab ?? internalActiveTab;
  const activeFileId = propActiveFileId ?? internalActiveFileId;

  // Subscribe to real project store for live compiled code when available
  const elements = useLayers();
  const pages = useProjectStore((s) => s.pages);
  const activePageId = useProjectStore((s) => s.activePageId);
  const selectedElementId = useSelectionStore((s) => s.selectedId);
  const selectElement = useSelectionStore((s) => s.select);
  const animationSamples = useProjectStore((s) => s.animationSamples);

  // Compute live compiled code if elements exist
  const liveCompiledFiles = useMemo<CodeFileTab[]>(() => {
    if (propFiles) {
      return propFiles;
    }

    const hasLiveElements = Object.keys(elements).length > 0;
    if (!hasLiveElements) {
      return DEFAULT_FILES;
    }

    try {
      const activePage = pages[activePageId || "page_home"];
      let componentTsx = SAMPLE_CODE_HERO;
      let componentName = "Hero";

      if (activePage?.rootElementId && elements[activePage.rootElementId]) {
        const emitted = ReactComponentEmitter.emitPage(activePage, elements);
        componentTsx = emitted.content;
        componentName = activePage.name || "Hero";
      } else if (selectedElementId && elements[selectedElementId]) {
        const el = elements[selectedElementId];
        const emitted = ReactComponentEmitter.emitComponent(el.id, elements);
        componentTsx = emitted.content;
        componentName = el.name || "Component";
      }

      // Styles
      const stylesEmitted = StyleEmitter.emitProjectStyles(elements);

      // Animation
      const firstSample = Object.values(animationSamples)[0];
      const animationCode = firstSample
        ? GSAPAnimationEmitter.emitHook(firstSample).content
        : SAMPLE_CODE_ANIMATION;

      return [
        {
          id: `${componentName}.tsx`,
          name: `${componentName}.tsx`,
          language: "tsx",
          content: componentTsx,
          icon: <Icon icon={FileCode} size={14} />,
        },
        {
          id: `use${componentName}Animation.ts`,
          name: `use${componentName}Animation.ts`,
          language: "typescript",
          content: animationCode,
          icon: <Icon icon={Zap} size={14} />,
        },
        {
          id: `${componentName}.module.css`,
          name: `${componentName}.module.css`,
          language: "css",
          content: stylesEmitted.content || SAMPLE_CODE_STYLES,
          icon: <Icon icon={Layers} size={14} />,
        },
        {
          id: "README.md",
          name: "README.md",
          language: "markdown",
          content: SAMPLE_CODE_README,
          icon: <Icon icon={FileText} size={14} />,
        },
      ];
    } catch {
      return DEFAULT_FILES;
    }
  }, [propFiles, elements, pages, activePageId, selectedElementId, animationSamples]);

  // Resolve current active file
  const currentFile = useMemo(() => {
    return (
      liveCompiledFiles.find((f) => f.id === activeFileId) ||
      liveCompiledFiles[0] ||
      DEFAULT_FILES[0]
    );
  }, [liveCompiledFiles, activeFileId]);

  const displayCode = propCode ?? currentFile.content;
  const displayFileName = propFileName ?? currentFile.name;

  const handleTabClick = (tab: CodeTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  const handleSelectFile = (fileId: string) => {
    handleTabClick("code");
    if (onSelectFile) {
      onSelectFile(fileId);
    } else {
      setInternalActiveFileId(fileId);
    }
  };

  const handleCopy = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(displayCode);
    }
    onCopy?.(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), CODE_VIEW_TIMINGS.copyFeedbackMs);
  }, [displayCode, onCopy]);

  const handleExport = useCallback(() => {
    setIsExporting(true);
    try {
      if (onExport) {
        onExport(displayFileName, displayCode);
      } else {
        const packer = new ZipPacker();
        liveCompiledFiles.forEach((file) => {
          packer.addFile(file.name, file.content);
        });
        packer.download(`${displayFileName.split(".")[0] || "project"}.zip`);
      }
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setTimeout(() => setIsExporting(false), CODE_VIEW_TIMINGS.downloadFeedbackMs);
    }
  }, [displayFileName, displayCode, liveCompiledFiles, onExport]);

  const handleLineClickInternal = useCallback(
    (lineIdx: number, lineText: string) => {
      onLineClick?.(lineIdx, lineText);

      // Bidirectional Code-to-AST element selection
      if (elements && selectElement) {
        for (const el of Object.values(elements)) {
          const shortId = el.id.replace(/^el_/, "");
          if (lineText.includes(shortId) || (el.name && lineText.includes(el.name))) {
            selectElement(el.id, "element");
            break;
          }
        }
      }
    },
    [onLineClick, elements, selectElement]
  );

  return (
    <section
      role="region"
      aria-label="Code & Output Panel"
      className={`ll-bottom ll:flex ll:flex-col ll:w-full ll:h-full ll:min-w-0 ll:bg-surface-panel ll:border-t ll:border-border ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* 1. Header Toolbar (.ph in prototype) */}
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:px-3 ll:h-11 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:select-none">
        {/* Left: File Tabs & Console Tab */}
        <div
          role="tablist"
          aria-label="Code and Console tabs"
          className="ll:flex ll:items-center ll:gap-1 ll:min-w-0 ll:overflow-x-auto"
        >
          {liveCompiledFiles.map((file) => {
            const isSelected = activeTab === "code" && currentFile.id === file.id;
            return (
              <button
                key={file.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => handleSelectFile(file.id)}
                className={`ll:inline-flex ll:items-center ll:gap-1.5 ll:px-2.5 ll:h-7 ll:rounded-sm ll:text-small ll:font-medium ll:transition-colors ll:duration-75 ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
                  isSelected
                    ? "ll:bg-surface-raised ll:text-primary ll:border ll:border-border ll:shadow-soft"
                    : "ll:bg-transparent ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary ll:border ll:border-transparent"
                }`}
              >
                {file.icon}
                <span className="ll:truncate">{file.name}</span>
              </button>
            );
          })}

          {/* Console / Output Log Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "console"}
            tabIndex={activeTab === "console" ? 0 : -1}
            onClick={() => handleTabClick("console")}
            className={`ll:inline-flex ll:items-center ll:gap-1.5 ll:px-2.5 ll:h-7 ll:rounded-sm ll:text-small ll:font-medium ll:transition-colors ll:duration-75 ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
              activeTab === "console"
                ? "ll:bg-surface-raised ll:text-primary ll:border ll:border-border ll:shadow-soft"
                : "ll:bg-transparent ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary ll:border ll:border-transparent"
            }`}
          >
            <Icon icon={Terminal} size={14} />
            <span>Console</span>
          </button>
        </div>

        {/* Right: Actions (Copy, Export) */}
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            leftIcon={<Icon icon={copied ? Check : Copy} size={14} />}
          >
            {copied ? "Copied" : "Copy"}
          </Button>

          <Button
            size="sm"
            variant="secondary"
            loading={isExporting}
            onClick={handleExport}
            leftIcon={<Icon icon={Download} size={14} />}
          >
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>

      {/* 2. Body Area (.bb in prototype) */}
      <div className="ll:flex-1 ll:min-h-0 ll:overflow-hidden ll:relative ll:bg-surface-canvas">
        {activeTab === "code" ? (
          <SyntaxHighlighter
            code={displayCode}
            language={currentFile.language}
            highlightedLine={highlightedLine}
            onLineClick={handleLineClickInternal}
            className="ll:h-full ll:w-full"
          />
        ) : (
          <ConsoleView className="ll:h-full ll:w-full" />
        )}
      </div>
    </section>
  );
};

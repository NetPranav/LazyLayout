"use client";

import React, { useState, useMemo, useCallback } from "react";
import { FileCode, Zap, Layers, FileText } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
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
  activeTab = "code",
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
  const [internalActiveFileId, setInternalActiveFileId] = useState<string>("Hero.tsx");
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

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
      id="bottom"
      role="region"
      aria-label="Bottom panel"
      className={`ll-bottom ll:flex ll:flex-col ll:w-full ll:h-full ll:min-w-0 ll:bg-surface-panel ll:border-t ll:border-border ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* 1. Header Toolbar matching prototype: .bottom .ph (<span class="ctitle">Hero.tsx</span><span class="sp"></span><button class="tg">Copy</button><button class="tg">Export</button>) */}
      <div className="ll-ph ll:flex ll:items-center ll:justify-between ll:gap-2 ll:px-3 ll:h-header ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:select-none">
        {/* Left: Component File Name */}
        <span className="ll-ctitle ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:whitespace-nowrap">
          {displayFileName}
        </span>

        {/* Middle: Spacer */}
        <div className="ll-sp ll:flex-1" />

        {/* Right: Actions (Copy, Export) matching prototype .tg buttons */}
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="ll-tg ll:border-0 ll:bg-transparent ll:h-7 ll:px-2 ll:text-small ll:font-medium ll:text-muted ll:hover:text-primary ll:hover:bg-transparent ll:transition-colors ll:cursor-pointer ll:rounded-sm ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
          >
            {copied ? "Copied" : "Copy"}
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="ll-tg ll:border-0 ll:bg-transparent ll:h-7 ll:px-2 ll:text-small ll:font-medium ll:text-muted ll:hover:text-primary ll:hover:bg-transparent ll:transition-colors ll:cursor-pointer ll:rounded-sm ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>

      {/* 2. Body Area (.bb in prototype) */}
      <div className="ll-bb ll:flex-1 ll:min-h-0 ll:overflow-hidden ll:relative ll:bg-surface-canvas">
        {activeTab === "console" ? (
          <ConsoleView className="ll:h-full ll:w-full" />
        ) : (
          <SyntaxHighlighter
            code={displayCode}
            language={currentFile.language}
            highlightedLine={highlightedLine}
            onLineClick={handleLineClickInternal}
            className="ll:h-full ll:w-full"
          />
        )}
      </div>
    </section>
  );
};

export default CodePanel;

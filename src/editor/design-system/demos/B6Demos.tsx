"use client";

import React, { useState } from "react";
import { CodePanel } from "@/editor/panels/code-view/CodePanel";
import { ConsoleView } from "@/editor/panels/code-view/ConsoleView";
import { TraceView } from "@/editor/panels/code-view/TraceView";
import { CodeInspector } from "@/editor/panels/code-view/CodeInspector";
import { OutputConsole } from "@/editor/panels/console/OutputConsole";
import { SyntaxHighlighter } from "@/editor/panels/code-view/SyntaxHighlighter";
import { Icon } from "@/editor/components/Icon";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";

/**
 * 1. B6CodePanelCodeDemo:
 * Full CodePanel in code view with tabs, word wrap, copy, download,
 * find bar (Ctrl+F), and syntax highlighting.
 */
export const B6CodePanelCodeDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-panel">
      <CodePanel activeTab="code" />
    </div>
  );
};

/**
 * 2. B6CodePanelConsoleDemo:
 * CodePanel in console view with error / warn / info lines tinted per P,
 * fixed segmented filter buttons (#cfseg), log search, and command line.
 */
export const B6CodePanelConsoleDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-panel">
      <CodePanel activeTab="console" />
    </div>
  );
};

/**
 * 3. B6CodePanelTraceDemo:
 * CodePanel in trace view with hot steps tinted via --ll-syn-num,
 * waterfall scrub, breakpoints, and watch expressions.
 */
export const B6CodePanelTraceDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-panel">
      <CodePanel activeTab="trace" />
    </div>
  );
};

/**
 * 4. B6FindBarDemo:
 * Find bar (.tbfind per prototype lines 822-824) with query, count, prev/next, and Esc close.
 */
export const B6FindBarDemo: React.FC = () => {
  const [query, setQuery] = useState("Hero");
  const [matchIdx, setMatchIdx] = useState(0);
  const totalMatches = 4;

  return (
    <div className="ll:flex ll:flex-col ll:gap-4 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:max-w-xl">
      <div className="ll:text-small ll:text-secondary">
        Standalone Find bar (.tbfind) with query input, match count, prev/next navigation, and close.
      </div>
      <div className="ll:relative ll:h-16 ll:w-full ll:border ll:border-border ll:rounded-sm ll:p-3 ll:bg-surface-backdrop ll:flex ll:items-center ll:justify-end">
        <div
          role="search"
          className="ll-tbfind tbfind ll:flex ll:items-center ll:gap-1 ll:p-1 ll:pl-2 ll:bg-surface-float ll:border ll:border-border ll:rounded-md ll:shadow-floating"
        >
          <Icon icon={Search} size={13} className="ll:text-muted ll:shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
            {matchIdx + 1}/{totalMatches}
          </span>
          <button
            type="button"
            aria-label="Previous match"
            title="Previous match (Shift+Enter)"
            onClick={() => setMatchIdx((prev) => (prev - 1 + totalMatches) % totalMatches)}
            className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
          >
            <Icon icon={ChevronUp} size={14} />
          </button>
          <button
            type="button"
            aria-label="Next match"
            title="Next match (Enter)"
            onClick={() => setMatchIdx((prev) => (prev + 1) % totalMatches)}
            className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
          >
            <Icon icon={ChevronDown} size={14} />
          </button>
          <button
            type="button"
            aria-label="Close find"
            title="Close (Esc)"
            className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
          >
            <Icon icon={X} size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 5. B6SyntaxHighlightingDemo:
 * Demonstrates all 9 syntax token colours via --ll-syn-*:
 * kw, str, num, fn, tag, attr, type, punc, com.
 */
export const B6SyntaxHighlightingDemo: React.FC = () => {
  const sampleSnippet = `// Comment: --ll-syn-com (italic)
import React, { useEffect } from "react"; // import/from: --ll-syn-kw, string: --ll-syn-str

export interface ButtonProps {
  count: number; // type: --ll-syn-type, num: --ll-syn-num
}

export function ActionButton({ count }: ButtonProps) {
  const handleClick = (e: Event) => {
    console.log("Clicked count:", count); // fn: --ll-syn-fn
  };

  return (
    <button className="cta-btn" onClick={handleClick}>
      <span>Item #{count * 2}</span>
    </button>
  );
}`;

  return (
    <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:max-w-xl">
      <div className="ll:flex ll:flex-wrap ll:gap-2 ll:text-micro ll:font-mono">
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-kw">kw: keyword</span>
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-str">str: string</span>
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-num">num: number</span>
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-fn">fn: function</span>
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-tag">tag: jsx tag</span>
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-attr">attr: attribute</span>
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-type">type: type</span>
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-punc">punc: punctuation</span>
        <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-syn-com ll:italic">com: comment</span>
      </div>

      <div className="ll:h-64 ll:border ll:border-border ll:rounded-xs ll:overflow-hidden ll:bg-surface-backdrop">
        <SyntaxHighlighter code={sampleSnippet} language="tsx" />
      </div>
    </div>
  );
};

/**
 * 6. B6OutputConsoleDemo:
 * Detached OutputConsole wrapper with console & trace sub-views.
 */
export const B6OutputConsoleDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-72 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-panel">
      <OutputConsole />
    </div>
  );
};

/**
 * 7. B6CodeInspectorDemo:
 * Code inspector showing component configuration, export type, and package dependencies.
 */
export const B6CodeInspectorDemo: React.FC = () => {
  return (
    <div className="ll:w-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-panel">
      <CodeInspector componentName="Hero" exportType="named" targetLib="React" styleType="Tailwind" />
    </div>
  );
};

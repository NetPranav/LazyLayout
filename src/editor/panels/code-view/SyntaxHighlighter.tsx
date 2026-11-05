"use client";

import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import type { EmittedLine } from "./codeGenerator";

export interface SyntaxHighlighterProps {
  code?: string;
  lines?: EmittedLine[];
  language?: "tsx" | "typescript" | "javascript" | "css" | "prisma" | "markdown" | "json" | "html" | "vue";
  highlightedLine?: number | null;
  highlightedRanges?: Array<[number, number]>;
  changedLines?: Record<number, [number, number]> | null;
  onLineClick?: (lineIndex: number, lineText: string, ref?: string | null) => void;
  onLineHover?: (ref: string | null) => void;
  wrap?: boolean;
  className?: string;
  showLineNumbers?: boolean;
  folds?: Record<number, boolean>;
  onToggleFold?: (lineIndex: number) => void;
  onStickyScopeChange?: (scope: { label: string; line: number } | null) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

const KWR =
  /^(?:import|from|export|default|const|let|function|return|type|new|if|else|async|await|as|true|false|null|undefined|withDefaults|defineProps|onMounted|onBeforeUnmount|useEffect|useRef|scoped|setup)$/;
const TOKR =
  /(\/\/.*$|\/\*.*?\*\/|<!--.*?-->)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?)([A-Za-z][\w.:-]*)|([A-Za-z_:@][\w:.@-]*)(?==["{])|([A-Za-z_$][\w$]*)|(-?\d+(?:\.\d+)?)|(=>|[{}()[\];,<>=:/.?!&|+*-]+)/g;
const CSSR =
  /(\/\*.*?\*\/)|("[^"]*"|'[^']*')|(@[\w-]+)|([\w-]+)(?=\s*:\s)|(#[0-9A-Fa-f]{3,8}\b)|(-?\d*\.?\d+(?:px|rem|em|%|s|ms|deg|vh|vw)?)|([{}();:,])/g;
const JSNR =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|(true|false|null)|([{}[\],:])/g;

interface Token {
  t: string;
  c: "c" | "s" | "k" | "a" | "n" | "t" | "p" | "";
}

function tokLine(s: string, lang: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  function raw(t: string) {
    if (t) out.push({ t, c: "" });
  }

  if (lang === "css") {
    if (/^\s*[^;{}@]+\{\s*$/.test(s) && !/:\s/.test(s)) {
      const match = /^(\s*)(.*?)(\s*\{\s*)$/.exec(s);
      if (match) {
        return [
          { t: match[1], c: "" },
          { t: match[2], c: "t" },
          { t: match[3], c: "p" },
        ];
      }
    }
    const re = new RegExp(CSSR.source, "g");
    while ((m = re.exec(s))) {
      raw(s.slice(last, m.index));
      const kind = m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : m[4] ? "a" : m[5] || m[6] ? "n" : "p";
      out.push({ t: m[0], c: kind });
      last = re.lastIndex;
    }
  } else if (lang === "json") {
    const re = new RegExp(JSNR.source, "g");
    while ((m = re.exec(s))) {
      raw(s.slice(last, m.index));
      if (m[1]) {
        out.push({ t: m[1], c: m[2] ? "k" : "s" });
        if (m[2]) out.push({ t: m[2], c: "p" });
      } else {
        out.push({ t: m[0], c: m[3] ? "n" : m[4] ? "k" : "p" });
      }
      last = re.lastIndex;
    }
  } else {
    const re = new RegExp(TOKR.source, "g");
    while ((m = re.exec(s))) {
      raw(s.slice(last, m.index));
      if (m[1]) {
        out.push({ t: m[1], c: "c" });
      } else if (m[2]) {
        out.push({ t: m[2], c: "s" });
      } else if (m[3]) {
        out.push({ t: m[3], c: "p" });
        out.push({ t: m[4], c: "t" });
      } else if (m[5]) {
        out.push({ t: m[5], c: "a" });
      } else if (m[6]) {
        out.push({ t: m[6], c: KWR.test(m[6]) ? "k" : "" });
      } else if (m[7]) {
        out.push({ t: m[7], c: "n" });
      } else {
        out.push({ t: m[8], c: "p" });
      }
      last = re.lastIndex;
    }
  }
  raw(s.slice(last));
  return out;
}

function indOf(t: string): number {
  const m = /^( *)\S/.exec(t);
  return m ? m[1].length : -1;
}

export function foldMap(lines: EmittedLine[]): Record<number, number> {
  const I = lines.map((l) => indOf(l.t));
  const m: Record<number, number> = {};
  const n = I.length;
  for (let i = 0; i < n; i++) {
    if (I[i] < 0) continue;
    let j = i + 1;
    while (j < n && I[j] < 0) j++;
    if (j >= n || I[j] <= I[i]) continue;
    while (j < n && (I[j] < 0 || I[j] > I[i])) j++;
    if (j - 1 > i + 1) m[i] = j - 1;
  }
  return m;
}

export function scopeList(
  lines: EmittedLine[],
  lang: string
): Array<{ n: number; e: number; l: string }> {
  const fm = foldMap(lines);
  const lim = lang === "json" ? 2 : 0;
  const o: Array<{ n: number; e: number; l: string }> = [];

  Object.keys(fm).forEach((kStr) => {
    const k = +kStr;
    const t = lines[k].t;
    if (indOf(t) !== lim) return;
    let m = /function\s+(\w+)/.exec(t);
    if (m) {
      o.push({ n: k, e: fm[k], l: `function ${m[1]}` });
      return;
    }
    m = /^\s*"([\w@/.-]+)"\s*:/.exec(t);
    if (m) {
      o.push({ n: k, e: fm[k], l: m[1] });
      return;
    }
    m = /^<(\w+)/.exec(t);
    if (m) {
      o.push({ n: k, e: fm[k], l: `<${m[1]}>` });
      return;
    }
    o.push({ n: k, e: fm[k], l: t.trim().replace(/\s*[{(]\s*$/, "") });
  });
  return o;
}

const TOKEN_CLASS: Record<string, string> = {
  k: "ll:text-primary ll:font-medium", // Keyword
  t: "ll:text-primary ll:font-medium", // Tag
  s: "ll:text-secondary",              // String
  a: "ll:text-secondary",              // Attribute
  n: "ll:text-secondary",              // Number
  c: "ll:text-muted ll:italic",        // Comment
  p: "ll:text-muted",                  // Delimiter / punctuation
  "": "ll:text-primary",
};

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({
  code,
  lines: propLines,
  language = "tsx",
  highlightedLine,
  highlightedRanges = [],
  changedLines,
  onLineClick,
  onLineHover,
  wrap = false,
  className = "",
  showLineNumbers = true,
  folds = {},
  onToggleFold,
  onStickyScopeChange,
  scrollRef: externalScrollRef,
}) => {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef || internalScrollRef;

  const lines = useMemo<EmittedLine[]>(() => {
    if (propLines) return propLines;
    if (code != null) {
      return code.split("\n").map((t) => ({ t }));
    }
    return [];
  }, [propLines, code]);

  const fMap = useMemo(() => foldMap(lines), [lines]);
  const sList = useMemo(() => scopeList(lines, language), [lines, language]);

  // Hidden lines due to folding
  const hiddenLines = useMemo(() => {
    const hid: Record<number, boolean> = {};
    Object.keys(folds).forEach((kStr) => {
      const k = +kStr;
      if (folds[k] && fMap[k] != null) {
        for (let i = k + 1; i <= fMap[k]; i++) {
          hid[i] = true;
        }
      }
    });
    return hid;
  }, [folds, fMap]);

  // Track sticky scope on scroll
  const handleScroll = useCallback((e: Event) => {
    const el = e.currentTarget as HTMLElement | null;
    if (!el || !onStickyScopeChange) return;
    const top = el.scrollTop;
    const rowEls = el.querySelectorAll<HTMLElement>(".ll-cl");
    let hit: { label: string; line: number } | null = null;

    for (const s of sList) {
      const a = rowEls[s.n];
      const b = rowEls[s.e];
      if (a && b && a.offsetTop < top - 2 && b.offsetTop + b.offsetHeight > top + 20) {
        hit = { label: s.l, line: s.n };
        break;
      }
    }
    onStickyScopeChange(hit);
  }, [sList, onStickyScopeChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, scrollRef]);

  // Scroll the selected range into view when the selection changes
  const selStart = highlightedRanges.length ? highlightedRanges[0][0] : null;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || selStart == null) return;
    const row = el.querySelector<HTMLElement>(`.ll-cl[data-n="${selStart}"]`);
    if (!row) return;
    const top = row.offsetTop;
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - row.offsetHeight * 3) {
      el.scrollTo({ top: Math.max(0, top - row.offsetHeight * 2), behavior: "smooth" });
    }
  }, [selStart, scrollRef]);

  // Render tokens for a line, supporting flash diff highlight
  const renderLineTokens = (text: string, lineIdx: number, lang: string) => {
    const tokens = tokLine(text, lang);
    const mark = changedLines?.[lineIdx];

    if (!mark) {
      return tokens.map((tk, i) => (
        <span key={i} className={TOKEN_CLASS[tk.c] || "ll:text-primary"}>
          {tk.t}
        </span>
      ));
    }

    // Split tokens around marked diff range
    let pos = 0;
    const parts: React.ReactNode[] = [];
    tokens.forEach((tk, idx) => {
      const a = pos;
      const b = pos + tk.t.length;
      pos = b;

      if (b <= mark[0] || a >= mark[1]) {
        parts.push(
          <span key={idx} className={TOKEN_CLASS[tk.c] || "ll:text-primary"}>
            {tk.t}
          </span>
        );
      } else {
        const i0 = Math.max(a, mark[0]) - a;
        const i1 = Math.min(b, mark[1]) - a;
        const before = tk.t.slice(0, i0);
        const mid = tk.t.slice(i0, i1);
        const after = tk.t.slice(i1);

        parts.push(
          <React.Fragment key={idx}>
            {before && <span className={TOKEN_CLASS[tk.c] || "ll:text-primary"}>{before}</span>}
            {mid && (
              <span className={`ll:rounded-xs ll:bg-select-bg ll:text-select-fg ${TOKEN_CLASS[tk.c] || ""}`}>
                {mid}
              </span>
            )}
            {after && <span className={TOKEN_CLASS[tk.c] || "ll:text-primary"}>{after}</span>}
          </React.Fragment>
        );
      }
    });

    return parts;
  };

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      role="textbox"
      aria-readonly="true"
      aria-multiline="true"
      aria-label="Code viewer"
      className={`ll-cscroll ll:relative ll:h-full ll:w-full ll:overflow-auto ll:pt-2 ll:pb-3 ll:px-0 ll:font-mono ll:text-small ll:leading-5 ll:text-primary ll:outline-none ${
        wrap ? "ll:whitespace-pre-wrap ll:break-words" : "ll:whitespace-pre"
      } ${className}`}
      onMouseLeave={() => onLineHover?.(null)}
    >
      {lines.map((line, idx) => {
        if (hiddenLines[idx]) return null;

        const isCurrent = highlightedLine === idx;
        const isSelected = highlightedRanges.some(([s, e]) => idx >= s && idx <= e);
        const canFold = fMap[idx] != null;
        const isFolded = canFold && !!folds[idx];

        return (
          <div
            key={idx}
            data-n={idx}
            data-ref={line.ref || undefined}
            onClick={() => onLineClick?.(idx, line.t, line.ref)}
            onMouseEnter={() => line.ref && onLineHover?.(line.ref)}
            className={`ll-cl ll:flex ll:min-h-5 ll:min-w-max ll:transition-colors ${
              wrap ? "ll:min-w-0" : ""
            } ${
              isSelected
                ? "ll:bg-select-bg ll:shadow-indicator-active"
                : isCurrent
                ? "ll:bg-surface-hover"
                : ""
            }`}
          >
            {/* Gutter with fold chevron (width 24px) */}
            <span className="ll-cg ll:w-6 ll:h-5 ll:shrink-0 ll:grid ll:place-items-center ll:items-center ll:justify-center ll:select-none">
              {canFold ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={isFolded ? `Unfold line ${idx + 1}` : `Fold line ${idx + 1}`}
                  aria-expanded={!isFolded}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFold?.(idx);
                  }}
                  className="ll-cf ll:w-5 ll:h-5 ll:inline-flex ll:items-center ll:justify-center ll:rounded-xs ll:border-0 ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer ll:p-0"
                >
                  <Icon
                    icon={ChevronRight}
                    size={12}
                    className={`ll:transition-transform ll:duration-150 ${
                      !isFolded ? "ll:rotate-90" : ""
                    }`}
                  />
                </button>
              ) : null}
            </span>

            {/* Line number (36px width, right-aligned, padding-right 16px) */}
            {showLineNumbers && (
              <span
                aria-hidden="true"
                className={`ll-cn ll:w-9 ll:shrink-0 ll:text-right ll:pr-4 ll:select-none ${
                  isCurrent || isSelected
                    ? "ll:text-primary ll:font-medium"
                    : "ll:text-muted"
                }`}
              >
                {idx + 1}
              </span>
            )}

            {/* Code text */}
            <span className="ll-ct ll:flex-1 ll:pr-6 ll:font-mono ll:text-small ll:leading-5">
              {renderLineTokens(line.t, idx, language)}
            </span>

            {/* Fold ellipsis button */}
            {canFold && isFolded && (
              <button
                type="button"
                tabIndex={-1}
                aria-label="Unfold"
                title="Unfold"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFold?.(idx);
                }}
                className="ll-cfd ll:self-center ll:h-4 ll:ml-1 ll:px-1.5 ll:border ll:border-border ll:rounded-xs ll:font-mono ll:text-micro ll:leading-none ll:text-muted ll:hover:text-primary ll:hover:border-muted ll:bg-surface-bar ll:cursor-pointer"
              >
                …
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SyntaxHighlighter;

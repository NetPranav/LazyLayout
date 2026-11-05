"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  Trash2,
  Copy,
  Terminal,
  AlertCircle,
  AlertTriangle,
  Info,
  Circle,
  CornerDownLeft,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { DiagnosticBus } from "@/core/engine/DiagnosticBus";
import type { DiagnosticEvent } from "@/core/types/diagnostics";
import type { ConsoleViewProps } from "./types";

export interface LogItem {
  id: string;
  t: string;
  lvl: "info" | "warn" | "error" | "debug" | "cmd";
  src: string;
  msg: string;
  f?: string;
  ln?: number;
}

const DEFAULT_LOGS: LogItem[] = [
  { id: "l1", t: "14:02:09.118", lvl: "info", src: "compiler", msg: "Compiling 6 files" },
  { id: "l2", t: "14:02:09.431", lvl: "info", src: "compiler", msg: "Compiled in 313 ms" },
  { id: "l3", t: "14:02:09.502", lvl: "info", src: "api", msg: "GET /api/projects/my-project 200 · 84 ms" },
  {
    id: "l4",
    t: "14:02:09.644",
    lvl: "warn",
    src: "compiler",
    msg: "<img> without a sizes attribute may load a larger file than needed",
    f: "hero",
    ln: 4,
  },
  { id: "l5", t: "14:02:10.012", lvl: "info", src: "api", msg: "POST /api/assets/hero.jpg 201 · 212 ms" },
  { id: "l6", t: "14:02:10.230", lvl: "debug", src: "runtime", msg: "Hydrated the page in 18 ms" },
  { id: "l7", t: "14:02:11.870", lvl: "warn", src: "api", msg: "GET /api/fonts/Geist 304 · revalidated from cache" },
  {
    id: "l8",
    t: "14:02:12.356",
    lvl: "error",
    src: "compiler",
    msg: 'TS2322: Type "number" is not assignable to type "string"',
    f: "footer",
    ln: 2,
  },
  {
    id: "l9",
    t: "14:02:12.402",
    lvl: "warn",
    src: "compiler",
    msg: 'Unused import "MotionConfig"; remove it or use it',
    f: "hero",
    ln: 1,
  },
  { id: "l10", t: "14:02:13.904", lvl: "error", src: "api", msg: "POST /api/export 429 Too Many Requests · retry in 3 s" },
  { id: "l11", t: "14:02:17.021", lvl: "info", src: "api", msg: "POST /api/export 200 · 1.4 s" },
  { id: "l12", t: "14:02:17.230", lvl: "info", src: "compiler", msg: "Watching for changes" },
];

const FILTERS = [
  { id: "All", label: "All" },
  { id: "error", label: "Errors" },
  { id: "warn", label: "Warnings" },
  { id: "compiler", label: "Compiler" },
  { id: "api", label: "API" },
] as const;

function nowTime(): string {
  const d = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export const ConsoleView: React.FC<ConsoleViewProps> = ({
  initialLogs,
  onCommand,
  onJumpToFile,
  className = "",
  style,
}) => {
  const [logs, setLogs] = useState<LogItem[]>(initialLogs || DEFAULT_LOGS);
  const [filter, setFilter] = useState<string>("All");
  const [query, setQuery] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [inputVal, setInputVal] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to central DiagnosticBus for live events
  useEffect(() => {
    const unsub = DiagnosticBus.subscribe((evt: DiagnosticEvent) => {
      const lvl: LogItem["lvl"] =
        evt.severity === "error" ? "error" : evt.severity === "warning" ? "warn" : "info";
      const src =
        evt.channel.includes("API")
          ? "api"
          : evt.channel.includes("DB")
          ? "database"
          : "compiler";

      const newItem: LogItem = {
        id: `diag-${evt.id}`,
        t: nowTime(),
        lvl,
        src,
        msg: evt.message + (evt.suggestion ? ` (${evt.suggestion})` : ""),
      };

      setLogs((prev) => [...prev, newItem]);
    });
    return unsub;
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (filter === "error" && l.lvl !== "error") return false;
      if (filter === "warn" && l.lvl !== "warn") return false;
      if (filter === "compiler" && l.src !== "compiler") return false;
      if (filter === "api" && l.src !== "api") return false;

      if (q) {
        const full = `${l.src} ${l.msg}`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
  }, [logs, filter, query]);

  // Scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length]);

  const handleClear = useCallback(() => {
    setLogs([]);
  }, []);

  const handleCopyAll = useCallback(() => {
    const text = filteredLogs
      .map((l) => `${l.t} [${l.lvl.toUpperCase()}] ${l.src}: ${l.msg}`)
      .join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }, [filteredLogs]);

  const runCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);

    const userEntry: LogItem = {
      id: `cmd-${Date.now()}`,
      t: nowTime(),
      lvl: "cmd",
      src: "you",
      msg: trimmed,
    };
    setLogs((prev) => [...prev, userEntry]);
    onCommand?.(trimmed);

    const k = trimmed.split(/\s+/)[0].toLowerCase();
    if (k === "help") {
      const helps = [
        "help · list the commands",
        "clear · clear the log",
        "build · build the project and print a summary",
        "version · print the version",
      ];
      helps.forEach((h, i) => {
        setTimeout(() => {
          setLogs((prev) => [
            ...prev,
            { id: `h-${Date.now()}-${i}`, t: nowTime(), lvl: "info", src: "console", msg: h },
          ]);
        }, 60 + i * 60);
      });
    } else if (k === "clear") {
      setLogs([]);
    } else if (k === "version") {
      setLogs((prev) => [
        ...prev,
        {
          id: `ver-${Date.now()}`,
          t: nowTime(),
          lvl: "info",
          src: "console",
          msg: "Lazy Layout 0.9.2 · compiler 0.9.2 · Next.js · Tailwind",
        },
      ]);
    } else if (k === "build") {
      const seq = [
        "Building for production (Next.js, Tailwind)",
        "Compiled src/components/Hero.tsx · 1.4 KB",
        "Compiled src/components/Features.tsx · 1.2 KB",
        "Compiled src/components/Footer.tsx · 0.8 KB",
        "Build complete: 6 files · 6.2 KB · 0 errors",
      ];
      seq.forEach((msg, i) => {
        setTimeout(() => {
          setLogs((prev) => [
            ...prev,
            { id: `b-${Date.now()}-${i}`, t: nowTime(), lvl: "info", src: "compiler", msg },
          ]);
        }, 80 + i * 110);
      });
    } else {
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          t: nowTime(),
          lvl: "error",
          src: "console",
          msg: `Command not found: ${k}. Type help for the list.`,
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCommand(inputVal);
      setInputVal("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const nextIdx = historyIdx < 0 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInputVal(history[nextIdx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!history.length || historyIdx < 0) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setInputVal("");
      } else {
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx] || "");
      }
    }
  };

  const renderLevelIcon = (lvl: LogItem["lvl"]) => {
    switch (lvl) {
      case "error":
        return <Icon icon={AlertCircle} size={14} className="ll:text-primary" />;
      case "warn":
        return <Icon icon={AlertTriangle} size={14} className="ll:text-secondary" />;
      case "info":
        return <Icon icon={Info} size={14} className="ll:text-muted" />;
      case "debug":
        return <Icon icon={Circle} size={10} className="ll:text-muted" />;
      case "cmd":
        return <Icon icon={Terminal} size={14} className="ll:text-primary" />;
    }
  };

  return (
    <div
      className={`ll-v-console ll:flex ll:flex-col ll:h-full ll:w-full ll:bg-surface-panel ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* 1. Toolbar (44px, matching prototype .ctool) */}
      <div className="ll-ctool ll:h-11 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:px-3 ll:border-b ll:border-border ll:select-none">
        {/* Segmented Filter Control */}
        <div
          role="group"
          aria-label="Filter the log"
          className="ll-seg ll:flex ll:items-center ll:gap-0.5 ll:p-0.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm"
        >
          {FILTERS.map((f) => {
            const isSelected = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setFilter(f.id)}
                className={`ll:h-6 ll:px-2.5 ll:rounded-xs ll:font-sans ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ll:transition-colors ${
                  isSelected
                    ? "ll:bg-control-active ll:text-primary"
                    : "ll:bg-transparent ll:text-muted ll:hover:text-primary"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search Input (240px width, matching prototype .cfs) */}
        <div className="ll-cfs ll:flex ll:items-center ll:gap-2 ll:w-60 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:focus-within:border-primary ll:rounded-sm">
          <Icon icon={Search} size={13} className="ll:text-muted ll:shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the log"
            aria-label="Search the log"
            autoComplete="off"
            className="ll:w-full ll:bg-transparent ll:border-0 ll:outline-none ll:font-sans ll:text-small ll:text-primary ll:placeholder:text-muted ll:p-0"
          />
        </div>

        <div className="ll:flex-1" />

        {/* Action Buttons: Clear, Copy All */}
        <div className="ll:flex ll:items-center ll:gap-1.5">
          <button
            type="button"
            onClick={handleClear}
            className="ll-btn ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-2.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer ll:transition-colors"
          >
            <Icon icon={Trash2} size={13} className="ll:text-muted" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            className="ll-btn ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-2.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer ll:transition-colors"
          >
            <Icon icon={Copy} size={13} className="ll:text-muted" />
            <span>{copied ? "Copied" : "Copy all"}</span>
          </button>
        </div>
      </div>

      {/* 2. Log Stream (.clog in prototype) */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Log"
        className="ll-clog ll:flex-1 ll:min-h-0 ll:overflow-auto ll:py-1 ll:font-mono ll:text-small ll:leading-relaxed ll:flex ll:flex-col"
      >
        {filteredLogs.length === 0 ? (
          <div className="ll-cempty ll:flex-1 ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-1 ll:text-muted ll:p-6 ll:text-center ll:select-none">
            <Icon icon={Terminal} size={20} className="ll:text-muted ll:mb-1" />
            <span className="ll:text-body ll:text-secondary">
              {logs.length ? "Nothing matches the filter" : "The log is empty"}
            </span>
            <span className="ll:text-small ll:text-muted">
              {logs.length ? "Try another filter or clear the search" : "Type build or help in the command line"}
            </span>
          </div>
        ) : (
          filteredLogs.map((l) => {
            const locText = l.f && l.ln ? `${l.f}.tsx:${l.ln}` : "";
            return (
              <div
                key={l.id}
                role={locText ? "button" : undefined}
                tabIndex={locText ? 0 : undefined}
                onClick={() => l.f && l.ln && onJumpToFile?.(l.f, l.ln - 1)}
                className={`ll-lr ll:grid ll:grid-cols-console-row ll:gap-3 ll:items-start ll:px-4 ll:py-1 ll:text-secondary ll:relative ${
                  locText ? "ll:cursor-pointer ll:hover:bg-surface-hover" : ""
                } ${
                  l.lvl === "error"
                    ? "ll:shadow-indicator-active"
                    : l.lvl === "warn"
                    ? "ll:shadow-indicator-muted"
                    : ""
                }`}
              >
                {/* Timestamp */}
                <span className="ll-lt ll:text-muted ll:whitespace-nowrap">{l.t}</span>

                {/* Level Icon */}
                <span className="ll-li ll:inline-flex ll:items-center ll:justify-center ll:mt-0.5">
                  {renderLevelIcon(l.lvl)}
                </span>

                {/* Source Tag */}
                <span className="ll-ls ll:text-muted ll:truncate">{l.src}</span>

                {/* Message */}
                <span
                  className={`ll-lm ll:whitespace-pre-wrap ll:break-words ll:min-w-0 ${
                    l.lvl === "error" || l.lvl === "cmd"
                      ? "ll:text-primary ll:font-medium"
                      : l.lvl === "debug"
                      ? "ll:text-muted"
                      : "ll:text-secondary"
                  }`}
                >
                  {l.msg}
                </span>

                {/* Location Link */}
                {locText ? (
                  <span className="ll-lloc ll:text-secondary ll:underline ll:underline-offset-2 ll:whitespace-nowrap">
                    {locText}
                  </span>
                ) : (
                  <span />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Command Line Prompt (40px, matching prototype .cprompt) */}
      <div className="ll-cprompt ll:h-10 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:px-4 ll:border-t ll:border-border ll:bg-surface-panel ll:focus-within:shadow-[inset_0_1px_0_var(--ll-text-primary)]">
        <Icon icon={CornerDownLeft} size={14} className="ll:text-primary ll:shrink-0" />
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command, for example help"
          aria-label="Console command line"
          autoComplete="off"
          spellCheck={false}
          className="ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:outline-none ll:font-mono ll:text-small ll:text-primary ll:placeholder:text-muted ll:p-0"
        />
      </div>
    </div>
  );
};

export default ConsoleView;

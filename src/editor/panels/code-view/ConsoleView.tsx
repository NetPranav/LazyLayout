"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Trash2, Copy } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { ProtoIcon } from "@/editor/components/icons/ProtoIcon";
import {
  useConsoleLogs,
  consoleStore,
  type ConsoleLogItem,
} from "@/editor/panels/console/consoleStore";
import { fName, DEFAULT_CODE_STATE } from "./codeGenerator";
import type { ConsoleViewProps } from "./types";

export type LogItem = ConsoleLogItem;

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
  const storeLogs = useConsoleLogs();
  const [localLogs, setLocalLogs] = useState<LogItem[] | null>(initialLogs ?? null);
  const logs = localLogs ?? storeLogs;

  const [filter, setFilter] = useState<string>("All");
  const [query, setQuery] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [inputVal, setInputVal] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (localLogs) setLocalLogs([]);
    consoleStore.clear();
  }, [localLogs]);

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

    const userEntry = consoleStore.appendLog("cmd", "you", trimmed);
    if (localLogs) {
      setLocalLogs((prev) => [...(prev || []), userEntry]);
    }
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
          const item = consoleStore.appendLog("info", "console", h);
          if (localLogs) setLocalLogs((prev) => [...(prev || []), item]);
        }, 60 + i * 60);
      });
    } else if (k === "clear") {
      handleClear();
    } else if (k === "version") {
      const item = consoleStore.appendLog(
        "info",
        "console",
        "Lazy Layout 0.9.2 · compiler 0.9.2 · Next.js · Tailwind"
      );
      if (localLogs) setLocalLogs((prev) => [...(prev || []), item]);
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
          const item = consoleStore.appendLog("info", "compiler", msg);
          if (localLogs) setLocalLogs((prev) => [...(prev || []), item]);
        }, 80 + i * 110);
      });
    } else {
      const item = consoleStore.appendLog(
        "error",
        "console",
        `Command not found: ${k}. Type help for the list.`
      );
      if (localLogs) setLocalLogs((prev) => [...(prev || []), item]);
    }
  };

  const renderHighlightedMessage = (msg: string, qStr: string) => {
    const q = qStr.trim().toLowerCase();
    if (!q || !msg.toLowerCase().includes(q)) {
      return msg;
    }
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const lower = msg.toLowerCase();
    let matchIdx = lower.indexOf(q);
    let pieceId = 0;

    while (matchIdx !== -1) {
      if (matchIdx > lastIdx) {
        parts.push(msg.slice(lastIdx, matchIdx));
      }
      parts.push(
        <span
          key={`hit-${pieceId++}`}
          className="hit ll:bg-control-active ll:text-primary ll:font-medium ll:rounded-xs"
        >
          {msg.slice(matchIdx, matchIdx + q.length)}
        </span>
      );
      lastIdx = matchIdx + q.length;
      matchIdx = lower.indexOf(q, lastIdx);
    }
    if (lastIdx < msg.length) {
      parts.push(msg.slice(lastIdx));
    }
    return parts;
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
        return <ProtoIcon name="errc" size={14} className="ll-li li ll:mt-0.5 ll:text-syn-tag" />;
      case "warn":
        return <ProtoIcon name="warn" size={14} className="ll-li li ll:mt-0.5 ll:text-syn-attr" />;
      case "info":
        return <ProtoIcon name="infoc" size={14} className="ll-li li ll:mt-0.5 ll:text-syn-fn" />;
      case "debug":
        return <ProtoIcon name="dot" size={14} className="ll-li li ll:mt-0.5 ll:text-muted" />;
      case "cmd":
        return <ProtoIcon name="prompt" size={14} className="ll-li li ll:mt-0.5 ll:text-primary" />;
    }
  };

  return (
    <div
      className={`ll-v-console v-console ll:flex ll:flex-col ll:h-full ll:w-full ll:bg-surface-panel ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* 1. Toolbar (44px, matching prototype .ctool) */}
      <div className="ll-ctool ctool ll:h-11 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:pl-4 ll:pr-3 ll:border-b ll:border-border ll:select-none">
        {/* Segmented Filter Control (#cfseg with fixed button widths per P) */}
        <div
          id="cfseg"
          role="group"
          aria-label="Filter the log"
          className="ll-seg ll-pseg ll-dseg seg pseg dseg ll:flex ll:items-center ll:gap-px ll:p-px ll:h-7 ll:border ll:border-border ll:rounded-md ll:shrink-0 ll:w-auto"
        >
          {FILTERS.map((f) => {
            const isSelected = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                data-cf={f.id}
                aria-pressed={isSelected}
                onClick={() => setFilter(f.id)}
                className={`ll:shrink-0 ll:h-6 ll:px-3 ll:whitespace-nowrap ll:rounded-sm ll:flex ll:items-center ll:gap-1.5 ll:font-sans ll:text-micro ll:tracking-normal ll:leading-[1.4] ll:font-normal ll:border-0 ll:cursor-pointer ${
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
        <div className="ll-cfs cfs ll:flex ll:items-center ll:gap-2 ll:w-60 ll:h-7 ll:px-2 ll:bg-surface-canvas ll:border ll:border-border ll:focus-within:border-primary! ll:rounded-sm ll:text-muted ll:shrink-0">
          <Icon icon={Search} size={16} className="ll:shrink-0" />
          <input
            id="cq"
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
        <div className="ll:flex ll:items-center ll:gap-2">
          <button
            type="button"
            data-ca="conclear"
            onClick={handleClear}
            className="ll-btn btn sm ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-2 ll:bg-transparent ll:border ll:border-border ll:hover:bg-surface-hover ll:rounded-md ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer"
          >
            <Icon icon={Trash2} size={14} />
            <span>Clear</span>
          </button>

          <button
            type="button"
            data-ca="concopy"
            onClick={handleCopyAll}
            className="ll-btn btn sm ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-2 ll:bg-transparent ll:border ll:border-border ll:hover:bg-surface-hover ll:rounded-md ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer"
          >
            <Icon icon={Copy} size={14} />
            <span>{copied ? "Copied" : "Copy all"}</span>
          </button>
        </div>
      </div>

      {/* 2. Log Stream (.clog in prototype) */}
      <div
        id="clog"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Log"
        className="ll-clog clog ll:flex-1 ll:min-h-0 ll:overflow-auto ll:py-1 ll:font-mono ll:text-small ll:leading-[18px] ll:flex ll:flex-col"
      >
        {filteredLogs.length === 0 ? (
          <div className="ll-cempty cempty ll:flex-1 ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-1 ll:text-muted ll:p-6 ll:text-center ll:select-none">
            <ProtoIcon name="prompt" size={20} className="ll:text-muted ll:mb-1" />
            <span className="ll:text-body ll:text-secondary">
              {logs.length ? "Nothing matches the filter" : "The log is empty"}
            </span>
            <span className="cemh ll:text-small ll:text-muted">
              {logs.length ? "Try another filter or clear the search" : "Type build or help in the command line"}
            </span>
          </div>
        ) : (
          filteredLogs.map((l) => {
            const locText = l.f && l.ln ? `${fName(l.f, DEFAULT_CODE_STATE)}:${l.ln}` : "";
            const isErr = l.lvl === "error";
            const isWarn = l.lvl === "warn";
            const isInfo = l.lvl === "info";
            const isCmd = l.lvl === "cmd";
            const isDebug = l.lvl === "debug";

            const rowClass = isErr
              ? "l-error ll-l-error ll:shadow-[inset_2px_0_0_var(--ll-syn-tag)]"
              : isWarn
              ? "l-warn ll-l-warn ll:shadow-[inset_2px_0_0_var(--ll-syn-attr)]"
              : isInfo
              ? "l-info ll-l-info"
              : isCmd
              ? "l-cmd ll-l-cmd"
              : "l-debug ll-l-debug";

            return (
              <div
                key={l.id}
                data-id={l.id}
                role={locText ? "button" : undefined}
                tabIndex={locText ? 0 : undefined}
                onClick={() => l.f && l.ln && onJumpToFile?.(l.f, l.ln - 1)}
                className={`ll-lr lr ll:grid ll:grid-cols-console-row ll:gap-3 ll:items-start ll:px-4 ll:py-1 ll:text-secondary ll:relative ${
                  locText ? "ll:cursor-pointer ll:hover:bg-surface-hover" : ""
                } ${rowClass}`}
              >
                {/* Timestamp */}
                <span className="ll-lt lt ll:text-muted ll:whitespace-nowrap">{l.t}</span>

                {/* Level Icon */}
                {renderLevelIcon(l.lvl)}

                {/* Source Tag */}
                <span className="ll-ls ls ll:text-muted ll:truncate">{l.src}</span>

                {/* Message */}
                <span
                  className={`ll-lm lm ll:whitespace-pre-wrap ll:break-words ll:min-w-0 ${
                    isErr || isCmd
                      ? "ll:text-primary ll:font-medium"
                      : isDebug
                      ? "ll:text-muted"
                      : "ll:text-secondary"
                  }`}
                >
                  {renderHighlightedMessage(l.msg, query)}
                </span>

                {/* Location Link */}
                {locText ? (
                  <span className="ll-lloc lloc ll:text-secondary ll:underline ll:underline-offset-2 ll:whitespace-nowrap">
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
      <div className="ll-cprompt cprompt ll:h-10 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:px-4 ll:border-t ll:border-border ll:bg-surface-panel ll:text-secondary ll:cursor-text ll:focus-within:shadow-[inset_0_1px_0_var(--ll-text-primary)]">
        <ProtoIcon name="prompt" size={14} className="ll-cpr cpr ll:text-primary ll:shrink-0" />
        <input
          id="ccmd"
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

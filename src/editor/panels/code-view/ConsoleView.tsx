"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  X,
  ArrowDown,
  Copy,
  Check,
  Trash2,
  Play,
  Terminal,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { DiagnosticBus } from "@/core/engine/DiagnosticBus";
import type { DiagnosticEvent } from "@/core/types/diagnostics";
import {
  CONSOLE_CATEGORIES,
  INITIAL_CONSOLE_LOGS,
  CODE_VIEW_TIMINGS,
} from "./constants";
import type { ConsoleLogEntry, ConsoleViewProps } from "./types";

export const ConsoleView: React.FC<ConsoleViewProps> = ({
  initialLogs = INITIAL_CONSOLE_LOGS,
  onCommand,
  className = "",
  style,
}) => {
  const [logs, setLogs] = useState<ConsoleLogEntry[]>(initialLogs);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cliInput, setCliInput] = useState("");

  const streamRef = useRef<HTMLDivElement>(null);

  // Subscribe to central DiagnosticBus for real engine events
  useEffect(() => {
    const unsubscribe = DiagnosticBus.subscribe((event: DiagnosticEvent) => {
      const d = new Date(event.timestamp);
      const timeStr = `${d.toTimeString().split(" ")[0]}.${String(
        d.getMilliseconds()
      ).padStart(3, "0")}`;

      let category: ConsoleLogEntry["category"] = "compiler";
      if (
        event.channel === "DB_SCHEMA_ERR" ||
        event.channel === "BIND_ERR" ||
        event.channel === "MOCK_DB_ERR"
      ) {
        category = "database";
      } else if (
        event.channel === "MOCK_API_INFO" ||
        event.channel === "MOCK_API_ERR"
      ) {
        category = "api";
      } else if (
        event.channel === "ANIM_COMPAT" ||
        event.channel === "STATE_VAR_WARN"
      ) {
        category = "warning";
      } else if (event.channel === "BLUEPRINT_ERR") {
        category = "blueprint";
      } else if (event.severity === "error") {
        category = "error";
      } else if (event.severity === "warning") {
        category = "warning";
      }

      const level: ConsoleLogEntry["level"] =
        event.severity === "error"
          ? "error"
          : event.severity === "warning"
          ? "warn"
          : "info";

      const badge = event.channel;
      const entityTag = event.source.entityName
        ? `[${event.source.entityName}] `
        : event.source.entityId
        ? `[${event.source.entityId}] `
        : "";

      const fullMessage = `${entityTag}${event.message}${
        event.suggestion ? ` • Suggestion: ${event.suggestion}` : ""
      }${
        event.fallbackApplied !== undefined
          ? ` (Fallback applied: ${JSON.stringify(event.fallbackApplied)})`
          : ""
      }`;

      const entry: ConsoleLogEntry = {
        id: event.id,
        time: timeStr,
        category,
        level,
        badge,
        message: fullMessage,
      };

      setLogs((prev) => [...prev, entry]);
    });

    return unsubscribe;
  }, []);

  // Auto-scroll stream to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClear = useCallback(() => {
    setLogs([]);
  }, []);

  const handleCopy = useCallback(() => {
    const text = logs
      .map((l) => `[${l.time}] [${l.badge}] ${l.message}`)
      .join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), CODE_VIEW_TIMINGS.copyFeedbackMs);
  }, [logs]);

  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;

    onCommand?.(cmd);

    const time = `${new Date().toTimeString().split(" ")[0]}.000`;
    const userEntry: ConsoleLogEntry = {
      id: `cli_${Date.now()}`,
      time,
      category: "compiler",
      level: "info",
      badge: "COMMAND",
      message: `> ${cmd}`,
    };

    let responseEntry: ConsoleLogEntry;

    if (cmd.toLowerCase() === "help") {
      responseEntry = {
        id: `res_${Date.now()}`,
        time,
        category: "compiler",
        level: "info",
        badge: "HELP",
        message:
          "Available commands: 'clear', 'build', 'fps', 'stats', 'version', 'test-bind', 'test-schema', 'reset'",
      };
    } else if (cmd.toLowerCase() === "clear") {
      setLogs([]);
      setCliInput("");
      return;
    } else if (cmd.toLowerCase() === "fps" || cmd.toLowerCase() === "stats") {
      responseEntry = {
        id: `res_${Date.now()}`,
        time,
        category: "compiler",
        level: "success",
        badge: "WASM_STATS",
        message:
          "C++ Hermite Engine: 120 FPS stable • Frame Time: 0.8ms • GPU Cable Physics active",
      };
    } else if (cmd.toLowerCase() === "build") {
      responseEntry = {
        id: `res_${Date.now()}`,
        time,
        category: "compiler",
        level: "success",
        badge: "BUILD",
        message:
          "Production bundle generated in 240ms • Output: standalone Next.js 15 App",
        timing: "240ms",
      };
    } else if (cmd.toLowerCase() === "version") {
      responseEntry = {
        id: `res_${Date.now()}`,
        time,
        category: "compiler",
        level: "info",
        badge: "SYSTEM",
        message: "Lazy Layout Visual Motion Studio v2.0 • Code Mode Engine",
      };
    } else {
      responseEntry = {
        id: `res_${Date.now()}`,
        time,
        category: "compiler",
        level: "info",
        badge: "EXEC",
        message: `Command executed: '${cmd}' (return code: 0)`,
      };
    }

    setLogs((prev) => [...prev, userEntry, responseEntry]);
    setCliInput("");
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesFilter =
        activeCategory === "all" ||
        (activeCategory === "error" && log.level === "error") ||
        (activeCategory === "warning" && log.level === "warn") ||
        log.category === activeCategory;

      const matchesSearch =
        !searchQuery.trim() ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.badge.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [logs, activeCategory, searchQuery]);

  return (
    <div
      role="region"
      aria-label="Output Log & Console"
      className={`ll:flex ll:flex-col ll:h-full ll:w-full ll:bg-surface-panel ll:box-border ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* Top Filter and Action Toolbar */}
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:px-3 ll:py-1.5 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:select-none">
        {/* Category Tabs */}
        <div
          role="tablist"
          aria-label="Console categories"
          className="ll:flex ll:items-center ll:gap-1 ll:overflow-x-auto"
        >
          {CONSOLE_CATEGORIES.map((cat) => {
            const count =
              cat.id === "all"
                ? logs.length
                : cat.id === "error"
                ? logs.filter((l) => l.level === "error").length
                : cat.id === "warning"
                ? logs.filter((l) => l.level === "warn").length
                : logs.filter((l) => l.category === cat.id).length;

            const isSelected = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveCategory(cat.id)}
                className={`ll:inline-flex ll:items-center ll:gap-1.5 ll:px-2 ll:h-6 ll:text-small ll:font-medium ll:rounded-sm ll:box-border ll:cursor-pointer ll:transition-colors ll:duration-75 ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
                  isSelected
                    ? "ll:bg-select-bg ll:text-select-fg ll:font-semibold"
                    : "ll:bg-transparent ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
                }`}
              >
                <span>{cat.label}</span>
                <span className="ll:font-mono ll:text-nano ll:opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar Controls */}
        <div className="ll:flex ll:items-center ll:gap-1 ll:shrink-0">
          {/* Search Box */}
          <div className="ll:relative ll:inline-flex ll:items-center ll:box-border ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:h-6 ll:px-1.5 ll:w-36 ll:focus-within:border-primary">
            <Icon icon={Search} size={11} className="ll:text-muted ll:mr-1" />
            <input
              type="text"
              placeholder="Search logs..."
              aria-label="Search logs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ll:w-full ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-micro ll:font-sans ll:text-primary ll:placeholder:text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="ll:border-0 ll:bg-transparent ll:p-0 ll:cursor-pointer ll:text-muted ll:hover:text-primary"
              >
                <Icon icon={X} size={10} />
              </button>
            )}
          </div>

          <IconButton
            size="sm"
            aria-label="Toggle Auto-Scroll"
            tooltip="Toggle Auto-Scroll"
            pressed={autoScroll}
            icon={<Icon icon={ArrowDown} size={12} />}
            onClick={() => setAutoScroll((prev) => !prev)}
          />

          <IconButton
            size="sm"
            aria-label="Copy logs"
            tooltip={copied ? "Copied!" : "Copy logs"}
            icon={<Icon icon={copied ? Check : Copy} size={12} />}
            onClick={handleCopy}
          />

          <IconButton
            size="sm"
            aria-label="Clear console"
            tooltip="Clear console"
            icon={<Icon icon={Trash2} size={12} />}
            onClick={handleClear}
          />
        </div>
      </div>

      {/* Log Output Stream */}
      <div
        ref={streamRef}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-label="Log stream"
        className="ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:p-3 ll:font-mono ll:text-small ll:leading-relaxed ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
      >
        {filteredLogs.length === 0 ? (
          <div className="ll:flex ll:items-center ll:justify-center ll:h-full ll:text-muted ll:text-small ll:font-sans">
            No log entries match the current filter.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="ll:flex ll:items-start ll:gap-2 ll:py-0.5 ll:hover:bg-surface-hover ll:rounded-xs ll:px-1 ll:transition-colors ll:duration-75"
            >
              <span className="ll:text-muted ll:text-nano ll:shrink-0 ll:select-none">
                {log.time}
              </span>
              <span className="ll:bg-surface-bar ll:border ll:border-border ll:text-secondary ll:text-nano ll:font-semibold ll:px-1 ll:py-0.25 ll:rounded-xs ll:shrink-0 ll:select-none">
                {log.badge}
              </span>
              <span
                className={`ll:flex-1 ll:break-all ${
                  log.level === "error"
                    ? "ll:text-primary ll:font-semibold"
                    : log.level === "warn"
                    ? "ll:text-primary"
                    : "ll:text-secondary"
                }`}
              >
                {log.message}
              </span>
              {log.timing && (
                <span className="ll:text-muted ll:text-nano ll:shrink-0">
                  [{log.timing}]
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Interactive Command Prompt */}
      <form
        onSubmit={handleCliSubmit}
        className="ll:flex ll:items-center ll:gap-2 ll:px-3 ll:h-8 ll:border-t ll:border-border ll:bg-surface-panel ll:shrink-0"
      >
        <span
          aria-hidden="true"
          className="ll:text-muted ll:font-mono ll:text-small ll:font-bold ll:select-none"
        >
          &gt;
        </span>
        <input
          type="text"
          placeholder="Type an engine command (e.g. 'help', 'fps', 'build', 'version')..."
          aria-label="Engine command prompt"
          value={cliInput}
          onChange={(e) => setCliInput(e.target.value)}
          className="ll:flex-1 ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-small ll:text-primary ll:placeholder:text-muted"
        />
        <IconButton
          type="submit"
          size="sm"
          aria-label="Execute command"
          tooltip="Execute command"
          icon={<Icon icon={Play} size={11} />}
        />
      </form>
    </div>
  );
};

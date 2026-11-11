"use client";

import { useSyncExternalStore } from "react";
import { DiagnosticBus } from "@/core/engine/DiagnosticBus";
import type { DiagnosticEvent } from "@/core/types/diagnostics";

export interface ConsoleLogItem {
  id: string;
  t: string;
  lvl: "info" | "warn" | "error" | "debug" | "cmd";
  src: string;
  msg: string;
  f?: string;
  ln?: number;
}

export const INITIAL_LOGS: ConsoleLogItem[] = [
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

function nowTime(): string {
  const d = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

const RUN_DELAY_MS = 1200;
const RUN_DURATION_MS = 412;

class ConsoleStore {
  private logs: ConsoleLogItem[] = [...INITIAL_LOGS];
  private listeners: Set<() => void> = new Set();
  private runListeners: Set<() => void> = new Set();
  private isSubscribedToDiagnosticBus = false;

  constructor() {
    this.ensureDiagnosticSubscription();
  }

  private ensureDiagnosticSubscription() {
    if (this.isSubscribedToDiagnosticBus) return;
    this.isSubscribedToDiagnosticBus = true;

    DiagnosticBus.subscribe((evt: DiagnosticEvent) => {
      const lvl: ConsoleLogItem["lvl"] =
        evt.severity === "error" ? "error" : evt.severity === "warning" ? "warn" : "info";
      const src =
        evt.channel.includes("API")
          ? "api"
          : evt.channel.includes("DB")
          ? "database"
          : "compiler";

      this.appendLog(
        lvl,
        src,
        evt.message + (evt.suggestion ? ` (${evt.suggestion})` : "")
      );
    });
  }

  public getSnapshot = (): ConsoleLogItem[] => {
    return this.logs;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public appendLog(
    lvl: ConsoleLogItem["lvl"],
    src: string,
    msg: string,
    extra?: { f?: string; ln?: number }
  ): ConsoleLogItem {
    const item: ConsoleLogItem = {
      id: `l_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      t: nowTime(),
      lvl,
      src,
      msg,
      f: extra?.f,
      ln: extra?.ln,
    };
    this.logs = [...this.logs, item];
    this.notify();
    return item;
  }

  public clear(): void {
    this.logs = [];
    this.notify();
  }

  public subscribeRun = (listener: () => void): (() => void) => {
    this.runListeners.add(listener);
    return () => {
      this.runListeners.delete(listener);
    };
  };

  /**
   * Run the generated code: after the toolbar spinner delay, the build line is
   * emitted on the DiagnosticBus (the subscription above appends it to the
   * log) and run listeners fire so the Code panel can reveal the Console.
   */
  public runCode(durationMs = RUN_DURATION_MS, delayMs = RUN_DELAY_MS): Promise<ConsoleLogItem> {
    return new Promise((resolve) => {
      setTimeout(() => {
        DiagnosticBus.emit({
          channel: "HOT_RELOAD_INFO",
          severity: "info",
          source: {
            panel: "Console",
            entityId: "compiler_run",
            entityName: "CodeRunner",
          },
          message: `Built in ${durationMs} ms`,
        });
        const log = this.logs[this.logs.length - 1];
        this.runListeners.forEach((l) => l());
        resolve(log);
      }, delayMs);
    });
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("[ConsoleStore] Listener error:", err);
      }
    });
  }
}

export const consoleStore = new ConsoleStore();

export function useConsoleLogs(): ConsoleLogItem[] {
  return useSyncExternalStore(consoleStore.subscribe, consoleStore.getSnapshot, () => INITIAL_LOGS);
}

export function runCode(durationMs?: number, delayMs?: number): Promise<ConsoleLogItem> {
  return consoleStore.runCode(durationMs, delayMs);
}

export function appendConsoleLog(
  lvl: ConsoleLogItem["lvl"],
  src: string,
  msg: string,
  extra?: { f?: string; ln?: number }
): ConsoleLogItem {
  return consoleStore.appendLog(lvl, src, msg, extra);
}

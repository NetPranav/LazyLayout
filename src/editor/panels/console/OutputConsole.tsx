"use client";

import React, { useState } from "react";
import { ConsoleView } from "@/editor/panels/code-view/ConsoleView";
import { TraceView } from "@/editor/panels/code-view/TraceView";

export interface OutputConsoleProps {
  className?: string;
  style?: React.CSSProperties;
  defaultView?: "console" | "trace";
}

/**
 * OutputConsole: Console and Trace views from prototype P (lines 6425-6583),
 * replacing the legacy bridge.
 */
export const OutputConsole: React.FC<OutputConsoleProps> = ({
  className = "",
  style,
  defaultView = "console",
}) => {
  const [view, setView] = useState<"console" | "trace">(defaultView);

  return (
    <div
      className={`ll-output-console ll:flex ll:flex-col ll:h-full ll:w-full ll:bg-surface-panel ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* View switch header if detached */}
      <div className="ll:h-8 ll:shrink-0 ll:flex ll:items-center ll:gap-1 ll:px-3 ll:border-b ll:border-border ll:bg-surface-bar ll:select-none">
        <button
          type="button"
          onClick={() => setView("console")}
          className={`ll:h-6 ll:px-2.5 ll:rounded-xs ll:font-sans ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ll:transition-colors ${
            view === "console"
              ? "ll:bg-control-active ll:text-primary"
              : "ll:bg-transparent ll:text-muted ll:hover:text-primary"
          }`}
        >
          Console
        </button>
        <button
          type="button"
          onClick={() => setView("trace")}
          className={`ll:h-6 ll:px-2.5 ll:rounded-xs ll:font-sans ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ll:transition-colors ${
            view === "trace"
              ? "ll:bg-control-active ll:text-primary"
              : "ll:bg-transparent ll:text-muted ll:hover:text-primary"
          }`}
        >
          Execution Trace
        </button>
      </div>

      <div className="ll:flex-1 ll:min-h-0 ll:overflow-hidden">
        {view === "console" ? <ConsoleView /> : <TraceView />}
      </div>
    </div>
  );
};

export default OutputConsole;

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Check,
  Circle,
  Plus,
  X,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";

export interface TraceStep {
  id: string;
  node: string;
  ms: number;
  at: number;
  hot: boolean;
}

export interface Breakpoint {
  id: string;
  on: boolean;
}

export interface TraceViewProps {
  className?: string;
  style?: React.CSSProperties;
}

const INITIAL_RAW_STEPS = [
  { id: "click", node: "click  a.cta", ms: 0.4 },
  { id: "handler", node: "onClick  Hero", ms: 1.2 },
  { id: "track", node: 'track("cta_click")', ms: 6.8 },
  { id: "route", node: 'router.push("/signup")', ms: 18.4 },
  { id: "fetch", node: "GET /api/session", ms: 124.6 },
  { id: "state", node: "setUser(user)", ms: 2.1 },
  { id: "render", node: "render  <Signup />", ms: 41.3 },
  { id: "effect", node: "useEffect  focus email", ms: 3.2 },
  { id: "paint", node: "paint", ms: 8.9 },
];

function buildSteps(): { steps: TraceStep[]; total: number } {
  let at = 0;
  const totalRaw = INITIAL_RAW_STEPS.reduce((sum, s) => sum + s.ms, 0);
  const steps: TraceStep[] = INITIAL_RAW_STEPS.map((s) => {
    const item: TraceStep = {
      id: s.id,
      node: s.node,
      ms: s.ms,
      at,
      hot: s.ms / totalRaw >= 0.15,
    };
    at += s.ms;
    return item;
  });
  return { steps, total: +at.toFixed(1) };
}

const { steps: TRACE_STEPS, total: TOTAL_DURATION } = buildSteps();

function stepEnd(i: number): number {
  const s = TRACE_STEPS[i];
  return s ? +(s.at + s.ms).toFixed(1) : 0;
}

function traceEnv(i: number) {
  return {
    step: i + 1,
    elapsed: stepEnd(i),
    loading: i >= 4 && i < 5,
    user: i >= 5 ? { id: "u_42", plan: "free" } : null,
    status: i >= 4 ? 200 : null,
    route: i >= 3 ? "/signup" : "/",
    focused: i >= 7,
  };
}

function evaluateExpr(ex: string, i: number): { v: string; e?: boolean } {
  const trimmed = ex.trim();
  if (!trimmed) return { v: "" };
  if (
    !/^[\w.\s+\-*/<>=!&|'"()?:]+$/.test(trimmed) ||
    /\b(function|constructor|window|document|this|eval)\b/.test(trimmed)
  ) {
    return { v: "Not an expression", e: true };
  }
  try {
    const fn = new Function("env", `with(env){ return (${trimmed}); }`);
    const val = fn(traceEnv(i));
    if (val === undefined) return { v: "undefined" };
    if (val === null) return { v: "null" };
    if (typeof val === "object") return { v: JSON.stringify(val) };
    return { v: String(val) };
  } catch {
    return { v: "Not defined", e: true };
  }
}

export const TraceView: React.FC<TraceViewProps> = ({ className = "", style }) => {
  const [cur, setCur] = useState<number>(4);
  const [playing, setPlaying] = useState<boolean>(false);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([{ id: "fetch", on: true }]);
  const [watchList, setWatchList] = useState<string[]>([
    "elapsed",
    "user",
    "status === 200",
  ]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pause = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPlaying(false);
  }, []);

  const stepForward = useCallback(() => {
    setCur((prev) => {
      const next = prev + 1;
      if (next >= TRACE_STEPS.length) {
        pause();
        return prev;
      }
      const s = TRACE_STEPS[next];
      const hit = breakpoints.some((b) => b.on && b.id === s.id);
      if (hit) {
        pause();
      }
      return next;
    });
  }, [breakpoints, pause]);

  const stepBack = useCallback(() => {
    pause();
    setCur((prev) => Math.max(0, prev - 1));
  }, [pause]);

  const togglePlay = useCallback(() => {
    if (playing) {
      pause();
    } else {
      if (cur >= TRACE_STEPS.length - 1) {
        setCur(0);
      }
      setPlaying(true);
    }
  }, [playing, cur, pause]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCur((prev) => {
          const next = prev + 1;
          if (next >= TRACE_STEPS.length) {
            pause();
            return prev;
          }
          const s = TRACE_STEPS[next];
          const hit = breakpoints.some((b) => b.on && b.id === s.id);
          if (hit) {
            pause();
          }
          return next;
        });
      }, 650);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, breakpoints, pause]);

  const toggleBreakpoint = (id: string) => {
    setBreakpoints((prev) => {
      const existing = prev.find((b) => b.id === id);
      if (existing) {
        return prev.filter((b) => b.id !== id);
      }
      return [...prev, { id, on: true }];
    });
  };

  const toggleBreakpointActive = (id: string) => {
    setBreakpoints((prev) =>
      prev.map((b) => (b.id === id ? { ...b, on: !b.on } : b))
    );
  };

  const removeBreakpoint = (id: string) => {
    setBreakpoints((prev) => prev.filter((b) => b.id !== id));
  };

  const addWatch = () => {
    setWatchList((prev) => [...prev, ""]);
  };

  const updateWatch = (idx: number, val: string) => {
    setWatchList((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const removeWatch = (idx: number) => {
    setWatchList((prev) => prev.filter((_, i) => i !== idx));
  };

  const currentStep = TRACE_STEPS[cur] || TRACE_STEPS[0];

  return (
    <div
      className={`ll-v-trace trw0 v-trace ll:grid ll:grid-cols-trace-main ll:h-full ll:w-full ll:bg-surface-panel ll:overflow-hidden ${className}`}
      style={style}
    >
      {/* Left: Main Steps List */}
      <div className="ll-trmain trmain ll:flex ll:flex-col ll:min-w-0 ll:h-full ll:overflow-hidden">
        {/* Trace Bar (44px, matching prototype .trbar) */}
        <div className="ll-trbar trbar ll:h-11 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:px-3 ll:border-b ll:border-border ll:select-none">
          <button
            type="button"
            data-ca="trback"
            aria-label="Step back"
            title="Step back"
            onClick={stepBack}
            className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
          >
            <Icon icon={SkipBack} size={14} />
          </button>

          <button
            type="button"
            id="trplay"
            data-ca="trplay"
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
            onClick={togglePlay}
            className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
          >
            <Icon icon={playing ? Pause : Play} size={14} />
          </button>

          <button
            type="button"
            data-ca="trfwd"
            aria-label="Step forward"
            title="Step forward"
            onClick={stepForward}
            className="ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:cursor-pointer"
          >
            <Icon icon={SkipForward} size={14} />
          </button>

          {/* Scrubber Range */}
          <input
            id="trscr"
            type="range"
            min={0}
            max={TRACE_STEPS.length - 1}
            step={1}
            value={cur}
            onChange={(e) => {
              pause();
              setCur(+e.target.value);
            }}
            aria-label="Scrub the run"
            className="ll:flex-1 ll:max-w-sm ll:mx-3 ll:accent-primary ll:cursor-pointer"
          />

          <span id="trinfo" className="ll-trinfo trinfo mono ll:font-mono ll:text-micro ll:text-muted ll:truncate ll:whitespace-nowrap">
            {currentStep.node.replace(/\s+/g, " ")} · {stepEnd(cur)} ms
          </span>
        </div>

        {/* Trace Table Header (28px, matching prototype .trhead) */}
        <div className="ll-trhead trhead ll:h-7 ll:shrink-0 ll:grid ll:grid-cols-trace-row ll:gap-3 ll:items-center ll:px-4 ll:border-b ll:border-border ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:select-none">
          <span />
          <span>Step</span>
          <span>Waterfall</span>
          <span className="r ll:text-right">Time</span>
          <span>Status</span>
        </div>

        {/* Steps List (.trlist) */}
        <div
          id="trlist"
          role="listbox"
          aria-label="Steps"
          className="ll-trlist trlist ll:flex-1 ll:min-h-0 ll:overflow-auto ll:font-mono ll:text-small"
        >
          {TRACE_STEPS.map((s, idx) => {
            const isDone = idx < cur;
            const isRun = idx === cur;
            const bp = breakpoints.find((b) => b.id === s.id);
            const leftPct = (s.at / TOTAL_DURATION) * 100;
            const widthPct = Math.max(1.2, (s.ms / TOTAL_DURATION) * 100);

            return (
              <div
                key={s.id}
                role="option"
                data-i={idx}
                aria-selected={isRun}
                onClick={() => {
                  pause();
                  setCur(idx);
                }}
                className={`ll-trr trr ${s.hot ? "hot " : ""}${isRun ? "cur " : isDone ? "done " : "wait "}ll:h-8 ll:grid ll:grid-cols-trace-row ll:gap-3 ll:items-center ll:px-4 ll:cursor-pointer ll:transition-colors ${
                  isRun
                    ? "ll:bg-select-bg ll:text-select-fg"
                    : isDone
                    ? "ll:text-primary ll:hover:bg-surface-hover"
                    : "ll:text-muted ll:hover:bg-surface-hover"
                }`}
              >
                {/* Gutter Breakpoint Toggle */}
                <button
                  type="button"
                  data-ca="trbp"
                  data-id={s.id}
                  aria-label={bp ? "Remove breakpoint" : "Add breakpoint"}
                  title={bp ? "Remove breakpoint" : "Add breakpoint"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBreakpoint(s.id);
                  }}
                  className={`ll-trb trb ${bp ? (bp.on ? "on " : "off ") : ""}ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0`}
                >
                  <span
                    className={`ll:w-2 ll:h-2 ll:rounded-xs ll:border ll:border-muted ll:transition-colors ${
                      bp
                        ? bp.on
                          ? "ll:bg-primary ll:border-primary"
                          : "ll:border-primary ll:bg-transparent"
                        : "ll:opacity-0 ll:hover:opacity-100"
                    }`}
                  />
                </button>

                {/* Step node and hot badge */}
                <span className="ll-trn trn ll:flex ll:items-baseline ll:gap-2 ll:min-w-0 ll:truncate">
                  <span className="ll-tri tri ll:text-muted ll:w-3 ll:text-right ll:shrink-0">
                    {idx + 1}
                  </span>
                  <span className={`ll:truncate ${s.hot ? "ll:font-semibold ll:text-primary" : ""}`}>
                    {s.node}
                  </span>
                  {s.hot && (
                    <span className="ll-trh trh ll:font-mono ll:text-nano ll:font-medium ll:uppercase ll:tracking-wider ll:border ll:border-syn-num ll:rounded-xs ll:px-1 ll:text-syn-num ll:leading-3.5 ll:ml-1">
                      hot
                    </span>
                  )}
                </span>

                {/* Waterfall Bar */}
                <span className="ll-trw trw ll:relative ll:h-full ll:flex ll:items-center">
                  <span
                    className={`ll-trf trf ll:absolute ll:rounded-xs ${
                      s.hot
                        ? `ll:h-2.5 ll:bg-syn-num ll:opacity-100 ${
                            isRun
                              ? "ll:shadow-trace-hot-run"
                              : "ll:shadow-trace-hot"
                          }`
                        : "ll:h-1.5 ll:bg-muted ll:opacity-70"
                    }`}
                    style={{ left: `${leftPct.toFixed(2)}%`, width: `${widthPct.toFixed(2)}%` }}
                  />
                </span>

                {/* Timing */}
                <span className="ll-trt ll:text-right ll:text-small">
                  {s.ms.toFixed(1)} ms
                </span>

                {/* Status */}
                <span className="ll-trs ll:flex ll:items-center ll:gap-1 ll:text-micro ll:text-muted">
                  <Icon
                    icon={isDone ? Check : isRun ? Play : Circle}
                    size={11}
                    className={isRun ? "ll:text-primary" : ""}
                  />
                  <span>{isDone ? "ok" : isRun ? "now" : ""}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Breakpoints and Watch Sidebar (280px, matching prototype .trside) */}
      <aside
        aria-label="Breakpoints and watch"
        className="ll-trside trside ll:border-l ll:border-border ll:overflow-auto ll:flex ll:flex-col ll:bg-surface-panel"
      >
        {/* Section 1: Breakpoints */}
        <section id="trbps" className="ll-trsec trsec ll:p-3 ll:border-b ll:border-border">
          <div className="ll-trsh trsh ll:h-7 ll:flex ll:items-center ll:justify-between ll:mb-2">
            <span className="ll:font-mono ll:text-micro ll:font-medium ll:text-muted">
              Breakpoints
            </span>
            <button
              type="button"
              id="trbpadd"
              data-ca="trbpadd"
              aria-label="Add breakpoint"
              title="Add breakpoint"
              onClick={() => {
                const free = TRACE_STEPS.find((s) => !breakpoints.some((b) => b.id === s.id));
                if (free) toggleBreakpoint(free.id);
              }}
              disabled={breakpoints.length >= TRACE_STEPS.length}
              className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:disabled:opacity-40"
            >
              <Icon icon={Plus} size={12} />
            </button>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-1">
            {breakpoints.length === 0 ? (
              <div className="ll-trnone trnone ll:font-sans ll:text-micro ll:text-muted ll:py-1">
                No breakpoints. Click the gutter of a step.
              </div>
            ) : (
              breakpoints.map((bp) => {
                const s = TRACE_STEPS.find((x) => x.id === bp.id);
                return (
                  <div
                    key={bp.id}
                    data-id={bp.id}
                    className="ll-trbi trbi ll:flex ll:items-center ll:justify-between ll:gap-2 ll:h-7"
                  >
                    <label className="dcheck ll:flex ll:items-center ll:gap-2 ll:min-w-0 ll:flex-1 ll:cursor-pointer">
                      <input
                        type="checkbox"
                        data-ca="trbptog"
                        data-id={bp.id}
                        checked={bp.on}
                        onChange={() => toggleBreakpointActive(bp.id)}
                        className="ll:accent-primary ll:cursor-pointer"
                      />
                      <span className="mono ll:font-mono ll:text-micro ll:text-primary ll:truncate">
                        {s?.node}
                      </span>
                    </label>
                    <button
                      type="button"
                      data-ca="trbprm"
                      data-id={bp.id}
                      aria-label="Remove breakpoint"
                      title="Remove"
                      onClick={() => removeBreakpoint(bp.id)}
                      className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:cursor-pointer"
                    >
                      <Icon icon={X} size={11} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Section 2: Watch Expressions */}
        <section id="trwatch" className="ll-trsec trsec ll:p-3">
          <div className="ll-trsh trsh ll:h-7 ll:flex ll:items-center ll:justify-between ll:mb-2">
            <span className="ll:font-mono ll:text-micro ll:font-medium ll:text-muted">
              Watch
            </span>
            <button
              type="button"
              data-ca="trwadd"
              aria-label="Add watch expression"
              title="Add expression"
              onClick={addWatch}
              className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:text-muted ll:hover:text-primary ll:cursor-pointer"
            >
              <Icon icon={Plus} size={12} />
            </button>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-1.5">
            {watchList.length === 0 ? (
              <div className="ll-trnone trnone ll:font-sans ll:text-micro ll:text-muted ll:py-1">
                Nothing watched. Add an expression such as elapsed.
              </div>
            ) : (
              watchList.map((expr, idx) => {
                const evaluated = evaluateExpr(expr, cur);
                return (
                  <div
                    key={idx}
                    data-i={idx}
                    className="ll-trwi trwi ll:flex ll:items-center ll:gap-1.5 ll:min-h-6"
                  >
                    <input
                      type="text"
                      value={expr}
                      onChange={(e) => updateWatch(idx, e.target.value)}
                      placeholder="expression"
                      aria-label="Watch expression"
                      spellCheck={false}
                      autoComplete="off"
                      className="ll-wex wex mono ll:flex-1 ll:min-w-0 ll:h-6 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-border ll:focus:border-primary ll:rounded-xs ll:font-mono ll:text-micro ll:text-primary ll:placeholder:text-muted ll:outline-none"
                    />
                    <span
                      className={`ll-wv wv mono ll:font-mono ll:text-micro ll:max-w-24 ll:truncate ll:text-right ${
                        evaluated.e ? "mt ll:text-muted ll:italic" : "ll:text-primary"
                      }`}
                    >
                      {evaluated.v}
                    </span>
                    <button
                      type="button"
                      data-ca="trwrm"
                      data-i={idx}
                      aria-label="Remove expression"
                      title="Remove"
                      onClick={() => removeWatch(idx)}
                      className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:cursor-pointer"
                    >
                      <Icon icon={X} size={11} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </aside>
    </div>
  );
};

export default TraceView;

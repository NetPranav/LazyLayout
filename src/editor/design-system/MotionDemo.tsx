"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  useFeel,
  MOTION_PRESETS,
  type MotionPresetKey,
  surf,
  pressEl,
  springAnim,
  type Surf,
} from "../motion";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { Icon } from "../components/Icon";
import { SegmentedControl } from "../components/SegmentedControl";
import {
  Sparkles,
  Layers,
  Sliders,
  ChevronRight,
  X,
  Play,
  RotateCcw,
  Zap,
} from "lucide-react";

export function MotionDemo() {
  const { feel, setFeel, preset, reducedMotion } = useFeel();
  const [surfaceOpen, setSurfaceOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceElRef = useRef<HTMLDivElement>(null);
  const surfInstanceRef = useRef<Surf | null>(null);

  const pressBoxRef = useRef<HTMLButtonElement>(null);

  const boxSmoothRef = useRef<HTMLDivElement>(null);
  const boxLivelyRef = useRef<HTMLDivElement>(null);
  const boxBouncyRef = useRef<HTMLDivElement>(null);

  // Initialize Surf instance on mount
  useEffect(() => {
    if (surfaceElRef.current && !surfInstanceRef.current) {
      surfInstanceRef.current = surf(surfaceElRef.current);
    }
  }, []);

  const handleOpenSurface = useCallback(() => {
    const s = surfInstanceRef.current;
    const trigger = triggerRef.current;
    if (!s || !trigger) return;

    if (surfaceOpen) {
      s.leave();
      setSurfaceOpen(false);
    } else {
      const rect = trigger.getBoundingClientRect();
      s.open({
        from: {
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          r: 6,
        },
      });
      setSurfaceOpen(true);
    }
  }, [surfaceOpen]);

  const handleCloseSurface = useCallback(() => {
    if (surfInstanceRef.current && surfaceOpen) {
      surfInstanceRef.current.leave();
      setSurfaceOpen(false);
    }
  }, [surfaceOpen]);

  const handleTestBox = useCallback((key: MotionPresetKey) => {
    const p = MOTION_PRESETS[key];
    const targetRef =
      key === "smooth"
        ? boxSmoothRef
        : key === "lively"
          ? boxLivelyRef
          : boxBouncyRef;

    if (targetRef.current) {
      springAnim(
        targetRef.current,
        [
          { translate: `0 ${p.travel[0]}px`, scale: p.rowScale },
          { translate: "0 0", scale: "1" },
        ],
        p.rows[0],
        p.rows[1]
      );
    }
  }, []);

  const handleCompareAll = useCallback(() => {
    handleTestBox("smooth");
    handleTestBox("lively");
    handleTestBox("bouncy");
  }, [handleTestBox]);

  const feelOptions = [
    { value: "smooth", label: "Smooth (Default)" },
    { value: "lively", label: "Lively" },
    { value: "bouncy", label: "Bouncy" },
  ];

  return (
    <div className="ll:flex ll:flex-col ll:gap-8 ll:w-full">
      {/* Header */}
      <div className="ll:flex ll:flex-col ll:gap-2">
        <div className="ll:flex ll:items-center ll:justify-between ll:flex-wrap ll:gap-2">
          <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
            Motion Engine
          </h1>
          <span className="ll:inline-flex ll:items-center ll:gap-1.5 ll:px-2.5 ll:py-1 ll:rounded-md ll:bg-surface-bar ll:border ll:border-border ll:text-micro ll:font-mono ll:text-secondary">
            <span className="ll:w-2 ll:h-2 ll:rounded-xs ll:bg-control-primary" />
            Motion engine ported from Nook (the owner&apos;s own product)
          </span>
        </div>
        <p className="ll:text-body ll:text-secondary">
          Physics-driven spring animation engine. Built with real mass-1 springs
          parameterized by response (seconds) and damping ratio.
          Interrupted motions preserve momentum without layout jumps.
        </p>
      </div>

      {/* Global Feel Controller */}
      <div className="ll:p-6 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:flex ll:flex-col ll:gap-4">
        <div className="ll:flex ll:flex-col ll:sm:flex-row ll:sm:items-center ll:justify-between ll:gap-3">
          <div>
            <div className="ll:text-body ll:font-semibold ll:text-primary">
              Active Motion Feel
            </div>
            <div className="ll:text-small ll:text-secondary">
              Switches global presets and writes <code>--ll-ease-pop</code> and{" "}
              <code>--ll-dur-pop</code> CSS tokens.
            </div>
          </div>
          <SegmentedControl
            options={feelOptions}
            value={feel}
            onChange={(val) => setFeel(val as MotionPresetKey)}
            size="md"
          />
        </div>

        <div className="ll:grid ll:grid-cols-2 ll:sm:grid-cols-4 ll:gap-3 ll:pt-2 ll:border-t ll:border-border">
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">
              Row Springs
            </span>
            <span className="ll:font-mono ll:text-small ll:text-primary">
              [{preset.rows[0]}, {preset.rows[1]}]
            </span>
          </div>
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">
              Stagger
            </span>
            <span className="ll:font-mono ll:text-small ll:text-primary">
              {preset.stagger}ms
            </span>
          </div>
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">
              Wind-up
            </span>
            <span className="ll:font-mono ll:text-small ll:text-primary">
              {preset.wind}px
            </span>
          </div>
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">
              Enter Kick / Bulge
            </span>
            <span className="ll:font-mono ll:text-small ll:text-primary">
              {preset.enterKick}px/s
            </span>
          </div>
        </div>
      </div>

      {/* Demo 1: Surface Engine (Surf) */}
      <div className="ll:flex ll:flex-col ll:gap-4">
          <div className="ll:flex ll:flex-col ll:gap-1.5">
            <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
              1. Surface Engine (Surf) — Popover, Wind-Up, Blur &amp; Wheel Bump
            </span>
            <span className="ll:text-micro ll:font-mono ll:text-muted">
              Wheel over surface past ends to trigger endBump
            </span>
          </div>

          <div className="ll:relative ll:min-h-72 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:items-center ll:justify-center">
            <Button
              ref={triggerRef}
              variant="primary"
              size="md"
              onClick={handleOpenSurface}
              className="ll:z-10"
            >
              {surfaceOpen ? "Close Sample Surface" : "Open Sample Surface (Physics Seed)"}
            </Button>

            {/* Real Surf Overlay Element */}
            <div
              ref={surfaceElRef}
              className="ll-surface-overlay ll:absolute ll:z-20 ll:top-24 ll:w-sample-surface ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:overflow-hidden"
            >
              <div className="ll-lay ll:p-2 ll:flex ll:flex-col ll:gap-1">
                <div className="ll:flex ll:items-center ll:justify-between ll:px-3 ll:py-1.5 ll:border-b ll:border-border ll:mb-1">
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Island Surface
                  </span>
                  <IconButton
                    aria-label="Close sample surface"
                    size="sm"
                    icon={<Icon icon={X} size={14} />}
                    onClick={handleCloseSurface}
                  />
                </div>

                <div
                  data-row
                  className="ll:flex ll:items-center ll:gap-2.5 ll:px-3 ll:h-8 ll:rounded-sm ll:text-body ll:text-primary ll:hover:bg-surface-hover ll:cursor-pointer"
                >
                  <Icon icon={Sparkles} size={14} className="ll:text-secondary" />
                  <span className="ll:flex-1">AI Copilot</span>
                  <span className="ll:font-mono ll:text-micro ll:text-muted">⌘K</span>
                </div>

                <div
                  data-row
                  className="ll:flex ll:items-center ll:gap-2.5 ll:px-3 ll:h-8 ll:rounded-sm ll:text-body ll:text-primary ll:hover:bg-surface-hover ll:cursor-pointer"
                >
                  <Icon icon={Layers} size={14} className="ll:text-secondary" />
                  <span className="ll:flex-1">Inspect Layers</span>
                  <span className="ll:font-mono ll:text-micro ll:text-muted">⌥L</span>
                </div>

                <div
                  data-row
                  className="ll:flex ll:items-center ll:gap-2.5 ll:px-3 ll:h-8 ll:rounded-sm ll:text-body ll:text-primary ll:hover:bg-surface-hover ll:cursor-pointer"
                >
                  <Icon icon={Sliders} size={14} className="ll:text-secondary" />
                  <span className="ll:flex-1">Animation Presets</span>
                  <Icon icon={ChevronRight} size={14} className="ll:text-muted" />
                </div>

                <div
                  data-row
                  className="ll:flex ll:items-center ll:justify-between ll:px-3 ll:h-8 ll:rounded-sm ll:border-t ll:border-border ll:mt-1 ll:text-micro ll:text-secondary"
                >
                  <span>Wheel to test bump:</span>
                  <span className="ll:font-mono">±{preset.endBump}px/s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Demo 2: Press Target Interaction */}
        <div className="ll:flex ll:flex-col ll:gap-4">
          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
            2. Interactive Press Target (pressScale 0.96 with Spring Return)
          </span>

          <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:sm:flex-row ll:items-center ll:justify-between ll:gap-6">
            <div className="ll:flex ll:flex-col ll:gap-1">
              <span className="ll:text-body ll:font-semibold ll:text-primary">
                Physics Press Sensor
              </span>
              <span className="ll:text-small ll:text-secondary">
                Hold pointer down on the tile to compress. Releases on pointerup.
              </span>
            </div>

            <button
              type="button"
              ref={pressBoxRef}
              onPointerDown={() => pressBoxRef.current && pressEl(pressBoxRef.current, true)}
              onPointerUp={() => pressBoxRef.current && pressEl(pressBoxRef.current, false)}
              onPointerLeave={() => pressBoxRef.current && pressEl(pressBoxRef.current, false)}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                  e.preventDefault();
                  if (pressBoxRef.current) pressEl(pressBoxRef.current, true);
                }
              }}
              onKeyUp={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  if (pressBoxRef.current) pressEl(pressBoxRef.current, false);
                }
              }}
              onBlur={() => {
                if (pressBoxRef.current) pressEl(pressBoxRef.current, false);
              }}
              className="ll:w-56 ll:h-16 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:flex ll:items-center ll:justify-center ll:gap-2 ll:select-none ll:cursor-pointer ll:text-body ll:font-medium ll:text-primary ll:shadow-soft ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary"
            >
              <Icon icon={Zap} size={16} className="ll:text-primary" />
              <span>Hold to Compress</span>
            </button>
          </div>
        </div>

        {/* Demo 3: Three Feels Side-by-Side */}
        <div className="ll:flex ll:flex-col ll:gap-4">
          <div className="ll:flex ll:items-center ll:justify-between ll:flex-wrap ll:gap-2">
            <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
              3. Three Feels Side-by-Side (Smooth vs Lively vs Bouncy)
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCompareAll}
              leftIcon={<Icon icon={RotateCcw} size={14} />}
            >
              Compare All Simultaneously
            </Button>
          </div>

          <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-4">
            {/* Smooth Card */}
            <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-4 ll:flex ll:flex-col ll:justify-between ll:gap-4">
              <div className="ll:flex ll:flex-col ll:gap-1">
                <div className="ll:flex ll:items-center ll:justify-between">
                  <span className="ll:text-body ll:font-semibold ll:text-primary">
                    Smooth
                  </span>
                  <span className="ll:text-micro ll:font-mono ll:text-secondary">
                    ~3.6% Overshoot
                  </span>
                </div>
                <span className="ll:text-small ll:text-secondary">
                  Subtle Apple-grade restraint. Elegant and precise.
                </span>
              </div>

              <div className="ll:h-28 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:flex ll:items-center ll:justify-center ll:overflow-hidden">
                <div
                  ref={boxSmoothRef}
                  className="ll:w-20 ll:h-10 ll:rounded-sm ll:bg-control-primary ll:text-control-primary-fg ll:flex ll:items-center ll:justify-center ll:text-micro ll:font-medium ll:shadow-soft"
                >
                  Smooth
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTestBox("smooth")}
                leftIcon={<Icon icon={Play} size={12} />}
              >
                Test Smooth
              </Button>
            </div>

            {/* Lively Card */}
            <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-4 ll:flex ll:flex-col ll:justify-between ll:gap-4">
              <div className="ll:flex ll:flex-col ll:gap-1">
                <div className="ll:flex ll:items-center ll:justify-between">
                  <span className="ll:text-body ll:font-semibold ll:text-primary">
                    Lively
                  </span>
                  <span className="ll:text-micro ll:font-mono ll:text-secondary">
                    Fast &amp; Snappy
                  </span>
                </div>
                <span className="ll:text-small ll:text-secondary">
                  Quick response (0.34s) with moderate spring momentum.
                </span>
              </div>

              <div className="ll:h-28 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:flex ll:items-center ll:justify-center ll:overflow-hidden">
                <div
                  ref={boxLivelyRef}
                  className="ll:w-20 ll:h-10 ll:rounded-sm ll:bg-control-primary ll:text-control-primary-fg ll:flex ll:items-center ll:justify-center ll:text-micro ll:font-medium ll:shadow-soft"
                >
                  Lively
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTestBox("lively")}
                leftIcon={<Icon icon={Play} size={12} />}
              >
                Test Lively
              </Button>
            </div>

            {/* Bouncy Card */}
            <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-4 ll:flex ll:flex-col ll:justify-between ll:gap-4">
              <div className="ll:flex ll:flex-col ll:gap-1">
                <div className="ll:flex ll:items-center ll:justify-between">
                  <span className="ll:text-body ll:font-semibold ll:text-primary">
                    Bouncy
                  </span>
                  <span className="ll:text-micro ll:font-mono ll:text-secondary">
                    ~25% Overshoot
                  </span>
                </div>
                <span className="ll:text-small ll:text-secondary">
                  Playful oscillation with scale breathing (0.92 / 1.14).
                </span>
              </div>

              <div className="ll:h-28 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:flex ll:items-center ll:justify-center ll:overflow-hidden">
                <div
                  ref={boxBouncyRef}
                  className="ll:w-20 ll:h-10 ll:rounded-sm ll:bg-control-primary ll:text-control-primary-fg ll:flex ll:items-center ll:justify-center ll:text-micro ll:font-medium ll:shadow-soft"
                >
                  Bouncy
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTestBox("bouncy")}
                leftIcon={<Icon icon={Play} size={12} />}
              >
                Test Bouncy
              </Button>
            </div>
          </div>
        </div>

        {/* Reduced Motion Note */}
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-4 ll:flex ll:flex-col ll:sm:flex-row ll:sm:items-center ll:justify-between ll:gap-3">
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-body ll:font-semibold ll:text-primary">
              Accessibility &amp; Reduced Motion Support
            </span>
            <span className="ll:text-small ll:text-secondary">
              Respects <code>prefers-reduced-motion: reduce</code>. Springs and
              blurs automatically degrade to a clean 120ms opacity fade.
            </span>
          </div>
          <div className="ll:flex ll:items-center ll:gap-2 ll:px-3 ll:py-1.5 ll:rounded-md ll:bg-surface-bar ll:border ll:border-border ll:text-small ll:font-mono">
            <span
              className={`ll:w-2 ll:h-2 ll:rounded-xs ${reducedMotion ? "ll:bg-control-primary" : "ll:bg-muted"
                }`}
            />
            <span className="ll:text-primary">
              System Reduced Motion: {reducedMotion ? "Active (120ms Fade)" : "Inactive"}
            </span>
          </div>
        </div>
      </div>
      );
}


"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from "react";
import { prefersReducedMotion } from "../motion/feel";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  delayMs?: number;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  delayMs = 250,
  side = "top",
  className = "",
  disabled = false,
}: TooltipProps) {
  const tooltipId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleShow = useCallback(() => {
    if (disabled || !content) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);
  }, [disabled, content, clearTimer, delayMs]);

  const handleHide = useCallback(() => {
    clearTimer();
    setIsVisible(false);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // A tip near the window edge (the panel's header buttons) shifts inward instead of running off screen.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!isVisible || !el || (side !== "top" && side !== "bottom")) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const pad = 8;
    if (r.right > window.innerWidth - pad) el.style.marginLeft = `${window.innerWidth - pad - r.right}px`;
    else if (r.left < pad) el.style.marginLeft = `${pad - r.left}px`;
  }, [isVisible, side]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleHide();
      }
    };
    if (isVisible) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isVisible, handleHide]);

  if (!content || disabled) {
    return <>{children}</>;
  }

  let positionStyles = "";
  if (side === "top") {
    positionStyles = "ll:bottom-full ll:left-1/2 ll:-translate-x-1/2 ll:mb-1.5";
  } else if (side === "bottom") {
    positionStyles = "ll:top-full ll:left-1/2 ll:-translate-x-1/2 ll:mt-1.5";
  } else if (side === "left") {
    positionStyles = "ll:right-full ll:top-1/2 ll:-translate-y-1/2 ll:mr-1.5";
  } else {
    // right
    positionStyles = "ll:left-full ll:top-1/2 ll:-translate-y-1/2 ll:ml-1.5";
  }

  return (
    <div
      className={`ll:relative ll:inline-flex ${className}`}
      onMouseEnter={handleShow}
      onMouseLeave={handleHide}
      onFocusCapture={handleShow}
      onBlurCapture={handleHide}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}
      <div
        ref={tipRef}
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isVisible}
        className={`ll:absolute ll:z-50 ll:pointer-events-none ll:select-none ll:whitespace-nowrap ll:box-border ll:px-2 ll:py-1 ll:bg-surface-raised ll:text-primary ll:rounded-sm ll:border ll:border-border ll:shadow-soft ll:text-micro ll:font-medium ${prefersReducedMotion()
            ? isVisible
              ? "ll:block"
              : "ll:hidden"
            : `ll:transition-opacity ll:duration-120 ${isVisible ? "ll:opacity-100 ll:scale-100" : "ll:opacity-0 ll:scale-95 ll:pointer-events-none"
            }`
          } ${positionStyles}`}
      >
        {content}
      </div>
    </div>
  );
}

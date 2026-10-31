import React, { useState, useRef, useEffect, useCallback, useId } from "react";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  delayMs?: number;
  side?: "top" | "bottom";
  className?: string;
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  delayMs = 300,
  side = "top",
  className = "",
  disabled = false,
}: TooltipProps) {
  const tooltipId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const positionStyles =
    side === "top"
      ? "ll:bottom-full ll:left-1/2 ll:-translate-x-1/2 ll:mb-1.5"
      : "ll:top-full ll:left-1/2 ll:-translate-x-1/2 ll:mt-1.5";

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
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isVisible}
        className={`ll:absolute ll:z-50 ll:pointer-events-none ll:select-none ll:whitespace-nowrap ll:box-border ll:px-2 ll:py-1 ll:bg-control-primary ll:text-control-primary-fg ll:rounded-sm ll:border ll:border-border ll:shadow-soft ll:text-micro ll:font-medium ll:transition-opacity ll:duration-swap ${positionStyles} ${
          isVisible ? "ll:opacity-100" : "ll:opacity-0"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

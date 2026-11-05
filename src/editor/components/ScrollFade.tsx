"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { motionValue, type MotionValue } from "motion/react";

export type ScrollFadeOrientation = "vertical" | "horizontal" | "both";
export type ScrollFadeEdge = "top" | "bottom" | "left" | "right";

export interface UseScrollFadeOptions {
  orientation?: ScrollFadeOrientation;
  size?: number;
  shrink?: number;
  blur?: number;
  enabled?: boolean;
}

export type ScrollFadeValues = Record<ScrollFadeEdge, MotionValue<number>>;

interface EdgeState {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Hook measuring scroll offsets and returning MotionValues for each edge.
 */
export function useScrollFade(
  targetRef: React.RefObject<HTMLElement | null>,
  options?: UseScrollFadeOptions
): ScrollFadeValues {
  const enabled = options?.enabled ?? true;
  const orientation = options?.orientation ?? "vertical";

  const [values] = useState<ScrollFadeValues>(() => ({
    top: motionValue(0),
    bottom: motionValue(0),
    left: motionValue(0),
    right: motionValue(0),
  }));

  const checkScroll = useCallback(() => {
    const el = targetRef.current;
    if (!el || !enabled) {
      values.top.set(0);
      values.bottom.set(0);
      values.left.set(0);
      values.right.set(0);
      return;
    }

    const { scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth } = el;
    const canScrollY = orientation !== "horizontal" && scrollHeight > clientHeight + 1;
    const canScrollX = orientation !== "vertical" && scrollWidth > clientWidth + 1;

    const isTop = canScrollY && scrollTop > 1;
    const isBottom = canScrollY && scrollTop + clientHeight < scrollHeight - 1;
    const isLeft = canScrollX && scrollLeft > 1;
    const isRight = canScrollX && scrollLeft + clientWidth < scrollWidth - 1;

    values.top.set(isTop ? 1 : 0);
    values.bottom.set(isBottom ? 1 : 0);
    values.left.set(isLeft ? 1 : 0);
    values.right.set(isRight ? 1 : 0);
  }, [targetRef, enabled, orientation, values]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => checkScroll());
      ro.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro?.disconnect();
    };
  }, [targetRef, checkScroll]);

  return values;
}

export interface ScrollFadeProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: ScrollFadeOrientation;
  size?: number;
  shrink?: number;
  blur?: number;
  enabled?: boolean;
  asChild?: boolean;
  children?: React.ReactNode;
}

/**
 * Scrollable container applying CSS mask-image edge fades without blurring or shrinking elements.
 */
export const ScrollFade = forwardRef<HTMLDivElement, ScrollFadeProps>(
  (
    {
      orientation = "vertical",
      size,
      shrink,
      blur,
      enabled = true,
      className = "",
      style,
      children,
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLDivElement | null>(null);
    useImperativeHandle(forwardedRef, () => internalRef.current as HTMLDivElement);

    const [edges, setEdges] = useState<EdgeState>({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });

    const updateEdges = useCallback(() => {
      const el = internalRef.current;
      if (!el || !enabled) {
        setEdges({ top: false, bottom: false, left: false, right: false });
        return;
      }

      const { scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth } = el;
      const canScrollY = orientation !== "horizontal" && scrollHeight > clientHeight + 1;
      const canScrollX = orientation !== "vertical" && scrollWidth > clientWidth + 1;

      const top = canScrollY && scrollTop > 1;
      const bottom = canScrollY && scrollTop + clientHeight < scrollHeight - 1;
      const left = canScrollX && scrollLeft > 1;
      const right = canScrollX && scrollLeft + clientWidth < scrollWidth - 1;

      setEdges((prev) => {
        if (
          prev.top === top &&
          prev.bottom === bottom &&
          prev.left === left &&
          prev.right === right
        ) {
          return prev;
        }
        return { top, bottom, left, right };
      });
    }, [enabled, orientation]);

    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      updateEdges();
      el.addEventListener("scroll", updateEdges, { passive: true });

      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => updateEdges());
        ro.observe(el);
      }

      return () => {
        el.removeEventListener("scroll", updateEdges);
        ro?.disconnect();
      };
    }, [updateEdges]);

    // Build CSS mask-image based on active edge states
    const fadeSize = size ? `${size}px` : "var(--ll-spacing-8, 32px)";

    let maskImage: string | undefined;

    if (orientation === "vertical") {
      if (edges.top && edges.bottom) {
        maskImage = `linear-gradient(to bottom, transparent 0, black ${fadeSize}, black calc(100% - ${fadeSize}), transparent 100%)`;
      } else if (edges.top) {
        maskImage = `linear-gradient(to bottom, transparent 0, black ${fadeSize}, black 100%)`;
      } else if (edges.bottom) {
        maskImage = `linear-gradient(to bottom, black 0, black calc(100% - ${fadeSize}), transparent 100%)`;
      }
    } else if (orientation === "horizontal") {
      if (edges.left && edges.right) {
        maskImage = `linear-gradient(to right, transparent 0, black ${fadeSize}, black calc(100% - ${fadeSize}), transparent 100%)`;
      } else if (edges.left) {
        maskImage = `linear-gradient(to right, transparent 0, black ${fadeSize}, black 100%)`;
      } else if (edges.right) {
        maskImage = `linear-gradient(to right, black 0, black calc(100% - ${fadeSize}), transparent 100%)`;
      }
    } else if (orientation === "both") {
      const vGradient =
        edges.top && edges.bottom
          ? `linear-gradient(to bottom, transparent 0, black ${fadeSize}, black calc(100% - ${fadeSize}), transparent 100%)`
          : edges.top
            ? `linear-gradient(to bottom, transparent 0, black ${fadeSize}, black 100%)`
            : edges.bottom
              ? `linear-gradient(to bottom, black 0, black calc(100% - ${fadeSize}), transparent 100%)`
              : undefined;

      const hGradient =
        edges.left && edges.right
          ? `linear-gradient(to right, transparent 0, black ${fadeSize}, black calc(100% - ${fadeSize}), transparent 100%)`
          : edges.left
            ? `linear-gradient(to right, transparent 0, black ${fadeSize}, black 100%)`
            : edges.right
              ? `linear-gradient(to right, black 0, black calc(100% - ${fadeSize}), transparent 100%)`
              : undefined;

      if (vGradient && hGradient) {
        maskImage = `${vGradient}, ${hGradient}`;
      } else {
        maskImage = vGradient ?? hGradient;
      }
    }

    const maskStyle: React.CSSProperties = maskImage
      ? {
          maskImage,
          WebkitMaskImage: maskImage,
          maskComposite: orientation === "both" ? "intersect" : undefined,
          WebkitMaskComposite: orientation === "both" ? "source-in" : undefined,
        }
      : {};

    return (
      <div
        ref={internalRef}
        className={`ll:relative ll:overflow-auto ${className}`}
        style={{
          ...maskStyle,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ScrollFade.displayName = "ScrollFade";

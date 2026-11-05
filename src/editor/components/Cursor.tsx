"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  forwardRef,
  useImperativeHandle,
} from "react";
import { motionValue, type MotionValue } from "motion/react";
import {
  prefersReducedMotion,
  subscribeReducedMotion,
  getServerReducedMotion,
} from "../motion/reducedMotion";

export interface CursorPos {
  x: number;
  y: number;
}

export interface CursorContextType {
  cursorPos: CursorPos;
  cursorX: MotionValue<number>;
  cursorY: MotionValue<number>;
  active: boolean;
  global: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  cursorRef: React.RefObject<HTMLDivElement | null>;
  setCursorPos: (pos: CursorPos) => void;
  setActive: (active: boolean) => void;
}

const CursorContext = createContext<CursorContextType | null>(null);

/**
 * Access collaborative cursor state within a CursorProvider.
 */
export function useCursor(): CursorContextType {
  const ctx = useContext(CursorContext);
  if (!ctx) {
    throw new Error("useCursor must be used within a CursorProvider");
  }
  return ctx;
}

export interface CursorProviderProps {
  children: React.ReactNode;
  global?: boolean;
}

/**
 * Context provider tracking pointer coordinates and active presence.
 */
export const CursorProvider: React.FC<CursorProviderProps> = ({
  children,
  global = false,
}) => {
  const [cursorPos, setCursorPosState] = useState<CursorPos>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const [cursorX] = useState<MotionValue<number>>(() => motionValue(0));
  const [cursorY] = useState<MotionValue<number>>(() => motionValue(0));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  const setCursorPos = useCallback(
    (pos: CursorPos) => {
      setCursorPosState(pos);
      cursorX.set(pos.x);
      cursorY.set(pos.y);
    },
    [cursorX, cursorY]
  );

  const value: CursorContextType = useMemo(
    () => ({
      cursorPos,
      cursorX,
      cursorY,
      active,
      global,
      containerRef,
      cursorRef,
      setCursorPos,
      setActive,
    }),
    [cursorPos, cursorX, cursorY, active, global, containerRef, cursorRef, setCursorPos, setActive]
  );

  return <CursorContext.Provider value={value}>{children}</CursorContext.Provider>;
};

export interface CursorContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

/**
 * Bounding container that captures pointer movement for Cursor and CursorFollow.
 */
export const CursorContainer = forwardRef<HTMLDivElement, CursorContainerProps>(
  ({ children, className = "", ...props }, forwardedRef) => {
    const { containerRef, setCursorPos, setActive, global } = useCursor();

    useImperativeHandle(forwardedRef, () => containerRef.current as HTMLDivElement);

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!global && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const x = Math.round(e.clientX - rect.left);
          const y = Math.round(e.clientY - rect.top);
          setCursorPos({ x, y });
        } else {
          setCursorPos({ x: e.clientX, y: e.clientY });
        }
        setActive(true);
      },
      [global, containerRef, setCursorPos, setActive]
    );

    const handlePointerEnter = useCallback(() => {
      setActive(true);
    }, [setActive]);

    const handlePointerLeave = useCallback(() => {
      setActive(false);
    }, [setActive]);

    return (
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={`ll:relative ll:w-full ll:h-full ll:overflow-hidden ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CursorContainer.displayName = "CursorContainer";

export interface CursorProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  asChild?: boolean;
}

/**
 * Collaborative cursor pointer anchored to current pointer coordinates.
 */
export const Cursor = forwardRef<HTMLDivElement, CursorProps>(
  ({ children, className = "", style, ...props }, forwardedRef) => {
    const { cursorPos, active, cursorRef } = useCursor();
    const reduced = useSyncExternalStore(
      subscribeReducedMotion,
      prefersReducedMotion,
      getServerReducedMotion
    );

    useImperativeHandle(forwardedRef, () => cursorRef.current as HTMLDivElement);

    const transitionStyle = reduced
      ? "opacity var(--ll-dur-fade, 120ms) ease"
      : "opacity var(--ll-dur-fade, 120ms) ease";

    return (
      <div
        ref={cursorRef}
        aria-hidden="true"
        className={`ll:pointer-events-none ll:absolute ll:top-0 ll:left-0 ll:z-30 ll:text-primary ${className}`}
        style={{
          transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`,
          opacity: active ? 1 : 0,
          transition: transitionStyle,
          ...style,
        }}
        {...props}
      >
        {children ?? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 0 L16 6 L9 9 L6 16 Z" />
          </svg>
        )}
      </div>
    );
  }
);
Cursor.displayName = "Cursor";

export type CursorFollowSide = "top" | "right" | "bottom" | "left";
export type CursorFollowAlign = "start" | "center" | "end";

export interface CursorFollowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  side?: CursorFollowSide;
  sideOffset?: number;
  align?: CursorFollowAlign;
  alignOffset?: number;
  className?: string;
  style?: React.CSSProperties;
  asChild?: boolean;
}

/**
 * Label badge anchored relative to Cursor with side and alignment offsets.
 */
export const CursorFollow = forwardRef<HTMLDivElement, CursorFollowProps>(
  (
    {
      children,
      side = "bottom",
      sideOffset,
      align = "end",
      alignOffset,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    const { cursorPos, active } = useCursor();
    const reduced = useSyncExternalStore(
      subscribeReducedMotion,
      prefersReducedMotion,
      getServerReducedMotion
    );

    // Compute side and alignment offsets
    let offsetX = alignOffset ?? 0;
    let offsetY = sideOffset ?? 0;

    if (side === "bottom") {
      offsetY = sideOffset ?? 16;
      if (align === "end") offsetX = alignOffset ?? 12;
      else if (align === "center") offsetX = alignOffset ?? 0;
      else if (align === "start") offsetX = alignOffset ?? -12;
    } else if (side === "top") {
      offsetY = -(sideOffset ?? 24);
      if (align === "end") offsetX = alignOffset ?? 12;
      else if (align === "center") offsetX = alignOffset ?? 0;
      else if (align === "start") offsetX = alignOffset ?? -12;
    } else if (side === "right") {
      offsetX = sideOffset ?? 20;
      if (align === "end") offsetY = alignOffset ?? 12;
      else if (align === "center") offsetY = alignOffset ?? 0;
      else if (align === "start") offsetY = alignOffset ?? -12;
    } else if (side === "left") {
      offsetX = -(sideOffset ?? 20);
      if (align === "end") offsetY = alignOffset ?? 12;
      else if (align === "center") offsetY = alignOffset ?? 0;
      else if (align === "start") offsetY = alignOffset ?? -12;
    }

    const posX = cursorPos.x + offsetX;
    const posY = cursorPos.y + offsetY;

    const transitionStyle = reduced
      ? "opacity var(--ll-dur-fade, 120ms) ease"
      : "transform var(--ll-dur-swap, 75ms) ease-out, opacity var(--ll-dur-fade, 120ms) ease";

    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={`ll:pointer-events-none ll:absolute ll:top-0 ll:left-0 ll:z-30 ll:select-none ${className}`}
        style={{
          transform: `translate3d(${posX}px, ${posY}px, 0)`,
          opacity: active ? 1 : 0,
          transition: transitionStyle,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CursorFollow.displayName = "CursorFollow";

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { PhosphorIcon } from "@/editor/components/icons/PhosphorIcon";
import { useMounted } from "@/editor/components/useMounted";
import { springAnim, cancelAll } from "@/editor/motion/ease";
import { getActivePreset, prefersReducedMotion } from "@/editor/motion/feel";
import { defaultHost } from "@/editor/motion/loop";
import "./stage.css";

// Lane B4 TextFormatBar Constants
const FORMAT_BAR_HEIGHT_PX = 32;
const FORMAT_BAR_APPROX_WIDTH_PX = 159;
const FORMAT_BAR_OFFSET_GAP_PX = 8;
const FORMAT_BAR_VIEWPORT_PADDING_PX = 8;
const FORMAT_BAR_POP_SCALE_INITIAL = 0.86;
const FORMAT_BAR_POP_SCALE_FINAL = 1;
const FORMAT_BAR_POP_OFFSET_Y_PX = 6;
const FORMAT_BAR_HIDE_DURATION_MS = 110;
const FORMAT_BAR_GLYPH_SIZE_PX = 14;

const ItalicIcon: React.FC = () => <PhosphorIcon name="textItalic" size={FORMAT_BAR_GLYPH_SIZE_PX} />;
const UnderlineIcon: React.FC = () => <PhosphorIcon name="textUnderline" size={FORMAT_BAR_GLYPH_SIZE_PX} />;
const StrikeIcon: React.FC = () => <PhosphorIcon name="textStrikethrough" size={FORMAT_BAR_GLYPH_SIZE_PX} />;
const LinkIconSvg: React.FC = () => <PhosphorIcon name="link" size={FORMAT_BAR_GLYPH_SIZE_PX} />;

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  link: boolean;
}

export interface TextFormatBarProps {
  /** If provided, overrides active format state (for demos / controlled use) */
  formats?: FormatState;
  /** Callback when user clicks a format button */
  onFormat?: (command: "bold" | "italic" | "underline" | "strike" | "link") => void;
  /** Force visible (e.g. for design system demo) */
  forceVisible?: boolean;
  /** Host container to constrain selection listening to (defaults to window) */
  containerRef?: React.RefObject<HTMLElement | null>;
}

export const TextFormatBar: React.FC<TextFormatBarProps> = ({
  formats: controlledFormats,
  onFormat: controlledOnFormat,
  forceVisible = false,
  containerRef,
}) => {
  const mounted = useMounted();
  const barRef = useRef<HTMLDivElement | null>(null);
  const [internalFormats, setInternalFormats] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    link: false,
  });
  const [isOpen, setIsOpen] = useState(false);
  const prevRectRef = useRef<{ left: number; top: number } | null>(null);
  const isMouseDownOnBarRef = useRef(false);

  const activeFormats = controlledFormats ?? internalFormats;

  const updateFormatStates = useCallback(() => {
    try {
      const b = document.queryCommandState("bold");
      const i = document.queryCommandState("italic");
      const u = document.queryCommandState("underline");
      const s = document.queryCommandState("strikeThrough");
      const sel = window.getSelection();
      let hasLink = false;
      if (sel && sel.anchorNode) {
        const parent =
          sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement;
        hasLink = !!parent?.closest("a");
      }
      setInternalFormats({
        bold: b,
        italic: i,
        underline: u,
        strike: s,
        link: hasLink,
      });
    } catch {
      // document.queryCommandState fallback
    }
  }, []);

  const placeAndShow = useCallback(
    (rc: DOMRect) => {
      const bar = barRef.current;
      if (!bar) return;

      const first = !isOpen;
      if (first) {
        cancelAll(bar);
        bar.style.display = "flex";
      }

      const barW = bar.offsetWidth || FORMAT_BAR_APPROX_WIDTH_PX;
      const barH = bar.offsetHeight || FORMAT_BAR_HEIGHT_PX;
      const cx = rc.left + rc.width / 2;
      let x = Math.round(cx - barW / 2);
      let y = Math.round(rc.top - barH - FORMAT_BAR_OFFSET_GAP_PX);
      let below = false;

      // Position above selected text; flip below only if it would leave the viewport top
      if (y < FORMAT_BAR_VIEWPORT_PADDING_PX) {
        y = Math.round(rc.bottom + FORMAT_BAR_OFFSET_GAP_PX);
        below = true;
      }
      x = Math.max(
        FORMAT_BAR_VIEWPORT_PADDING_PX,
        Math.min(window.innerWidth - barW - FORMAT_BAR_VIEWPORT_PADDING_PX, x)
      );
      y = Math.max(
        FORMAT_BAR_VIEWPORT_PADDING_PX,
        Math.min(window.innerHeight - barH - FORMAT_BAR_VIEWPORT_PADDING_PX, y)
      );

      const prev = prevRectRef.current;
      prevRectRef.current = { left: x, top: y };

      bar.style.display = "flex";
      bar.style.left = `${x}px`;
      bar.style.top = `${y}px`;

      if (first) {
        setIsOpen(true);
        cancelAll(bar);
        const originX = Math.max(0, Math.min(barW, cx - x));
        bar.style.transformOrigin = `${originX}px ${below ? "0" : "100%"}`;
        const m = getActivePreset();
        springAnim(
          bar,
          [
            {
              opacity: 0,
              scale: FORMAT_BAR_POP_SCALE_INITIAL,
              translate: `0 ${below ? -FORMAT_BAR_POP_OFFSET_Y_PX : FORMAT_BAR_POP_OFFSET_Y_PX}px`,
            },
            { opacity: 1, scale: FORMAT_BAR_POP_SCALE_FINAL, translate: "0 0" },
          ],
          m.pop[0],
          m.pop[1]
        );
      } else if (!prefersReducedMotion() && prev) {
        const dx = prev.left - x;
        const dy = prev.top - y;
        if (Math.abs(dx) + Math.abs(dy) > 1) {
          cancelAll(bar);
          const m = getActivePreset();
          springAnim(
            bar,
            [{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }],
            m.shape[0],
            m.shape[1]
          );
        }
      }
    },
    [isOpen]
  );

  const hideBar = useCallback(() => {
    const bar = barRef.current;
    if (!bar || !isOpen) return;
    setIsOpen(false);
    prevRectRef.current = null;
    cancelAll(bar);
    if (prefersReducedMotion()) {
      bar.style.display = "none";
      return;
    }
    const anim = bar.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FORMAT_BAR_HIDE_DURATION_MS,
      easing: "ease-out",
      fill: "forwards",
    });
    anim.onfinish = () => {
      bar.style.display = "none";
      anim.cancel();
    };
  }, [isOpen]);

  // Selection change tracking
  useEffect(() => {
    if (forceVisible) {
      const bar = barRef.current;
      if (bar) {
        bar.style.display = "flex";
        bar.style.position = "relative";
        bar.style.left = "auto";
        bar.style.top = "auto";
      }
      return;
    }

    const checkSelection = () => {
      if (isMouseDownOnBarRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        hideBar();
        return;
      }

      const range = sel.getRangeAt(0);
      const host = containerRef?.current ?? document.body;

      if (!host.contains(range.commonAncestorContainer)) {
        hideBar();
        return;
      }

      const rc = range.getBoundingClientRect();
      if (rc.width === 0 && rc.height === 0) {
        hideBar();
        return;
      }

      updateFormatStates();
      placeAndShow(rc);
    };

    let unregisterCheck: (() => void) | null = null;

    const handleSelectionChange = () => {
      if (!unregisterCheck) {
        unregisterCheck = defaultHost.register(() => {
          if (unregisterCheck) {
            unregisterCheck();
            unregisterCheck = null;
          }
          checkSelection();
        });
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("resize", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("resize", handleSelectionChange);
      if (unregisterCheck) {
        unregisterCheck();
        unregisterCheck = null;
      }
    };
  }, [forceVisible, containerRef, placeAndShow, hideBar, updateFormatStates]);

  const handleFormat = (command: "bold" | "italic" | "underline" | "strike" | "link") => {
    if (controlledOnFormat) {
      controlledOnFormat(command);
    } else {
      try {
        if (command === "link") {
          if (activeFormats.link) {
            document.execCommand("unlink");
          } else {
            document.execCommand("createLink", false, "#");
          }
        } else if (command === "strike") {
          document.execCommand("strikeThrough");
        } else {
          document.execCommand(command);
        }
      } catch {
        // Document execCommand fallback
      }
    }
    updateFormatStates();
  };

  const buttonFocusRing =
    "ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary";

  const barContent = (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Text format"
      data-testid="text-format-bar"
      className="ll-ftxb ll:select-none"
      onPointerDown={(e) => {
        isMouseDownOnBarRef.current = true;
        e.preventDefault();
      }}
      onPointerUp={() => {
        isMouseDownOnBarRef.current = false;
      }}
    >
      <button
        type="button"
        data-fc="bold"
        aria-pressed={activeFormats.bold ? "true" : "false"}
        aria-label="Bold"
        title="Bold (Ctrl+B)"
        onPointerDown={(e) => e.preventDefault()}
        className={`ll-ib ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:transition-colors ${buttonFocusRing} ${
          activeFormats.bold
            ? "ll:bg-control-active ll:text-primary"
            : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
        }`}
        onClick={() => handleFormat("bold")}
      >
        <b className="ll:font-bold ll:text-small ll:leading-none">B</b>
      </button>

      <button
        type="button"
        data-fc="italic"
        aria-pressed={activeFormats.italic ? "true" : "false"}
        aria-label="Italic"
        title="Italic (Ctrl+I)"
        onPointerDown={(e) => e.preventDefault()}
        className={`ll-ib ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:transition-colors ${buttonFocusRing} ${
          activeFormats.italic
            ? "ll:bg-control-active ll:text-primary"
            : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
        }`}
        onClick={() => handleFormat("italic")}
      >
        <ItalicIcon />
      </button>

      <button
        type="button"
        data-fc="underline"
        aria-pressed={activeFormats.underline ? "true" : "false"}
        aria-label="Underline"
        title="Underline (Ctrl+U)"
        onPointerDown={(e) => e.preventDefault()}
        className={`ll-ib ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:transition-colors ${buttonFocusRing} ${
          activeFormats.underline
            ? "ll:bg-control-active ll:text-primary"
            : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
        }`}
        onClick={() => handleFormat("underline")}
      >
        <UnderlineIcon />
      </button>

      <button
        type="button"
        data-fc="strike"
        aria-pressed={activeFormats.strike ? "true" : "false"}
        aria-label="Strikethrough"
        title="Strikethrough (Ctrl+Shift+X)"
        onPointerDown={(e) => e.preventDefault()}
        className={`ll-ib ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:transition-colors ${buttonFocusRing} ${
          activeFormats.strike
            ? "ll:bg-control-active ll:text-primary"
            : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
        }`}
        onClick={() => handleFormat("strike")}
      >
        <StrikeIcon />
      </button>

      <span className="ll-ftxs" />

      <button
        type="button"
        data-fc="link"
        aria-pressed={activeFormats.link ? "true" : "false"}
        aria-label="Link"
        title="Link"
        onPointerDown={(e) => e.preventDefault()}
        className={`ll-ib ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:transition-colors ${buttonFocusRing} ${
          activeFormats.link
            ? "ll:bg-control-active ll:text-primary"
            : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
        }`}
        onClick={() => handleFormat("link")}
      >
        <LinkIconSvg />
      </button>
    </div>
  );

  if (forceVisible) {
    return barContent;
  }

  if (!mounted) {
    return null;
  }

  return createPortal(barContent, document.body);
};

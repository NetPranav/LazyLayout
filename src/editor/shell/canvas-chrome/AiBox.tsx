"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { ArrowUp, Check, Frame, X } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import { surf, type Surf } from "@/editor/motion/surface";
import { MENU_FALLBACKS, MOT } from "@/editor/motion/presets";
import { prefersReducedMotion } from "@/editor/motion/feel";
import { CANVAS_CHROME_SIZES } from "./constants";
import type { AiState } from "./types";
import "./ai-loader.css";

export interface AiBoxProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (prompt: string) => void;
  /** Opens the AI chat view in the right panel with the current prompt. */
  onExpand?: (prompt: string) => void;
  onStop?: () => void;
  onUndo?: () => void;
  onKeep?: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  context?: { name: string; type: string };
  state?: AiState;
  aiLoading?: boolean;
}

export const AiBox: React.FC<AiBoxProps> = ({
  open,
  onClose,
  onSubmit,
  onStop,
  onUndo,
  onKeep,
  triggerRef,
  context = { name: "Home", type: "frame" },
  state,
  aiLoading = false,
}) => {
  // Derive aiState directly from props without effect setState
  const [localAiState, setLocalAiState] = useState<AiState>("idle");
  const aiState: AiState = aiLoading ? "work" : (state ?? localAiState);

  const [prompt, setPrompt] = useState<string>("");
  const [hasContext, setHasContext] = useState<boolean>(true);
  const [isRendered, setIsRendered] = useState<boolean>(open);
  const [prevOpen, setPrevOpen] = useState<boolean>(open);

  const boxRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const lastSentPromptRef = useRef<string>("");
  const textareaId = useId();

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }

  // Auto-fit textarea height, capped by CSS maxHeight
  const fitTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Initialize Surf instance on mount
  useEffect(() => {
    if (!isRendered || !boxRef.current) return;
    const s = surf(boxRef.current);
    surfRef.current = s;

    return () => {
      s.reset();
    };
  }, [isRendered]);

  // Handle open / close surface spring motion
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const boxEl = boxRef.current;
    if (!s || !boxEl) return;

    if (open) {
      const triggerEl = triggerRef?.current;
      let seed = { ...MENU_FALLBACKS.surfaceSeedDefault };
      if (triggerEl) {
        const r = triggerEl.getBoundingClientRect();
        seed = {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r:
            parseFloat(getComputedStyle(triggerEl).borderRadius) ||
            MENU_FALLBACKS.popoverRadius,
        };
      }

      s.open({
        from: seed,
        up: true,
      });
    } else {
      s.leave();
      const exitDuration = prefersReducedMotion()
        ? MENU_FALLBACKS.reducedMotionDuration
        : MOT.exitMs;
      const t = setTimeout(() => {
        setIsRendered(false);
      }, exitDuration);
      return () => clearTimeout(t);
    }
  }, [open, isRendered, triggerRef]);

  // Focus the prompt once the box is open (the trigger click would otherwise keep focus)
  useEffect(() => {
    if (!open || !isRendered) return;
    const id = setTimeout(() => textareaRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open, isRendered]);

  // Outside click & Escape handler
  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        if (triggerRef?.current && triggerRef.current.contains(e.target as Node))
          return;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        triggerRef?.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isRendered, onClose, triggerRef]);

  const handleSend = useCallback(
    (textToSend?: string) => {
      const finalPrompt = (textToSend ?? prompt).trim();
      if (!finalPrompt) return;

      lastSentPromptRef.current = finalPrompt;
      setPrompt("");
      setLocalAiState("work");
      onSubmit?.(finalPrompt);
    },
    [prompt, onSubmit]
  );

  const handleStop = useCallback(() => {
    setPrompt(lastSentPromptRef.current);
    setLocalAiState("idle");
    onStop?.();
    textareaRef.current?.focus();
  }, [onStop]);

  const handleUndo = useCallback(() => {
    setLocalAiState("idle");
    setPrompt("");
    onUndo?.();
  }, [onUndo]);

  const handleKeep = useCallback(() => {
    setLocalAiState("idle");
    setPrompt("");
    onKeep?.();
  }, [onKeep]);

  if (!isRendered) return null;

  const placeholderText =
    aiState === "done"
      ? "Follow up…"
      : hasContext
      ? "Ask AI to build or edit…"
      : "Ask anything about this page…";

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Ask AI"
      tabIndex={-1}
      style={{
        width: "min(480px, calc(100% - var(--ll-spacing-8)))",
        bottom:
          "calc(var(--ll-size-topbar-h) + var(--ll-spacing-4) + var(--ll-spacing-2) - var(--ll-spacing-0-5))",
      }}
      className="ll-aibox ll-surface-overlay ll:absolute ll:left-1/2 ll:-translate-x-1/2 ll:z-30 ll:flex ll:flex-col ll:p-2 ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:outline-none ll:transition-colors ll:focus-within:border-primary"
    >
      <div className="ll-lay ll:flex ll:flex-col ll:gap-1 ll:w-full">
        {/* Done State Banner (.ll-aidone) */}
        {aiState === "done" && (
          <div className="ll-aidone ll:flex ll:items-center ll:gap-3 ll:min-h-7 ll:text-small ll:font-sans ll:text-primary">
            <Icon icon={Check} size={CANVAS_CHROME_SIZES.iconMd} className="ll:shrink-0 ll:text-primary" />
            <span className="ll:flex-1 ll:min-w-0 ll:truncate">
              Changed weight and size
            </span>
            <div className="ll:flex ll:items-center ll:gap-2 ll:shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                className="ll-aitxt ll:h-6 ll:px-2 ll:font-sans ll:text-small ll:font-medium ll:text-secondary ll:hover:text-primary ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
              >
                Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleKeep}
                className="ll-aitxt ll:h-6 ll:px-2 ll:font-sans ll:text-small ll:font-medium ll:text-secondary ll:hover:text-primary ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
              >
                Keep
              </Button>
            </div>
          </div>
        )}

        {/* Input Row (.ll-aiinrow) - shown when idle or done */}
        {aiState !== "work" && (
          <div className="ll-aiinrow ll:flex ll:items-end ll:gap-2 ll:min-w-0 ll:w-full">
            {/* Context tag (.ll-aitag) */}
            {hasContext && (
              <span className="ll-aitag ll:flex ll:items-center ll:gap-1 ll:shrink-0 ll:h-7 ll:mb-0 ll:pl-1.5 ll:pr-0.5 ll:rounded-sm ll:bg-surface-bar ll:text-secondary ll:text-nano ll:font-medium ll:select-none">
                <Icon icon={Frame} size={CANVAS_CHROME_SIZES.iconMd} className="ll:shrink-0" />
                <span
                  style={{
                    maxWidth: "calc(var(--ll-size-menu-users-w) / 2)",
                  }}
                  className="ll-aictx ll:truncate"
                >
                  {context.name}
                </span>
                <IconButton
                  size="sm"
                  aria-label="Remove context"
                  onClick={() => setHasContext(false)}
                  icon={<Icon icon={X} size={CANVAS_CHROME_SIZES.iconXs} />}
                  className="ll-aitagx ll:w-4 ll:h-4 ll:p-0 ll:border-0 ll:bg-transparent ll:cursor-pointer ll:text-muted ll:hover:text-primary ll:hover:bg-control-active ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
                />
              </span>
            )}

            {/* Auto-expanding Textarea */}
            <textarea
              ref={textareaRef}
              id={textareaId}
              autoFocus
              rows={1}
              value={prompt}
              style={{
                maxHeight: "calc(var(--ll-spacing-16) + var(--ll-spacing-6))",
              }}
              onChange={(e) => {
                setPrompt(e.target.value);
                fitTextarea();
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={placeholderText}
              aria-label="Ask AI"
              autoComplete="off"
              className="ll:flex-1 ll:min-w-0 ll:h-7 ll:py-1 ll:px-1 ll:bg-transparent ll:border-0 ll:outline-none ll:resize-none ll:text-body ll:font-sans ll:text-primary ll:placeholder:text-muted "
            />

            {/* Send button using IconButton */}
            <IconButton
              size="sm"
              aria-label="Send"
              disabled={!prompt.trim()}
              onClick={() => handleSend()}
              variant="ghost"
              pressed={!!prompt.trim()}
              className={`ll-aisend ll:w-7 ll:h-7 ll:shrink-0 ${
                prompt.trim() ? "" : "ll:text-muted"
              }`}
              icon={<Icon icon={ArrowUp} size={CANVAS_CHROME_SIZES.iconMd} />}
            />
          </div>
        )}

        {/* Working / Loading State (.ll-aiwork) with Trace Loader (.ll-aiload) */}
        {aiState === "work" && (
          <div className="ll-aiwork ll:flex ll:items-center ll:gap-3 ll:min-h-7 ll:text-small ll:font-sans ll:text-muted">
            {/* Trace loader (.ll-aiload) animated via ai-loader.css keyframes */}
            <svg
              className="ll-aiload ll:w-5 ll:h-5 ll:shrink-0 ll:text-primary"
              viewBox="0 0 256 256"
              aria-hidden="true"
            >
              <path
                className="ll-aiload-tro"
                pathLength={100}
                d="M256 256H128L0 128H128ZM256 128H128L0 0H128Z"
              />
              <path
                className="ll-aiload-trf"
                d="M256 256H128L0 128H128ZM256 128H128L0 0H128Z"
              />
            </svg>

            <span className="ll:flex-1 ll:min-w-0 ll:truncate">
              Working on {hasContext ? context.name : "this page"}…
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="ll-aitxt ll:h-6 ll:px-2 ll:font-sans ll:text-small ll:font-medium ll:text-secondary ll:hover:text-primary ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
            >
              Stop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
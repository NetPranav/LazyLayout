"use client";

import React, { useState, useRef, useId } from "react";
import { Eye, EyeOff, Layers, Code, Play } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { LogoMark } from "@/editor/components/LogoMark";
import { RightPanelFrame } from "./RightPanelFrame";
import type { RightPanelMode, AiChatMessage, DesignSectionConfig } from "./types";

export interface RightPanelLabViewProps {
  initialMode?: RightPanelMode;
  initialAi?: boolean;
}

const DEFAULT_LAB_MESSAGES: AiChatMessage[] = [
  {
    id: "lab-1",
    role: "user",
    content: "Make this headline bolder",
  },
  {
    id: "lab-2",
    role: "assistant",
    content: "Set Headline to weight 700.",
  },
];

// Fake content stubs moved from RightPanelFrame to lab view only, using solid surface tokens
const LAB_DESIGN_SECTIONS: DesignSectionConfig[] = [
  {
    id: "position",
    title: "Position",
    moreContent: (
      <div className="ll:py-2 ll:px-2.5 ll:rounded-sm ll:bg-surface-bar ll:text-micro ll:font-mono ll:text-muted">
        Advanced position &amp; z-index offsets
      </div>
    ),
  },
  {
    id: "layout",
    title: "Layout",
    moreContent: (
      <div className="ll:py-2 ll:px-2.5 ll:rounded-sm ll:bg-surface-bar ll:text-micro ll:font-mono ll:text-muted">
        Advanced flex, grid &amp; constraints
      </div>
    ),
  },
  {
    id: "appearance",
    title: "Appearance",
    moreContent: (
      <div className="ll:py-2 ll:px-2.5 ll:rounded-sm ll:bg-surface-bar ll:text-micro ll:font-mono ll:text-muted">
        Corner radii, blend modes &amp; pointer events
      </div>
    ),
  },
  {
    id: "typography",
    title: "Typography",
    moreContent: (
      <div className="ll:py-2 ll:px-2.5 ll:rounded-sm ll:bg-surface-bar ll:text-micro ll:font-mono ll:text-muted">
        Font loading &amp; variable axes
      </div>
    ),
  },
  { id: "fill", title: "Fill" },
  { id: "stroke", title: "Stroke" },
  { id: "effects", title: "Effects" },
  { id: "animation", title: "Animation" },
  { id: "data", title: "Data" },
  { id: "logic", title: "Logic" },
  { id: "accessibility", title: "Accessibility" },
];

export function RightPanelLabView({
  initialMode = "design",
  initialAi = false,
}: RightPanelLabViewProps) {
  const labId = useId();
  const designBtnId = `${labId}-mode-design`;
  const motionBtnId = `${labId}-mode-motion`;
  const codeBtnId = `${labId}-mode-code`;
  const toggleAiId = `${labId}-toggle-ai`;
  const toggleHideId = `${labId}-toggle-hide`;

  const [mode, setMode] = useState<RightPanelMode>(initialMode);
  const [aiOpen, setAiOpen] = useState(initialAi);
  const [isLayerHidden, setIsLayerHidden] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>(DEFAULT_LAB_MESSAGES);
  const nextMsgIdRef = useRef(3);

  const handleSendMessage = (text: string) => {
    const newMsg: AiChatMessage = {
      id: `lab-msg-${nextMsgIdRef.current++}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  return (
    <div className="ll:w-full ll:h-screen ll:flex ll:flex-col ll:bg-surface-canvas ll:text-primary ll:overflow-hidden ll:font-sans">
      {/* Top Test Toolbar */}
      <div className="ll:h-10 ll:px-4 ll:flex ll:items-center ll:justify-between ll:bg-surface-panel ll:border-b ll:border-border ll:shrink-0 ll:select-none">
        <div className="ll:flex ll:items-center ll:gap-2">
          <span className="ll:text-micro ll:font-mono ll:uppercase ll:text-muted ll:font-medium">
            Lab Mode:
          </span>
          <div className="ll:flex ll:items-center ll:border ll:border-border ll:rounded-sm ll:p-0.5 ll:bg-surface-bar">
            <button
              type="button"
              id={designBtnId}
              aria-pressed={mode === "design"}
              onClick={() => {
                setMode("design");
                setAiOpen(false);
              }}
              className={`ll:flex ll:items-center ll:gap-1.5 ll:h-6 ll:px-2.5 ll:rounded-xs ll:text-small ll:font-medium ll:transition-none ll:cursor-pointer ll:border-0 ${
                mode === "design"
                  ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
                  : "ll:bg-transparent ll:text-secondary ll:hover:text-primary"
              }`}
            >
              <Icon icon={Layers} size={13} />
              <span>Design</span>
            </button>
            <button
              type="button"
              id={motionBtnId}
              aria-pressed={mode === "motion"}
              onClick={() => {
                setMode("motion");
                setAiOpen(false);
              }}
              className={`ll:flex ll:items-center ll:gap-1.5 ll:h-6 ll:px-2.5 ll:rounded-xs ll:text-small ll:font-medium ll:transition-none ll:cursor-pointer ll:border-0 ${
                mode === "motion"
                  ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
                  : "ll:bg-transparent ll:text-secondary ll:hover:text-primary"
              }`}
            >
              <Icon icon={Play} size={13} />
              <span>Motion</span>
            </button>
            <button
              type="button"
              id={codeBtnId}
              aria-pressed={mode === "code"}
              onClick={() => {
                setMode("code");
                setAiOpen(false);
              }}
              className={`ll:flex ll:items-center ll:gap-1.5 ll:h-6 ll:px-2.5 ll:rounded-xs ll:text-small ll:font-medium ll:transition-none ll:cursor-pointer ll:border-0 ${
                mode === "code"
                  ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
                  : "ll:bg-transparent ll:text-secondary ll:hover:text-primary"
              }`}
            >
              <Icon icon={Code} size={13} />
              <span>Code</span>
            </button>
          </div>
        </div>

        <div className="ll:flex ll:items-center ll:gap-2">
          <button
            type="button"
            id={toggleAiId}
            aria-pressed={aiOpen}
            onClick={() => setAiOpen((prev) => !prev)}
            className={`ll:flex ll:items-center ll:gap-1.5 ll:h-6 ll:px-2.5 ll:rounded-xs ll:text-small ll:font-medium ll:transition-none ll:cursor-pointer ll:border ll:border-border ${
              aiOpen
                ? "ll:bg-control-primary-bg ll:text-control-primary-fg"
                : "ll:bg-surface-bar ll:text-secondary ll:hover:text-primary"
            }`}
          >
            <span className="ll-logo">
              <LogoMark size={13} />
            </span>
            <span>{aiOpen ? "Close AI" : "Open AI Chat"}</span>
          </button>

          <button
            type="button"
            id={toggleHideId}
            aria-pressed={isLayerHidden}
            onClick={() => setIsLayerHidden((prev) => !prev)}
            className="ll:flex ll:items-center ll:gap-1.5 ll:h-6 ll:px-2.5 ll:rounded-xs ll:text-small ll:font-medium ll:bg-surface-bar ll:border ll:border-border ll:text-secondary ll:hover:text-primary ll:transition-none ll:cursor-pointer"
          >
            <Icon icon={isLayerHidden ? EyeOff : Eye} size={13} />
            <span>{isLayerHidden ? "Hidden" : "Visible"}</span>
          </button>
        </div>
      </div>

      {/* 1440x900 viewport frame */}
      <div className="ll:flex-1 ll:flex ll:min-h-0 ll:overflow-hidden">
        {/* Mock Canvas Area */}
        <main
          className="ll:flex-1 ll:flex ll:flex-col ll:items-center ll:justify-center ll:p-8 ll:bg-surface-backdrop ll:overflow-hidden"
          aria-label="Design Canvas"
        >
          {/* Mock Artboard (1440 style preview) */}
          <div className="ll:w-full ll:max-w-2xl ll:h-96 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:p-8 ll:flex ll:flex-col ll:justify-center ll:items-start ll:gap-4 ll:relative ll:select-none">
            <div className="ll:absolute ll:top-3 ll:left-4 ll:text-micro ll:font-mono ll:text-muted">
              Artboard • 1440 × 900
            </div>

            <div
              className={`ll:p-2 ll:rounded-sm ll:border ${
                isLayerHidden ? "ll:opacity-20" : "ll:opacity-100"
              } ll:border-control-primary-bg ll:bg-surface-bar`}
            >
              <h1 className="ll:text-display ll:font-semibold ll:text-primary ll:m-0 ll:tracking-tight">
                Design it once. Ship it lazily.
              </h1>
            </div>

            <p className="ll:text-body ll:text-secondary ll:max-w-md ll:m-0">
              Build pages visually and get production code out. Apple-level
              craftsmanship with Awwwards-level polish.
            </p>

            <button
              type="button"
              className="ll:h-8 ll:px-4 ll:rounded-sm ll:bg-control-primary-bg ll:text-control-primary-fg ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ll:hover:opacity-90 ll:transition-none"
            >
              Get started
            </button>
          </div>
        </main>

        {/* Right Panel Frame under test */}
        <RightPanelFrame
          mode={mode}
          aiOpen={aiOpen}
          isLayerHidden={isLayerHidden}
          onToggleHideLayer={() => setIsLayerHidden((prev) => !prev)}
          onAiClose={() => setAiOpen(false)}
          aiMessages={messages}
          onAiSendMessage={handleSendMessage}
          designSections={LAB_DESIGN_SECTIONS}
        />
      </div>
    </div>
  );
}

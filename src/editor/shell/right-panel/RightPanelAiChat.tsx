"use client";

import React, { useState, useId, useRef, useEffect } from "react";
import { ArrowUp, X } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { LogoMark } from "@/editor/components/LogoMark";
import type { AiChatMessage } from "./types";

export interface RightPanelAiChatProps {
  onAiClose?: () => void;
  aiMessages?: AiChatMessage[];
  onAiSendMessage?: (content: string) => void;
  aiInputPlaceholder?: string;
  className?: string;
}

export const RightPanelAiChat: React.FC<RightPanelAiChatProps> = ({
  onAiClose,
  aiMessages = [],
  onAiSendMessage,
  aiInputPlaceholder = "Ask anything about this…",
  className = "",
}) => {
  const [inputValue, setInputValue] = useState("");
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listRef = useRef<HTMLDivElement>(null);

  // Like the prototype, the list scrolls to the newest message.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [aiMessages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAiSendMessage?.(trimmed);
    setInputValue("");
  };

  return (
    <section
      aria-label="AI chat"
      className={`ll-aichat ll:flex ll:flex-1 ll:flex-col ll:min-h-0 ll:overflow-hidden ll:font-sans ll:text-body ${className}`}
    >
      {/* AI Chat Header */}
      <div className="ll-aichead ll:h-header ll:pl-4 ll:pr-3 ll:flex ll:items-center ll:gap-2 ll:border-b ll:border-border ll:shrink-0">
        <span className="ll-logo ll-aimark ll:text-primary ll:shrink-0">
          <LogoMark size={18} />
        </span>
        <span className="ll-aitl ll:text-body ll:font-medium ll:text-primary ll:font-sans">
          AI
        </span>

        <div className="ll:flex-1" />

        <IconButton
          aria-label="Close AI"
          title="Close AI"
          icon={<Icon icon={X} size={16} />}
          onClick={onAiClose}
        />
      </div>

      {/* Message List */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        className="ll-ailist ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:p-4 ll:flex ll:flex-col ll:gap-4"
      >
        {aiMessages.map((msg) => (
          <p
            key={msg.id}
            className={`ll-aimsg ll:m-0 ll:font-sans ll:text-body ll:leading-normal ${
              msg.role === "user"
                ? "ll-you ll:text-secondary"
                : "ll:text-primary"
            }`}
          >
            {msg.content}
          </p>
        ))}
      </div>

      {/* Footer / Input row */}
      <div className="ll-aichatfoot ll:shrink-0 ll:p-3 ll:border-t ll:border-border">
        <form
          onSubmit={handleSubmit}
          className="ll-airow ll:flex ll:items-center ll:gap-2 ll:min-w-0"
        >
          <input
            id={inputId}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={aiInputPlaceholder}
            aria-label={aiInputPlaceholder.replace(/…$/, "")}
            autoComplete="off"
            className="ll:flex-1 ll:min-w-0 ll:h-8 ll:p-0 ll:bg-transparent ll:border-0 ll:font-sans ll:text-body ll:text-primary ll:placeholder:text-muted ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:rounded-sm ll:transition-all"
          />
          <button
            type="submit"
            aria-label="Send"
            title="Send"
            className="ll-aisend ll:w-8 ll:h-8 ll:shrink-0 ll:grid ll:place-items-center ll:rounded-sm ll:bg-control-primary-bg ll:text-control-primary-fg ll:hover:opacity-90 ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:transition-none"
          >
            <Icon icon={ArrowUp} size={16} />
          </button>
        </form>
      </div>
    </section>
  );
};

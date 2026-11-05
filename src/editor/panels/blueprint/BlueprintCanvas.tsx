"use client";

import React from "react";
import { ChevronLeft, GitFork, Database } from "lucide-react";
import { Icon } from "@/editor/components/Icon";

export interface BlueprintCanvasProps {
  /** Mode: Logic or Data coming-soon workspace */
  mode?: "Logic" | "Data";
  /** Back button handler */
  onBack?: () => void;
  /** Legacy back handler */
  onBackToViewport?: () => void;
  focusedNodeId?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

const DESCRIPTIONS: Record<"Logic" | "Data", { icon: typeof GitFork; desc: string }> = {
  Logic: {
    icon: GitFork,
    desc: "A full-page workspace for flows, conditions and events. It opens here once it is built.",
  },
  Data: {
    icon: Database,
    desc: "A full-page workspace for sources, tables and bindings. It opens here once it is built.",
  },
};

/**
 * BlueprintCanvas: Full-page shell dialog with a Back button (P lines 1146-1153, 6882-6902),
 * shown as "Coming soon". Real content is out of scope.
 */
export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  mode = "Logic",
  onBack,
  onBackToViewport,
  className = "",
  style,
}) => {
  const handleBack = () => {
    if (onBack) onBack();
    else if (onBackToViewport) onBackToViewport();
    else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  };

  const info = DESCRIPTIONS[mode] || DESCRIPTIONS.Logic;

  return (
    <div
      role="dialog"
      aria-label={mode}
      className={`ll-csoon ll:flex ll:flex-col ll:h-full ll:w-full ll:bg-surface-canvas ll:select-none ${className}`}
      style={style}
    >
      {/* Header (.csh in prototype: height 52px, 16px padding, panel bg, border-bottom) */}
      <header className="ll-csh ll:h-13 ll:shrink-0 ll:flex ll:items-center ll:gap-3 ll:px-4 ll:bg-surface-panel ll:border-b ll:border-border">
        <button
          type="button"
          data-soon="back"
          onClick={handleBack}
          aria-label="Back"
          className="ll-btn ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-2.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer ll:transition-colors"
        >
          <Icon icon={ChevronLeft} size={14} />
          <span>Back</span>
        </button>
        <span className="ll-cst ll:font-sans ll:text-body ll:font-medium ll:text-primary">
          {mode}
        </span>
      </header>

      {/* Body (.csb in prototype: centered, 32px icon, h2 24px/600, p 13px muted max-w 420px) */}
      <div className="ll-csb ll:flex-1 ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-3 ll:text-center ll:p-6">
        <Icon icon={info.icon} size={32} className="ll-csi ll:text-muted ll:mb-1" />
        <h2 className="ll:font-sans ll:text-2xl ll:font-semibold ll:text-primary ll:m-0">
          {mode} is coming soon
        </h2>
        <p className="ll:font-sans ll:text-small ll:text-muted ll:max-w-md ll:m-0 ll:leading-relaxed">
          {info.desc}
        </p>
      </div>
    </div>
  );
};

export default BlueprintCanvas;

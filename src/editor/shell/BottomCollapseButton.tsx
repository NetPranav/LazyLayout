"use client";

import React from "react";
import { ProtoIcon } from "@/editor/components/icons/ProtoIcon";
import { toggleBottomCollapsed, useBottomCollapsed } from "./shellFx";

/** Collapses the bottom panel (Motion timeline, Code panel) to its header strip and back. 32px, 4px radius. */
export const BottomCollapseButton: React.FC<{ mode: "motion" | "code" }> = ({ mode }) => {
  const collapsed = useBottomCollapsed(mode);
  const label = collapsed ? "Expand panel" : "Collapse panel";
  return (
    <button
      type="button"
      data-ta="collapse-bottom"
      data-testid="bottom-collapse"
      onClick={() => toggleBottomCollapsed(mode)}
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className="ll:w-8 ll:h-8 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:flex-none ll:transition-colors ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:border-0 ll:bg-transparent ll:cursor-pointer"
    >
      <ProtoIcon
        name="collapseb"
        size={18}
        style={{ transform: collapsed ? "rotate(180deg)" : undefined, transition: "transform 0.2s ease" }}
      />
    </button>
  );
};

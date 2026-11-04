"use client";

import React, { useState, useEffect } from "react";
import { Workflow, GripVertical, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import type { InspectorSectionProps, LogicItem } from "../types";

export interface LogicSectionProps extends InspectorSectionProps {
  onOpenBlueprint?: () => void;
  onAddLogicRef?: { current?: () => void };
}

export const LogicSection: React.FC<LogicSectionProps> = ({
  onAddLogicRef,
  className = "",
}) => {
  const [logicItems, setLogicItems] = useState<LogicItem[]>([]);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const handleAdd = () => {
    const newId = `logic-${Date.now()}`;
    const next: LogicItem[] = [
      ...logicItems,
      { id: newId, blueprint: "onClick", trigger: "onClick" },
    ];
    setLogicItems(next);
  };

  useEffect(() => {
    if (onAddLogicRef) {
      onAddLogicRef.current = handleAdd;
    }
  });

  const handleRemove = (id: string) => {
    setLogicItems((prev) => prev.filter((it) => it.id !== id));
    if (activePopoverId === id) setActivePopoverId(null);
  };

  if (logicItems.length === 0) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:w-full ${className}`}>
      {logicItems.map((item) => (
        <div
          key={item.id}
          data-k="logic"
          className="ll-dr ll-rr ll:flex ll:items-center ll:gap-1.5 ll:h-8 ll:px-1 ll:rounded-sm ll:hover:bg-surface-bar ll:transition-colors"
        >
          <button
            type="button"
            aria-label="Reorder"
            title="Reorder"
            className="ll-grip ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:cursor-grab ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
          >
            <Icon icon={GripVertical} size={12} />
          </button>

          <button
            type="button"
            aria-label="Settings"
            title="Settings"
            onClick={() =>
              setActivePopoverId(activePopoverId === item.id ? null : item.id)
            }
            className="ll-lead ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
          >
            <Icon icon={Workflow} size={14} className="ll:text-muted" />
          </button>

          <div className="ll-sum ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
            <span className="ll-stx ll:font-mono ll:text-small ll:text-primary ll:truncate">
              {item.blueprint || "onClick"}
            </span>
          </div>

          <button
            type="button"
            aria-label="Remove"
            title="Remove"
            onClick={() => handleRemove(item.id)}
            className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
          >
            <Icon icon={Minus} size={14} />
          </button>

          {activePopoverId === item.id && (
            <RowSettingsPopover
              isOpen={true}
              title="Logic Blueprint"
              onClose={() => setActivePopoverId(null)}
            >
              <div className="ll:flex ll:flex-col ll:gap-2">
                <span className="ll:text-nano ll:font-mono ll:text-muted">
                  Trigger: {item.trigger}
                </span>
              </div>
            </RowSettingsPopover>
          )}
        </div>
      ))}
    </div>
  );
};

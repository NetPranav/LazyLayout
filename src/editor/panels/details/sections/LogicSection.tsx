"use client";
import React, { useState, useEffect } from "react";
import { Workflow, GripVertical, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import type { InspectorSectionProps, LogicItem } from "../types";

export interface LogicSectionProps extends InspectorSectionProps {
  onOpenBlueprint?: () => void;
  onAddLogicRef?: { current?: () => void };
}

const BLUEPRINT_OPTIONS = [
  { value: "None", label: "None" },
  { value: "onClick", label: "onClick" },
  { value: "onSubmit", label: "onSubmit" },
] as const;

export const LogicSection: React.FC<LogicSectionProps> = ({
  onOpenBlueprint,
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

  const handleUpdate = (id: string, patch: Partial<LogicItem>) => {
    setLogicItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleRemove = (id: string) => {
    setLogicItems((prev) => prev.filter((it) => it.id !== id));
    if (activePopoverId === id) setActivePopoverId(null);
  };

  if (logicItems.length === 0) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-0.5 ll:-mx-1 ${className}`}>
      {logicItems.map((item) => {
        const isOpen = activePopoverId === item.id;
        return (
          <div
            key={item.id}
            data-k="logic"
            className={`ll-dr ll-rr ll:group ll:flex ll:items-center ll:gap-1 ll:h-8 ll:py-0.5 ll:px-1 ll:rounded-sm ${
              isOpen ? "ll:bg-surface-raised ll:text-primary" : ""
            }`}
          >
            <span
              aria-hidden="true"
              title="Drag to reorder"
              className="ll-grip ll:-ml-4 ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:cursor-grab ll:opacity-0 ll:group-hover:opacity-100 ll:group-focus-within:opacity-100 ll:transition-opacity ll:duration-100"
            >
              <Icon icon={GripVertical} size={12} />
            </span>

            <button
              type="button"
              aria-label="Settings"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              title="Settings"
              onClick={() => setActivePopoverId(isOpen ? null : item.id)}
              className="ll-lead ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:shrink-0 ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:hover:bg-surface-hover ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:text-muted"
            >
              <Icon icon={Workflow} size={14} />
            </button>

            <div className="ll-sum ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0">
              <span className="ll-stx ll:font-mono ll:text-micro ll:text-primary ll:truncate">
                {item.blueprint || "None"}
              </span>
            </div>

            <button
              type="button"
              aria-label="Remove"
              title="Remove"
              onClick={() => handleRemove(item.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={Minus} size={14} />
            </button>

            <RowSettingsPopover isOpen={isOpen} title="Logic" onClose={() => setActivePopoverId(null)}>
              <Select
                aria-label="Blueprint"
                options={BLUEPRINT_OPTIONS}
                value={item.blueprint}
                width="100%"
                size="sm"
                onChange={(value) => handleUpdate(item.id, { blueprint: value, trigger: value })}
              />
              <button
                type="button"
                onClick={onOpenBlueprint}
                className="ll:h-7 ll:w-full ll:rounded-sm ll:bg-surface-bar ll:text-small ll:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:border-0 ll:outline-none"
              >
                Open
              </button>
            </RowSettingsPopover>
          </div>
        );
      })}
    </div>
  );
};

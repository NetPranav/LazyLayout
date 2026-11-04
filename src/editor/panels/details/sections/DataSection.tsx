"use client";
import React, { useState, useEffect } from "react";
import { Link as LinkIcon, GripVertical, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import type { InspectorSectionProps, DataItem } from "../types";

export interface DataSectionProps extends InspectorSectionProps {
  onAddDataRef?: { current?: () => void };
}

export const DataSection: React.FC<DataSectionProps> = ({
  onAddDataRef,
  className = "",
}) => {
  const [dataBindings, setDataBindings] = useState<DataItem[]>([]);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const handleAdd = () => {
    const newId = `data-${Date.now()}`;
    const next: DataItem[] = [...dataBindings, { id: newId, source: "items.title" }];
    setDataBindings(next);
  };

  useEffect(() => {
    if (onAddDataRef) {
      onAddDataRef.current = handleAdd;
    }
  });

  const handleUpdate = (id: string, source: string) => {
    setDataBindings((prev) => prev.map((d) => (d.id === id ? { ...d, source } : d)));
  };

  const handleRemove = (id: string) => {
    setDataBindings((prev) => prev.filter((d) => d.id !== id));
    if (activePopoverId === id) setActivePopoverId(null);
  };

  if (dataBindings.length === 0) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-0.5 ll:-mx-1 ${className}`}>
      {dataBindings.map((item) => {
        const isOpen = activePopoverId === item.id;
        return (
          <div
            key={item.id}
            data-k="data"
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
              <Icon icon={LinkIcon} size={14} />
            </button>

            <div className="ll-sum ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0">
              <span className="ll-stx ll:font-mono ll:text-micro ll:text-primary ll:truncate">
                {item.source || "Not bound"}
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

            <RowSettingsPopover isOpen={isOpen} title="Data" onClose={() => setActivePopoverId(null)}>
              <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:rounded-sm">
                <input
                  type="text"
                  aria-label="Data source"
                  placeholder="Bind to source"
                  value={item.source}
                  onChange={(e) => handleUpdate(item.id, e.target.value)}
                  className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                />
              </div>
            </RowSettingsPopover>
          </div>
        );
      })}
    </div>
  );
};

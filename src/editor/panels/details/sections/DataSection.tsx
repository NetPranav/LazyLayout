"use client";

import React, { useState } from "react";
import { Plus, Link as LinkIcon } from "lucide-react";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { TextField } from "@/editor/components/TextField";
import { RepeatableRow } from "../controls/RepeatableRow";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import type { InspectorSectionProps, DataItem } from "../types";

export const DataSection: React.FC<InspectorSectionProps> = ({
  className = "",
}) => {
  const [dataBindings, setDataBindings] = useState<DataItem[]>([
    { id: "data-1", source: "items.title" },
  ]);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const handleAdd = () => {
    const newId = `data-${Date.now()}`;
    const next: DataItem[] = [...dataBindings, { id: newId, source: "" }];
    setDataBindings(next);
    setActivePopoverId(newId);
  };

  const handleUpdate = (id: string, source: string) => {
    setDataBindings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, source } : d))
    );
  };

  const handleRemove = (id: string) => {
    setDataBindings((prev) => prev.filter((d) => d.id !== id));
    if (activePopoverId === id) setActivePopoverId(null);
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Header Add Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pb-1">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          State &amp; Collections
        </span>
        <IconButton
          size="sm"
          aria-label="Add data binding"
          tooltip="Add data binding"
          onClick={handleAdd}
          icon={<Icon icon={Plus} size={14} />}
        />
      </div>

      {/* Repeatable Data List */}
      <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
        {dataBindings.length === 0 ? (
          <div className="ll:py-2 ll:px-2.5 ll:text-micro ll:font-mono ll:text-muted ll:bg-surface-bar ll:rounded-sm">
            No data bindings attached.
          </div>
        ) : (
          dataBindings.map((item) => {
            const isOpen = activePopoverId === item.id;

            const leadNode = (
              <span className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:text-muted">
                <Icon icon={LinkIcon} size={13} />
              </span>
            );

            const summaryNode = (
              <input
                type="text"
                aria-label="Data source"
                placeholder="Bind to source..."
                value={item.source}
                onChange={(e) => handleUpdate(item.id, e.target.value)}
                className="ll:w-full ll:h-7 ll:px-2 ll:box-border ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:focus:border-primary ll:outline-none ll:rounded-sm ll:font-mono ll:text-small ll:text-primary ll:placeholder:text-muted ll:transition-colors"
              />
            );

            return (
              <React.Fragment key={item.id}>
                <RepeatableRow
                  id={item.id}
                  isOpen={isOpen}
                  leadContent={leadNode}
                  leadTitle="Data binding settings"
                  summaryContent={summaryNode}
                  onOpenSettings={() =>
                    setActivePopoverId((prev) =>
                      prev === item.id ? null : item.id
                    )
                  }
                  onRemove={() => handleRemove(item.id)}
                />

                {isOpen && (
                  <RowSettingsPopover
                    title="Data Binding Settings"
                    isOpen={isOpen}
                    onClose={() => setActivePopoverId(null)}
                  >
                    <TextField
                      size="sm"
                      label="Source path"
                      mono
                      placeholder="e.g. user.profile.name"
                      value={item.source}
                      onChange={(e) => handleUpdate(item.id, e.target.value)}
                    />
                  </RowSettingsPopover>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};

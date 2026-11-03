"use client";

import React, { useState } from "react";
import { Plus, Workflow, ExternalLink } from "lucide-react";
import { Select } from "@/editor/components/Select";
import { Button } from "@/editor/components/Button";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { RepeatableRow } from "../controls/RepeatableRow";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import { BLUEPRINT_OPTIONS } from "../constants";
import type { InspectorSectionProps, LogicItem } from "../types";

export interface LogicSectionProps extends InspectorSectionProps {
  onOpenBlueprint?: () => void;
}

export const LogicSection: React.FC<LogicSectionProps> = ({
  onOpenBlueprint,
  className = "",
}) => {
  const [logicItems, setLogicItems] = useState<LogicItem[]>([
    { id: "logic-1", blueprint: "onClick", trigger: "onClick" },
  ]);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const handleAdd = () => {
    const newId = `logic-${Date.now()}`;
    const next: LogicItem[] = [
      ...logicItems,
      { id: newId, blueprint: "None", trigger: "onClick" },
    ];
    setLogicItems(next);
    setActivePopoverId(newId);
  };

  const handleUpdate = (id: string, blueprint: string) => {
    setLogicItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, blueprint } : it))
    );
  };

  const handleRemove = (id: string) => {
    setLogicItems((prev) => prev.filter((it) => it.id !== id));
    if (activePopoverId === id) setActivePopoverId(null);
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Header Add Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pb-1">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Events &amp; Blueprints
        </span>
        <IconButton
          size="sm"
          aria-label="Add logic event"
          tooltip="Add logic event"
          onClick={handleAdd}
          icon={<Icon icon={Plus} size={14} />}
        />
      </div>

      {/* Repeatable Logic List */}
      <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
        {logicItems.length === 0 ? (
          <div className="ll:py-2 ll:px-2.5 ll:text-micro ll:font-mono ll:text-muted ll:bg-surface-bar ll:rounded-sm">
            No events attached.
          </div>
        ) : (
          logicItems.map((item) => {
            const isOpen = activePopoverId === item.id;

            const leadNode = (
              <span className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:text-muted">
                <Icon icon={Workflow} size={13} />
              </span>
            );

            const summaryNode = (
              <div className="ll:flex ll:items-center ll:gap-1.5 ll:w-full">
                <div className="ll:flex-1 ll:min-w-0">
                  <Select
                    size="sm"
                    label=""
                    aria-label="Blueprint trigger"
                    value={item.blueprint}
                    options={BLUEPRINT_OPTIONS}
                    onChange={(val) => handleUpdate(item.id, val)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onOpenBlueprint}
                  rightIcon={<Icon icon={ExternalLink} size={12} />}
                >
                  Open
                </Button>
              </div>
            );

            return (
              <React.Fragment key={item.id}>
                <RepeatableRow
                  id={item.id}
                  isOpen={isOpen}
                  leadContent={leadNode}
                  leadTitle="Logic event settings"
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
                    title="Logic Event Settings"
                    isOpen={isOpen}
                    onClose={() => setActivePopoverId(null)}
                  >
                    <Select
                      size="sm"
                      label="Event"
                      aria-label="Event trigger"
                      value={item.blueprint}
                      options={BLUEPRINT_OPTIONS}
                      onChange={(val) => handleUpdate(item.id, val)}
                    />

                    <Button
                      size="sm"
                      variant="primary"
                      onClick={onOpenBlueprint}
                      rightIcon={<Icon icon={ExternalLink} size={12} />}
                      className="ll:w-full"
                    >
                      Open in Blueprint Editor
                    </Button>
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

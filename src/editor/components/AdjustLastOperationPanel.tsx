"use client";

/**
 * ============================================================================
 * ADJUST LAST OPERATION PANEL (Phase 3D-011)
 * ============================================================================
 * Blender-style parameter tweaking panel positioned at the bottom-left of
 * the 3D viewport. Automatically appears after a 3D command executes,
 * showing typed controls for each schema argument (numbers, booleans, enums).
 * Edits re-run the command with merged arguments while preserving 1 undo step.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { Icon } from "./Icon";
import { NumberField } from "./NumberField";
import { Toggle } from "./Toggle";
import { Select } from "./Select";
import { TextField } from "./TextField";
import {
  getLastOperation,
  subscribe,
  adjustLastOperation,
  describeArgs,
  clearLastOperation,
  type LastOperation,
  type ArgDescriptor,
} from "../../core/3d/commands/lastOperation";

export interface AdjustLastOperationPanelProps {
  className?: string;
}

export const AdjustLastOperationPanel: React.FC<AdjustLastOperationPanelProps> = ({
  className = "",
}) => {
  const [op, setOp] = useState<LastOperation | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [descriptors, setDescriptors] = useState<ArgDescriptor[]>([]);

  // Sync with last operation state
  useEffect(() => {
    const update = () => {
      const current = getLastOperation();
      setOp(current ? { ...current, args: { ...current.args } } : null);
      if (current) {
        setDescriptors(describeArgs(current.id));
        setIsCollapsed(false); // Auto-expand when a new command runs
      } else {
        setDescriptors([]);
      }
    };

    update();
    return subscribe(update);
  }, []);

  const handleArgChange = useCallback(
    (name: string, value: unknown) => {
      if (!op) return;
      const patch = { [name]: value };
      adjustLastOperation(patch);
      // Local state immediately mirrors for responsive UI
      setOp((prev) => (prev ? { ...prev, args: { ...prev.args, ...patch } } : null));
    },
    [op]
  );

  if (!op || descriptors.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="adjust-last-op-panel"
      className={`ll:w-64 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-md ll:overflow-hidden ll:select-none ll:font-sans ${className}`}
    >
      {/* Header */}
      <div
        className="ll:h-8 ll:px-3 ll:bg-surface-bar ll:border-b ll:border-border ll:flex ll:items-center ll:justify-between ll:cursor-pointer"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:min-w-0">
          <Icon
            icon={isCollapsed ? ChevronRight : ChevronDown}
            size={14}
            className="ll:text-secondary ll:shrink-0"
          />
          <span className="ll:text-micro ll:font-semibold ll:text-primary ll:truncate">
            {op.title}
          </span>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="ll:text-muted ll:hover:text-primary ll:p-0.5 ll:rounded-sm ll:border-0 ll:bg-transparent ll:cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            clearLastOperation();
          }}
        >
          <Icon icon={X} size={13} />
        </button>
      </div>

      {/* Body Controls */}
      {!isCollapsed && (
        <div className="ll:p-3 ll:flex ll:flex-col ll:gap-2.5 ll:max-h-72 ll:overflow-y-auto">
          {descriptors.map((arg) => {
            const currentVal = op.args[arg.name] ?? arg.default;

            return (
              <div
                key={arg.name}
                data-arg={arg.name}
                className="ll:flex ll:flex-col ll:gap-1"
              >
                {arg.type === "number" && (
                  <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                    <span className="ll:text-micro ll:text-secondary ll:capitalize">
                      {arg.name}
                    </span>
                    <div className="ll:w-28">
                      <NumberField
                        aria-label={arg.name}
                        value={
                          typeof currentVal === "number"
                            ? currentVal
                            : Number(arg.default ?? 0)
                        }
                        min={arg.min}
                        max={arg.max}
                        step={arg.step ?? (arg.min !== undefined && arg.min >= 0 ? 1 : 0.1)}
                        onChange={(val) => handleArgChange(arg.name, val)}
                        size="sm"
                      />
                    </div>
                  </div>
                )}

                {arg.type === "boolean" && (
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:text-micro ll:text-secondary ll:capitalize">
                      {arg.name}
                    </span>
                    <Toggle
                      aria-label={arg.name}
                      checked={Boolean(currentVal)}
                      onChange={(val) => handleArgChange(arg.name, val)}
                      size="sm"
                    />
                  </div>
                )}

                {arg.type === "enum" && (
                  <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                    <span className="ll:text-micro ll:text-secondary ll:capitalize">
                      {arg.name}
                    </span>
                    <div className="ll:w-32">
                      <Select
                        aria-label={arg.name}
                        value={String(currentVal ?? "")}
                        onChange={(val) => handleArgChange(arg.name, val)}
                        options={(arg.options ?? []).map((opt) => ({
                          value: opt,
                          label: opt,
                        }))}
                        size="sm"
                      />
                    </div>
                  </div>
                )}

                {arg.type === "string" && (
                  <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                    <span className="ll:text-micro ll:text-secondary ll:capitalize">
                      {arg.name}
                    </span>
                    <div className="ll:w-32">
                      <TextField
                        aria-label={arg.name}
                        value={String(currentVal ?? "")}
                        onChange={(e) => handleArgChange(arg.name, e.target.value)}
                        size="sm"
                      />
                    </div>
                  </div>
                )}

                {arg.type === "vector3" && (
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-micro ll:text-secondary ll:capitalize">
                      {arg.name}
                    </span>
                    <div className="ll:grid ll:grid-cols-3 ll:gap-1">
                      {(["X", "Y", "Z"] as const).map((axis, i) => {
                        const vec = (Array.isArray(currentVal)
                          ? currentVal
                          : [0, 0, 0]) as [number, number, number];
                        return (
                          <NumberField
                            key={axis}
                            label={axis}
                            aria-label={`${arg.name} ${axis}`}
                            value={Number(vec[i] ?? 0)}
                            step={0.1}
                            onChange={(val) => {
                              const nextVec: [number, number, number] = [...vec];
                              nextVec[i] = val;
                              handleArgChange(arg.name, nextVec);
                            }}
                            size="sm"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

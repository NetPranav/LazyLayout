"use client";

/**
 * ============================================================================
 * MODIFIERS PROPERTIES TAB (Phase 3D-022, 3D-030)
 * ============================================================================
 * Features:
 *   - Modifier Looks strip for 1-click preset modifiers.
 *   - "Add Modifier" popover menu populated from MODIFIER_REGISTRY.
 *   - Ordered modifier stack per object.
 *   - Reorder (up / down), viewport and render visibility toggles.
 *   - Apply modifier (bakes into mesh geometry).
 *   - Delete modifier.
 *   - Parameter editor driven by the modifier's Zod schema.
 *   - Slot reserved for keyframe diamonds.
 * ============================================================================
 */

import React, { useState } from "react";
import {
  Plus,
  Eye,
  EyeOff,
  Video,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  Diamond,
  Layers,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { IconButton } from "@/editor/components/IconButton";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { useDocument } from "@/core/store/useDocumentStore";
import { tryRunCommand } from "@/core/commands";
import { MODIFIER_REGISTRY } from "@/core/3d/modifiers/registry";
import { LooksStrip } from "./LooksStrip";
import { FieldRenderer } from "./FieldRenderer";
import type { PropertiesFace } from "./propertiesFace";

export interface ModifiersTabProps {
  objectId: string;
  face: PropertiesFace;
  className?: string;
}

export const ModifiersTab: React.FC<ModifiersTabProps> = ({
  objectId,
  face,
  className = "",
}) => {
  const doc = useDocument((d) => d);
  const obj = doc.objects?.[objectId];

  const [addMenuAnchor, setAddMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  if (!obj) {
    return (
      <div className="ll:p-4 ll:text-micro ll:text-muted">
        No 3D object selected.
      </div>
    );
  }

  const modifiers = obj.modifiers ?? [];

  const handleAddModifier = (type: string) => {
    tryRunCommand("3d.modifier.add", { objectId, type });
    setAddMenuAnchor(null);
  };

  const handleRemoveModifier = (modifierId: string) => {
    tryRunCommand("3d.modifier.remove", { objectId, modifierId });
  };

  const handleReorder = (modifierId: string, direction: "up" | "down") => {
    const currentIndex = modifiers.findIndex((m) => m.id === modifierId);
    if (currentIndex < 0) return;
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < modifiers.length) {
      tryRunCommand("3d.modifier.reorder", { objectId, modifierId, newIndex });
    }
  };

  const handleToggleVisibility = (modifierId: string, currentEnabled: boolean) => {
    tryRunCommand("3d.modifier.set_visibility", {
      objectId,
      modifierId,
      enabled: !currentEnabled,
    });
  };

  const handleToggleRender = (modifierId: string, currentRenderEnabled: boolean) => {
    tryRunCommand("3d.modifier.set_visibility", {
      objectId,
      modifierId,
      renderEnabled: !currentRenderEnabled,
    });
  };

  const handleApply = (modifierId: string) => {
    tryRunCommand("3d.modifier.apply", { objectId, modifierId });
  };

  const handleParamChange = (modifierId: string, key: string, value: unknown) => {
    tryRunCommand("3d.modifier.set_param", {
      objectId,
      modifierId,
      key,
      value,
    });
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-modifiers">
      {/* Simple Face: Looks strip for modifiers */}
      {face === "simple" && (
        <LooksStrip section="modifier" targetId={objectId} />
      )}

      {/* Add Modifier Button & Menu */}
      <div className="ll:flex ll:items-center ll:justify-between">
        <div className="ll:flex ll:items-center ll:gap-1.5">
          <Icon icon={Layers} size={14} className="ll:text-secondary" />
          <span className="ll:text-micro ll:font-semibold ll:text-primary">
            Modifier Stack ({modifiers.length})
          </span>
        </div>

        <Button
          data-testid="add-modifier-button"
          size="sm"
          variant="secondary"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setAddMenuAnchor({ x: rect.left, y: rect.bottom + 4 });
          }}
          className="ll:flex ll:items-center ll:gap-1"
        >
          <Icon icon={Plus} size={13} />
          <span>Add Modifier</span>
        </Button>

        {addMenuAnchor && (
          <Menu
            open={Boolean(addMenuAnchor)}
            position={addMenuAnchor}
            onClose={() => setAddMenuAnchor(null)}
            aria-label="Add Modifier Menu"
          >
            {Object.entries(MODIFIER_REGISTRY).map(([typeKey, def]) => (
              <MenuItem
                key={typeKey}
                onClick={() => handleAddModifier(typeKey)}
                data-modifier-type={typeKey}
              >
                {def.label}
              </MenuItem>
            ))}
          </Menu>
        )}
      </div>

      {/* Empty State */}
      {modifiers.length === 0 && (
        <div className="ll:p-4 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:text-center ll:text-micro ll:text-muted">
          No modifiers applied. Click &ldquo;Add Modifier&rdquo; to add a non-destructive operation.
        </div>
      )}

      {/* Modifier Stack List */}
      <div className="ll:flex ll:flex-col ll:gap-3">
        {modifiers.map((mod, index) => {
          const def = MODIFIER_REGISTRY[mod.type];
          const isEnabled = mod.enabled !== false;
          const isRenderEnabled = mod.renderEnabled !== false;

          return (
            <div
              key={mod.id}
              data-modifier-id={mod.id}
              data-modifier-type={mod.type}
              className="ll:border ll:border-border ll:bg-surface-panel ll:rounded-md ll:overflow-hidden"
            >
              {/* Card Header */}
              <div className="ll:h-8 ll:px-2.5 ll:bg-surface-bar ll:border-b ll:border-border ll:flex ll:items-center ll:justify-between ll:gap-2">
                <div className="ll:flex ll:items-center ll:gap-1.5 ll:min-w-0">
                  <span className="ll:text-micro ll:font-semibold ll:text-primary ll:capitalize ll:truncate">
                    {mod.name || def?.label || mod.type}
                  </span>
                </div>

                <div className="ll:flex ll:items-center ll:gap-0.5">
                  {/* Viewport Visibility Toggle */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    data-testid="modifier-visibility-toggle"
                    aria-label={isEnabled ? "Disable in viewport" : "Enable in viewport"}
                    tooltip={isEnabled ? "Disable in viewport" : "Enable in viewport"}
                    pressed={!isEnabled}
                    onClick={() => handleToggleVisibility(mod.id, isEnabled)}
                    icon={<Icon icon={isEnabled ? Eye : EyeOff} size={13} />}
                  />

                  {/* Render Visibility Toggle */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={isRenderEnabled ? "Disable in render" : "Enable in render"}
                    tooltip={isRenderEnabled ? "Disable in render" : "Enable in render"}
                    pressed={!isRenderEnabled}
                    onClick={() => handleToggleRender(mod.id, isRenderEnabled)}
                    icon={<Icon icon={Video} size={13} className={isRenderEnabled ? "" : "ll:opacity-40"} />}
                  />

                  {/* Move Up */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label="Move modifier up"
                    tooltip="Move up"
                    disabled={index === 0}
                    onClick={() => handleReorder(mod.id, "up")}
                    icon={<Icon icon={ArrowUp} size={13} />}
                  />

                  {/* Move Down */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label="Move modifier down"
                    tooltip="Move down"
                    disabled={index === modifiers.length - 1}
                    onClick={() => handleReorder(mod.id, "down")}
                    icon={<Icon icon={ArrowDown} size={13} />}
                  />

                  {/* Apply Modifier */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    data-testid="apply-modifier-button"
                    aria-label="Apply modifier"
                    tooltip="Apply modifier to geometry"
                    onClick={() => handleApply(mod.id)}
                    icon={<Icon icon={Check} size={13} className="ll:text-emerald-500" />}
                  />

                  {/* Delete Modifier */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    data-testid="delete-modifier-button"
                    aria-label="Delete modifier"
                    tooltip="Delete modifier"
                    onClick={() => handleRemoveModifier(mod.id)}
                    icon={<Icon icon={Trash2} size={13} className="ll:text-red-500" />}
                  />

                  {/* Keyframe Slot (future phase) */}
                  <span
                    title="Keyframe parameters (Phase 3D-112)"
                    className="ll:text-muted/40 ll:p-1 ll:cursor-not-allowed"
                  >
                    <Icon icon={Diamond} size={11} />
                  </span>
                </div>
              </div>

              {/* Modifier Parameters Body */}
              <div className="ll:p-3">
                {def?.schema ? (
                  <FieldRenderer
                    schema={def.schema}
                    values={(mod.params ?? {}) as Record<string, unknown>}
                    onChange={(paramKey, paramVal) =>
                      handleParamChange(mod.id, paramKey, paramVal)
                    }
                  />
                ) : (
                  <div className="ll:text-micro ll:text-muted">
                    No editable parameters for this modifier.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

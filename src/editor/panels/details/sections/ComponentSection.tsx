"use client";

import React, { useState } from "react";
import { Sparkles, Component, Copy, Split, RotateCcw, Plus, Trash2 } from "lucide-react";
import { invokeCommand } from "@/core/commands";
import { instanceRootOf } from "@/core/components/instances";
import { useLayers } from "@/core/store/useDocumentStore";
import { useDocument } from "@/core/store/useDocumentStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";

export interface ComponentSectionProps {
  selectedId?: string | null;
  className?: string;
}

export const ComponentSection: React.FC<ComponentSectionProps> = ({
  selectedId: propSelectedId,
  className = "",
}) => {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectedId = propSelectedId ?? selectedIds[0] ?? null;
  const layers = useLayers();
  const doc = useDocument((d) => d);

  const [newPropName, setNewPropName] = useState("");
  const [newPropValues, setNewPropValues] = useState("");

  if (!selectedId || !layers[selectedId]) {
    return (
      <div className={`ll:p-3 ll:text-micro ll:text-muted ll:text-center ${className}`}>
        Select a layer to manage components
      </div>
    );
  }

  const layer = layers[selectedId];
  const isMaster = Boolean(layer.componentMain || (layer.parentId === null && layer.archetype === "container" && doc.designComponents?.[layer.id]));
  const isInstance = Boolean(layer.instance);
  const rootId = isInstance ? instanceRootOf(layers, layer.id) : null;
  const rootLayer = rootId ? layers[rootId] : null;
  const masterId = rootLayer?.instance?.component ?? layer.instance?.component;
  const masterLayer = masterId ? doc.layers[masterId] : null;

  // Variant properties on master
  const variantProps = isMaster
    ? (doc.designComponents?.[layer.id]?.variantProps ?? [])
    : masterId && doc.designComponents?.[masterId]
    ? (doc.designComponents[masterId].variantProps ?? [])
    : [];

  const handleCreateComponent = () => {
    void invokeCommand("component.create", { ids: [layer.id] });
  };

  const handleCreateInstance = () => {
    void invokeCommand("component.createInstance", { component: layer.id });
  };

  const handleDetachInstance = () => {
    if (rootId) {
      void invokeCommand("component.detach", { ids: [rootId] });
    }
  };

  const handleResetOverrides = () => {
    if (rootId) {
      void invokeCommand("component.reset", { ids: [rootId] });
    }
  };

  const handleAddVariantProperty = () => {
    if (!newPropName.trim() || !newPropValues.trim()) return;
    const vals = newPropValues.split(",").map((v) => v.trim()).filter(Boolean);
    void invokeCommand("component.addVariantProperty", {
      component: layer.id,
      name: newPropName.trim(),
      values: vals,
    });
    setNewPropName("");
    setNewPropValues("");
  };

  // State A: Regular uncomponentized layer
  if (!isMaster && !isInstance) {
    return (
      <div className={`ll:flex ll:flex-col ll:gap-2 ll:p-3 ll:rounded-md ll:border ll:border-line-subtle ll:bg-surface-panel/40 ${className}`}>
        <div className="ll:flex ll:items-center ll:justify-between">
          <span className="ll:flex ll:items-center ll:gap-1.5 ll:text-small ll:font-medium ll:text-primary">
            <span className="ll:text-purple-400">❖</span> Component
          </span>
        </div>
        <p className="ll:text-micro ll:text-muted">
          Turn this layer into a reusable Master Component with customizable variants.
        </p>
        <button
          type="button"
          onClick={handleCreateComponent}
          className="ll:flex ll:items-center ll:justify-center ll:gap-2 ll:w-full ll:py-1.5 ll:px-3 ll:rounded ll:bg-purple-600/15 ll:text-purple-300 ll:border ll:border-purple-500/30 ll:text-small ll:font-medium ll:hover:bg-purple-600/25 ll:transition-colors ll:cursor-pointer"
        >
          <span>❖ Create Component</span>
        </button>
      </div>
    );
  }

  // State B: Master Component
  if (isMaster) {
    return (
      <div className={`ll:flex ll:flex-col ll:gap-3 ll:p-3 ll:rounded-md ll:border ll:border-purple-500/40 ll:bg-purple-950/10 ${className}`}>
        {/* Header Badge */}
        <div className="ll:flex ll:items-center ll:justify-between">
          <span className="ll:flex ll:items-center ll:gap-1.5 ll:px-2 ll:py-0.5 ll:rounded-full ll:bg-purple-500/20 ll:text-purple-300 ll:text-micro ll:font-semibold ll:border ll:border-purple-500/30">
            ❖ Master Component
          </span>
          <span className="ll:text-micro ll:font-mono ll:text-muted">#{layer.id.slice(0, 8)}</span>
        </div>

        {/* Component Name */}
        <div className="ll:flex ll:flex-col ll:gap-1">
          <label className="ll:text-micro ll:font-medium ll:text-muted">Component Name</label>
          <input
            type="text"
            value={layer.name || "Component"}
            onChange={(e) => void invokeCommand("layer.rename", { id: layer.id, name: e.target.value })}
            className="ll:w-full ll:h-7 ll:px-2 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-small ll:text-primary ll:outline-none ll:focus:border-purple-400"
          />
        </div>

        {/* Variants Section */}
        <div className="ll:flex ll:flex-col ll:gap-2 ll:pt-2 ll:border-t ll:border-border">
          <div className="ll:flex ll:items-center ll:justify-between">
            <span className="ll:text-micro ll:font-medium ll:uppercase ll:tracking-wider ll:text-muted">
              Variants ({variantProps.length})
            </span>
          </div>

          {variantProps.map((p) => (
            <div key={p.name} className="ll:flex ll:items-center ll:justify-between ll:p-1.5 ll:rounded ll:bg-surface/60 ll:border ll:border-line-subtle">
              <span className="ll:text-micro ll:font-medium ll:text-primary">{p.name}:</span>
              <div className="ll:flex ll:items-center ll:gap-1 ll:flex-wrap">
                {p.values.map((v) => (
                  <span key={v} className="ll:px-1.5 ll:py-0.2 ll:rounded ll:bg-control-active ll:text-micro ll:text-secondary">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Add Variant Form */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:pt-1">
            <input
              type="text"
              placeholder="Prop (Size)"
              value={newPropName}
              onChange={(e) => setNewPropName(e.target.value)}
              className="ll:h-6 ll:px-1.5 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-micro ll:text-primary ll:outline-none"
            />
            <input
              type="text"
              placeholder="Vals (sm, md, lg)"
              value={newPropValues}
              onChange={(e) => setNewPropValues(e.target.value)}
              className="ll:h-6 ll:px-1.5 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={!newPropName.trim() || !newPropValues.trim()}
            onClick={handleAddVariantProperty}
            className="ll:flex ll:items-center ll:justify-center ll:gap-1 ll:w-full ll:py-1 ll:rounded ll:bg-control-hover ll:text-micro ll:font-medium ll:text-secondary ll:hover:text-primary ll:disabled:opacity-40 ll:cursor-pointer"
          >
            <Icon icon={Plus} size={12} />
            <span>Add Variant Property</span>
          </button>
        </div>

        {/* Master Actions */}
        <div className="ll:pt-2 ll:border-t ll:border-border">
          <button
            type="button"
            onClick={handleCreateInstance}
            className="ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:w-full ll:py-1.5 ll:px-3 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-small ll:font-medium ll:text-primary ll:hover:bg-control-hover ll:transition-colors ll:cursor-pointer"
          >
            <span>◇ Create Instance</span>
          </button>
        </div>
      </div>
    );
  }

  // State C: Component Instance
  return (
    <div className={`ll:flex ll:flex-col ll:gap-3 ll:p-3 ll:rounded-md ll:border ll:border-sky-500/30 ll:bg-sky-950/10 ${className}`}>
      {/* Header Badge */}
      <div className="ll:flex ll:items-center ll:justify-between">
        <span className="ll:flex ll:items-center ll:gap-1.5 ll:px-2 ll:py-0.5 ll:rounded-full ll:bg-sky-500/20 ll:text-sky-300 ll:text-micro ll:font-semibold ll:border ll:border-sky-500/30">
          ◇ Component Instance
        </span>
        {masterLayer && (
          <span className="ll:text-micro ll:text-muted ll:truncate ll:max-w-[120px]" title={masterLayer.name}>
            from: {masterLayer.name}
          </span>
        )}
      </div>

      {/* Variant Selector(s) */}
      {variantProps.length > 0 && (
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:uppercase ll:tracking-wider ll:text-muted">
            Variant Properties
          </span>
          {variantProps.map((p) => {
            const currentVal = String(layer.properties[`variant.${p.name}`] ?? p.values[0] ?? "");
            return (
              <Select
                key={p.name}
                size="sm"
                label={p.name}
                value={currentVal}
                options={p.values.map((v) => ({ value: v, label: v }))}
                onChange={(val) => {
                  void invokeCommand("component.setVariant", {
                    instance: layer.id,
                    property: p.name,
                    value: val,
                  });
                }}
              />
            );
          })}
        </div>
      )}

      {/* Instance Actions */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:pt-2 ll:border-t ll:border-border">
        <button
          type="button"
          onClick={handleDetachInstance}
          title="Detach from master to edit as standalone layers"
          className="ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:py-1 ll:px-2 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-micro ll:font-medium ll:text-secondary ll:hover:text-primary ll:hover:bg-control-hover ll:transition-colors ll:cursor-pointer"
        >
          <Icon icon={Split} size={12} />
          <span>Detach</span>
        </button>

        <button
          type="button"
          onClick={handleResetOverrides}
          title="Revert all overrides back to master definition"
          className="ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:py-1 ll:px-2 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-micro ll:font-medium ll:text-secondary ll:hover:text-primary ll:hover:bg-control-hover ll:transition-colors ll:cursor-pointer"
        >
          <Icon icon={RotateCcw} size={12} />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/editor/components/Button";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { documentStore } from "@/core/store/documentState";
import { setDriversNamed } from "@/core/bindings/bindingCommands";
import {
  affordancesForLayer,
  buildReactivityDrafts,
  describeReactivity,
  meterProgress,
  REACTIVITY_SOURCES,
  type ReactivityAffordance,
  type ReactivitySource,
} from "@/core/bindings/reactivityCard";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

const REACTIVITY_DRIVER_NAME = "reactivity:simple";

/**
 * Phase 140 · Simple Reactivity Card: lets creators wire Cursor, Scroll,
 * Hover on…, Touch, Keyboard, or Sound reactions in one click with live
 * meter feedback and plain-language descriptions.
 */
export const ReactivityCard: React.FC<InspectorSectionProps> = ({ selectedId, className = "" }) => {
  const layerId = selectedId ?? "";
  const layer = useStore(documentStore, (s) => (layerId ? s.document.layers[layerId] : undefined));
  const allLayers = useStore(documentStore, (s) => s.document.layers);
  const [source, setSource] = useState<ReactivitySource>("cursor");
  const [affordance, setAffordance] = useState<ReactivityAffordance>("follow");
  const [strength, setStrength] = useState<number>(60);
  const [smoothness, setSmoothness] = useState<number>(50);
  const [hoverTargetId, setHoverTargetId] = useState<string>(layerId);
  const [liveSample, setLiveSample] = useState<number>(0.6);

  const availableAffordances = useMemo(
    () => affordancesForLayer(layer?.archetype, source),
    [layer?.archetype, source]
  );
  const activeAffordance = availableAffordances.some((a) => a.id === affordance)
    ? affordance
    : (availableAffordances[0]?.id ?? "follow");

  const config = useMemo(
    () => ({
      ownerLayerId: layerId,
      layerName: layer?.name,
      source,
      affordance: activeAffordance,
      strength,
      smoothness,
      hoverLayerId: source === "hover" ? hoverTargetId || layerId : undefined,
    }),
    [layerId, layer?.name, source, activeAffordance, strength, smoothness, hoverTargetId]
  );

  const sentence = useMemo(() => describeReactivity(config), [config]);
  const meterRatio = meterProgress(liveSample, 0, 1);
  const layerOptions = useMemo(
    () => Object.values(allLayers).map((l) => ({ value: l.id, label: l.name || l.id })),
    [allLayers]
  );

  if (!selectedId) return null;

  const applyReaction = () => {
    const drafts = buildReactivityDrafts(config);
    setDriversNamed(selectedId, REACTIVITY_DRIVER_NAME, drafts, "Set reactivity");
  };

  return (
    <div data-testid="reactivity-card" className={`ll-dbody ll:flex ll:flex-col ll:gap-2 ll:-mx-1 ${className}`}>
      <div className="ll:text-micro ll:text-secondary">Reacts to</div>
      <div className="ll:grid ll:grid-cols-3 ll:gap-1">
        {REACTIVITY_SOURCES.map((item) => {
          const active = item.id === source;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSource(item.id);
                setLiveSample(item.id === "cursor" ? 0.65 : item.id === "scroll" ? 0.45 : 0.75);
              }}
              title={item.description}
              className={`ll:h-7 ll:px-2 ll:rounded-sm ll:border ll:text-micro ll:truncate ${
                active
                  ? "ll:bg-control-primary ll:text-control-primary-fg ll:border-control-primary"
                  : "ll:bg-surface-bar ll:text-primary ll:border-board-line ll:hover:bg-surface-hover"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {source === "hover" && (
        <OptionRow label="Target">
          <Select
            aria-label="Hover target layer"
            size="sm"
            width="100%"
            options={layerOptions}
            value={hoverTargetId}
            onChange={setHoverTargetId}
          />
        </OptionRow>
      )}

      <OptionRow label="Action">
        <Select
          aria-label="Reactivity affordance"
          size="sm"
          width="100%"
          options={availableAffordances.map((a) => ({ value: a.id, label: a.label }))}
          value={activeAffordance}
          onChange={(v) => setAffordance(v as ReactivityAffordance)}
        />
      </OptionRow>

      <OptionRow label="Strength">
        <div className="ll:relative ll:flex ll:items-center ll:gap-1.5 ll:w-full">
          <div className="ll:relative ll:flex-1 ll:h-7 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-board-line ll:overflow-hidden">
            <div
              className="ll:h-full ll:bg-accent ll:opacity-25 ll:transition-all"
              style={{ width: `${Math.round(meterRatio * 100)}%` }}
            />
            <input
              type="range"
              aria-label="Reaction strength"
              min={0}
              max={100}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className="ll:absolute ll:inset-0 ll:w-full ll:h-full ll:opacity-0 ll:cursor-ew-resize"
            />
          </div>
          <NumberField size="sm" aria-label="Reaction strength numeric" value={strength} min={0} max={100} step={5} onChange={setStrength} />
        </div>
      </OptionRow>

      <OptionRow label="Smooth">
        <div className="ll:relative ll:flex ll:items-center ll:gap-1.5 ll:w-full">
          <div className="ll:relative ll:flex-1 ll:h-7 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-board-line ll:overflow-hidden">
            <div
              className="ll:h-full ll:bg-surface-raised ll:transition-all"
              style={{ width: `${smoothness}%` }}
            />
            <input
              type="range"
              aria-label="Reaction smoothness"
              min={0}
              max={100}
              value={smoothness}
              onChange={(e) => setSmoothness(Number(e.target.value))}
              className="ll:absolute ll:inset-0 ll:w-full ll:h-full ll:opacity-0 ll:cursor-ew-resize"
            />
          </div>
          <NumberField size="sm" aria-label="Reaction smoothness numeric" value={smoothness} min={0} max={100} step={5} onChange={setSmoothness} />
        </div>
      </OptionRow>

      <p className="ll:text-micro ll:text-secondary ll:bg-surface-bar ll:border ll:border-board-line ll:rounded-sm ll:p-2">
        {sentence}
      </p>

      <Button size="sm" variant="primary" onClick={applyReaction}>
        Apply reaction
      </Button>
    </div>
  );
};

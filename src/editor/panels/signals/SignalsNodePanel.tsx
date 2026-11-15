import React, { useMemo } from "react";
import { useStore } from "zustand";
import { documentStore } from "@/core/store/documentState";
import { Button } from "@/editor/components/Button";
import { buildSignalNodeGraph, compileCssScrollTimeline } from "@/core/bindings/exportCompiler";
import type { Binding } from "@/core/document/signals";

export interface SignalsNodePanelProps {
  readonly liveReadings?: Readonly<Record<string, number>>;
  readonly onOpenPlayground?: () => void;
  readonly className?: string;
}

/**
 * Phase 142 · Pro Signals Panel: displays bindings as a structured DAG
 * (Signal -> Operators -> Target) with live Preview meters, CSS timeline
 * eligibility indicators, and "Open in Playground with tape".
 */
export const SignalsNodePanel: React.FC<SignalsNodePanelProps> = ({
  liveReadings = {},
  onOpenPlayground,
  className = "",
}) => {
  const bindingsMap = useStore(documentStore, (s) => s.document.bindings ?? {});
  const bindings = useMemo(() => Object.values(bindingsMap) as Binding[], [bindingsMap]);
  const graph = useMemo(() => buildSignalNodeGraph(bindings, liveReadings), [bindings, liveReadings]);

  return (
    <div data-testid="signals-node-panel" className={`ll:flex ll:flex-col ll:gap-2 ll:p-3 ll:bg-surface-panel ${className}`}>
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
        <span className="ll:text-small ll:text-primary">Signals Graph ({bindings.length})</span>
        <Button size="sm" variant="secondary" onClick={onOpenPlayground}>
          Open in Playground with tape
        </Button>
      </div>

      {bindings.length === 0 ? (
        <div className="ll:p-3 ll:rounded-sm ll:border ll:border-board-line ll:bg-surface-bar ll:text-micro ll:text-secondary">
          No active bindings yet. Add a driver or reaction to inspect its signal graph.
        </div>
      ) : (
        <div className="ll:flex ll:flex-col ll:gap-2">
          {bindings.map((binding) => {
            const chainNodes = graph.nodes.filter((n) => n.bindingId === binding.id);
            const hasCssTimeline = compileCssScrollTimeline(binding) !== null;
            return (
              <div
                key={binding.id}
                data-binding-node={binding.id}
                className="ll:flex ll:flex-col ll:gap-1.5 ll:p-2 ll:rounded-sm ll:border ll:border-board-line ll:bg-surface-bar"
              >
                <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                  <span className="ll:text-micro ll:text-primary ll:font-mono">{binding.name || binding.id}</span>
                  {hasCssTimeline && (
                    <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:border ll:border-board-line ll:bg-surface-raised ll:text-nano ll:text-secondary">
                      CSS timeline
                    </span>
                  )}
                </div>
                <div className="ll:flex ll:items-center ll:gap-1 ll:flex-wrap">
                  {chainNodes.map((node, index) => (
                    <React.Fragment key={node.id}>
                      <span className="ll:px-2 ll:py-1 ll:rounded-xs ll:border ll:border-board-line ll:bg-surface-panel ll:text-micro ll:text-primary">
                        {node.label}
                        {typeof node.value === "number" ? ` (${node.value.toFixed(2)})` : ""}
                      </span>
                      {index < chainNodes.length - 1 && (
                        <span className="ll:text-micro ll:text-muted">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

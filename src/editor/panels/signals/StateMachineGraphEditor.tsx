import React from "react";
import { Button } from "@/editor/components/Button";
import type {
  StateMachineSnapshot,
  StateMachineSpec,
  StateNodeSpec,
} from "@/core/signals/stateMachineRuntime";

export interface StateMachineGraphEditorProps {
  readonly spec: StateMachineSpec;
  readonly snapshot: StateMachineSnapshot;
  readonly onSetBoolean?: (name: string, value: boolean) => void;
  readonly onSetNumber?: (name: string, value: number) => void;
  readonly onFireTrigger?: (name: string) => void;
  readonly onReset?: () => void;
  readonly className?: string;
}

const DEFAULT_NODE_WIDTH = 128;
const DEFAULT_NODE_HEIGHT = 44;

function nodeCenter(node: StateNodeSpec, index: number): { readonly x: number; readonly y: number } {
  const x = node.x ?? (index % 3) * 165 + 78;
  const y = node.y ?? Math.floor(index / 3) * 84 + 38;
  return { x, y };
}

/**
 * Phase 151 · Visual state-graph editor for Rive-style state machines:
 * displays states (`pose` and `blend1d`), conditional transitions, live inputs
 * (boolean, number, trigger), and computed property output.
 */
export const StateMachineGraphEditor: React.FC<StateMachineGraphEditorProps> = ({
  spec,
  snapshot,
  onSetBoolean,
  onSetNumber,
  onFireTrigger,
  onReset,
  className = "",
}) => {
  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  spec.states.forEach((node, idx) => {
    positions.set(node.id, nodeCenter(node, idx));
  });

  return (
    <div
      data-testid="state-machine-graph-editor"
      className={`ll:flex ll:flex-col ll:gap-2 ll:p-3 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-sm ${className}`}
    >
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
        <div className="ll:flex ll:items-center ll:gap-2">
          <span className="ll:text-small ll:text-primary">{spec.name}</span>
          <span className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:border ll:border-board-line ll:text-nano ll:font-mono ll:text-secondary">
            state: {snapshot.currentStateId}
          </span>
        </div>
        {onReset && (
          <Button size="sm" variant="secondary" onClick={onReset}>
            Reset
          </Button>
        )}
      </div>

      {/* Interactive state graph canvas (SVG edges + rectangular token cards) */}
      <div className="ll:relative ll:bg-surface-bar ll:border ll:border-board-line ll:rounded-sm ll:p-2">
        <svg
          width="100%"
          height={180}
          viewBox="0 0 500 180"
          role="img"
          aria-label={`State machine graph for ${spec.name}`}
          className="ll:block"
        >
          {spec.transitions.map((tr) => {
            const fromPos = tr.from === "*" ? { x: 24, y: 24 } : positions.get(tr.from);
            const toPos = positions.get(tr.to);
            if (!fromPos || !toPos) return null;
            const isActive = snapshot.activeTransition?.transitionId === tr.id;
            return (
              <g key={tr.id}>
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke={isActive ? "var(--color-accent)" : "var(--color-board-line)"}
                  strokeWidth={isActive ? 2 : 1.25}
                />
              </g>
            );
          })}

          {spec.states.map((node) => {
            const center = positions.get(node.id) ?? { x: 80, y: 40 };
            const isCurrent = snapshot.currentStateId === node.id;
            const isTarget = snapshot.activeTransition?.toStateId === node.id;
            return (
              <g key={node.id} transform={`translate(${center.x - DEFAULT_NODE_WIDTH / 2}, ${center.y - DEFAULT_NODE_HEIGHT / 2})`}>
                <rect
                  width={DEFAULT_NODE_WIDTH}
                  height={DEFAULT_NODE_HEIGHT}
                  rx={4}
                  fill="var(--color-surface-raised)"
                  stroke={
                    isCurrent
                      ? "var(--color-control-active)"
                      : isTarget
                        ? "var(--color-accent)"
                        : "var(--color-board-line)"
                  }
                  strokeWidth={isCurrent || isTarget ? 2 : 1}
                />
                <text
                  x={10}
                  y={18}
                  fill="var(--color-primary)"
                  fontSize="11"
                  fontFamily="var(--font-sans)"
                >
                  {node.label}
                </text>
                <text
                  x={10}
                  y={33}
                  fill="var(--color-secondary)"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                >
                  {node.kind === "blend1d" ? `1D: ${node.inputName}` : "pose"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Live typed inputs */}
      <div className="ll:flex ll:flex-col ll:gap-1.5">
        <span className="ll:text-micro ll:text-secondary">Inputs</span>
        <div className="ll:grid ll:grid-cols-1 ll:gap-1.5">
          {spec.inputs.map((input) => {
            const val = snapshot.inputs[input.name];
            if (input.kind === "boolean") {
              const checked = Boolean(val);
              return (
                <label
                  key={input.name}
                  className="ll:flex ll:items-center ll:justify-between ll:px-2 ll:py-1 ll:rounded-xs ll:bg-surface-bar ll:border ll:border-board-line ll:text-micro ll:text-primary"
                >
                  <span className="ll:font-mono">{input.name}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onSetBoolean?.(input.name, e.target.checked)}
                  />
                </label>
              );
            }
            if (input.kind === "number") {
              const numVal = typeof val === "number" ? val : input.initial;
              const min = input.min ?? 0;
              const max = input.max ?? 1;
              return (
                <label
                  key={input.name}
                  className="ll:flex ll:flex-col ll:gap-1 ll:px-2 ll:py-1 ll:rounded-xs ll:bg-surface-bar ll:border ll:border-board-line ll:text-micro ll:text-primary"
                >
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:font-mono">{input.name}</span>
                    <span className="ll:font-mono ll:text-secondary">{numVal.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={(max - min) / 100 || 0.01}
                    value={numVal}
                    onChange={(e) => onSetNumber?.(input.name, Number(e.target.value))}
                  />
                </label>
              );
            }
            return (
              <div
                key={input.name}
                className="ll:flex ll:items-center ll:justify-between ll:px-2 ll:py-1 ll:rounded-xs ll:bg-surface-bar ll:border ll:border-board-line"
              >
                <span className="ll:text-micro ll:font-mono ll:text-primary">{input.name}</span>
                <Button size="sm" variant="secondary" onClick={() => onFireTrigger?.(input.name)}>
                  Fire trigger
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live evaluated output properties */}
      <div className="ll:flex ll:flex-wrap ll:gap-1.5">
        {Object.entries(snapshot.properties).map(([prop, propVal]) => (
          <div
            key={prop}
            className="ll:px-2 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:border ll:border-board-line ll:text-nano ll:font-mono ll:text-secondary"
          >
            {prop}: {propVal.toFixed(3)}
          </div>
        ))}
      </div>
    </div>
  );
};

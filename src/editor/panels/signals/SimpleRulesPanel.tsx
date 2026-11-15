import React from "react";
import { Button } from "@/editor/components/Button";
import {
  MAX_SIMPLE_RULE_CONTROLS,
  SIMPLE_RULE_CONTROL_LABELS,
  describeSimpleRuleInPlainLanguage,
  type SimpleFeelPreset,
  type SimpleIntensityLevel,
  type SimpleRuleActionKind,
  type SimpleRuleEntry,
  type SimpleRuleEventKind,
  type SimpleRulesState,
} from "@/core/nodescript/simpleRulesEditor";

export interface SimpleRulesPanelProps {
  readonly state: SimpleRulesState;
  readonly availableLayerIds: readonly string[];
  readonly onUpdateRule: (rule: SimpleRuleEntry) => void;
  readonly onRemoveRule: (ruleId: string) => void;
  readonly onOpenAsGraph?: (ruleId: string) => void;
  readonly className?: string;
}

const EVENT_OPTIONS: readonly SimpleRuleEventKind[] = [
  "hovered",
  "clicked",
  "pressed",
  "dragged",
  "overlaps",
  "hits",
  "enters_field",
];

const ACTION_OPTIONS: readonly SimpleRuleActionKind[] = [
  "glow",
  "flip",
  "confetti",
  "spring_home",
  "play_sound",
  "go_to_state",
  "move_to",
];

const FEEL_OPTIONS: readonly SimpleFeelPreset[] = ["snappy", "bouncy", "gentle", "crisp", "dramatic"];
const INTENSITY_OPTIONS: readonly SimpleIntensityLevel[] = ["subtle", "medium", "strong"];

/**
 * Phase 167 · Plain-language Interactions list in Motion tab:
 * "When [event] on [layer] → Do [actions]" capped at 7 controls per rule,
 * listing editable companion colliders/fields/springs underneath.
 */
export const SimpleRulesPanel: React.FC<SimpleRulesPanelProps> = ({
  state,
  availableLayerIds,
  onUpdateRule,
  onRemoveRule,
  onOpenAsGraph,
  className = "",
}) => {
  const controlCount = SIMPLE_RULE_CONTROL_LABELS.length;
  if (controlCount > MAX_SIMPLE_RULE_CONTROLS) {
    throw new Error(`SimpleRulesPanel exceeds control limit (${controlCount}/${MAX_SIMPLE_RULE_CONTROLS})`);
  }

  return (
    <div
      data-testid="simple-rules-panel"
      className={`ll:flex ll:flex-col ll:gap-2 ll:p-3 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-sm ${className}`}
    >
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
        <span className="ll:text-small ll:text-primary">Interactions</span>
        <span className="ll:text-nano ll:font-mono ll:text-secondary">
          {state.rules.length} {state.rules.length === 1 ? "rule" : "rules"}
        </span>
      </div>

      {state.rules.map((rule) => {
        const primaryAction = rule.actions[0] ?? { kind: "glow" as const };
        const ruleCompanions = state.companions.filter((c) => c.ruleId === rule.id);

        return (
          <div
            key={rule.id}
            data-testid={`simple-rule-${rule.id}`}
            className="ll:flex ll:flex-col ll:gap-1.5 ll:p-2 ll:bg-surface-bar ll:border ll:border-board-line ll:rounded-sm"
          >
            <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
              <span className="ll:text-nano ll:text-primary">
                {describeSimpleRuleInPlainLanguage(rule)}
              </span>
              <div className="ll:flex ll:items-center ll:gap-1">
                {onOpenAsGraph && (
                  <Button size="sm" variant="secondary" onClick={() => onOpenAsGraph(rule.id)}>
                    Open as graph
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => onRemoveRule(rule.id)}>
                  Remove
                </Button>
              </div>
            </div>

            <div className="ll:grid ll:grid-cols-4 ll:gap-1.5">
              <select
                aria-label="When"
                value={rule.event}
                onChange={(e) =>
                  onUpdateRule({ ...rule, event: e.target.value as SimpleRuleEventKind })
                }
                className="ll:px-1.5 ll:py-1 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-xs ll:text-nano ll:text-primary"
              >
                {EVENT_OPTIONS.map((evt) => (
                  <option key={evt} value={evt}>
                    {evt}
                  </option>
                ))}
              </select>

              <select
                aria-label="On layer"
                value={rule.subjectLayerId}
                onChange={(e) => onUpdateRule({ ...rule, subjectLayerId: e.target.value })}
                className="ll:px-1.5 ll:py-1 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-xs ll:text-nano ll:text-primary"
              >
                {availableLayerIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>

              <select
                aria-label="Do"
                value={primaryAction.kind}
                onChange={(e) =>
                  onUpdateRule({
                    ...rule,
                    actions: [{ ...primaryAction, kind: e.target.value as SimpleRuleActionKind }],
                  })
                }
                className="ll:px-1.5 ll:py-1 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-xs ll:text-nano ll:text-primary"
              >
                {ACTION_OPTIONS.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>

              <select
                aria-label="Target"
                value={primaryAction.targetLayerId ?? rule.subjectLayerId}
                onChange={(e) =>
                  onUpdateRule({
                    ...rule,
                    actions: [{ ...primaryAction, targetLayerId: e.target.value }],
                  })
                }
                className="ll:px-1.5 ll:py-1 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-xs ll:text-nano ll:text-primary"
              >
                {availableLayerIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>

            <div className="ll:grid ll:grid-cols-3 ll:gap-1.5">
              <select
                aria-label="Feel"
                value={rule.feel}
                onChange={(e) =>
                  onUpdateRule({ ...rule, feel: e.target.value as SimpleFeelPreset })
                }
                className="ll:px-1.5 ll:py-1 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-xs ll:text-nano ll:text-primary"
              >
                {FEEL_OPTIONS.map((feel) => (
                  <option key={feel} value={feel}>
                    {feel}
                  </option>
                ))}
              </select>

              <select
                aria-label="Strength"
                value={rule.intensity}
                onChange={(e) =>
                  onUpdateRule({ ...rule, intensity: e.target.value as SimpleIntensityLevel })
                }
                className="ll:px-1.5 ll:py-1 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-xs ll:text-nano ll:text-primary"
              >
                {INTENSITY_OPTIONS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>

              <label className="ll:flex ll:items-center ll:gap-1 ll:px-1.5 ll:py-1 ll:text-nano ll:text-secondary">
                <input
                  type="checkbox"
                  aria-label="Active"
                  checked={rule.enabled}
                  onChange={(e) => onUpdateRule({ ...rule, enabled: e.target.checked })}
                />
                Active
              </label>
            </div>

            {ruleCompanions.length > 0 && (
              <div className="ll:flex ll:flex-wrap ll:gap-1 ll:pt-1 ll:border-t ll:border-board-line">
                {ruleCompanions.map((cmp) => (
                  <span
                    key={cmp.id}
                    className="ll:px-1.5 ll:py-0.5 ll:bg-surface-panel ll:border ll:border-board-line ll:rounded-xs ll:text-nano ll:font-mono ll:text-secondary"
                  >
                    + {cmp.kind} ({cmp.layerId})
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

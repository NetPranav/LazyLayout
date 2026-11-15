/**
 * @file simpleRulesEditor.ts
 * @module core/nodescript/simpleRulesEditor
 * @description Phase 167: Simple rules model ("When [event] on [layer] → Do [actions]"
 * with <= 7 controls, plain-English phrasing, Law 17 feel presets, automatic
 * companion provisioning/cleanup for colliders/fields/home springs, and
 * canonical BlueprintGraph compilation).
 */

import { ASTManager, type BlueprintGraph, type BlueprintNodeInstance, type BlueprintWire } from "../ast/ASTManager";
import { toInteractionCanonicalName } from "./interactionBridge";

export const MAX_SIMPLE_RULE_CONTROLS = 7;

export type SimpleRuleEventKind =
  | "hovered"
  | "clicked"
  | "pressed"
  | "dragged"
  | "overlaps"
  | "hits"
  | "enters_field"
  | "viewed"
  | "key_pressed";

export type SimpleRuleActionKind =
  | "glow"
  | "flip"
  | "confetti"
  | "spring_home"
  | "play_sound"
  | "go_to_state"
  | "move_to";

export type SimpleFeelPreset = "snappy" | "bouncy" | "gentle" | "crisp" | "dramatic";
export type SimpleIntensityLevel = "subtle" | "medium" | "strong";

export interface SimpleRuleActionStep {
  readonly kind: SimpleRuleActionKind;
  readonly targetLayerId?: string;
  readonly valueParam?: string | number;
}

export type CompanionKind = "collider" | "field" | "home_spring" | "draggable_body";

export interface ProvisionedRuleCompanion {
  readonly id: string;
  readonly ruleId: string;
  readonly kind: CompanionKind;
  readonly layerId: string;
  readonly editableParams: Record<string, string | number | boolean>;
}

/**
 * Simple rule editor item: capped at 7 interactive UI controls
 * (event, subject layer, action, target layer, feel, intensity, enabled).
 */
export interface SimpleRuleEntry {
  readonly id: string;
  readonly event: SimpleRuleEventKind;
  readonly subjectLayerId: string;
  readonly partnerLayerId?: string;
  readonly actions: readonly SimpleRuleActionStep[];
  readonly feel: SimpleFeelPreset;
  readonly intensity: SimpleIntensityLevel;
  readonly enabled: boolean;
}

export interface SimpleRulesState {
  readonly rules: readonly SimpleRuleEntry[];
  readonly companions: readonly ProvisionedRuleCompanion[];
}

export const SIMPLE_RULE_CONTROL_LABELS = [
  "When",
  "On layer",
  "Do",
  "Target",
  "Feel",
  "Strength",
  "Active",
] as const;

const EVENT_PHRASES: Readonly<Record<SimpleRuleEventKind, string>> = {
  hovered: "is hovered",
  clicked: "is clicked",
  pressed: "is pressed",
  dragged: "is dragged",
  overlaps: "overlaps",
  hits: "hits",
  enters_field: "enters field",
  viewed: "enters view",
  key_pressed: "receives key",
};

const ACTION_PHRASES: Readonly<Record<SimpleRuleActionKind, string>> = {
  glow: "glows",
  flip: "flips",
  confetti: "sprays confetti",
  spring_home: "springs home",
  play_sound: "plays sound",
  go_to_state: "switches state",
  move_to: "moves",
};

const FEEL_SPRING_PRESETS: Readonly<Record<SimpleFeelPreset, { readonly bounce: number; readonly timeSec: number }>> = {
  snappy: { bounce: 0.12, timeSec: 0.28 },
  bouncy: { bounce: 0.45, timeSec: 0.52 },
  gentle: { bounce: 0.08, timeSec: 0.72 },
  crisp: { bounce: 0.05, timeSec: 0.2 },
  dramatic: { bounce: 0.62, timeSec: 0.85 },
};

/** Generate plain-language summary: `"When [layer] [event] → [target] [actions]"`. */
export function describeSimpleRuleInPlainLanguage(rule: SimpleRuleEntry): string {
  const eventPhrase = EVENT_PHRASES[rule.event];
  const partnerPart = rule.partnerLayerId ? ` ${rule.partnerLayerId}` : "";
  const actionSummary = rule.actions
    .map((a) => `${a.targetLayerId ?? rule.subjectLayerId} ${ACTION_PHRASES[a.kind]}`)
    .join(" and ");
  return `When ${rule.subjectLayerId} ${eventPhrase}${partnerPart} → ${actionSummary || "no action"}`;
}

/** Determine physics/field/spring companions required automatically by a Simple rule. */
export function inferRequiredCompanionsForRule(rule: SimpleRuleEntry): readonly ProvisionedRuleCompanion[] {
  const result: ProvisionedRuleCompanion[] = [];
  if (rule.event === "overlaps" || rule.event === "hits") {
    result.push({
      id: `${rule.id}__cmp_collider_subject`,
      ruleId: rule.id,
      kind: "collider",
      layerId: rule.subjectLayerId,
      editableParams: {
        role: rule.event === "overlaps" ? "trigger" : "solid",
        bounce: rule.feel === "bouncy" ? 75 : 30,
      },
    });
    if (rule.partnerLayerId) {
      result.push({
        id: `${rule.id}__cmp_collider_partner`,
        ruleId: rule.id,
        kind: "collider",
        layerId: rule.partnerLayerId,
        editableParams: {
          role: rule.event === "overlaps" ? "trigger" : "solid",
          bounce: 30,
        },
      });
    }
  } else if (rule.event === "enters_field") {
    result.push({
      id: `${rule.id}__cmp_field`,
      ruleId: rule.id,
      kind: "field",
      layerId: rule.partnerLayerId ?? rule.subjectLayerId,
      editableParams: { mode: "attract", radius: 140 },
    });
    result.push({
      id: `${rule.id}__cmp_collider_subject`,
      ruleId: rule.id,
      kind: "collider",
      layerId: rule.subjectLayerId,
      editableParams: { role: "trigger" },
    });
  } else if (rule.event === "dragged") {
    result.push({
      id: `${rule.id}__cmp_drag_body`,
      ruleId: rule.id,
      kind: "draggable_body",
      layerId: rule.subjectLayerId,
      editableParams: { throwable: true, grip: 25 },
    });
  }

  if (rule.actions.some((a) => a.kind === "spring_home")) {
    result.push({
      id: `${rule.id}__cmp_home_spring`,
      ruleId: rule.id,
      kind: "home_spring",
      layerId: rule.subjectLayerId,
      editableParams: { returnStrength: 65 },
    });
  }

  return result;
}

export function addOrUpdateSimpleRule(state: SimpleRulesState, rule: SimpleRuleEntry): SimpleRulesState {
  const withoutRule = state.rules.filter((r) => r.id !== rule.id);
  const withoutCompanions = state.companions.filter((c) => c.ruleId !== rule.id);
  const newCompanions = inferRequiredCompanionsForRule(rule);
  return {
    rules: [...withoutRule, rule],
    companions: [...withoutCompanions, ...newCompanions],
  };
}

export function updateRuleCompanionParam(
  state: SimpleRulesState,
  companionId: string,
  paramKey: string,
  value: string | number | boolean
): SimpleRulesState {
  return {
    ...state,
    companions: state.companions.map((c) =>
      c.id === companionId
        ? { ...c, editableParams: { ...c.editableParams, [paramKey]: value } }
        : c
    ),
  };
}

export function removeSimpleRule(state: SimpleRulesState, ruleId: string): SimpleRulesState {
  return {
    rules: state.rules.filter((r) => r.id !== ruleId),
    companions: state.companions.filter((c) => c.ruleId !== ruleId),
  };
}

function sanitizeIdent(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/g, "_");
}

function mapEventToNodeType(evt: SimpleRuleEventKind): string {
  switch (evt) {
    case "hovered":
      return "interaction/onHover";
    case "clicked":
    case "pressed":
      return "interaction/onPointer";
    case "dragged":
      return "interaction/onDrag";
    case "viewed":
      return "interaction/onView";
    case "key_pressed":
      return "interaction/onKey";
    case "overlaps":
    case "hits":
    case "enters_field":
      return "interaction/onCollider";
  }
}

function mapActionToNode(
  action: SimpleRuleActionStep,
  feel: SimpleFeelPreset,
  intensity: SimpleIntensityLevel,
  subjectLayerId: string,
  idx: number
): BlueprintNodeInstance {
  const target = action.targetLayerId ?? subjectLayerId;
  const springSpec = FEEL_SPRING_PRESETS[feel];
  const mult = intensity === "subtle" ? 0.5 : intensity === "strong" ? 1.5 : 1.0;

  let type = "interaction/springProperty";
  let property = "opacity";
  let value: number | string = 1;

  if (action.kind === "glow") {
    property = "effects.glow";
    value = Number((0.6 * mult).toFixed(2));
  } else if (action.kind === "flip") {
    property = "transform.rotateY";
    value = Math.round(180 * mult);
  } else if (action.kind === "confetti") {
    type = "interaction/spawnParticles";
    property = "confetti";
    value = Math.round(24 * mult);
  } else if (action.kind === "play_sound") {
    type = "interaction/playAudio";
    property = "sfx";
    value = String(action.valueParam ?? "click");
  } else if (action.kind === "go_to_state") {
    type = "interaction/setState";
    property = "state";
    value = String(action.valueParam ?? "active");
  } else if (action.kind === "spring_home") {
    property = "transform.x";
    value = 0;
  } else {
    property = "transform.x";
    value = Number(action.valueParam ?? Math.round(24 * mult));
  }

  return {
    id: `act_${idx}`,
    type,
    title: toInteractionCanonicalName(type),
    position: { x: 320 + idx * 240, y: 80 },
    customParams: {
      target,
      property,
      value,
      bounce: springSpec.bounce,
      timeSec: springSpec.timeSec,
    },
  };
}

/** Compile a Simple rule into a canonical `BlueprintGraph` for preview & export. */
export function compileSimpleRuleToBlueprint(rule: SimpleRuleEntry): BlueprintGraph {
  const safeId = sanitizeIdent(rule.id);
  const graph = ASTManager.createGraph(`simple_${safeId}`, `Rule_${safeId}`, "event");
  const evtType = mapEventToNodeType(rule.event);
  const evtNode: BlueprintNodeInstance = {
    id: "evt",
    type: evtType,
    title: toInteractionCanonicalName(evtType),
    position: { x: 40, y: 80 },
    customParams: {
      target: rule.subjectLayerId,
      eventKind: rule.event,
      ...(rule.partnerLayerId ? { partner: rule.partnerLayerId } : {}),
    },
  };

  const actionNodes = rule.actions.map((a, idx) =>
    mapActionToNode(a, rule.feel, rule.intensity, rule.subjectLayerId, idx)
  );
  const wires: BlueprintWire[] = [];
  for (let i = 0; i < actionNodes.length; i++) {
    const prevId = i === 0 ? evtNode.id : actionNodes[i - 1]!.id;
    wires.push({
      id: `w_${i}`,
      sourceNodeId: prevId,
      sourcePinId: "exec",
      targetNodeId: actionNodes[i]!.id,
      targetPinId: "exec",
    });
  }

  return {
    ...graph,
    nodes: [evtNode, ...actionNodes],
    wires,
  };
}

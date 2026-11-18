"use client";
import React, { useMemo, useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/editor/components/Button";
import { Toggle } from "@/editor/components/Toggle";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { motionSafety, safetySummary, type SafetyFinding, type SafetyRule } from "@/core/rules/motionSafety";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Motion safety (ROADMAP Phase 93): what is wrong with this layer's motion for people who can be hurt or shut out by it,
 * with a button to fix each. Flashing, a loop nobody can pause, a tap target under 44 px, nothing showing on focus. The
 * checks are `motionSafety` (`core/rules`); the fixes are commands (`motionSafety.*`, `layer.setMotionSafety`).
 */
const RULE_LABEL: Record<SafetyRule, string> = { flash: "Flashing", "long-loop": "Can't pause", "touch-target": "Small tap target", focus: "No focus" };

export const MotionSafetySection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document);
  const [all, setAll] = useState(false);
  const [message, setMessage] = useState("");
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  const mine = useMemo(() => (layer ? motionSafety(doc, layer.id) : []), [doc, layer]);
  const page = useMemo(() => motionSafety(doc), [doc]);
  if (!layer) return null;
  const run = (fix: { command: string; args: Record<string, unknown> }) => {
    const out = tryRunCommand(fix.command, fix.args);
    setMessage(out.ok ? "" : (out.message ?? "That did not work."));
  };
  const set = (args: Record<string, unknown>) => run({ command: "layer.setMotionSafety", args: { ids: [layer.id], ...args } });
  const row = (f: SafetyFinding, i: number) => (
    <li key={`${f.layerId}-${f.rule}-${f.clipId ?? i}`} data-rule={f.rule} className="ll:flex ll:flex-col ll:gap-1 ll:p-1.5 ll:rounded-sm ll:border ll:border-border">
      <span className="ll:text-micro ll:text-primary"><strong>{RULE_LABEL[f.rule]}</strong>{f.severity === "error" ? " (must fix)" : ""}</span>
      <span className="ll:text-micro ll:text-secondary">{f.message}</span>
      {f.fix && <Button size="sm" aria-label={`${f.fix.label}: ${RULE_LABEL[f.rule]}`} onClick={() => run(f.fix!)}>{f.fix.label}</Button>}
    </li>
  );
  const summary = safetySummary(page);
  const others = page.filter((f) => f.layerId !== layer.id);

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="motion-safety">
      <p className="ll:m-0 ll:text-micro ll:text-primary" role="status" aria-label="Motion safety">
        {mine.length === 0 ? "No problems with this layer's motion." : `${mine.length} ${mine.length === 1 ? "problem" : "problems"} with this layer's motion.`}
      </p>
      {mine.length > 0 && <ul className="ll:m-0 ll:p-0 ll:list-none ll:flex ll:flex-col ll:gap-1" aria-label="Motion safety problems">{mine.map(row)}</ul>}
      <OptionRow label="Essential">
        <Toggle size="sm" aria-label="This motion is essential" checked={layer.properties["motion.essential"] === true} onChange={(essential) => set({ essential })} />
      </OptionRow>
      <OptionRow label="Can pause">
        <Toggle size="sm" aria-label="Visitors can pause this motion" checked={layer.properties["motion.pausable"] === true} onChange={(pausable) => set({ pausable })} />
      </OptionRow>
      <p className="ll:m-0 ll:text-micro ll:text-muted">Essential: the page can&apos;t be understood without it. Pausable: a visitor has a way to stop it (the exported page does not add that control yet).</p>
      <p className="ll:m-0 ll:text-micro ll:text-muted" role="status" aria-label="Whole page motion safety">
        Whole page: {page.length === 0 ? "no problems" : `${summary.flash} flashing, ${summary["long-loop"]} can't pause, ${summary["touch-target"]} small tap targets, ${summary.focus} without focus`}.
      </p>
      {others.length > 0 && (
        <>
          <Button size="sm" aria-label={all ? "Hide the rest of the page's problems" : "Show the rest of the page's problems"} onClick={() => setAll(!all)}>{all ? "Hide" : `Show ${others.length} on other layers`}</Button>
          {all && (
            <ul className="ll:m-0 ll:p-0 ll:list-none ll:flex ll:flex-col ll:gap-1 ll:max-h-48 ll:overflow-y-auto" aria-label="Problems on other layers">
              {others.map((f, i) => (
                <li key={`${f.layerId}-${f.rule}-${i}`} className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:text-micro">
                  <span className="ll:truncate">{doc.layers[f.layerId]?.name}: {RULE_LABEL[f.rule]}</span>
                  <Button size="sm" aria-label={`Select ${doc.layers[f.layerId]?.name}`} onClick={() => useSelectionStore.getState().select(f.layerId, "element")}>Select</Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {message && <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">{message}</p>}
    </div>
  );
};

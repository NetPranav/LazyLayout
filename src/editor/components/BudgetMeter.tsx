"use client";

import React from "react";
import { fill, fitScene, TIER_BUDGETS, type FeatureCost, type Tier } from "@/core/gpu/tiers";

/**
 * ROADMAP_3D 3D-005: whether a 3D scene fits phones, mid laptops and high-end machines. One row per tier, each with a
 * bar for the fullest budget line, and, when a tier is over, the feature to drop first and what that gives up.
 */
const LABELS: Record<string, string> = { frameMs: "GPU time", gpuMB: "GPU memory", drawCalls: "Draw calls", kTriangles: "Triangles", simMs: "Simulation" };
const TIER_NAMES: Record<Tier, string> = { low: "Phone", mid: "Laptop", high: "High end" };

export interface BudgetMeterProps {
  features: readonly FeatureCost[];
  className?: string;
}

export const BudgetMeter: React.FC<BudgetMeterProps> = ({ features, className = "" }) => (
  <div role="group" aria-label="Scene budget by device" data-testid="budget-meter" className={`ll:flex ll:flex-col ll:gap-2 ll:font-sans ll:text-small ${className}`}>
    {(["low", "mid", "high"] as const).map((tier) => {
      const r = fitScene(features, tier);
      const lines = fill(r.used, TIER_BUDGETS[tier]);
      const worst = Object.entries(lines).sort((a, b) => b[1] - a[1])[0];
      const pct = Math.min(1.2, worst[1]);
      const state = r.fits ? "fits" : r.hopeless ? "too heavy" : "drop to fit";
      return (
        <div key={tier} data-tier={tier} data-fits={r.fits ? "true" : "false"} className="ll:flex ll:flex-col ll:gap-1">
          <div className="ll:flex ll:items-center ll:justify-between">
            <span className="ll:text-primary">{TIER_NAMES[tier]}</span>
            <span className={r.fits ? "ll:text-secondary" : "ll:text-primary"}>{state}</span>
          </div>
          <div role="progressbar" aria-label={`${TIER_NAMES[tier]}: ${LABELS[worst[0]]} ${Math.round(worst[1] * 100)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(worst[1] * 100)} className="ll:h-1.5 ll:rounded-sm ll:bg-surface-segmented ll:overflow-hidden">
            <div className={`ll:h-full ${r.fits ? "ll:bg-control-active" : "ll:bg-label-4"}`} style={{ width: `${Math.round(pct * 83)}%` }} />
          </div>
          <div className="ll:text-micro ll:text-muted">
            {LABELS[worst[0]]} {Math.round(worst[1] * 100)}% of the budget
            {r.drop.length > 0 && (
              <>
                {" · drop "}
                <span className="ll:text-secondary">{r.drop[0].label}</span>
                {r.drop[0].downgrade ? ` (${r.drop[0].downgrade})` : ""}
              </>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

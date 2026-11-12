"use client";

/**
 * ============================================================================
 * RENDER PROPERTIES TAB (Phase 3D-022, 3D-005 Quality Tiers)
 * ============================================================================
 * Exposes device GPU tier detection, budget allocations, and performance limits
 * from `src/core/gpu/tiers.ts`.
 * ============================================================================
 */

import React, { useMemo, useState } from "react";
import { Cpu, Gauge, Zap } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import {
  guessTier,
  TIER_BUDGETS,
  type Tier,
  type DeviceHints,
} from "@/core/gpu/tiers";
import type { PropertiesFace } from "./propertiesFace";

export interface RenderTabProps {
  face?: PropertiesFace;
  className?: string;
}

export const RenderTab: React.FC<RenderTabProps> = ({
  face,
  className = "",
}) => {
  const hints: DeviceHints = useMemo(() => {
    if (typeof window === "undefined") return {};
    const nav = window.navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number };
    return {
      deviceMemory: nav.deviceMemory ?? 4,
      hardwareConcurrency: nav.hardwareConcurrency ?? 8,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    };
  }, []);

  const [selectedTier, setSelectedTier] = useState<Tier>(() => guessTier(hints));
  const budget = TIER_BUDGETS[selectedTier];

  return (
    <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-render">
      {/* Tier Switcher */}
      <div className="ll:flex ll:flex-col ll:gap-2">
        <div className="ll:flex ll:items-center ll:justify-between">
          <div className="ll:flex ll:items-center ll:gap-1.5">
            <Icon icon={Gauge} size={14} className="ll:text-accent" />
            <span className="ll:text-micro ll:font-semibold ll:text-primary">
              GPU Quality Tier
            </span>
          </div>
          <span className="ll:text-micro ll:font-mono ll:text-muted ll:capitalize">
            Auto: {guessTier(hints)}
          </span>
        </div>

        <SegmentedControl
          ariaLabel="Quality Tier"
          value={selectedTier}
          onChange={(t) => setSelectedTier(t as Tier)}
          options={[
            { value: "low", label: "Low", title: "Mobile & low-end devices" },
            { value: "mid", label: "Mid", title: "Laptops & standard desktops" },
            { value: "high", label: "High", title: "Discrete GPU / Workstations" },
          ]}
          size="compact"
        />
      </div>

      {/* Tier Budget Metrics */}
      <div className="ll:flex ll:flex-col ll:gap-2.5 ll:p-3 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
        <span className="ll:text-micro ll:font-semibold ll:text-primary">
          Budget Allocations (60 fps)
        </span>

        <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:text-micro">
          <div className="ll:flex ll:flex-col ll:p-2 ll:bg-surface-panel ll:rounded ll:border ll:border-border/60">
            <span className="ll:text-muted">Max Triangles</span>
            <span className="ll:text-small ll:font-semibold ll:font-mono ll:text-primary">
              {budget.kTriangles}k
            </span>
          </div>

          <div className="ll:flex ll:flex-col ll:p-2 ll:bg-surface-panel ll:rounded ll:border ll:border-border/60">
            <span className="ll:text-muted">Draw Calls</span>
            <span className="ll:text-small ll:font-semibold ll:font-mono ll:text-primary">
              {budget.drawCalls}
            </span>
          </div>

          <div className="ll:flex ll:flex-col ll:p-2 ll:bg-surface-panel ll:rounded ll:border ll:border-border/60">
            <span className="ll:text-muted">GPU Memory</span>
            <span className="ll:text-small ll:font-semibold ll:font-mono ll:text-primary">
              {budget.gpuMB} MB
            </span>
          </div>

          <div className="ll:flex ll:flex-col ll:p-2 ll:bg-surface-panel ll:rounded ll:border ll:border-border/60">
            <span className="ll:text-muted">Frame Time</span>
            <span className="ll:text-small ll:font-semibold ll:font-mono ll:text-primary">
              {budget.frameMs} ms
            </span>
          </div>
        </div>
      </div>

      {/* Detected Hardware Info */}
      <div className="ll:flex ll:flex-col ll:gap-1.5 ll:text-micro ll:text-muted">
        <div className="ll:flex ll:items-center ll:gap-1.5">
          <Icon icon={Cpu} size={13} />
          <span>Device CPU Cores: {hints.hardwareConcurrency ?? "Unknown"}</span>
        </div>
        <div className="ll:flex ll:items-center ll:gap-1.5">
          <Icon icon={Zap} size={13} />
          <span>Estimated RAM: {hints.deviceMemory ? `${hints.deviceMemory} GB` : "Unknown"}</span>
        </div>
      </div>

      {face === "pro" && (
        <div className="ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded ll:text-micro ll:text-muted">
          <span>Target Pixel Ratio: {budget.maxPixelRatio}x | Context Budget: {budget.sceneContexts}</span>
        </div>
      )}
    </div>
  );
};

"use client";

/**
 * ============================================================================
 * CONSTRAINTS PROPERTIES TAB (Phase 3D-022, 3D-028 Stub)
 * ============================================================================
 * Stub tab explaining the upcoming Phase 3D-028 object constraints engine.
 * ============================================================================
 */

import React from "react";
import { Link2, Info, Compass, Target, Magnet } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import type { PropertiesFace } from "./propertiesFace";

export interface ConstraintsTabProps {
  objectId?: string;
  face?: PropertiesFace;
  className?: string;
}

export const ConstraintsTab: React.FC<ConstraintsTabProps> = ({
  className = "",
}) => {
  return (
    <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-constraints">
      <div className="ll:flex ll:items-start ll:gap-2 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
        <Icon icon={Info} size={15} className="ll:text-accent ll:shrink-0 ll:mt-0.5" />
        <div className="ll:flex ll:flex-col ll:gap-0.5">
          <span className="ll:text-micro ll:font-semibold ll:text-primary">
            Object Constraints (Phase 3D-028)
          </span>
          <span className="ll:text-micro ll:text-muted ll:leading-relaxed">
            Non-destructive transform modifiers, tracking targets, and cinematic camera rigs
            will arrive in Phase 3D-028.
          </span>
        </div>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-2">
        <span className="ll:text-micro ll:font-semibold ll:text-secondary">
          Upcoming Constraint Types:
        </span>

        <div className="ll:grid ll:grid-cols-1 ll:gap-1.5">
          <div className="ll:flex ll:items-center ll:gap-2.5 ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded">
            <Icon icon={Target} size={14} className="ll:text-secondary" />
            <div className="ll:flex ll:flex-col">
              <span className="ll:text-micro ll:font-medium ll:text-primary">Track To / Look At</span>
              <span className="ll:text-micro ll:text-muted">Keeps camera or light aimed at a target object</span>
            </div>
          </div>

          <div className="ll:flex ll:items-center ll:gap-2.5 ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded">
            <Icon icon={Link2} size={14} className="ll:text-secondary" />
            <div className="ll:flex ll:flex-col">
              <span className="ll:text-micro ll:font-medium ll:text-primary">Copy Transform</span>
              <span className="ll:text-micro ll:text-muted">Mirrors position, rotation, or scale from another entity</span>
            </div>
          </div>

          <div className="ll:flex ll:items-center ll:gap-2.5 ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded">
            <Icon icon={Compass} size={14} className="ll:text-secondary" />
            <div className="ll:flex ll:flex-col">
              <span className="ll:text-micro ll:font-medium ll:text-primary">Follow Path</span>
              <span className="ll:text-micro ll:text-muted">Animates entity along a 3D bezier or spline curve</span>
            </div>
          </div>

          <div className="ll:flex ll:items-center ll:gap-2.5 ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded">
            <Icon icon={Magnet} size={14} className="ll:text-secondary" />
            <div className="ll:flex ll:flex-col">
              <span className="ll:text-micro ll:font-medium ll:text-primary">Limit Distance / Clamp</span>
              <span className="ll:text-micro ll:text-muted">Restricts motion within a spherical or axis boundary</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

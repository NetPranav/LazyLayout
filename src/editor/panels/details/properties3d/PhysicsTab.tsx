"use client";

/**
 * ============================================================================
 * PHYSICS PROPERTIES TAB (Phase 3D-022, 3D-049 Stub)
 * ============================================================================
 * Stub tab explaining the upcoming Phase 3D-049 physics simulation engine.
 * For 2.5D layers and simple faces, exposes intuitive surface physics controls
 * (mass, stiffness, damping, bounce, friction).
 * ============================================================================
 */

import React, { useState } from "react";
import { Info, Activity } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { NumberField } from "@/editor/components/NumberField";
import { Slider } from "@/editor/components/Slider";
import { Toggle } from "@/editor/components/Toggle";
import type { PropertiesFace } from "./propertiesFace";

export interface PhysicsTabProps {
  objectId?: string;
  face: PropertiesFace;
  className?: string;
}

export const PhysicsTab: React.FC<PhysicsTabProps> = ({
  face,
  className = "",
}) => {
  // Local state for surface physics controls
  const [enabled, setEnabled] = useState(false);
  const [mass, setMass] = useState(1.0);
  const [stiffness, setStiffness] = useState(180);
  const [damping, setDamping] = useState(12);
  const [bounce, setBounce] = useState(0.4);
  const [friction, setFriction] = useState(0.5);

  return (
    <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-physics">
      {/* Informational Banner */}
      <div className="ll:flex ll:items-start ll:gap-2 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
        <Icon icon={Info} size={15} className="ll:text-accent ll:shrink-0 ll:mt-0.5" />
        <div className="ll:flex ll:flex-col ll:gap-0.5">
          <span className="ll:text-micro ll:font-semibold ll:text-primary">
            Physics Simulation (Phase 3D-049)
          </span>
          <span className="ll:text-micro ll:text-muted ll:leading-relaxed">
            Full rigid body, cloth solver, and soft-body simulation engine will arrive in Phase 3D-049.
            Below are 2.5D surface response parameters.
          </span>
        </div>
      </div>

      {/* Surface Physics Simple Face */}
      <div className="ll:flex ll:flex-col ll:gap-3">
        <div className="ll:flex ll:items-center ll:justify-between">
          <div className="ll:flex ll:items-center ll:gap-1.5">
            <Icon icon={Activity} size={14} className="ll:text-secondary" />
            <span className="ll:text-micro ll:font-semibold ll:text-primary">
              Surface Spring Response
            </span>
          </div>
          <Toggle
            aria-label="Enable physics response"
            checked={enabled}
            onChange={setEnabled}
            size="sm"
          />
        </div>

        {enabled && (
          <div className="ll:flex ll:flex-col ll:gap-3 ll:pt-2 ll:border-t ll:border-border/40">
            {/* Mass */}
            <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
              <span className="ll:text-micro ll:text-secondary">Mass (kg)</span>
              <div className="ll:w-28">
                <NumberField
                  aria-label="Mass"
                  value={mass}
                  min={0.01}
                  step={0.1}
                  onChange={setMass}
                  size="sm"
                />
              </div>
            </div>

            {/* Stiffness */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:flex ll:items-center ll:justify-between">
                <span className="ll:text-micro ll:text-secondary">Stiffness</span>
                <span className="ll:text-micro ll:text-muted">{stiffness}</span>
              </div>
              <Slider
                aria-label="Stiffness"
                value={stiffness}
                min={10}
                max={500}
                step={5}
                onChange={setStiffness}
              />
            </div>

            {/* Damping */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:flex ll:items-center ll:justify-between">
                <span className="ll:text-micro ll:text-secondary">Damping</span>
                <span className="ll:text-micro ll:text-muted">{damping}</span>
              </div>
              <Slider
                aria-label="Damping"
                value={damping}
                min={1}
                max={50}
                step={1}
                onChange={setDamping}
              />
            </div>

            {/* Bounce (Restitution) */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:flex ll:items-center ll:justify-between">
                <span className="ll:text-micro ll:text-secondary">Bounce</span>
                <span className="ll:text-micro ll:text-muted">{bounce.toFixed(2)}</span>
              </div>
              <Slider
                aria-label="Bounce"
                value={bounce}
                min={0}
                max={1}
                step={0.05}
                onChange={setBounce}
              />
            </div>

            {/* Friction */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:flex ll:items-center ll:justify-between">
                <span className="ll:text-micro ll:text-secondary">Friction</span>
                <span className="ll:text-micro ll:text-muted">{friction.toFixed(2)}</span>
              </div>
              <Slider
                aria-label="Friction"
                value={friction}
                min={0}
                max={1}
                step={0.05}
                onChange={setFriction}
              />
            </div>
          </div>
        )}

        {face === "pro" && (
          <div className="ll:pt-3 ll:border-t ll:border-border ll:text-micro ll:text-muted">
            Pro Physics: Collision margins, continuous collision detection (CCD), and solver sub-steps will be exposed here in Phase 3D-049.
          </div>
        )}
      </div>
    </div>
  );
};

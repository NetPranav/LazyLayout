"use client";

/**
 * 2.5D spaces (Phase 127). A frame or group: "3D space" on, then its Perspective, vanishing point and the angle it is
 * seen from, and an Orbit preview to look around it. A layer standing in a space: its Depth and Tilt. Handles on the
 * canvas move the vanishing point and a selected layer's depth.
 */

import React, { useState } from "react";
import { invokeCommand } from "@/core/commands";
import { useLayers } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { isSpace, spaceOf, vanishingPoint } from "@/core/editing/spaceOps";
import { Slider } from "@/editor/components/Slider";
import { Toggle } from "@/editor/components/Toggle";
import { NumberField } from "@/editor/components/NumberField";
import { useSpaceViewStore } from "@/editor/stage/spaceViewStore";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** A slider that writes one undo step when it is let go. */
function Committed({ label, value, min, max, step = 1, onCommit }: { label: string; value: number; min: number; max: number; step?: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<number | null>(null);
  return (
    <Slider
      ariaLabel={label}
      min={min}
      max={max}
      step={step}
      value={draft ?? value}
      onChange={setDraft}
      onCommit={(v) => {
        setDraft(null);
        onCommit(v);
      }}
      showInput
    />
  );
}

export const SpaceSection: React.FC<InspectorSectionProps> = ({ selectedId }) => {
  useLayers();
  const orbiting = useSpaceViewStore((s) => s.orbiting);
  const startOrbit = useSpaceViewStore((s) => s.start);
  const stopOrbit = useSpaceViewStore((s) => s.stop);
  const layer = selectedId ? getDocument().layers[selectedId] : undefined;
  if (!layer || !selectedId) return null;
  const space = isSpace(layer);
  const inSpace = spaceOf(selectedId);
  const canBeSpace = layer.archetype === "container" || layer.archetype === "form";
  const p = layer.properties;
  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      {canBeSpace && (
        <OptionGroup>
          <OptionRow label="3D space">
            <Toggle size="sm" aria-label="3D space" checked={space} onChange={(on) => void invokeCommand(on ? "space.make" : "space.release", { ids: [selectedId] })} />
          </OptionRow>
          {space && (
            <>
              <OptionRow label="Perspective">
                <Committed label="Space perspective" value={num(p["transform.perspective"], 900)} min={100} max={4000} step={10} onCommit={(v) => void invokeCommand("space.set", { id: selectedId, perspective: v })} />
              </OptionRow>
              <OptionRow label="Vanish X">
                <NumberField size="sm" aria-label="Vanishing point X" value={vanishingPoint(layer).x} step={1} onChange={(v) => void invokeCommand("space.set", { id: selectedId, vanishX: v })} />
              </OptionRow>
              <OptionRow label="Vanish Y">
                <NumberField size="sm" aria-label="Vanishing point Y" value={vanishingPoint(layer).y} step={1} onChange={(v) => void invokeCommand("space.set", { id: selectedId, vanishY: v })} />
              </OptionRow>
              <OptionRow label="View X">
                <Committed label="Space view angle X" value={num(p["transform.rotateX"], 0)} min={-60} max={60} onCommit={(v) => void invokeCommand("space.set", { id: selectedId, viewX: v })} />
              </OptionRow>
              <OptionRow label="View Y">
                <Committed label="Space view angle Y" value={num(p["transform.rotateY"], 0)} min={-60} max={60} onCommit={(v) => void invokeCommand("space.set", { id: selectedId, viewY: v })} />
              </OptionRow>
              <OptionRow label="Orbit">
                <Toggle size="sm" aria-label="Orbit preview" checked={orbiting === selectedId} onChange={(on) => (on ? startOrbit(selectedId) : stopOrbit())} />
              </OptionRow>
            </>
          )}
        </OptionGroup>
      )}
      {inSpace && (
        <OptionGroup>
          <OptionRow label="Depth">
            <Committed label="Depth in space" value={num(p["transform.translateZ"], 0)} min={-1000} max={600} step={5} onCommit={(v) => void invokeCommand("space.setDepth", { ids: [selectedId], z: v })} />
          </OptionRow>
          <OptionRow label="Tilt X">
            <Committed label="Tilt X in space" value={num(p["transform.rotateX"], 0)} min={-90} max={90} onCommit={(v) => void invokeCommand("space.setDepth", { ids: [selectedId], tiltX: v })} />
          </OptionRow>
          <OptionRow label="Tilt Y">
            <Committed label="Tilt Y in space" value={num(p["transform.rotateY"], 0)} min={-90} max={90} onCommit={(v) => void invokeCommand("space.setDepth", { ids: [selectedId], tiltY: v })} />
          </OptionRow>
        </OptionGroup>
      )}
      {!space && !inSpace && !canBeSpace && <span className="ll:text-micro ll:text-muted">Put this layer in a frame that is a 3D space to give it depth</span>}
    </div>
  );
};

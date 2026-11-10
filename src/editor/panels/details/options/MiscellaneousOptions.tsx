"use client";

import React, { useState } from "react";
import { OptionGroup, OptionRow } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

// ==================== Divider Options ====================
export const DividerOptions: React.FC<InspectorSectionProps> = () => {
  const [cap, setCap] = useState("Butt");
  const [dash, setDash] = useState(0);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Cap">
          <Select
            size="sm"
            value={cap}
            options={[
              { value: "Butt", label: "Butt" },
              { value: "Round", label: "Round" },
              { value: "Square", label: "Square" },
            ]}
            onChange={setCap}
            aria-label="Line cap"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Dash">
          <NumberField
            size="sm"
            value={dash}
            min={0}
            onChange={setDash}
            aria-label="Dash offset"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Background Options ====================
export const BackgroundOptions: React.FC<InspectorSectionProps> = () => {
  const [angle, setAngle] = useState(180);
  const [noise, setNoise] = useState(10);
  const [pattern, setPattern] = useState("None");
  const [parallax, setParallax] = useState(0);
  const [blend, setBlend] = useState("Normal");

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Angle">
          <NumberField
            size="sm"
            unit="°"
            value={angle}
            onChange={setAngle}
            aria-label="Gradient angle"
            className="ll:w-full"
          />
        </OptionRow>
        <OptionRow label="Noise">
          <NumberField
            size="sm"
            unit="%"
            value={noise}
            min={0}
            max={100}
            onChange={setNoise}
            aria-label="Noise opacity"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      <OptionGroup>
        <OptionRow label="Pattern">
          <Select
            size="sm"
            value={pattern}
            options={[
              { value: "None", label: "None" },
              { value: "Dots", label: "Dots" },
              { value: "Grid", label: "Grid" },
              { value: "Lines", label: "Lines" },
            ]}
            onChange={setPattern}
            aria-label="Background pattern"
            className="ll:w-full"
          />
        </OptionRow>
        <OptionRow label="Parallax">
          <NumberField
            size="sm"
            value={parallax}
            step={0.1}
            onChange={setParallax}
            aria-label="Parallax speed"
            className="ll:w-full"
          />
        </OptionRow>
        <OptionRow label="Blend">
          <Select
            size="sm"
            value={blend}
            options={[
              { value: "Normal", label: "Normal" },
              { value: "Multiply", label: "Multiply" },
              { value: "Screen", label: "Screen" },
              { value: "Overlay", label: "Overlay" },
            ]}
            onChange={setBlend}
            aria-label="Background blend"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Icon Options ====================
export const IconOptions: React.FC<InspectorSectionProps> = () => {
  const [viewBox, setViewBox] = useState("0 0 24 24");
  const [cap, setCap] = useState("Round");
  const [join, setJoin] = useState("Round");
  const [dash, setDash] = useState("");

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="View box">
          <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:w-full">
            <input
              type="text"
              value={viewBox}
              onChange={(e) => setViewBox(e.target.value)}
              aria-label="View box"
              className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </OptionRow>
      </OptionGroup>

      <OptionGroup>
        <OptionRow label="Cap">
          <Select
            size="sm"
            value={cap}
            options={[
              { value: "Round", label: "Round" },
              { value: "Butt", label: "Butt" },
              { value: "Square", label: "Square" },
            ]}
            onChange={setCap}
            aria-label="Line cap"
            className="ll:w-full"
          />
        </OptionRow>
        <OptionRow label="Join">
          <Select
            size="sm"
            value={join}
            options={[
              { value: "Round", label: "Round" },
              { value: "Miter", label: "Miter" },
              { value: "Bevel", label: "Bevel" },
            ]}
            onChange={setJoin}
            aria-label="Line join"
            className="ll:w-full"
          />
        </OptionRow>
        <OptionRow label="Dash">
          <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:w-full">
            <input
              type="text"
              value={dash}
              onChange={(e) => setDash(e.target.value)}
              aria-label="Dash array"
              className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Shape Options ====================
export const ShapeOptions: React.FC<InspectorSectionProps> = () => {
  const [vertexRadius, setVertexRadius] = useState(0);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Vertex">
          <NumberField
            size="sm"
            value={vertexRadius}
            min={0}
            onChange={setVertexRadius}
            aria-label="Vertex radius"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Counter Options ====================
export const CounterOptions: React.FC<InspectorSectionProps> = () => {
  const [decimals, setDecimals] = useState(0);
  const [duration, setDuration] = useState(1.5);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Decimals">
          <NumberField
            size="sm"
            value={decimals}
            min={0}
            max={6}
            onChange={setDecimals}
            aria-label="Decimal places"
            className="ll:w-full"
          />
        </OptionRow>
        <OptionRow label="Duration">
          <NumberField
            size="sm"
            unit="s"
            value={duration}
            step={0.1}
            min={0.1}
            onChange={setDuration}
            aria-label="Count duration"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Object3D Options ====================
export const Object3DOptions: React.FC<InspectorSectionProps> = () => {
  const [wireframe, setWireframe] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [castShadow, setCastShadow] = useState(true);
  const [receiveShadow, setReceiveShadow] = useState(true);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Wireframe">
          <label className="ll:flex ll:items-center ll:gap-2 ll:cursor-pointer">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
              className="ll:rounded-xs ll:border-border ll:text-primary ll:focus:ring-primary"
            />
            <span className="ll:text-small ll:text-muted">Enabled</span>
          </label>
        </OptionRow>
        <OptionRow label="Transparent">
          <label className="ll:flex ll:items-center ll:gap-2 ll:cursor-pointer">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              className="ll:rounded-xs ll:border-border ll:text-primary ll:focus:ring-primary"
            />
            <span className="ll:text-small ll:text-muted">Enabled</span>
          </label>
        </OptionRow>
        <OptionRow label="Cast shadow">
          <label className="ll:flex ll:items-center ll:gap-2 ll:cursor-pointer">
            <input
              type="checkbox"
              checked={castShadow}
              onChange={(e) => setCastShadow(e.target.checked)}
              className="ll:rounded-xs ll:border-border ll:text-primary ll:focus:ring-primary"
            />
            <span className="ll:text-small ll:text-muted">Enabled</span>
          </label>
        </OptionRow>
        <OptionRow label="Receive shadow">
          <label className="ll:flex ll:items-center ll:gap-2 ll:cursor-pointer">
            <input
              type="checkbox"
              checked={receiveShadow}
              onChange={(e) => setReceiveShadow(e.target.checked)}
              className="ll:rounded-xs ll:border-border ll:text-primary ll:focus:ring-primary"
            />
            <span className="ll:text-small ll:text-muted">Enabled</span>
          </label>
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

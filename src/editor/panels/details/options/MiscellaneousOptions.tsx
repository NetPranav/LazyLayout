"use client";

import React, { useState } from "react";
import { OptionGroup, OptionRow } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

// ==================== Divider Options ====================
export const DividerOptions: React.FC<InspectorSectionProps> = ({ getValue, onUpdateProp }) => {
  const rawCap = (getValue?.("svg.strokeLinecap") as string) || "butt";
  const cap = rawCap.charAt(0).toUpperCase() + rawCap.slice(1).toLowerCase();
  const dash = typeof getValue?.("svg.strokeDashoffset") === "number" ? (getValue?.("svg.strokeDashoffset") as number) : 0;

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
            onChange={(c) => {
              onUpdateProp?.("svg.strokeLinecap", c.toLowerCase());
            }}
            aria-label="Line cap"
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Dash">
          <NumberField
            size="sm"
            value={dash}
            min={0}
            onChange={(d) => {
              onUpdateProp?.("svg.strokeDashoffset", d);
            }}
            aria-label="Dash offset"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Background Options ====================
export const BackgroundOptions: React.FC<InspectorSectionProps> = ({ getValue, onUpdateProp }) => {
  const angle = typeof getValue?.("paint.angle") === "number" ? (getValue?.("paint.angle") as number) : 180;
  const noise = typeof getValue?.("paint.noise") === "number" ? (getValue?.("paint.noise") as number) : 10;
  const pattern = (getValue?.("paint.pattern") as string) || "None";
  const parallax = typeof getValue?.("paint.parallax") === "number" ? (getValue?.("paint.parallax") as number) : 0;
  const rawBlend = (getValue?.("appearance.blendMode") as string) || "normal";
  const blend = rawBlend.charAt(0).toUpperCase() + rawBlend.slice(1).toLowerCase();

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Angle">
          <NumberField
            size="sm"
            unit="°"
            value={angle}
            onChange={(a) => {
              onUpdateProp?.("paint.angle", a);
            }}
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
            onChange={(n) => {
              onUpdateProp?.("paint.noise", n);
            }}
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
            onChange={(p) => {
              onUpdateProp?.("paint.pattern", p);
            }}
            aria-label="Background pattern"
            className="ll:w-full"
          />
        </OptionRow>
        <OptionRow label="Parallax">
          <NumberField
            size="sm"
            value={parallax}
            step={0.1}
            onChange={(px) => {
              onUpdateProp?.("paint.parallax", px);
            }}
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
            onChange={(b) => {
              onUpdateProp?.("appearance.blendMode", b.toLowerCase());
            }}
            aria-label="Background blend"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Icon Options ====================
export const IconOptions: React.FC<InspectorSectionProps> = ({ getValue, onUpdateProp }) => {
  const currentViewBox = (getValue?.("svg.viewBox") as string) || "0 0 24 24";
  const rawCap = (getValue?.("svg.strokeLinecap") as string) || "round";
  const cap = rawCap.charAt(0).toUpperCase() + rawCap.slice(1).toLowerCase();
  const rawJoin = (getValue?.("svg.strokeLinejoin") as string) || "round";
  const join = rawJoin.charAt(0).toUpperCase() + rawJoin.slice(1).toLowerCase();
  const currentDash = (getValue?.("svg.strokeDasharray") as string) || "";

  const [typingViewBox, setTypingViewBox] = useState<string | null>(null);
  const viewBox = typingViewBox ?? currentViewBox;

  const [typingDash, setTypingDash] = useState<string | null>(null);
  const dash = typingDash ?? currentDash;

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="View box">
          <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:w-full">
            <input
              type="text"
              value={viewBox}
              onChange={(e) => {
                setTypingViewBox(e.target.value);
                onUpdateProp?.("svg.viewBox", e.target.value);
              }}
              onBlur={() => setTypingViewBox(null)}
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
            onChange={(c) => {
              onUpdateProp?.("svg.strokeLinecap", c.toLowerCase());
            }}
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
            onChange={(j) => {
              onUpdateProp?.("svg.strokeLinejoin", j.toLowerCase());
            }}
            aria-label="Line join"
            className="ll:w-full"
          />
        </OptionRow>
        <OptionRow label="Dash">
          <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:w-full">
            <input
              type="text"
              value={dash}
              onChange={(e) => {
                setTypingDash(e.target.value);
                onUpdateProp?.("svg.strokeDasharray", e.target.value);
              }}
              onBlur={() => setTypingDash(null)}
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
export const ShapeOptions: React.FC<InspectorSectionProps> = ({ getValue, onUpdateProp }) => {
  const vertexRadius = typeof getValue?.("shape.cornerRadius") === "number" ? (getValue?.("shape.cornerRadius") as number) : 0;

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Vertex">
          <NumberField
            size="sm"
            value={vertexRadius}
            min={0}
            onChange={(r) => {
              onUpdateProp?.("shape.cornerRadius", r);
            }}
            aria-label="Vertex radius"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Counter Options ====================
export const CounterOptions: React.FC<InspectorSectionProps> = ({ getValue, onUpdateProp }) => {
  const decimals = typeof getValue?.("content.counter.decimals") === "number" ? (getValue?.("content.counter.decimals") as number) : 0;
  const duration = typeof getValue?.("content.counter.duration") === "number" ? (getValue?.("content.counter.duration") as number) : 1.5;

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Decimals">
          <NumberField
            size="sm"
            value={decimals}
            min={0}
            max={6}
            onChange={(d) => {
              onUpdateProp?.("content.counter.decimals", d);
            }}
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
            onChange={(du) => {
              onUpdateProp?.("content.counter.duration", du);
            }}
            aria-label="Count duration"
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

// ==================== Object3D Options ====================
export const Object3DOptions: React.FC<InspectorSectionProps> = ({ getValue, onUpdateProp }) => {
  const wireframe = Boolean(getValue?.("object3d.wireframe"));
  const transparent = Boolean(getValue?.("object3d.transparent"));
  const castShadow = getValue?.("object3d.castShadow") !== false;
  const receiveShadow = getValue?.("object3d.receiveShadow") !== false;

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Wireframe">
          <label className="ll:flex ll:items-center ll:gap-2 ll:cursor-pointer">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => {
                onUpdateProp?.("object3d.wireframe", e.target.checked);
              }}
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
              onChange={(e) => {
                onUpdateProp?.("object3d.transparent", e.target.checked);
              }}
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
              onChange={(e) => {
                onUpdateProp?.("object3d.castShadow", e.target.checked);
              }}
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
              onChange={(e) => {
                onUpdateProp?.("object3d.receiveShadow", e.target.checked);
              }}
              className="ll:rounded-xs ll:border-border ll:text-primary ll:focus:ring-primary"
            />
            <span className="ll:text-small ll:text-muted">Enabled</span>
          </label>
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

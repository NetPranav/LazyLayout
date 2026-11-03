"use client";

import React, { useState, useId } from "react";
import { FileCode, Plus, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { TextField } from "@/editor/components/TextField";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { Select } from "@/editor/components/Select";
import { PanelSection } from "@/editor/components/PanelSection";
import { PropertyRow } from "@/editor/components/PropertyRow";
import {
  TARGET_LIB_OPTIONS,
  STYLE_TYPE_OPTIONS,
  EXPORT_TYPE_OPTIONS,
  PROP_TYPE_OPTIONS,
} from "./constants";
import type { CodeInspectorProps, CodePropItem } from "./types";

const DEFAULT_PROPS: CodePropItem[] = [
  { id: "p_title", name: "title", type: "string" },
  { id: "p_cta", name: "cta", type: "string" },
];

export const CodeInspector: React.FC<CodeInspectorProps> = ({
  componentName: propComponentName,
  onComponentNameChange,
  exportType: propExportType,
  onExportTypeChange,
  targetLib: propTargetLib,
  onTargetLibChange,
  styleType: propStyleType,
  onStyleTypeChange,
  propsList: propPropsList,
  onAddProp,
  onRemoveProp,
  dependencies: propDependencies,
  onAddDependency,
  onRemoveDependency,
  outputFile: propOutputFile,
  onOutputFileChange,
  className = "",
  style,
}) => {
  const [internalComponentName, setInternalComponentName] = useState("Hero");
  const [internalExportType, setInternalExportType] = useState<"named" | "default">("named");
  const [internalTargetLib, setInternalTargetLib] = useState<"React" | "HTML" | "Vue">("React");
  const [internalStyleType, setInternalStyleType] = useState<"CSS modules" | "Tailwind" | "Inline">("CSS modules");
  const [internalProps, setInternalProps] = useState<CodePropItem[]>(DEFAULT_PROPS);
  const [internalDeps, setInternalDeps] = useState<string[]>([]);
  const [internalOutputFile, setInternalOutputFile] = useState("Hero.tsx");

  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState("string");
  const [newDepName, setNewDepName] = useState("");

  const componentName = propComponentName ?? internalComponentName;
  const exportType = propExportType ?? internalExportType;
  const targetLib = propTargetLib ?? internalTargetLib;
  const styleType = propStyleType ?? internalStyleType;
  const propsList = propPropsList ?? internalProps;
  const dependencies = propDependencies ?? internalDeps;
  const outputFile = propOutputFile ?? internalOutputFile;

  const inspectorId = useId();

  const handleNameChange = (val: string) => {
    if (onComponentNameChange) {
      onComponentNameChange(val);
    } else {
      setInternalComponentName(val);
    }
  };

  const handleExportChange = (val: "named" | "default") => {
    if (onExportTypeChange) {
      onExportTypeChange(val);
    } else {
      setInternalExportType(val);
    }
  };

  const handleTargetChange = (val: "React" | "HTML" | "Vue") => {
    if (onTargetLibChange) {
      onTargetLibChange(val);
    } else {
      setInternalTargetLib(val);
    }
  };

  const handleStyleChange = (val: "CSS modules" | "Tailwind" | "Inline") => {
    if (onStyleTypeChange) {
      onStyleTypeChange(val);
    } else {
      setInternalStyleType(val);
    }
  };

  const handleFileChange = (val: string) => {
    if (onOutputFileChange) {
      onOutputFileChange(val);
    } else {
      setInternalOutputFile(val);
    }
  };

  const handleCreateProp = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPropName.trim();
    if (!name) return;

    if (onAddProp) {
      onAddProp(name, newPropType);
    } else {
      setInternalProps((prev) => [
        ...prev,
        { id: `prop_${Date.now()}`, name, type: newPropType },
      ]);
    }
    setNewPropName("");
  };

  const handleDeleteProp = (id: string) => {
    if (onRemoveProp) {
      onRemoveProp(id);
    } else {
      setInternalProps((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleCreateDep = (e: React.FormEvent) => {
    e.preventDefault();
    const dep = newDepName.trim();
    if (!dep) return;

    if (onAddDependency) {
      onAddDependency(dep);
    } else {
      setInternalDeps((prev) => [...prev, dep]);
    }
    setNewDepName("");
  };

  const handleDeleteDep = (dep: string) => {
    if (onRemoveDependency) {
      onRemoveDependency(dep);
    } else {
      setInternalDeps((prev) => prev.filter((d) => d !== dep));
    }
  };

  return (
    <div
      id="ins-code"
      role="region"
      aria-label="Code Inspector"
      className={`ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
      style={style}
    >
      {/* File Header Bar (#rtop in prototype) */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:px-3 ll:h-9 ll:border-b ll:border-border ll:bg-surface-bar ll:shrink-0">
        <Icon icon={FileCode} size={14} className="ll:text-primary" />
        <span className="ll:font-mono ll:text-small ll:font-medium ll:text-primary ll:truncate">
          {outputFile}
        </span>
      </div>

      {/* 1. Component Section */}
      <PanelSection title="Component" defaultOpen={true}>
        <PropertyRow label="Name">
          <TextField
            size="sm"
            aria-label="Component name"
            value={componentName}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </PropertyRow>

        <PropertyRow label="Export">
          <SegmentedControl
            size="sm"
            ariaLabel="Export type"
            value={exportType}
            onChange={(val) => handleExportChange(val as "named" | "default")}
            options={EXPORT_TYPE_OPTIONS}
          />
        </PropertyRow>
      </PanelSection>

      {/* 2. Target & Output Section */}
      <PanelSection title="Output" defaultOpen={true}>
        <PropertyRow label="Target">
          <SegmentedControl
            size="sm"
            ariaLabel="Target framework"
            value={targetLib}
            onChange={(val) => handleTargetChange(val as "React" | "HTML" | "Vue")}
            options={TARGET_LIB_OPTIONS}
          />
        </PropertyRow>

        <PropertyRow label="Styles">
          <Select
            size="sm"
            aria-label="Style strategy"
            value={styleType}
            onChange={(val) =>
              handleStyleChange(val as "CSS modules" | "Tailwind" | "Inline")
            }
            options={STYLE_TYPE_OPTIONS}
          />
        </PropertyRow>

        <PropertyRow label="File">
          <TextField
            size="sm"
            mono
            aria-label="Output file"
            value={outputFile}
            onChange={(e) => handleFileChange(e.target.value)}
          />
        </PropertyRow>
      </PanelSection>

      {/* 3. Props Section */}
      <PanelSection
        title={`Props (${propsList.length})`}
        defaultOpen={true}
      >
        <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
          {propsList.map((prop) => (
            <div
              key={prop.id}
              className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:py-1 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm"
            >
              <span className="ll:font-mono ll:text-small ll:text-primary ll:truncate">
                {prop.name}
              </span>
              <div className="ll:flex ll:items-center ll:gap-1.5 ll:shrink-0">
                <span className="ll:font-mono ll:text-nano ll:text-muted ll:bg-surface-raised ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:border ll:border-border">
                  {prop.type}
                </span>
                <IconButton
                  size="sm"
                  aria-label={`Remove prop ${prop.name}`}
                  tooltip={`Remove ${prop.name}`}
                  icon={<Icon icon={Minus} size={12} />}
                  onClick={() => handleDeleteProp(prop.id)}
                />
              </div>
            </div>
          ))}

          {/* Add Prop Input Row */}
          <form
            onSubmit={handleCreateProp}
            className="ll:flex ll:items-center ll:gap-1.5 ll:mt-1"
          >
            <div className="ll:flex-1">
              <TextField
                size="sm"
                placeholder="Prop name"
                aria-label="New prop name"
                value={newPropName}
                onChange={(e) => setNewPropName(e.target.value)}
              />
            </div>
            <div className="ll:w-24 ll:shrink-0">
              <Select
                size="sm"
                aria-label="Prop type"
                value={newPropType}
                onChange={setNewPropType}
                options={PROP_TYPE_OPTIONS}
              />
            </div>
            <IconButton
              type="submit"
              size="sm"
              aria-label="Add prop"
              tooltip="Add prop"
              disabled={!newPropName.trim()}
              icon={<Icon icon={Plus} size={12} />}
            />
          </form>
        </div>
      </PanelSection>

      {/* 4. Dependencies Section */}
      <PanelSection title="Dependencies" defaultOpen={true}>
        <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
          {dependencies.length === 0 ? (
            <span className="ll:text-muted ll:text-small">
              none
            </span>
          ) : (
            dependencies.map((dep) => (
              <div
                key={dep}
                className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:py-1 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm"
              >
                <span className="ll:font-mono ll:text-small ll:text-primary ll:truncate">
                  {dep}
                </span>
                <IconButton
                  size="sm"
                  aria-label={`Remove dependency ${dep}`}
                  tooltip={`Remove ${dep}`}
                  icon={<Icon icon={Minus} size={12} />}
                  onClick={() => handleDeleteDep(dep)}
                />
              </div>
            ))
          )}

          {/* Add Dependency Input Row */}
          <form
            onSubmit={handleCreateDep}
            className="ll:flex ll:items-center ll:gap-1.5 ll:mt-1"
          >
            <div className="ll:flex-1">
              <TextField
                size="sm"
                placeholder="Package name (e.g. framer-motion)"
                aria-label="Package name"
                value={newDepName}
                onChange={(e) => setNewDepName(e.target.value)}
              />
            </div>
            <IconButton
              type="submit"
              size="sm"
              aria-label="Add dependency"
              tooltip="Add dependency"
              disabled={!newDepName.trim()}
              icon={<Icon icon={Plus} size={12} />}
            />
          </form>
        </div>
      </PanelSection>
    </div>
  );
};

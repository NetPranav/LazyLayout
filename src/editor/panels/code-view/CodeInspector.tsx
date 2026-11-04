"use client";

import React, { useState, useId, useMemo } from "react";
import { FileText, Plus, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useLayers } from "@/core/store/useDocumentStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import type { CodeInspectorProps, CodePropItem } from "./types";

const DEFAULT_PROPS: CodePropItem[] = [
  { id: "p_title", name: "title", type: "string" },
  { id: "p_cta", name: "cta", type: "string" },
];

const EXPORT_OPTIONS = [
  { value: "Named", label: "Named" },
  { value: "Default", label: "Default" },
] as const;

const TARGET_OPTIONS = [
  { value: "React", label: "React" },
  { value: "HTML", label: "HTML" },
  { value: "Vue", label: "Vue" },
] as const;

const STYLE_OPTIONS = [
  { value: "CSS modules", label: "CSS modules" },
  { value: "Tailwind", label: "Tailwind" },
  { value: "Inline", label: "Inline" },
] as const;

const PROP_TYPE_OPTIONS = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
] as const;

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
  const inspectorId = useId();

  // Connect to selection store and project store
  const selectedElementId = useSelectionStore((s) => s.selectedId);
  const elements = useLayers();
  const activePageId = useProjectStore((s) => s.activePageId);
  const pages = useProjectStore((s) => s.pages);

  const defaultComponentName = useMemo(() => {
    if (selectedElementId && elements[selectedElementId]) {
      return elements[selectedElementId].name || "Hero";
    }
    const page = pages[activePageId || "page_home"];
    return page?.name || "Hero";
  }, [selectedElementId, elements, activePageId, pages]);

  // Internal uncontrolled fallbacks
  const [internalComponentName, setInternalComponentName] = useState<string>(defaultComponentName);
  const [internalExportType, setInternalExportType] = useState<"named" | "default">("named");
  const [internalTargetLib, setInternalTargetLib] = useState<"React" | "HTML" | "Vue">("React");
  const [internalStyleType, setInternalStyleType] = useState<"CSS modules" | "Tailwind" | "Inline">("CSS modules");
  const [internalProps, setInternalProps] = useState<CodePropItem[]>(DEFAULT_PROPS);
  const [internalDeps, setInternalDeps] = useState<string[]>([]);
  const [internalOutputFile, setInternalOutputFile] = useState<string>(`${defaultComponentName}.tsx`);

  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState("string");
  const [isAddingProp, setIsAddingProp] = useState(false);

  const [newDepName, setNewDepName] = useState("");
  const [isAddingDep, setIsAddingDep] = useState(false);

  const componentName = propComponentName ?? (selectedElementId ? defaultComponentName : internalComponentName);
  const exportType = propExportType ?? internalExportType;
  const targetLib = propTargetLib ?? internalTargetLib;
  const styleType = propStyleType ?? internalStyleType;
  const propsList = propPropsList ?? internalProps;
  const dependencies = propDependencies ?? internalDeps;
  const outputFile = propOutputFile ?? (propComponentName ? `${propComponentName}.tsx` : internalOutputFile);

  const handleNameChange = (val: string) => {
    if (onComponentNameChange) onComponentNameChange(val);
    else setInternalComponentName(val);
  };

  const handleExportChange = (val: string) => {
    const canonical = val.toLowerCase() === "default" ? "default" : "named";
    if (onExportTypeChange) onExportTypeChange(canonical);
    else setInternalExportType(canonical);
  };

  const handleTargetChange = (val: string) => {
    const v = val as "React" | "HTML" | "Vue";
    if (onTargetLibChange) onTargetLibChange(v);
    else setInternalTargetLib(v);
  };

  const handleStyleChange = (val: string) => {
    const v = val as "CSS modules" | "Tailwind" | "Inline";
    if (onStyleTypeChange) onStyleTypeChange(v);
    else setInternalStyleType(v);
  };

  const handleFileChange = (val: string) => {
    if (onOutputFileChange) onOutputFileChange(val);
    else setInternalOutputFile(val);
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
    setIsAddingProp(false);
  };

  const handleDeleteProp = (id: string) => {
    if (onRemoveProp) onRemoveProp(id);
    else setInternalProps((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreateDep = (e: React.FormEvent) => {
    e.preventDefault();
    const dep = newDepName.trim();
    if (!dep) return;

    if (onAddDependency) onAddDependency(dep);
    else setInternalDeps((prev) => [...prev, dep]);

    setNewDepName("");
    setIsAddingDep(false);
  };

  const handleDeleteDep = (dep: string) => {
    if (onRemoveDependency) onRemoveDependency(dep);
    else setInternalDeps((prev) => prev.filter((d) => d !== dep));
  };

  const exportDisplayValue = exportType === "default" ? "Default" : "Named";

  return (
    <div
      id="ins-code"
      role="region"
      aria-label="Code Inspector"
      className={`ll-code-inspector ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
      style={style}
    >
      {/* 1. Header: File icon + File name matching prototype: .rtop (.rico + .rname) */}
      <div className="ll-rtop ll:flex ll:items-center ll:gap-2 ll:px-4 ll:h-header ll:border-b ll:border-border ll:shrink-0 ll:min-w-0">
        <Icon icon={FileText} size={16} className="ll-rico ll:text-muted ll:shrink-0" />
        <span className="ll-rname ll:text-title ll:font-semibold ll:text-primary ll:truncate">
          {outputFile}
        </span>
      </div>

      {/* 2. Component Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Component
          </h3>
          <div className="ll-sp ll:flex-1" />
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Name Field with prefix 'Name' */}
          <div
            className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
            title="Component name"
          >
            <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
              Name
            </span>
            <input
              type="text"
              aria-label="Component name"
              value={componentName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
            />
          </div>

          {/* Export Select */}
          <div className="ll-dgrid ll:grid ll:grid-cols-2 ll:gap-2">
            <Select
              size="sm"
              aria-label="Export"
              value={exportDisplayValue}
              onChange={handleExportChange}
              options={EXPORT_OPTIONS}
            />
          </div>
        </div>
      </section>

      {/* 3. Output Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Output
          </h3>
          <div className="ll-sp ll:flex-1" />
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* React / HTML / Vue Segmented Control */}
          <SegmentedControl
            size="sm"
            ariaLabel="Output target"
            value={targetLib}
            onChange={handleTargetChange}
            options={TARGET_OPTIONS}
          />

          {/* Styles Strategy Select */}
          <Select
            size="sm"
            aria-label="Styles"
            value={styleType}
            onChange={handleStyleChange}
            options={STYLE_OPTIONS}
          />

          {/* Output File Name Field with prefix 'File' */}
          <div
            className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
            title="File name"
          >
            <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
              File
            </span>
            <input
              type="text"
              aria-label="File name"
              value={outputFile}
              onChange={(e) => handleFileChange(e.target.value)}
              className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
            />
          </div>
        </div>
      </section>

      {/* 4. Props Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Props
          </h3>
          <IconButton
            size="sm"
            aria-label="Add prop"
            tooltip="Add prop"
            icon={<Icon icon={Plus} size={14} />}
            onClick={() => setIsAddingProp((prev) => !prev)}
          />
        </div>

        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Add Prop Inline Form */}
          {isAddingProp && (
            <form
              onSubmit={handleCreateProp}
              className="ll:flex ll:items-center ll:gap-1.5"
            >
              <div className="ll-dfield ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
                <input
                  type="text"
                  placeholder="Prop name"
                  aria-label="New prop name"
                  value={newPropName}
                  onChange={(e) => setNewPropName(e.target.value)}
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:w-full ll:font-mono ll:text-micro ll:text-primary ll:placeholder:text-muted ll:p-0"
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
                aria-label="Save prop"
                tooltip="Save"
                disabled={!newPropName.trim()}
                icon={<Icon icon={Plus} size={12} />}
              />
            </form>
          )}

          {/* Prop Rows matching prototype .drow / .dpair */}
          {propsList.map((prop) => (
            <div key={prop.id} className="ll-dr ll:flex ll:flex-col ll:gap-2">
              <div className="ll-drow ll:grid ll:grid-cols-2 ll:gap-2 ll:items-center">
                <div
                  className="ll-dfield ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0"
                  title="Prop name"
                >
                  <input
                    type="text"
                    aria-label="Prop name"
                    value={prop.name}
                    onChange={(e) => {
                      const updatedName = e.target.value;
                      setInternalProps((prev) =>
                        prev.map((p) =>
                          p.id === prop.id ? { ...p, name: updatedName } : p
                        )
                      );
                    }}
                    className="ll:bg-transparent ll:border-0 ll:outline-none ll:w-full ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                  />
                </div>

                <div className="ll-dpair ll:flex ll:items-center ll:gap-1.5 ll:min-w-0">
                  <div className="ll:flex-1 ll:min-w-0">
                    <Select
                      size="sm"
                      aria-label="Prop type"
                      value={prop.type}
                      onChange={(newType) => {
                        setInternalProps((prev) =>
                          prev.map((p) =>
                            p.id === prop.id ? { ...p, type: newType } : p
                          )
                        );
                      }}
                      options={PROP_TYPE_OPTIONS}
                    />
                  </div>
                  <IconButton
                    size="sm"
                    aria-label={`Remove prop ${prop.name}`}
                    tooltip="Remove prop"
                    icon={<Icon icon={Minus} size={12} />}
                    onClick={() => handleDeleteProp(prop.id)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Dependencies Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Dependencies
          </h3>
          <IconButton
            size="sm"
            aria-label="Add dependency"
            tooltip="Add dependency"
            icon={<Icon icon={Plus} size={14} />}
            onClick={() => setIsAddingDep((prev) => !prev)}
          />
        </div>

        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Add Dependency Inline Form */}
          {isAddingDep && (
            <form
              onSubmit={handleCreateDep}
              className="ll:flex ll:items-center ll:gap-1.5"
            >
              <div className="ll-dfield ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
                <input
                  type="text"
                  placeholder="Package name"
                  aria-label="Package name"
                  value={newDepName}
                  onChange={(e) => setNewDepName(e.target.value)}
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:w-full ll:font-mono ll:text-micro ll:text-primary ll:placeholder:text-muted ll:p-0"
                />
              </div>
              <IconButton
                type="submit"
                size="sm"
                aria-label="Save dependency"
                tooltip="Save"
                disabled={!newDepName.trim()}
                icon={<Icon icon={Plus} size={12} />}
              />
            </form>
          )}

          {/* Dependencies List matching prototype .dr / .drm */}
          {dependencies.map((dep) => (
            <div
              key={dep}
              className="ll-dr ll:flex ll:items-center ll:justify-between ll:gap-2"
            >
              <div className="ll-dfield ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:flex-1 ll:min-w-0">
                <span className="ll:font-mono ll:text-micro ll:text-primary ll:truncate">
                  {dep}
                </span>
              </div>
              <IconButton
                size="sm"
                aria-label={`Remove dependency ${dep}`}
                tooltip="Remove dependency"
                icon={<Icon icon={Minus} size={12} />}
                onClick={() => handleDeleteDep(dep)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CodeInspector;

"use client";

import React, { useState, useMemo } from "react";
import {
  Code,
  FileCode,
  Plus,
  X,
  Copy,
  Download,
  Check,
  Film,
  Type,
  Square,
  Image as ImageIcon,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useLayers } from "@/core/store/useDocumentStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { ZipPacker } from "@/compiler/export/ZipPacker";
import {
  FRAMEWORKS,
  STYLINGS,
  ANIMATIONS,
  cxFmt,
  fName,
  fPath,
  fCompKind,
  cxGen,
  animOf,
  cxFiles,
  cxSize,
  cxKB,
  FILE_OF,
  type FrameworkKey,
  type StylingKey,
  type AnimationKey,
  type CodeGeneratorState,
} from "./codeGenerator";
import { useCodeModels } from "./useCodeModels";
import type { CodeInspectorProps, CodePropItem } from "./types";

const TARGET_OPTIONS: Array<"React" | "HTML" | "Vue"> = ["React", "HTML", "Vue"];

const FWS_BY_TARGET: Record<"React" | "HTML" | "Vue", FrameworkKey[]> = {
  React: ["next", "react"],
  Vue: ["nuxt", "vue"],
  HTML: ["html"],
};

const ANIM_PROPS = [
  { key: "opacity", name: "Opacity", unit: "%" },
  { key: "x", name: "Position X", unit: "px" },
  { key: "y", name: "Position Y", unit: "px" },
  { key: "scale", name: "Scale", unit: "%" },
  { key: "rot", name: "Rotation", unit: "\u00b0" },
] as const;

function sentenceCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

const CodeRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="ll-crow ll:flex ll:items-baseline ll:justify-between ll:gap-3 ll:min-h-5 ll:font-sans ll:text-small ll:leading-snug ll:text-muted">
    <span className="ll:shrink-0">{label}</span>
    <span className="ll:font-mono ll:text-micro ll:leading-snug ll:text-primary ll:text-right ll:min-w-0 ll:truncate">{value}</span>
  </div>
);

export const CodeInspector: React.FC<CodeInspectorProps> = ({
  componentName: propComponentName,
  onComponentNameChange,
  exportType: propExportType,
  onExportTypeChange,
  targetLib: propTargetLib,
  onTargetLibChange,
  styleType: _propStyleType,
  onStyleTypeChange,
  propsList: propPropsList,
  onAddProp,
  onRemoveProp,
  dependencies: _propDependencies,
  onAddDependency,
  onRemoveDependency: _onRemoveDependency,
  outputFile: _propOutputFile,
  onOutputFileChange: _onOutputFileChange,
  className = "",
  style,
}) => {
  // Store integration
  const selectedElementId = useSelectionStore((s) => s.selectedId);
  const elements = useLayers();
  const models = useCodeModels();
  const _pages = useProjectStore((s) => s.pages);

  // Inspector state: Project, File, or Layer
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Generator configuration
  const [fw, setFw] = useState<FrameworkKey>("next");
  const [sty, setSty] = useState<StylingKey>("tw");
  const [anim, setAnim] = useState<AnimationKey>("none");
  const [ts, setTs] = useState<boolean>(true);
  const [compNames, setCompNames] = useState<Record<string, string>>({
    hero: "Hero",
    features: "Features",
    footer: "Footer",
    home: "Home",
  });
  const [expTypes, setExpTypes] = useState<Record<string, "Named" | "Default">>({
    hero: "Named",
    features: "Named",
    footer: "Named",
  });
  const [compProps, setCompProps] = useState<Record<string, CodePropItem[]>>({
    hero: [
      { id: "p1", name: "title", type: "string" },
      { id: "p2", name: "cta", type: "string" },
    ],
    features: [{ id: "p3", name: "heading", type: "string" }],
    footer: [{ id: "p4", name: "copyright", type: "string" }],
  });
  const [depsList, setDepsList] = useState<string[]>([]);
  const [newDepInput, setNewDepInput] = useState<string>("");

  // Export progress animation state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportDone, setExportDone] = useState<{ n: number; sz: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  // Determine current active inspector state
  const inspectorKind: "layer" | "file" | "project" = selectedElementId
    ? "layer"
    : selectedFileId
    ? "file"
    : "project";

  const codeState: CodeGeneratorState = useMemo(() => {
    return {
      fw,
      sty,
      anim,
      ts,
      names: compNames,
      exp: expTypes,
      props: Object.fromEntries(
        Object.entries(compProps).map(([k, list]) => [k, list.map((p) => ({ n: p.name, t: p.type }))])
      ),
      deps: depsList,
    };
  }, [fw, sty, anim, ts, compNames, expTypes, compProps, depsList]);

  // Target library (React / HTML / Vue)
  const currentTargetLib = propTargetLib ?? cxFmt(fw);

  const handleTargetChange = (t: "React" | "HTML" | "Vue") => {
    onTargetLibChange?.(t);
    const defaultFw = FWS_BY_TARGET[t][0];
    setFw(defaultFw);
  };

  const handleStyleChange = (s: StylingKey) => {
    setSty(s);
    onStyleTypeChange?.(s === "tw" ? "Tailwind" : s === "mod" ? "CSS modules" : "Inline");
  };

  // Export repo simulation with progress bar matching P lines 6599-6604, 6825-6841
  const handleExportRepo = () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    setExportDone(null);

    const interval = setInterval(() => {
      setExportProgress((prev) => {
        const next = Math.min(100, prev + 12 + Math.random() * 8);
        if (next >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          const totalSz = cxKB(cxSize(codeState));
          setExportDone({ n: cxFiles(codeState).length, sz: totalSz });

          // Trigger real zip download
          const packer = new ZipPacker();
          cxFiles(codeState).forEach((f) => {
            const gen = cxGen(f.id, codeState);
            packer.addFile(fName(f.id, codeState), gen.text);
          });
          packer.download("my-project.zip");
        }
        return next;
      });
    }, 120);
  };

  const installCmdStr = `npm install ${cxGen("pkg", codeState).deps.join(" ")}`;

  const handleCopyInstallCmd = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(installCmdStr);
    }
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1400);
  };

  // Add dependency to package.json
  const handleAddDependency = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = newDepInput.trim();
      if (val && !depsList.includes(val)) {
        setDepsList((prev) => [...prev, val]);
        onAddDependency?.(val);
        setNewDepInput("");
      }
    }
  };

  // Add prop to current file component
  const handleAddProp = (fileId: string) => {
    const list = compProps[fileId] || [];
    let n = 1;
    while (list.some((p) => p.name === `prop${n}`)) n++;
    const newProp: CodePropItem = {
      id: `p_${Date.now()}`,
      name: `prop${n}`,
      type: "string",
    };
    setCompProps((prev) => ({
      ...prev,
      [fileId]: [...(prev[fileId] || []), newProp],
    }));
    onAddProp?.(newProp.name, newProp.type);
  };

  const handleRemoveProp = (fileId: string, propId: string) => {
    setCompProps((prev) => ({
      ...prev,
      [fileId]: (prev[fileId] || []).filter((p) => p.id !== propId),
    }));
    onRemoveProp?.(propId);
  };

  // 1. RENDER: LAYER STATE (When layer is selected on the canvas)
  if (inspectorKind === "layer" && selectedElementId) {
    const shortId = selectedElementId.replace(/^el_/, "");
    const fileId = FILE_OF[shortId] || "hero";
    const gen = cxGen(fileId, codeState, models.data, models.type, models.txt);
    const range = gen.rg[shortId] || [0, 0];
    const nodeInfo = gen.nodes[shortId];
    const node = nodeInfo?.node;
    const layerName = elements[selectedElementId]?.name || sentenceCase(shortId);
    const classAttr = nodeInfo?.at.find((x) => /^(className|class)=|^:?style=/.test(x)) ?? "";
    const classMatch = /^(?:className|class)="(.*)"$/.exec(classAttr);
    const classList = classMatch ? classMatch[1].split(" ").filter(Boolean) : [];
    const classFallback = classAttr.replace(/^(\w+)=/, "");
    const decls = node?.st ?? [];
    const anim = animOf(shortId, codeState, true);
    const anim0 = codeState.anim;
    const animRows = anim
      ? ANIM_PROPS.filter((p) => anim.from[p.key] != null).map((p) => [
          p.name,
          `${anim.from[p.key]} to ${anim.to[p.key]}${p.unit}`,
        ])
      : [];

    return (
      <div
        id="ins-code"
        role="region"
        aria-label="Code Inspector"
        data-k="layer"
        className={`ll-code-inspector ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
        style={style}
      >
        {/* Header (.rtop in prototype: height 44px) */}
        <div className="ll-rtop ll:h-11 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:px-4 ll:border-b ll:border-border">
          <Icon
            icon={shortId === "headline" || shortId === "subtitle" ? Type : shortId === "image" ? ImageIcon : Square}
            size={16}
            className="ll:text-secondary ll:shrink-0"
          />
          <span className="ll-rname ll:font-sans ll:text-heading ll:leading-snug ll:tracking-normal ll:font-semibold ll:text-primary ll:truncate ll:min-w-0">
            {layerName}
          </span>
          <div className="ll:flex-1" />
          <span className="ll-rsub ll:font-mono ll:text-micro ll:text-muted ll:whitespace-nowrap">
            {fName(fileId, codeState)}
          </span>
        </div>

        {/* Section 1: Element */}
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
          <div className="ll-dtitle ll:flex ll:items-center ll:min-h-6">
            <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Element</h3>
          </div>
          <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
            <CodeRow label="Tag" value={`<${nodeInfo?.tag || shortId}>`} />
            <CodeRow label="Component" value={compNames[fileId] || fileId} />
            <CodeRow label="Lines" value={`${range[0] + 1} to ${range[1] + 1}`} />
            <div className="ll-csub2 ll:font-sans ll:text-micro ll:leading-snug ll:text-muted ll:mt-1">
              {sty === "tw" ? "Classes" : sty === "mod" ? "Class" : "Inline style"}
            </div>
            <code className="ll-cclass ll:block ll:font-mono ll:text-micro ll:leading-4.5 ll:text-secondary ll:break-all">
              {classMatch
                ? classList.map((c) => (
                    <span
                      key={c}
                      className="ll:inline-block ll:mr-1 ll:mb-1 ll:px-1 ll:border ll:border-border ll:rounded-sm ll:bg-surface-bar"
                    >
                      {c}
                    </span>
                  ))
                : classFallback}
            </code>
            <div className="ll-csub2 ll:font-sans ll:text-micro ll:leading-snug ll:text-muted ll:mt-1">Declarations</div>
            <div className="ll-cdecl ll:flex ll:flex-col ll:gap-0.5 ll:font-mono ll:text-micro ll:leading-snug">
              {decls.map(([prop, val]) => (
                <div key={prop} className="ll-cdl ll:flex ll:justify-between ll:gap-3 ll:text-secondary">
                  <span className="ll:text-muted">{prop}</span>
                  <span className="ll:text-right ll:min-w-0 ll:truncate">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Props and data */}
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
          <div className="ll-dtitle ll:flex ll:items-center ll:min-h-6">
            <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Props and data</h3>
          </div>
          <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
            <CodeRow
              label={node?.bind ? "Bound to" : "Bound data"}
              value={node?.bind ? `prop ${node.bind}` : "None"}
            />
            {node?.x != null && <CodeRow label="Text" value={`"${node.x}"`} />}
            {(node?.at ?? []).slice(0, 3).map(([k, v]) => (
              <CodeRow key={k} label={k} value={v} />
            ))}
          </div>
        </section>

        {/* Section 3: Animation */}
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
          <div className="ll-dtitle ll:flex ll:items-center ll:min-h-6">
            <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Animation</h3>
          </div>
          <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
            {anim ? (
              <>
                <CodeRow label="Engine" value={anim0 === "none" ? "None (not exported)" : ANIMATIONS[anim0]} />
                {animRows.map(([k, v]) => (
                  <CodeRow key={k} label={k} value={v} />
                ))}
                <CodeRow label="Timing" value={`${anim.dur} s, delay ${anim.delay} s`} />
                <CodeRow label="Easing" value={anim.ease} />
              </>
            ) : (
              <p className="ll:m-0 ll:font-sans ll:text-small ll:text-muted">No animation on this layer.</p>
            )}
            <button
              type="button"
              className="ll-btn ll:w-full ll:h-7 ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-body ll:font-medium ll:text-primary ll:cursor-pointer"
            >
              <Icon icon={Film} size={13} className="ll:text-muted" />
              <span>Open in Motion</span>
            </button>
          </div>
        </section>

        {/* Section 4: Actions */}
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:p-4">
          <button
            type="button"
            className="ll-btn ll:w-full ll:h-8 ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:bg-control-primary-bg ll:text-control-primary-fg ll:border-0 ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:cursor-pointer"
          >
            <Icon icon={Code} size={14} />
            <span>Jump to code</span>
          </button>
        </section>
      </div>
    );
  }

  // 2. RENDER: FILE STATE (When a specific file is selected)
  if (inspectorKind === "file" && selectedFileId) {
    const isComp = fCompKind(selectedFileId);
    const gen = cxGen(selectedFileId, codeState);
    const currentName = compNames[selectedFileId] || propComponentName || selectedFileId;
    const currentExp = expTypes[selectedFileId] || propExportType || "Named";
    const currentProps = compProps[selectedFileId] || propPropsList || [];

    return (
      <div
        id="ins-code"
        role="region"
        aria-label="Code Inspector"
        data-k="file"
        className={`ll-code-inspector ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
        style={style}
      >
        {/* Header (.rtop in prototype: height 44px) */}
        <div className="ll-rtop ll:h-11 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:px-4 ll:border-b ll:border-border">
          <Icon icon={FileCode} size={16} className="ll:text-primary" />
          <span className="ll-rname ll:font-sans ll:text-body ll:font-semibold ll:text-primary ll:truncate">
            {fName(selectedFileId, codeState)}
          </span>
          <div className="ll:flex-1" />
          <button
            type="button"
            data-ca="toproj"
            onClick={() => setSelectedFileId(null)}
            className="ll-rback ll:font-mono ll:text-micro ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:px-2 ll:py-1 ll:rounded-xs ll:border-0 ll:bg-transparent ll:cursor-pointer"
          >
            Project
          </button>
        </div>

        {/* Section 1: Component Config */}
        {isComp && (
          <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:p-4 ll:border-b ll:border-border">
            <div className="ll-dtitle ll:flex ll:items-center ll:justify-between">
              <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Component</h3>
            </div>
            <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
              {/* Name field with prefix inside */}
              <div
                className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:focus-within:border-primary ll:rounded-sm"
                title="Component name"
              >
                <span className="ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:select-none">
                  Name
                </span>
                <input
                  type="text"
                  value={currentName}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setCompNames((prev) => ({ ...prev, [selectedFileId]: nextVal }));
                    onComponentNameChange?.(nextVal);
                  }}
                  className="ll:w-full ll:bg-transparent ll:border-0 ll:outline-none ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                />
              </div>

              {/* Export Type select */}
              <div className="ll:flex ll:items-center ll:gap-2">
                <span className="ll:font-sans ll:text-small ll:text-muted ll:w-16">Export</span>
                <select
                  value={currentExp}
                  onChange={(e) => {
                    const next = e.target.value as "Named" | "Default";
                    setExpTypes((prev) => ({ ...prev, [selectedFileId]: next }));
                    onExportTypeChange?.(next.toLowerCase() as "named" | "default");
                  }}
                  className="ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:font-sans ll:text-small ll:text-primary ll:outline-none"
                >
                  <option value="Named">Named</option>
                  <option value="Default">Default</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Section 2: File Stats */}
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:p-4 ll:border-b ll:border-border">
          <div className="ll-dtitle ll:flex ll:items-center ll:justify-between">
            <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">File</h3>
          </div>
          <div className="ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:font-mono ll:text-micro">
            <div className="ll-crow ll:flex ll:items-baseline ll:justify-between">
              <span className="ll:text-muted">Name</span>
              <span className="ll:text-primary">{fName(selectedFileId, codeState)}</span>
            </div>
            <div className="ll-crow ll:flex ll:items-baseline ll:justify-between">
              <span className="ll:text-muted">Path</span>
              <span className="ll:text-primary ll:truncate ll:max-w-44">
                {fPath(selectedFileId, codeState)}
              </span>
            </div>
            <div className="ll-crow ll:flex ll:items-baseline ll:justify-between">
              <span className="ll:text-muted">Lines</span>
              <span className="ll:text-primary">{gen.lines.length}</span>
            </div>
            <div className="ll-crow ll:flex ll:items-baseline ll:justify-between">
              <span className="ll:text-muted">Size</span>
              <span className="ll:text-primary">
                {(new Blob([gen.text]).size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
        </section>

        {/* Section 3: Props */}
        {isComp && (
          <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:p-4 ll:border-b ll:border-border">
            <div className="ll-dtitle ll:flex ll:items-center ll:justify-between">
              <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Props</h3>
              <button
                type="button"
                aria-label="Add prop"
                title="Add prop"
                onClick={() => handleAddProp(selectedFileId)}
                className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:text-muted ll:hover:text-primary ll:cursor-pointer"
              >
                <Icon icon={Plus} size={12} />
              </button>
            </div>
            <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
              {currentProps.map((p) => (
                <div key={p.id} className="ll:flex ll:items-center ll:gap-1.5">
                  <div className="ll-dfield ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:flex ll:items-center">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        setCompProps((prev) => ({
                          ...prev,
                          [selectedFileId]: (prev[selectedFileId] || []).map((x) =>
                            x.id === p.id ? { ...x, name: nextName } : x
                          ),
                        }));
                      }}
                      className="ll:w-full ll:bg-transparent ll:border-0 ll:outline-none ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                    />
                  </div>
                  <select
                    value={p.type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setCompProps((prev) => ({
                        ...prev,
                        [selectedFileId]: (prev[selectedFileId] || []).map((x) =>
                          x.id === p.id ? { ...x, type: nextType } : x
                        ),
                      }));
                    }}
                    className="ll:w-24 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="node">node</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Remove prop"
                    onClick={() => handleRemoveProp(selectedFileId, p.id)}
                    className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:bg-transparent ll:border-0 ll:text-muted ll:hover:text-primary ll:cursor-pointer"
                  >
                    <Icon icon={X} size={11} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 4: Dependencies */}
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:p-4 ll:border-b ll:border-border">
          <div className="ll-dtitle ll:flex ll:items-center ll:justify-between">
            <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Dependencies</h3>
          </div>
          <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
            <div className="ll:flex ll:flex-col ll:gap-1">
              {gen.deps.length === 0 ? (
                <p className="ll:font-sans ll:text-small ll:text-muted ll:m-0">
                  No packages imported.
                </p>
              ) : (
                gen.deps.map((d) => (
                  <div key={d} className="ll:flex ll:items-center ll:justify-between ll:font-mono ll:text-micro">
                    <span className="ll:text-primary">{d}</span>
                  </div>
                ))
              )}
            </div>

            <div className="ll-dfield ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:focus-within:border-primary ll:rounded-sm ll:flex ll:items-center">
              <input
                type="text"
                value={newDepInput}
                onChange={(e) => setNewDepInput(e.target.value)}
                onKeyDown={handleAddDependency}
                placeholder="Add a package, press Enter"
                aria-label="Add dependency"
                autoComplete="off"
                spellCheck={false}
                className="ll:w-full ll:bg-transparent ll:border-0 ll:outline-none ll:font-mono ll:text-micro ll:text-primary ll:placeholder:text-muted ll:p-0"
              />
            </div>
          </div>
        </section>

        {/* Section 5: Actions */}
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:p-4">
          <div className="ll:grid ll:grid-cols-2 ll:gap-2">
            <button
              type="button"
              className="ll-btn ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer"
            >
              Open to the side
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(fPath(selectedFileId, codeState));
                }
              }}
              className="ll-btn ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer"
            >
              Copy path
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([gen.text], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = fName(selectedFileId, codeState);
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="ll-btn ll:w-full ll:h-7 ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer"
          >
            <Icon icon={Download} size={13} className="ll:text-muted" />
            <span>Download {fName(selectedFileId, codeState)}</span>
          </button>
        </section>
      </div>
    );
  }

  // 3. RENDER: PROJECT STATE (Default when no layer or file is selected)
  return (
    <div
      id="ins-code"
      role="region"
      aria-label="Code Inspector"
      data-k="project"
      className={`ll-code-inspector ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
      style={style}
    >
      {/* Header (.rtop in prototype: height 44px) */}
      <div className="ll-rtop ll:h-11 ll:shrink-0 ll:flex ll:items-center ll:gap-2 ll:px-4 ll:border-b ll:border-border">
        <Icon icon={Code} size={16} className="ll:text-primary" />
        <span className="ll-rname ll:font-sans ll:text-body ll:font-semibold ll:text-primary">
          Project
        </span>
        <div className="ll:flex-1" />
        <span className="ll-rsub ll:font-mono ll:text-micro ll:text-muted">
          MyProject
        </span>
      </div>

      {/* Section 1: Framework */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Framework</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2.5">
          {/* Target Format: React / HTML / Vue */}
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:font-sans ll:text-small ll:text-muted ll:w-20">Output</span>
            <div
              role="group"
              aria-label="Output format"
              className="ll-seg ll:flex-1 ll:flex ll:items-center ll:gap-0.5 ll:p-0.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm"
            >
              {TARGET_OPTIONS.map((t) => {
                const isSelected = currentTargetLib === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleTargetChange(t)}
                    className={`ll:flex-1 ll:h-6 ll:rounded-xs ll:font-sans ll:text-micro ll:font-medium ll:border-0 ll:cursor-pointer ll:transition-colors ${
                      isSelected
                        ? "ll:bg-control-active ll:text-primary"
                        : "ll:bg-transparent ll:text-muted ll:hover:text-primary"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Framework dropdown */}
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:font-sans ll:text-small ll:text-muted ll:w-20">Framework</span>
            <select
              value={fw}
              onChange={(e) => setFw(e.target.value as FrameworkKey)}
              aria-label="Framework"
              className="ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:font-sans ll:text-small ll:text-primary ll:outline-none"
            >
              {FWS_BY_TARGET[currentTargetLib].map((k) => (
                <option key={k} value={k}>
                  {FRAMEWORKS[k].n}
                </option>
              ))}
            </select>
          </div>

          {/* Styling dropdown */}
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:font-sans ll:text-small ll:text-muted ll:w-20">Styling</span>
            <select
              value={sty}
              onChange={(e) => handleStyleChange(e.target.value as StylingKey)}
              aria-label="Styling"
              className="ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:font-sans ll:text-small ll:text-primary ll:outline-none"
            >
              <option value="tw">{STYLINGS.tw}</option>
              <option value="mod">{STYLINGS.mod}</option>
              <option value="inline">{STYLINGS.inline}</option>
            </select>
          </div>

          {/* Animation dropdown */}
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:font-sans ll:text-small ll:text-muted ll:w-20">Animation</span>
            <select
              value={anim}
              onChange={(e) => setAnim(e.target.value as AnimationKey)}
              aria-label="Animation engine"
              className="ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:font-sans ll:text-small ll:text-primary ll:outline-none"
            >
              <option value="none">{ANIMATIONS.none}</option>
              <option value="css">{ANIMATIONS.css}</option>
              {currentTargetLib === "React" && <option value="fm">{ANIMATIONS.fm}</option>}
              <option value="gsap">{ANIMATIONS.gsap}</option>
            </select>
          </div>

          {/* TypeScript checkbox */}
          <label className="ll:flex ll:items-center ll:gap-2 ll:cursor-pointer ll:mt-1">
            <input
              type="checkbox"
              checked={ts}
              onChange={(e) => setTs(e.target.checked)}
              aria-label="TypeScript"
              className="ll:accent-primary ll:cursor-pointer"
            />
            <span className="ll:font-sans ll:text-small ll:text-primary">TypeScript</span>
          </label>
        </div>
      </section>

      {/* Section 2: Output */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:p-4 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Output</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:font-mono ll:text-micro">
          <div className="ll-crow ll:flex ll:items-baseline ll:justify-between">
            <span className="ll:text-muted">Files</span>
            <span className="ll:text-primary">{cxFiles(codeState).length}</span>
          </div>
          <div className="ll-crow ll:flex ll:items-baseline ll:justify-between">
            <span className="ll:text-muted">Total size</span>
            <span className="ll:text-primary">{cxKB(cxSize(codeState))}</span>
          </div>
          <div className="ll-crow ll:flex ll:items-baseline ll:justify-between">
            <span className="ll:text-muted">Dependencies</span>
            <span className="ll:text-primary">{cxGen("pkg", codeState).deps.length}</span>
          </div>
          <div className="ll-cdeps ll:text-muted ll:font-mono ll:text-micro ll:break-words ll:mt-1">
            {cxGen("pkg", codeState).deps.join(", ")}
          </div>
        </div>
      </section>

      {/* Section 3: Export */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2.5 ll:p-4">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Export</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Export File */}
          <button
            type="button"
            onClick={() => {
              const gen = cxGen("hero", codeState);
              const blob = new Blob([gen.text], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = fName("hero", codeState);
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="ll-btn ll:w-full ll:h-7 ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer"
          >
            <Icon icon={Download} size={13} className="ll:text-muted" />
            <span>Export file</span>
          </button>

          {/* Export Repo (.zip) with progress bar matching P lines 6599-6604 */}
          {isExporting ? (
            <div role="status" className="ll-xprog ll:flex ll:flex-col ll:gap-1.5 ll:p-2 ll:bg-surface-bar ll:rounded-sm">
              <div className="ll:flex ll:items-center ll:justify-between ll:font-sans ll:text-micro">
                <span className="ll:text-primary">Packing files for export...</span>
                <span className="ll:font-mono ll:text-muted">{Math.round(exportProgress)}%</span>
              </div>
              <div className="ll-xbar ll:h-0.5 ll:w-full ll:bg-border ll:rounded-xs ll:overflow-hidden">
                <div
                  className="ll:h-full ll:bg-primary ll:transition-all ll:duration-100"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              {exportDone && (
                <div role="status" className="ll-xdone ll:flex ll:items-center ll:gap-2 ll:font-sans ll:text-small ll:text-primary">
                  <Icon icon={Check} size={14} className="ll:text-primary" />
                  <span>
                    my-project.zip · {exportDone.n} files · {exportDone.sz}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={handleExportRepo}
                className="ll-btn ll:w-full ll:h-8 ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:bg-control-primary-bg ll:text-control-primary-fg ll:border-0 ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:cursor-pointer"
              >
                <Icon icon={Download} size={14} />
                <span>Export repo (.zip)</span>
              </button>
            </>
          )}

          {/* Copy install command */}
          <button
            type="button"
            onClick={handleCopyInstallCmd}
            className="ll-btn ll:w-full ll:h-7 ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer"
          >
            <Icon icon={Copy} size={13} className="ll:text-muted" />
            <span>{copiedCmd ? "Copied" : "Copy install command"}</span>
          </button>

          <code className="ll-cinst ll:block ll:p-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-micro ll:text-secondary ll:break-all">
            {installCmdStr}
          </code>
        </div>
      </section>
    </div>
  );
};

export default CodeInspector;

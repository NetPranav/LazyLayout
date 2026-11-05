"use client";

import React, { useState } from "react";
import { CodePanel } from "@/editor/panels/code-view/CodePanel";
import { CodeInspector } from "@/editor/panels/code-view/CodeInspector";
import { ConsoleView } from "@/editor/panels/code-view/ConsoleView";
import { TraceView } from "@/editor/panels/code-view/TraceView";
import { BlueprintCanvas } from "@/editor/panels/blueprint/BlueprintCanvas";

/**
 * 1. CodePanel Demo - Code view state
 */
export const CodePanelCodeDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
      <CodePanel activeTab="code" />
    </div>
  );
};

/**
 * 2. CodePanel Demo - Console view state
 */
export const CodePanelConsoleDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
      <CodePanel activeTab="console" />
    </div>
  );
};

/**
 * 3. CodePanel Demo - Trace view state
 */
export const CodePanelTraceDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
      <CodePanel activeTab="trace" />
    </div>
  );
};

/**
 * 4. CodeInspector Demo - Project state
 */
export const CodeInspectorProjectDemo: React.FC = () => {
  return (
    <div className="ll:w-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-panel">
      <CodeInspector />
    </div>
  );
};

/**
 * 5. CodeInspector Demo - File state
 */
export const CodeInspectorFileDemo: React.FC = () => {
  return (
    <div className="ll:w-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-panel">
      <CodeInspector componentName="Hero" exportType="named" targetLib="React" styleType="Tailwind" />
    </div>
  );
};

/**
 * 6. CodeInspector Demo - Layer state
 */
export const CodeInspectorLayerDemo: React.FC = () => {
  return (
    <div className="ll:w-80 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-panel">
      <CodeInspector componentName="Headline" />
    </div>
  );
};

/**
 * 7. Console standalone view demo
 */
export const ConsoleViewDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-72 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
      <ConsoleView />
    </div>
  );
};

/**
 * 8. Trace standalone view demo
 */
export const TraceViewDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-72 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
      <TraceView />
    </div>
  );
};

/**
 * 9. Logic Coming-soon Page Shell Demo
 */
export const LogicComingSoonDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-72 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
      <BlueprintCanvas mode="Logic" />
    </div>
  );
};

/**
 * 10. Data Coming-soon Page Shell Demo
 */
export const DataComingSoonDemo: React.FC = () => {
  return (
    <div className="ll:w-full ll:h-72 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
      <BlueprintCanvas mode="Data" />
    </div>
  );
};

/**
 * Composite full gallery of all Code mode components and states
 */
export const CodeModeDemos: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("panel");

  return (
    <div className="ll:flex ll:flex-col ll:gap-6 ll:p-6 ll:bg-surface-canvas">
      <div className="ll:flex ll:items-center ll:gap-2 ll:border-b ll:border-border ll:pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("panel")}
          className={`ll:px-3 ll:py-1.5 ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ${
            activeTab === "panel" ? "ll:bg-control-primary-bg ll:text-control-primary-fg" : "ll:bg-surface-bar ll:text-muted"
          }`}
        >
          Bottom Panel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inspector")}
          className={`ll:px-3 ll:py-1.5 ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ${
            activeTab === "inspector" ? "ll:bg-control-primary-bg ll:text-control-primary-fg" : "ll:bg-surface-bar ll:text-muted"
          }`}
        >
          Right Inspector
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("comingsoon")}
          className={`ll:px-3 ll:py-1.5 ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ${
            activeTab === "comingsoon" ? "ll:bg-control-primary-bg ll:text-control-primary-fg" : "ll:bg-surface-bar ll:text-muted"
          }`}
        >
          Coming Soon Shells
        </button>
      </div>

      {activeTab === "panel" && (
        <div className="ll:flex ll:flex-col ll:gap-6">
          <div>
            <h4 className="ll:font-sans ll:text-body ll:font-semibold ll:text-primary ll:mb-2">Code View</h4>
            <CodePanelCodeDemo />
          </div>
          <div>
            <h4 className="ll:font-sans ll:text-body ll:font-semibold ll:text-primary ll:mb-2">Console View</h4>
            <CodePanelConsoleDemo />
          </div>
          <div>
            <h4 className="ll:font-sans ll:text-body ll:font-semibold ll:text-primary ll:mb-2">Execution Trace</h4>
            <CodePanelTraceDemo />
          </div>
        </div>
      )}

      {activeTab === "inspector" && (
        <div className="ll:flex ll:gap-6 ll:flex-wrap">
          <div>
            <h4 className="ll:font-sans ll:text-body ll:font-semibold ll:text-primary ll:mb-2">Project State</h4>
            <CodeInspectorProjectDemo />
          </div>
          <div>
            <h4 className="ll:font-sans ll:text-body ll:font-semibold ll:text-primary ll:mb-2">File State</h4>
            <CodeInspectorFileDemo />
          </div>
        </div>
      )}

      {activeTab === "comingsoon" && (
        <div className="ll:flex ll:flex-col ll:gap-6">
          <div>
            <h4 className="ll:font-sans ll:text-body ll:font-semibold ll:text-primary ll:mb-2">Logic Shell</h4>
            <LogicComingSoonDemo />
          </div>
          <div>
            <h4 className="ll:font-sans ll:text-body ll:font-semibold ll:text-primary ll:mb-2">Data Shell</h4>
            <DataComingSoonDemo />
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeModeDemos;

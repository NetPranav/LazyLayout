"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { TopBar, PreviewButton } from "../../components/TopBar";
import { LogoMark } from "../../components/LogoMark";
import { type EditorMode } from "../../components/ModeTabs";
import { type ShipIssue } from "../../components/ShipPopover";
import {
  SAVE_DURATION_MS,
} from "../../components/topbar-constants";

const DEMO_ISSUES: readonly ShipIssue[] = [
  { id: "alt", title: "Hero image has no alt text" },
  { id: "contrast", title: "Button contrast is 3.9:1" },
];

/**
 * Task B8 TopBar demos:
 * 1. Default state with Preview button (disabled with "Preview is not designed yet" when no handler is provided).
 * 2. TopBar with Preview button enabled (active onPreview callback provided).
 * 3. Trace loader saving state: back-and-forth outline draw/undraw, fill hidden, no opacity blink, sr-only status text.
 * 4. Interactive 3.2s save simulation.
 * 5. LogoMark standalone states (static, saving trace, reduced-motion pulse).
 */
export function B8Demos() {
  const [mode, setMode] = useState<EditorMode>("design");
  const [issues, setIssues] = useState<readonly ShipIssue[]>(DEMO_ISSUES);
  const [previewClickCount, setPreviewClickCount] = useState(0);

  // Interactive 3.2s save simulation state
  const [isSimulatingSave, setIsSimulatingSave] = useState(false);
  const [saveStatusState, setSaveStatusState] = useState<"saved" | "saving">("saved");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSimulateSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setIsSimulatingSave(true);
    setSaveStatusState("saving");

    saveTimerRef.current = setTimeout(() => {
      setIsSimulatingSave(false);
      setSaveStatusState("saved");
      saveTimerRef.current = null;
    }, SAVE_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="ll:flex ll:flex-col ll:gap-10 ll:font-sans" data-testid="b8-demos">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary">
          B8: Top Bar &mdash; Preview Button &amp; Trace Loader
        </h2>
        <p className="ll:text-small ll:text-muted ll:mt-1">
          Apple-level top bar with 32x32 Preview button left of Ship, and infinite back-and-forth
          logo outline trace loader during saves (one save = 3.2s, no opacity blink, sr-only status,
          no visible saving text or dot).
        </p>
      </div>

      {/* 1. Interactive 3.2s Save Simulation */}
      <div className="ll:flex ll:flex-col ll:gap-3">
        <div className="ll:flex ll:items-center ll:justify-between">
          <div>
            <span className="ll:text-small ll:font-medium ll:text-primary">
              1. Interactive Save Simulation (3.2s back-and-forth trace cycle)
            </span>
            <p className="ll:text-micro ll:text-muted">
              Click &quot;Simulate Save&quot; to test the 3.2s trace loader: logo outline draws and
              undraws back and forth alternate on a 1.6s bezier curve; fill stays hidden without
              opacity blink; sr-only role=&quot;status&quot; updates &quot;Saving&quot; &rarr;
              &quot;Saved&quot;.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSimulateSave}
            disabled={isSimulatingSave}
            data-testid="b8-simulate-save-btn"
            className="ll:h-7 ll:px-3 ll:rounded-sm ll:bg-control-primary ll:text-control-primary-fg ll:text-small ll:font-medium ll:border-0 ll:cursor-pointer ll:hover:opacity-90 ll:disabled:opacity-45 ll:disabled:cursor-not-allowed"
          >
            {isSimulatingSave ? "Saving (3.2s)..." : "Simulate Save"}
          </button>
        </div>

        <div className="ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
          <TopBar
            projectName="Save Simulation Project"
            saving={isSimulatingSave}
            saveStatus={saveStatusState}
            mode={mode}
            onSelectMode={setMode}
            issues={issues}
            onFixIssue={(id) => setIssues((prev) => prev.filter((i) => i.id !== id))}
          />
        </div>
      </div>

      {/* 2. TopBar with Preview Button Disabled (No Handler, Reason Tooltip) */}
      <div className="ll:flex ll:flex-col ll:gap-2">
        <span className="ll:text-small ll:font-medium ll:text-primary">
          2. TopBar with Preview Button (Disabled &mdash; No Engine Preview Mode)
        </span>
        <p className="ll:text-micro ll:text-muted">
          When no onPreview handler is provided, the Preview button left of Ship is disabled with
          the tooltip reason &quot;Preview is not designed yet&quot;.
        </p>
        <div className="ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
          <TopBar
            projectName="Preview Disabled Demo"
            saving={false}
            saveStatus="saved"
            mode={mode}
            onSelectMode={setMode}
            issues={issues}
          />
        </div>
      </div>

      {/* 3. TopBar with Preview Button Enabled */}
      <div className="ll:flex ll:flex-col ll:gap-2">
        <div className="ll:flex ll:items-center ll:justify-between">
          <div>
            <span className="ll:text-small ll:font-medium ll:text-primary">
              3. TopBar with Preview Button (Enabled &mdash; onPreview Provided)
            </span>
            <p className="ll:text-micro ll:text-muted">
              When an onPreview handler is provided, the button is enabled and clickable (clicks:{" "}
              {previewClickCount}).
            </p>
          </div>
        </div>
        <div className="ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
          <TopBar
            projectName="Preview Enabled Demo"
            saving={false}
            saveStatus="saved"
            mode={mode}
            onSelectMode={setMode}
            issues={issues}
            onPreview={() => setPreviewClickCount((c) => c + 1)}
          />
        </div>
      </div>

      {/* 4. TopBar in Active Saving State (Persistent Trace) */}
      <div className="ll:flex ll:flex-col ll:gap-2">
        <span className="ll:text-small ll:font-medium ll:text-primary">
          4. Persistent Saving State (Logo Trace Loader Active)
        </span>
        <p className="ll:text-micro ll:text-muted">
          Continuous saving state: outline draws 0 &rarr; 100 then undraws 100 &rarr; 0 back and
          forth. Fill is hidden while saving, no opacity blink, no visible saving text or dot.
        </p>
        <div className="ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
          <TopBar
            projectName="Continuous Saving Demo"
            saving={true}
            saveStatus="saving"
            mode={mode}
            onSelectMode={setMode}
            issues={issues}
          />
        </div>
      </div>

      {/* 5. Standalone Components: Preview Button & LogoMark */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-6">
        {/* Preview Button standalone states */}
        <div className="ll:flex ll:flex-col ll:gap-3 ll:p-5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
          <span className="ll:text-small ll:font-medium ll:text-primary">
            Preview Button (Standalone)
          </span>
          <p className="ll:text-micro ll:text-muted">
            32x32 button with 4px modest radius and 16px Play icon, matching prototype #previewbtn.
          </p>

          <div className="ll:flex ll:items-center ll:gap-6 ll:pt-2">
            <div className="ll:flex ll:flex-col ll:items-center ll:gap-1.5">
              <span className="ll:text-micro ll:font-medium ll:text-muted">Enabled</span>
              <PreviewButton id="previewbtn-enabled" data-testid="demo-preview-enabled"
                onPreview={() => setPreviewClickCount((c) => c + 1)}
              />
            </div>

            <div className="ll:flex ll:flex-col ll:items-center ll:gap-1.5">
              <span className="ll:text-micro ll:font-medium ll:text-muted">Disabled (Reason Tooltip)</span>
              <PreviewButton id="previewbtn-disabled" data-testid="demo-preview-disabled" />
            </div>
          </div>
        </div>

        {/* LogoMark standalone states */}
        <div className="ll:flex ll:flex-col ll:gap-3 ll:p-5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
          <span className="ll:text-small ll:font-medium ll:text-primary">
            LogoMark (Standalone States)
          </span>
          <p className="ll:text-micro ll:text-muted">
            Fill hidden during save. Outline draws/undraws back and forth on 1.6s bezier curve.
          </p>

          <div className="ll:flex ll:items-center ll:gap-6 ll:pt-2">
            <div className="ll:flex ll:flex-col ll:items-center ll:gap-1.5">
              <span className="ll:text-micro ll:font-medium ll:text-muted">Static (20px)</span>
              <div className="ll:w-8 ll:h-8 ll:grid ll:place-items-center">
                <LogoMark size={20} saving={false} data-testid="b8-logo-static" />
              </div>
            </div>

            <div className="ll:flex ll:flex-col ll:items-center ll:gap-1.5">
              <span className="ll:text-micro ll:font-medium ll:text-muted">Saving Trace (20px)</span>
              <div className="ll:w-8 ll:h-8 ll:grid ll:place-items-center">
                <LogoMark size={20} saving={true} data-testid="b8-logo-saving" />
              </div>
            </div>

            <div className="ll:flex ll:flex-col ll:items-center ll:gap-1.5">
              <span className="ll:text-micro ll:font-medium ll:text-muted">Large (32px)</span>
              <div className="ll:w-8 ll:h-8 ll:grid ll:place-items-center">
                <LogoMark size={32} saving={true} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

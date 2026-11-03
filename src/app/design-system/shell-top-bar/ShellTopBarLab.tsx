"use client";

import React, { useState } from "react";
import { TopBar, PageSwitcher, type EditorMode, type CollabUser } from "@/editor/components";

const SAMPLE_USERS: readonly CollabUser[] = [
  { id: "1", initials: "AP", name: "Adarsh Pathade", status: "Viewing" },
  { id: "2", initials: "RK", name: "Rina Kapoor", status: "Editing Hero" },
  { id: "3", initials: "SM", name: "Sam Mori", status: "Viewing" },
  { id: "4", initials: "JL", name: "Jun Lee", status: "Viewing" },
  { id: "5", initials: "TO", name: "Tara Osei", status: "Viewing" },
];

export function ShellTopBarLab() {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<EditorMode>("design");
  const [issues, setIssues] = useState([
    { id: "alt", title: "Hero image has no alt text" },
    { id: "contrast", title: "Button contrast is 3.9:1" },
  ]);
  const [page, setPage] = useState("Home");

  const handleFixIssue = (id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id));
  };

  const resetIssues = () => {
    setIssues([
      { id: "alt", title: "Hero image has no alt text" },
      { id: "contrast", title: "Button contrast is 3.9:1" },
    ]);
  };

  return (
    <div className="ll-lab-root ll:font-sans ll:w-screen ll:h-screen ll:bg-surface-backdrop ll:flex ll:items-center ll:justify-center ll:overflow-hidden ll:p-4">
      {/* 1440 x 900 Frame */}
      <div
        id="lab-frame"
        className="ll-lab-frame ll:max-w-full ll:max-h-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:flex ll:flex-col ll:overflow-hidden ll:relative"
      >
        {/* Real TopBar under test */}
        <TopBar
          projectName="MyProject"
          saving={saving}
          mode={mode}
          onSelectMode={setMode}
          issues={issues}
          onFixIssue={handleFixIssue}
          users={SAMPLE_USERS}
        />

        {/* Canvas area with verification controls and PageSwitcher */}
        <div className="ll:flex-1 ll:p-8 ll:flex ll:flex-col ll:gap-6 ll:overflow-y-auto">
          <div className="ll:flex ll:items-center ll:justify-between ll:border-b ll:border-border ll:pb-4">
            <div>
              <h2 className="ll:text-title ll:font-semibold ll:text-primary">
                TopBar Lab Verification Frame (1440 x 900)
              </h2>
              <p className="ll:text-small ll:text-secondary">
                Testing logo saving trace, mode tabs, theme toggle, ship popover, and page switcher.
              </p>
            </div>

            <div className="ll:flex ll:items-center ll:gap-3">
              <button
                type="button"
                id="btn-toggle-saving"
                onClick={() => setSaving((prev) => !prev)}
                className="ll:h-8 ll:px-3 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:text-small ll:font-medium ll:text-primary ll:hover:bg-surface-panel ll:cursor-pointer ll:outline-none"
              >
                {saving ? "Stop Saving Trace" : "Trigger Saving Trace"}
              </button>

              <button
                type="button"
                id="btn-toggle-issues"
                onClick={() => (issues.length ? setIssues([]) : resetIssues())}
                className="ll:h-8 ll:px-3 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:text-small ll:font-medium ll:text-primary ll:hover:bg-surface-panel ll:cursor-pointer ll:outline-none"
              >
                {issues.length ? "Set Ready (0 issues)" : "Set 2 Issues"}
              </button>
            </div>
          </div>

          <div className="ll:grid ll:grid-cols-2 ll:gap-6">
            <div className="ll:bg-surface-panel ll:p-6 ll:border ll:border-border ll:rounded-md ll:flex ll:flex-col ll:gap-3">
              <span className="ll:text-small ll:font-semibold ll:text-primary">
                PageSwitcher Standalone Component
              </span>
              <p className="ll:text-small ll:text-secondary">
                Searchable select-style trigger for left panel header (Queue item 2):
              </p>
              <div className="ll:w-fit ll:bg-surface-bar ll:px-2 ll:py-1 ll:border ll:border-border ll:rounded-sm">
                <PageSwitcher
                  currentPage={page}
                  onSelectPage={setPage}
                  onNewPage={() => setPage("New Untitled Page")}
                />
              </div>
              <span className="ll:text-micro ll:text-muted">
                Active page: <strong className="ll:text-primary">{page}</strong>
              </span>
            </div>

            <div className="ll:bg-surface-panel ll:p-6 ll:border ll:border-border ll:rounded-md ll:flex ll:flex-col ll:gap-3">
              <span className="ll:text-small ll:font-semibold ll:text-primary">
                Current TopBar State
              </span>
              <div className="ll:flex ll:flex-col ll:gap-1.5 ll:text-small ll:text-secondary">
                <div>
                  Mode: <strong className="ll:text-primary">{mode}</strong>
                </div>
                <div>
                  Saving:{" "}
                  <strong className="ll:text-primary">
                    {saving ? "True (tracing outline)" : "False (idle)"}
                  </strong>
                </div>
                <div>
                  Ship issues count:{" "}
                  <strong className="ll:text-primary">
                    {issues.length} {issues.length === 0 ? "(Ready)" : ""}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

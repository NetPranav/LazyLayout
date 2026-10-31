import React from "react";

export interface WorkspaceFrameProps {
  className?: string;
}

export function WorkspaceFrame({ className = "" }: WorkspaceFrameProps) {
  return (
    <div
      aria-label="Application workspace preview"
      className={`ll:w-full ll:h-72 ll:sm:h-80 ll:md:h-96 ll:rounded-lg ll:border ll:border-border ll:shadow-soft ll:overflow-hidden ll:flex ll:flex-col ll:bg-surface-canvas ${className}`}
    >
      {/* Real Layer 1: Toolbar (surface-bar on top) */}
      <div
        aria-label="Toolbar layer"
        className="ll:h-10 ll:w-full ll:bg-surface-bar ll:border-b ll:border-border ll:px-3 ll:sm:px-4 ll:flex ll:items-center ll:justify-between ll:shrink-0"
      >
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary ll:truncate">
          Toolbar — surface-bar
        </span>
        <div className="ll:flex ll:items-center ll:gap-2 ll:shrink-0">
          <button
            type="button"
            className="ll:h-6 ll:px-2.5 ll:rounded-sm ll:border ll:border-border ll:bg-surface-raised ll:text-micro ll:font-medium ll:text-primary ll:flex ll:items-center ll:justify-center"
          >
            Export
          </button>
          <button
            type="button"
            className="ll:h-6 ll:px-2.5 ll:rounded-sm ll:bg-control-primary ll:text-micro ll:font-medium ll:text-control-primary-fg ll:flex ll:items-center ll:justify-center"
          >
            Preview
          </button>
        </div>
      </div>

      {/* Workspace body: Rail, Panel, and Canvas */}
      <div className="ll:flex-1 ll:flex ll:overflow-hidden ll:min-w-0">
        {/* Real Layer 2a: Rail (surface-panel) */}
        <div
          aria-label="Side rail"
          className="ll:w-10 ll:sm:w-12 ll:h-full ll:bg-surface-panel ll:border-r ll:border-border ll:shrink-0 ll:flex ll:flex-col ll:items-center ll:py-3 ll:gap-2"
        >
          <div className="ll:w-6 ll:h-6 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border" />
          <div className="ll:w-6 ll:h-6 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border" />
        </div>

        {/* Real Layer 2b: Panel (surface-panel) */}
        <div
          aria-label="Panel"
          className="ll:hidden ll:sm:flex ll:sm:w-44 ll:md:w-52 ll:h-full ll:bg-surface-panel ll:border-r ll:border-border ll:shrink-0 ll:p-2 ll:sm:p-3 ll:flex-col ll:gap-2 ll:overflow-hidden"
        >
          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary ll:truncate">
            Panel — surface-panel
          </span>
          <div className="ll:w-full ll:h-7 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:px-2 ll:flex ll:items-center">
            <span className="ll:text-micro ll:text-secondary ll:truncate">Inspector</span>
          </div>
          <div className="ll:w-full ll:h-7 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:px-2 ll:flex ll:items-center">
            <span className="ll:text-micro ll:text-secondary ll:truncate">Timeline</span>
          </div>
        </div>

        {/* Real Layer 3: Canvas (surface-canvas) */}
        <div
          aria-label="Canvas"
          className="ll:flex-1 ll:min-w-0 ll:h-full ll:bg-surface-canvas ll:p-2 ll:sm:p-4 ll:md:p-6 ll:flex ll:items-center ll:justify-center ll:overflow-hidden"
        >
          {/* Real Layer 4: Raised card (surface-raised) on canvas - fluid max-w-xs */}
          <div
            aria-label="Raised card surface"
            className="ll:w-full ll:max-w-xs ll:p-3 ll:sm:p-4 ll:rounded-md ll:bg-surface-raised ll:border ll:border-border ll:shadow-soft ll:flex ll:flex-col ll:gap-2 ll:sm:gap-3 ll:min-w-0"
          >
            <div className="ll:flex ll:flex-col ll:gap-1 ll:min-w-0">
              <span className="ll:text-body ll:font-semibold ll:text-primary ll:truncate">
                Raised Card (surface-raised)
              </span>
              <span className="ll:text-small ll:text-secondary ll:truncate">
                Surface on surface-canvas
              </span>
            </div>

            {/* Real Layer 5: Active control (control-primary with control-primary-fg text) */}
            <div
              aria-label="Active control"
              className="ll:w-full ll:h-8 ll:sm:h-9 ll:rounded-sm ll:bg-control-primary ll:text-control-primary-fg ll:text-small ll:font-medium ll:flex ll:items-center ll:justify-center ll:text-center ll:px-2 ll:truncate"
            >
              Active Control (control-primary)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";

export interface WorkspaceFrameProps {
  className?: string;
}

export function WorkspaceFrame({ className = "" }: WorkspaceFrameProps) {
  return (
    <div
      aria-label="Application workspace preview"
      className={`ll:w-full ll:h-72 ll:sm:h-80 ll:md:h-96 ll:rounded-lg ll:border ll:border-border ll:shadow-soft ll:overflow-hidden ll:flex ll:flex-col ll:bg-neutral-100 ${className}`}
    >
      {/* Real Layer 1: Toolbar (neutral-50 on top) */}
      <div
        aria-label="Toolbar layer"
        className="ll:h-10 ll:w-full ll:bg-neutral-50 ll:border-b ll:border-border ll:px-3 ll:sm:px-4 ll:flex ll:items-center ll:justify-between ll:shrink-0"
      >
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800 ll:truncate">
          Toolbar — neutral-50
        </span>
        <div className="ll:flex ll:items-center ll:gap-2 ll:shrink-0">
          <button
            type="button"
            className="ll:h-6 ll:px-2.5 ll:rounded-sm ll:border ll:border-border ll:bg-neutral-0 ll:text-micro ll:font-medium ll:text-neutral-1000 ll:flex ll:items-center ll:justify-center"
          >
            Export
          </button>
          <button
            type="button"
            className="ll:h-6 ll:px-2.5 ll:rounded-sm ll:bg-neutral-1000 ll:text-micro ll:font-medium ll:text-neutral-0 ll:flex ll:items-center ll:justify-center"
          >
            Preview
          </button>
        </div>
      </div>

      {/* Workspace body: Rail, Panel, and Canvas */}
      <div className="ll:flex-1 ll:flex ll:overflow-hidden ll:min-w-0">
        {/* Real Layer 2a: Rail (neutral-200) */}
        <div
          aria-label="Side rail"
          className="ll:w-10 ll:sm:w-12 ll:h-full ll:bg-neutral-200 ll:border-r ll:border-border ll:shrink-0 ll:flex ll:flex-col ll:items-center ll:py-3 ll:gap-2"
        >
          <div className="ll:w-6 ll:h-6 ll:rounded-sm ll:bg-neutral-100 ll:border ll:border-border" />
          <div className="ll:w-6 ll:h-6 ll:rounded-sm ll:bg-neutral-100 ll:border ll:border-border" />
        </div>

        {/* Real Layer 2b: Panel (neutral-200) */}
        <div
          aria-label="Panel"
          className="ll:hidden ll:sm:flex ll:sm:w-44 ll:md:w-52 ll:h-full ll:bg-neutral-200 ll:border-r ll:border-border ll:shrink-0 ll:p-2 ll:sm:p-3 ll:flex-col ll:gap-2 ll:overflow-hidden"
        >
          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800 ll:truncate">
            Panel — neutral-200
          </span>
          <div className="ll:w-full ll:h-7 ll:rounded-sm ll:bg-neutral-100 ll:border ll:border-border ll:px-2 ll:flex ll:items-center">
            <span className="ll:text-micro ll:text-neutral-800 ll:truncate">Inspector</span>
          </div>
          <div className="ll:w-full ll:h-7 ll:rounded-sm ll:bg-neutral-100 ll:border ll:border-border ll:px-2 ll:flex ll:items-center">
            <span className="ll:text-micro ll:text-neutral-800 ll:truncate">Timeline</span>
          </div>
        </div>

        {/* Real Layer 3: Canvas (neutral-100) */}
        <div
          aria-label="Canvas"
          className="ll:flex-1 ll:min-w-0 ll:h-full ll:bg-neutral-100 ll:p-2 ll:sm:p-4 ll:md:p-6 ll:flex ll:items-center ll:justify-center ll:overflow-hidden"
        >
          {/* Real Layer 4: Raised white card (neutral-0) on canvas - fluid max-w-xs, no fixed w-64 */}
          <div
            aria-label="Raised card surface"
            className="ll:w-full ll:max-w-xs ll:p-3 ll:sm:p-4 ll:rounded-md ll:bg-neutral-0 ll:border ll:border-border ll:shadow-soft ll:flex ll:flex-col ll:gap-2 ll:sm:gap-3 ll:min-w-0"
          >
            <div className="ll:flex ll:flex-col ll:gap-1 ll:min-w-0">
              <span className="ll:text-body ll:font-semibold ll:text-neutral-1000 ll:truncate">
                Raised Card (neutral-0)
              </span>
              <span className="ll:text-small ll:text-neutral-800 ll:truncate">
                White surface on neutral-100 canvas
              </span>
            </div>

            {/* Real Layer 5: Black active control (neutral-1000 with neutral-0 text) */}
            <div
              aria-label="Active control"
              className="ll:w-full ll:h-8 ll:sm:h-9 ll:rounded-sm ll:bg-neutral-1000 ll:text-neutral-0 ll:text-small ll:font-medium ll:flex ll:items-center ll:justify-center ll:text-center ll:px-2 ll:truncate"
            >
              Active Control (neutral-1000)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

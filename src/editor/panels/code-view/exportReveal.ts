/** Id of the Export section in the Code inspector (the right sidebar): the toolbar's Export button points at it. */
export const EXPORT_SECTION_ID = "ll-export-section";

/** Fired by `revealExportSection`. The shell opens the right sidebar; the section scrolls into view and pulses. */
export const REVEAL_EXPORT_EVENT = "ll:reveal-export";

/** Shows the Export section in the right sidebar: opens the sidebar if it is collapsed, scrolls to the section, pulses it. */
export function revealExportSection(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REVEAL_EXPORT_EVENT));
}

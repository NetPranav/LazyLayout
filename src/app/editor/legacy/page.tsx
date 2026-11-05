"use client";

/**
 * ============================================================================
 * LEGACY EDITOR STUDIO PAGE (/editor/legacy)
 * ============================================================================
 * Serves the old dock-based editor with all features from origin/main
 * (pen tool, auto layout, breakpoints, tokens, etc.) until the new UI
 * has screens for those features.
 * ============================================================================
 */

import "@/legacy-editor/styles/globals.css";
import { EditorShell } from "@/legacy-editor/shell/EditorShell";
import { LegacyStudioHeader } from "./LegacyStudioHeader";

export default function LegacyEditorPage() {
  return <EditorShell headerSlot={<LegacyStudioHeader />} />;
}

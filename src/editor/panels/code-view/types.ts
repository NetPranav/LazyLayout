/**
 * Types for Code View, Code Inspector, and Console panels.
 */

import type React from "react";
import type { EmittedFile } from "@/core/types/compiler";

export type CodeTab = "code" | "console";

export interface CodeFileTab {
  id: string;
  name: string;
  language: "tsx" | "typescript" | "javascript" | "css" | "prisma" | "markdown" | "json";
  content: string;
  icon?: React.ReactNode;
}

export interface CodePanelProps {
  /** Active primary tab: code viewer or console stream */
  activeTab?: CodeTab;
  /** Callback when switching between code and console */
  onTabChange?: (tab: CodeTab) => void;
  /** Active file ID among code tabs */
  activeFileId?: string;
  /** Callback when switching active file */
  onSelectFile?: (fileId: string) => void;
  /** Custom files to display in the tabs strip */
  files?: CodeFileTab[];
  /** Code content override for the active view */
  code?: string;
  /** Active file name label */
  fileName?: string;
  /** Highlighted line index (0-based) for bidirectional AST sync */
  highlightedLine?: number | null;
  /** Line click handler for code-to-AST navigation */
  onLineClick?: (lineIndex: number, lineText: string) => void;
  /** Copy action handler */
  onCopy?: (code: string) => void;
  /** Export / download action handler */
  onExport?: (fileName: string, code: string) => void;
  /** Additional CSS class names */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
}

export interface CodePropItem {
  id: string;
  name: string;
  type: string;
}

export interface CodeInspectorProps {
  /** Active component name */
  componentName?: string;
  /** Callback when component name changes */
  onComponentNameChange?: (name: string) => void;
  /** Export type: named or default */
  exportType?: "named" | "default";
  /** Callback when export type changes */
  onExportTypeChange?: (type: "named" | "default") => void;
  /** Target library / framework: React, HTML, Vue */
  targetLib?: "React" | "HTML" | "Vue";
  /** Callback when target library changes */
  onTargetLibChange?: (lib: "React" | "HTML" | "Vue") => void;
  /** Style strategy: CSS modules, Tailwind, Inline */
  styleType?: "CSS modules" | "Tailwind" | "Inline";
  /** Callback when style strategy changes */
  onStyleTypeChange?: (type: "CSS modules" | "Tailwind" | "Inline") => void;
  /** List of component props */
  propsList?: CodePropItem[];
  /** Callback when adding a prop */
  onAddProp?: (name: string, type: string) => void;
  /** Callback when removing a prop */
  onRemoveProp?: (id: string) => void;
  /** Dependencies list */
  dependencies?: string[];
  /** Callback when adding a dependency package */
  onAddDependency?: (pkg: string) => void;
  /** Callback when removing a dependency package */
  onRemoveDependency?: (pkg: string) => void;
  /** Output file name */
  outputFile?: string;
  /** Callback when output file changes */
  onOutputFileChange?: (file: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}

export interface ConsoleLogEntry {
  id: string;
  time: string;
  category: "all" | "blueprint" | "database" | "api" | "compiler" | "warning" | "error";
  level: "info" | "warn" | "error" | "success" | "bp";
  badge: string;
  message: string;
  timing?: string;
}

export interface ConsoleViewProps {
  /** Initial logs list */
  initialLogs?: ConsoleLogEntry[];
  /** Callback when CLI command is executed */
  onCommand?: (command: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}

export interface LiveCodeInspectorProps {
  className?: string;
  style?: React.CSSProperties;
  /** External files override instead of full project compilation */
  files?: EmittedFile[];
  /** Controlled active file path */
  selectedFilePath?: string;
  /** Callback when selecting a file */
  onSelectFilePath?: (path: string) => void;
}

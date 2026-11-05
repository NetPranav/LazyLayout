"use client";

import React, { useState, useMemo } from "react";
import { X, Copy, Check, Download } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import {
  EXPORT_FORMATS,
  type ExportFormat,
} from "./motionExport";
import { useMotionModel } from "@/editor/motion-model";

export interface MotionExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const FORMAT_TABS = [
  { value: "css", label: "CSS" },
  { value: "waapi", label: "WAAPI" },
  { value: "fm", label: "Framer Motion" },
  { value: "gsap", label: "GSAP" },
];

function highlightCode(src: string): string {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|((?<![\w-])(?:import|from|export|const|function|return|new|if|true|false|type|void|number)(?![\w-])|@keyframes|@media)|((?<![\w])-?\d*\.?\d+(?:px|ms|s|deg|%)?)/g,
    (m, c, q, k) => {
      if (c) return `<span class="c">${c}</span>`;
      if (q) return `<span class="s">${q}</span>`;
      if (k) return `<span class="k">${k}</span>`;
      return `<span class="n">${m}</span>`;
    }
  );
}

export const MotionExportModal: React.FC<MotionExportModalProps> = ({
  isOpen,
  onClose,
  className = "",
}) => {
  const [format, setFormat] = useState<ExportFormat>("css");
  const [copied, setCopied] = useState(false);
  const comp = useMotionModel((s) => s.comp);

  const meta = EXPORT_FORMATS[format];
  const generatedCode = useMemo(() => meta.gen(comp), [meta, comp]);

  const lineCount = useMemo(() => generatedCode.split("\n").length, [generatedCode]);
  const byteSize = useMemo(() => {
    const bytes = new Blob([generatedCode]).size;
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  }, [generatedCode]);

  const highlightedHtml = useMemo(() => highlightCode(generatedCode), [generatedCode]);

  if (!isOpen) return null;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lazy-layout-animation.${meta.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      role="dialog"
      aria-label="Export animation"
      className={`ll-ppop ll-xpop ll:fixed ll:z-50 ll:flex ll:flex-col ll:bg-surface-float ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:overflow-hidden ${className}`}
      style={{
        width: "520px",
        maxWidth: "calc(100vw - 16px)",
      }}
    >
      {/* Header */}
      <div className="ll:flex ll:items-center ll:justify-between ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <span className="ll:text-body ll:font-semibold ll:text-primary">
          Export animation
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="ll:size-6 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:transition-colors"
        >
          <Icon icon={X} size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="ll:p-4 ll:flex ll:flex-col ll:gap-3">
        {/* Format Selector */}
        <SegmentedControl
          size="sm"
          ariaLabel="Format"
          value={format}
          onChange={(v) => setFormat(v as ExportFormat)}
          options={FORMAT_TABS}
        />

        {/* Code View */}
        <pre
          className="ll-xcode ll:focus:outline-none"
          tabIndex={0}
          aria-label="Generated code"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />

        {/* Info & Meta */}
        <div className="ll:flex ll:items-center ll:gap-2 ll:font-mono ll:text-micro ll:text-muted">
          <span>
            {lineCount} lines · {byteSize} · {meta.dep}
          </span>
        </div>

        {/* Note */}
        <div className="ll:text-micro ll:text-muted ll:leading-snug">
          {meta.note}
        </div>
      </div>

      {/* Footer */}
      <div className="ll:flex ll:items-center ll:justify-end ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <button
          type="button"
          onClick={handleCopy}
          className="ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:h-7 ll:min-w-21 ll:px-3 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-primary ll:hover:bg-surface-bar ll:transition-colors"
        >
          <Icon icon={copied ? Check : Copy} size={14} />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>

        <button
          type="button"
          onClick={handleDownload}
          className="ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-3 ll:bg-primary ll:text-surface-panel ll:border ll:border-transparent ll:rounded-sm ll:text-micro ll:font-medium ll:hover:opacity-90 ll:transition-opacity"
        >
          <Icon icon={Download} size={14} />
          <span>Download .{meta.ext}</span>
        </button>
      </div>
    </div>
  );
};

export default MotionExportModal;

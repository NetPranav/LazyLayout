"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import { Select } from "@/editor/components/Select";
import { Checkbox } from "@/editor/components/Checkbox";
import { useMounted } from "@/editor/components/useMounted";
import { springAnim } from "@/editor/motion/ease";
import { isMotionOff } from "@/editor/motion/reducedMotion";
import { SyntaxHighlighter } from "@/editor/panels/code-view/SyntaxHighlighter";
import { exportCurrentFile, exportRepoZip, npmInstallCommand } from "@/editor/panels/code-view/codeExport";
import { consoleStore } from "@/editor/panels/console/consoleStore";
import { ExportFileTree } from "./ExportFileTree";
import { formatBytes, useExportFiles } from "./exportFiles";
import { useExportDialogStore, type ExportFormat } from "./useExportDialogStore";
import "./export-dialog.css";

const FORMAT_OPTIONS = [
  { value: "zip", label: "Repo .zip" },
  { value: "file", label: "Current file" },
  { value: "npm", label: "Copy npm install" },
] as const;

const SETUP_OPTIONS = [{ value: "next", label: "Next.js (App Router)" }] as const;
const STYLING_OPTIONS = [{ value: "css", label: "Plain CSS" }] as const;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Phase = "idle" | "busy" | "done";

const ExportSheet: React.FC = () => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const closing = useRef(false);

  const trigger = useExportDialogStore((s) => s.trigger);
  const excluded = useExportDialogStore((s) => s.excluded);
  const selectedPath = useExportDialogStore((s) => s.selectedPath);
  const format = useExportDialogStore((s) => s.format);
  const select = useExportDialogStore((s) => s.select);
  const setIncluded = useExportDialogStore((s) => s.setIncluded);
  const setFormat = useExportDialogStore((s) => s.setFormat);
  const close = useExportDialogStore((s) => s.close);

  const { files, tree } = useExportFiles(true);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);
  const current = useMemo(
    () => files.find((f) => f.path === selectedPath) ?? files.find((f) => /(^|\/)page\.tsx$/.test(f.path)) ?? files[0] ?? null,
    [files, selectedPath],
  );
  const included = useMemo(() => files.filter((f) => !excludedSet.has(f.path)), [files, excludedSet]);
  const totalBytes = useMemo(() => included.reduce((n, f) => n + f.bytes, 0), [included]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [copied, setCopied] = useState(false);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  // Opens from the trigger with one spring; with motion off it simply appears. Focus goes in, and back to the trigger on close.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;
    const active = document.activeElement as HTMLElement | null;
    const from = trigger ?? active;
    if (!isMotionOff()) {
      const r = sheet.getBoundingClientRect();
      const t = from?.getBoundingClientRect();
      if (t && t.width > 0) {
        sheet.style.transformOrigin = `${t.left + t.width / 2 - r.left}px ${t.top + t.height / 2 - r.top}px`;
      }
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      springAnim(sheet, [{ opacity: 0, scale: 0.88 }, { opacity: 1, scale: 1 }], 0.38, 0.82);
    }
    sheet.querySelector<HTMLElement>('[role="tree"]')?.focus({ preventScroll: true });
    if (!sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      const back = trigger ?? active;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, [trigger]);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (isMotionOff() || !sheet || !backdrop) {
      close();
      return;
    }
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" });
    const a = sheet.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.94 }], { duration: 120, easing: "ease-out", fill: "forwards" });
    a.onfinish = close;
  }, [close]);

  // Esc closes from anywhere, also when focus has dropped to the page (a disabled button loses it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".ll-menu.ll-dd")) return; // an open dropdown takes Esc first
      e.stopPropagation();
      requestClose();
    };
    // Focus that lands outside the sheet (a closing menu handing it back) is pulled in again; open dropdowns are allowed.
    const onFocusIn = (e: FocusEvent) => {
      const sheet = sheetRef.current;
      const target = e.target as HTMLElement | null;
      if (closing.current || !sheet || !target || sheet.contains(target) || target.closest(".ll-menu")) return;
      (sheet.querySelector<HTMLElement>('[role="tree"]') ?? sheet).focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [requestClose]);

  // A new file crossfades into the preview; the pane keeps its size, so nothing jumps.
  const previewPath = current?.path;
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el || isMotionOff()) return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  }, [previewPath]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key !== "Tab") return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const items = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === sheet)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const copyCurrent = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.content);
      setCopied(true);
      later(() => setCopied(false), 1600);
      consoleStore.appendLog("info", "export", `Copied ${current.path}`);
    } catch {
      consoleStore.appendLog("warn", "export", "Could not copy (clipboard blocked)");
    }
  };

  const canRun = format === "zip" ? included.length > 0 : format === "file" ? current !== null : true;

  const run = () => {
    if (phase !== "idle" || !canRun) return;
    setPhase("busy");
    later(() => {
      try {
        if (format === "zip") {
          const name = exportRepoZip(new Set(included.map((f) => f.path)));
          consoleStore.appendLog("info", "export", `${name} downloaded: ${included.length} files`);
        } else if (format === "file" && current) {
          const r = exportCurrentFile(current.path);
          consoleStore.appendLog(r.ok ? "info" : "warn", "export", r.ok ? `Downloaded ${r.name}` : "No generated file to download");
        } else {
          const cmd = npmInstallCommand();
          void navigator.clipboard
            .writeText(cmd)
            .then(() => consoleStore.appendLog("info", "export", `Copied: ${cmd}`))
            .catch(() => consoleStore.appendLog("warn", "export", `Could not copy (clipboard blocked): ${cmd}`));
        }
      } catch (err) {
        consoleStore.appendLog("error", "export", `Export failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      setPhase("done");
      later(() => {
        setPhase("idle");
        if (document.activeElement === document.body) sheetRef.current?.focus({ preventScroll: true });
      }, 1800);
    }, 450);
  };

  const label =
    phase === "busy"
      ? "Preparing…"
      : phase === "done"
        ? format === "npm"
          ? "Copied"
          : "Downloaded"
        : format === "npm"
          ? "Copy command"
          : format === "file"
            ? "Download file"
            : "Download";

  const fileOptions = useMemo(() => files.map((f) => ({ value: f.path, label: f.path })), [files]);
  const currentIncluded = current ? !excludedSet.has(current.path) : false;

  return (
    <div
      ref={backdropRef}
      role="presentation"
      className="ll-xd-backdrop ll:bg-surface-backdrop/50 ll:font-sans"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ll-xd-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="ll-xd-sheet ll:bg-surface-raised ll:border ll:border-border ll:shadow-soft ll:text-primary ll:outline-none"
      >
        <div className="ll:flex ll:items-center ll:justify-between ll:h-12 ll:px-4 ll:border-b ll:border-border ll:shrink-0">
          <h2 id="ll-xd-title" className="ll:m-0 ll:text-title ll:font-semibold ll:text-primary">
            Export
          </h2>
          <IconButton aria-label="Close" tooltip={false} icon={<Icon icon={X} size={16} />} onClick={requestClose} />
        </div>

        {files.length === 0 ? (
          <div className="ll:flex-1 ll:grid ll:place-items-center ll:text-body ll:text-muted">Nothing to export yet.</div>
        ) : (
          <div className="ll-xd-body">
            <div className="ll-xd-tree ll:flex ll:flex-col ll:min-h-0 ll:border-r ll:border-border ll:bg-surface-panel">
              <div className="ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:py-1">
                <ExportFileTree tree={tree} selectedPath={current?.path ?? null} excluded={excluded} onSelect={select} onSetIncluded={setIncluded} />
              </div>
              <div className="ll:flex ll:flex-col ll:gap-2 ll:p-3 ll:border-t ll:border-border ll:shrink-0">
                <div className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:text-small ll:text-muted">
                  <span>Setup</span>
                  <span>Soon</span>
                </div>
                <Select options={SETUP_OPTIONS} value="next" disabled size="sm" aria-label="Framework" className="ll:w-full" />
                <Select options={STYLING_OPTIONS} value="css" disabled size="sm" aria-label="Styling" className="ll:w-full" />
              </div>
            </div>

            <div className="ll:flex ll:flex-col ll:min-h-0 ll:min-w-0">
              <div className="ll-xd-pick ll:items-center ll:gap-3 ll:p-3 ll:border-b ll:border-border ll:shrink-0">
                <Select
                  options={fileOptions}
                  value={current?.path}
                  onChange={select}
                  aria-label="File to preview"
                  size="sm"
                  className="ll:flex-1 ll:min-w-0"
                />
                <Checkbox
                  checked={currentIncluded}
                  onChange={(v) => current && setIncluded([current.path], v)}
                  label="Include"
                  aria-label="Include this file"
                />
              </div>
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-3 ll:h-10 ll:px-4 ll:border-b ll:border-border ll:shrink-0">
                <span className="ll:truncate ll:min-w-0 ll:font-mono ll:text-small ll:text-secondary">{current?.path}</span>
                <Button size="sm" variant="ghost" onClick={copyCurrent} leftIcon={<Icon icon={copied ? Check : Copy} size={14} />}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div ref={previewRef} className="ll:flex-1 ll:min-h-0 ll:flex ll:flex-col ll:bg-surface-canvas">
                {current && (
                  <SyntaxHighlighter
                    key={current.path}
                    code={current.content}
                    language={current.language}
                    className="ll:flex-1 ll:min-h-0 ll:overflow-auto ll:py-2 ll:font-mono ll:text-small ll:select-text"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div className="ll-xd-foot ll:px-4 ll:py-3 ll:border-t ll:border-border ll:shrink-0">
          <Select
            options={FORMAT_OPTIONS}
            value={format}
            onChange={(v) => setFormat(v as ExportFormat)}
            aria-label="Export format"
            size="sm"
            width={176}
          />
          <span className="ll:text-small ll:text-muted" aria-live="polite">
            {included.length === 0 && files.length > 0
              ? "No files selected"
              : `${included.length} ${included.length === 1 ? "file" : "files"} · ${formatBytes(totalBytes)}`}
          </span>
          <div className="ll-xd-foot-actions ll:flex ll:items-center ll:gap-2 ll:ml-auto">
            <Button variant="default" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={phase === "busy"}
              disabled={!canRun}
              onClick={run}
              leftIcon={phase === "done" ? <Icon icon={Check} size={16} /> : undefined}
            >
              {label}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** The Export sheet: pick the generated files, preview each, and download the repo as a .zip (or one file, or the install command). */
export const ExportDialog: React.FC = () => {
  const mounted = useMounted();
  const open = useExportDialogStore((s) => s.open);
  if (!mounted || !open) return null;
  return createPortal(<ExportSheet />, document.body);
};

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, FileCode, FolderArchive } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { isMotionOff } from "@/editor/motion/reducedMotion";
import { consoleStore } from "@/editor/panels/console/consoleStore";
import { openExportDialog } from "@/editor/shell/export-dialog/useExportDialogStore";
import { useCodeFilesStore } from "./codeFilesStore";
import { exportCurrentFile, exportRepoZip, copyNpmInstall, npmInstallCommand, repoSummary } from "./codeExport";
import { useCompiledFiles } from "./useCompiledFiles";
import { EXPORT_SECTION_ID, REVEAL_EXPORT_EVENT } from "./exportReveal";

type QuickExport = "zip" | "file" | "npm";

const DONE_MS = 1600;
const PULSE_MS = 900;
/** The sidebar springs open over about this long: the pulse waits for it. */
const OPEN_WAIT_MS = 320;

const ROW_CLASS =
  "ll-btn ll:w-full ll:h-8 ll:flex ll:items-center ll:gap-2 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer ll:text-left ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset";

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export interface CodeExportSectionProps {
  /** Draws a hairline above the section (when another section sits directly above it). */
  topBorder?: boolean;
}

/** The quick export in the Code inspector: Repo .zip, Current file and Copy npm install, with the real file count and size. "More options…" opens the full Export dialog. */
export const CodeExportSection: React.FC<CodeExportSectionProps> = ({ topBorder = false }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [done, setDone] = useState<QuickExport | null>(null);
  const [zipName, setZipName] = useState<string | null>(null);
  const [failed, setFailed] = useState<QuickExport | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFileId = useCodeFilesStore((s) => s.activeFileId);
  const compiled = useCompiledFiles();

  const summary = useMemo(() => {
    void compiled.files; // re-pack whenever the compiled output changes
    return repoSummary();
  }, [compiled.files]);
  const installCmd = useMemo(() => (summary.deps.length > 0 ? `npm install ${summary.deps.join(" ")}` : "npm install"), [summary.deps]);
  const currentName = useMemo(() => {
    const file = compiled.files.find((f) => f.path === activeFileId) ?? compiled.files[0];
    return file ? file.name : "";
  }, [compiled.files, activeFileId]);

  const flash = useCallback((which: QuickExport, ok: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    setDone(ok ? which : null);
    setFailed(ok ? null : which);
    timer.current = setTimeout(() => {
      setDone(null);
      setFailed(null);
    }, DONE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // The toolbar's Export button: scroll here and pulse once (a plain fade of the background; nothing moves).
  useEffect(() => {
    const reveal = () => {
      const wait = document.querySelector(".ll-shell[data-rc]") ? OPEN_WAIT_MS : 0;
      window.setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        el.scrollIntoView({ block: "nearest", behavior: isMotionOff() ? "auto" : "smooth" });
        if (!isMotionOff() && typeof el.animate === "function") {
          el.animate([{ backgroundColor: "var(--ll-surface-hover)" }, { backgroundColor: "transparent" }], {
            duration: PULSE_MS,
            easing: "ease-out",
          });
        }
        el.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
      }, wait);
    };
    window.addEventListener(REVEAL_EXPORT_EVENT, reveal);
    return () => window.removeEventListener(REVEAL_EXPORT_EVENT, reveal);
  }, []);

  const runZip = () => {
    try {
      const name = exportRepoZip();
      setZipName(name);
      consoleStore.appendLog("info", "export", `Repo .zip downloaded (${name})`);
      flash("zip", true);
    } catch (err) {
      consoleStore.appendLog("error", "export", `Export failed: ${err instanceof Error ? err.message : String(err)}`);
      flash("zip", false);
    }
  };

  const runFile = () => {
    try {
      const r = exportCurrentFile();
      consoleStore.appendLog(r.ok ? "info" : "warn", "export", r.ok ? `Downloaded ${r.name}` : "No generated file to download");
      flash("file", r.ok);
    } catch (err) {
      consoleStore.appendLog("error", "export", `Export failed: ${err instanceof Error ? err.message : String(err)}`);
      flash("file", false);
    }
  };

  const runNpm = () => {
    void copyNpmInstall().then(({ cmd, ok }) => {
      consoleStore.appendLog(ok ? "info" : "warn", "export", ok ? `Copied: ${cmd}` : `Could not copy (clipboard blocked): ${cmd}`);
      flash("npm", ok);
    });
  };

  const meta = "ll:ml-auto ll:font-mono ll:text-micro ll:text-muted ll:truncate ll:min-w-0";

  return (
    <section
      id={EXPORT_SECTION_ID}
      ref={ref}
      aria-label="Export"
      className={`ll-dsec ll:flex ll:flex-col ll:gap-2.5 ll:p-4 ${topBorder ? "ll:border-t ll:border-border" : ""}`}
    >
      <div className="ll-dtitle ll:flex ll:items-center ll:justify-between">
        <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Export</h3>
      </div>
      <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
        <button type="button" onClick={runZip} className={ROW_CLASS} data-export-row="zip">
          <Icon icon={done === "zip" ? Check : FolderArchive} size={14} className="ll:text-muted" />
          <span>{done === "zip" ? "Downloaded" : failed === "zip" ? "Failed" : "Repo .zip"}</span>
          <span className={meta}>{done === "zip" && zipName ? zipName : `${summary.files} files · ${kb(summary.bytes)}`}</span>
        </button>
        <button type="button" onClick={runFile} className={ROW_CLASS} data-export-row="file">
          <Icon icon={done === "file" ? Check : FileCode} size={14} className="ll:text-muted" />
          <span>{done === "file" ? "Downloaded" : failed === "file" ? "No file" : "Current file"}</span>
          <span className={meta}>{currentName}</span>
        </button>
        <button type="button" onClick={runNpm} className={ROW_CLASS} data-export-row="npm" title={npmInstallCommand()}>
          <Icon icon={done === "npm" ? Check : Copy} size={14} className="ll:text-muted" />
          <span>{done === "npm" ? "Copied" : failed === "npm" ? "Copy blocked" : "Copy npm install"}</span>
          <span className={meta}>{summary.deps.length} deps</span>
        </button>
        <code className="ll-cinst ll:block ll:p-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-micro ll:text-secondary ll:break-all">
          {installCmd}
        </code>
        <button
          type="button"
          onClick={(e) => openExportDialog(e.currentTarget)}
          className="ll-btn ll:w-full ll:h-7 ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:bg-transparent ll:border ll:border-border ll:hover:border-muted ll:rounded-sm ll:font-sans ll:text-small ll:font-medium ll:text-primary ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
        >
          <Icon icon={Download} size={13} className="ll:text-muted" />
          <span>More options…</span>
        </button>
      </div>
    </section>
  );
};

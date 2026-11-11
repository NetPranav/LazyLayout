"use client";

import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import { getActivePreset } from "@/editor/motion/feel";
import { springAnim } from "@/editor/motion/ease";
import type { PageItem } from "./pagesModel";
import type { RowDrag } from "./useRowDrag";

export interface PageRowProps {
  page: PageItem;
  drag: RowDrag;
  entering: boolean;
  renaming: boolean;
  confirming: boolean;
  canDelete: boolean;
  setRef: (el: HTMLDivElement | null) => void;
  onChoose: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onMenu: (x: number, y: number) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export const PageRow: React.FC<PageRowProps> = ({
  page,
  drag,
  entering,
  renaming,
  confirming,
  canDelete,
  setRef,
  onChoose,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onMenu,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) => {
  const el = useRef<HTMLDivElement | null>(null);
  const dragging = drag.dragId === page.id;

  // A new page pops in with a short spring.
  useEffect(() => {
    if (!entering || !el.current) return;
    const p = getActivePreset();
    springAnim(el.current, [{ opacity: 0, transform: "translateY(-6px) scale(0.98)" }, { opacity: 1, transform: "none" }], p.rows[0], p.rows[1]);
  }, [entering]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (renaming || e.target !== e.currentTarget) return;
    if (confirming) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancelDelete();
      }
      return;
    }
    if (e.key === "Enter") onChoose();
    else if (e.key === "F2") onStartRename();
    else if ((e.key === "Delete" || e.key === "Backspace") && canDelete) onAskDelete();
  };

  const tone = page.isCurrent ? "ll:bg-select-bg ll:text-primary" : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary";

  return (
    <div
      ref={(node) => {
        el.current = node;
        setRef(node);
      }}
      role="option"
      aria-selected={page.isCurrent}
      tabIndex={0}
      data-testid="page-row"
      data-page-id={page.id}
      data-current={page.isCurrent ? "true" : "false"}
      className={`ll:group ll:relative ll:flex ll:items-center ll:gap-2 ll:h-8 ll:shrink-0 ll:pl-3 ll:pr-1 ll:rounded-sm ll:cursor-pointer ll:select-none ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ${tone} ${
        dragging ? "ll:z-10 ll:bg-surface-raised ll:shadow-soft ll:pointer-events-none" : ""
      }`}
      onPointerDown={(e) => drag.onPointerDown(e, page.id)}
      onClick={() => {
        if (renaming || confirming || drag.consumeClick()) return;
        onChoose();
      }}
      onDoubleClick={() => {
        if (!confirming) onStartRename();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!renaming) onMenu(e.clientX, e.clientY);
      }}
      onKeyDown={onKeyDown}
    >
      {page.isCurrent && <span aria-hidden="true" className="ll:absolute ll:left-0 ll:top-2 ll:bottom-2 ll:w-0.5 ll:rounded-xs ll:bg-primary" />}

      {confirming ? (
        <>
          <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ll:text-primary">Delete “{page.name}”?</span>
          <Button size="sm" variant="strong" data-testid="page-delete-confirm" onClick={(e) => { e.stopPropagation(); onConfirmDelete(); }}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="ll:flex ll:flex-1 ll:min-w-0 ll:items-baseline ll:gap-2 ll:overflow-hidden">
            {renaming ? (
              <RenameInput name={page.name} onCommit={onCommitRename} onCancel={onCancelRename} />
            ) : (
              <>
                <span className={`ll:truncate ll:text-body ${page.isCurrent ? "ll:font-medium" : ""}`}>{page.name}</span>
                <span className="ll:shrink-0 ll:text-micro ll:text-muted ll:font-mono">{page.route}</span>
              </>
            )}
          </span>
          {!renaming && (
            <span className="ll:opacity-0 ll:group-hover:opacity-100 ll:focus-within:opacity-100">
              <IconButton
                size="sm"
                variant="ghost"
                aria-label={`Actions for ${page.name}`}
                data-testid="page-more"
                tabIndex={-1}
                icon={<Icon icon={MoreHorizontal} size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  onMenu(r.left, r.bottom + 4);
                }}
              />
            </span>
          )}
        </>
      )}
    </div>
  );
};

const RenameInput: React.FC<{ name: string; onCommit: (name: string) => void; onCancel: () => void }> = ({ name, onCommit, onCancel }) => {
  const [draft, setDraft] = useState(name);
  return (
    <input
      autoFocus
      aria-label="Page name"
      data-testid="page-rename"
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onCommit(draft);
        else if (e.key === "Escape") onCancel();
      }}
      onBlur={() => onCommit(draft)}
      className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:border-b ll:border-primary ll:p-0 ll:m-0 ll:outline-none ll:font-sans ll:text-body ll:text-primary"
    />
  );
};

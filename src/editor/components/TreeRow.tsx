"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronRight, Eye, EyeOff, Lock, Unlock, Zap } from "lucide-react";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";

export interface TreeRowProps {
  id: string;
  name: string;
  level?: number;
  icon?: React.ReactNode;
  hasChildren?: boolean;
  expanded?: boolean;
  selected?: boolean;
  rangeSelected?: boolean;
  hidden?: boolean;
  locked?: boolean;
  hasMotion?: boolean;
  dropPosition?: "before" | "after" | "inside" | null;
  onToggleExpand?: () => void;
  onSelect?: (e: React.MouseEvent) => void;
  onRename?: (newName: string) => void;
  onToggleHidden?: () => void;
  onToggleLocked?: () => void;
  className?: string;
}

export const TreeRow: React.FC<TreeRowProps> = ({
  id,
  name,
  level = 0,
  icon,
  hasChildren = false,
  expanded = false,
  selected = false,
  rangeSelected = false,
  hidden = false,
  locked = false,
  hasMotion = false,
  dropPosition = null,
  onToggleExpand,
  onSelect,
  onRename,
  onToggleHidden,
  onToggleLocked,
  className = "",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [prevName, setPrevName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  if (name !== prevName) {
    setPrevName(name);
    setDraftName(name);
  }

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!locked && onRename) {
      setIsEditing(true);
    }
  };

  const handleRenameCommit = () => {
    setIsEditing(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) {
      onRename?.(trimmed);
    } else {
      setDraftName(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRenameCommit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setDraftName(name);
    }
  };

  let dropStyles = "";
  if (dropPosition === "before") {
    dropStyles = "ll:shadow-drop-above";
  } else if (dropPosition === "after") {
    dropStyles = "ll:shadow-drop-below";
  } else if (dropPosition === "inside") {
    dropStyles = "ll:bg-surface-hover ll:shadow-drop-inside";
  }

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      data-id={id}
      onClick={onSelect}
      style={{
        paddingLeft: `calc(${level} * var(--ll-size-tree-indent) + var(--ll-size-tree-indent-base))`,
      }}
      className={`row ll:group ll:relative ll:flex ll:items-center ll:gap-2 ll:h-8 ll:pr-2 ll:text-left ll:box-border ll:cursor-pointer ll:select-none ll:transition-none ll:outline-none ll:font-sans ${
        selected
          ? "ll:bg-select-bg ll:text-select-fg"
          : rangeSelected
            ? "ll:bg-surface-bar ll:text-primary"
            : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
      } ${hidden ? "ll:opacity-40" : ""} ${dropStyles} ${className}`}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:shrink-0"
        >
          <Icon
            icon={ChevronRight}
            size={12}
            className={`ll:transition-transform ll:duration-120 ${
              expanded ? "ll:rotate-90" : ""
            }`}
          />
        </button>
      ) : (
        <span className="ll:w-4 ll:h-4 ll:shrink-0" />
      )}

      {icon && (
        <span
          className={`ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ${
            selected
              ? "ll:text-select-fg"
              : "ll:text-muted ll:group-hover:text-primary"
          }`}
        >
          {icon}
        </span>
      )}

      <div className="ll:flex-1 ll:min-w-0" onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={handleRenameCommit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="ll:w-full ll:h-6 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-primary ll:rounded-sm ll:outline-none ll:text-small ll:text-primary ll:font-sans"
          />
        ) : (
          <span className="ll:truncate ll:text-small ll:font-normal ll:block">
            {name}
          </span>
        )}
      </div>

      {hasMotion && (
        <span
          title="Motion animated"
          className="ll:flex ll:items-center ll:gap-0.5 ll:px-1 ll:py-0.2 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:text-nano ll:font-mono ll:text-muted"
        >
          <Icon icon={Zap} size={10} className="ll:text-primary" />
        </span>
      )}

      <div className="ll:flex ll:items-center ll:gap-0.5 ll:shrink-0 ll:opacity-0 ll:group-hover:opacity-100 ll:transition-opacity">
        {onToggleHidden && (
          <IconButton
            size="sm"
            aria-label={hidden ? "Show layer" : "Hide layer"}
            icon={hidden ? <Icon icon={EyeOff} size={12} /> : <Icon icon={Eye} size={12} />}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden();
            }}
          />
        )}

        {onToggleLocked && (
          <IconButton
            size="sm"
            aria-label={locked ? "Unlock layer" : "Lock layer"}
            icon={locked ? <Icon icon={Lock} size={12} /> : <Icon icon={Unlock} size={12} />}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLocked();
            }}
          />
        )}
      </div>
    </div>
  );
};

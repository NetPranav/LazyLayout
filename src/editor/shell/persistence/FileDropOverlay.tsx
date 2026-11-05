"use client";

import React from "react";
import { Upload } from "lucide-react";
import { Icon } from "@/editor/components/Icon";

export interface FileDropOverlayProps {
  visible: boolean;
  className?: string;
}

/** Full-window hint while a file is dragged over the editor. */
export const FileDropOverlay: React.FC<FileDropOverlayProps> = ({
  visible,
  className = "",
}) => {
  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="file-drop-overlay"
      className={`ll:fixed ll:inset-0 ll:z-50 ll:pointer-events-none ll:p-4 ll:flex ll:items-center ll:justify-center ${className}`}
    >
      <div className="ll:w-full ll:h-full ll:border-2 ll:border-dashed ll:border-border ll:rounded-lg ll:flex ll:items-center ll:justify-center">
        <div className="ll:flex ll:items-center ll:gap-3 ll:px-6 ll:py-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:shadow-soft ll:text-primary ll:font-sans">
          <Icon icon={Upload} size={18} className="ll:text-primary ll:shrink-0" />
          <span className="ll:text-body ll:font-medium">
            Drop a .lazy.json file to open it as a new project
          </span>
        </div>
      </div>
    </div>
  );
};

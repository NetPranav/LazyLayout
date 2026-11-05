"use client";

import React from "react";
import { File, Columns2, Link as LinkIcon, Download, ListTree } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { MenuItem, MenuSeparator } from "@/editor/components/Menu";
import { MENU_ICON_SIZE } from "@/editor/components/topbar-constants";
import type { FileMenuAction } from "./types";

export interface FileContextMenuContentProps {
  fileId: string;
  fileName: string;
  filePath?: string;
  onAction?: (action: FileMenuAction, fileId: string) => void;
}

export const FileContextMenuContent: React.FC<FileContextMenuContentProps> = ({
  fileId,
  filePath,
  onAction,
}) => {
  return (
    <>
      <MenuItem
        icon={<Icon icon={File} size={MENU_ICON_SIZE} />}
        onClick={() => onAction?.("open", fileId)}
      >
        Open
      </MenuItem>
      <MenuItem
        icon={<Icon icon={Columns2} size={MENU_ICON_SIZE} />}
        onClick={() => onAction?.("open-side", fileId)}
      >
        Open to the side
      </MenuItem>

      <MenuSeparator />

      <MenuItem
        icon={<Icon icon={LinkIcon} size={MENU_ICON_SIZE} />}
        onClick={() => onAction?.("copy-path", fileId)}
      >
        Copy path
      </MenuItem>
      <MenuItem
        icon={<Icon icon={Download} size={MENU_ICON_SIZE} />}
        onClick={() => onAction?.("download", fileId)}
      >
        Download
      </MenuItem>

      <MenuSeparator />

      <MenuItem
        icon={<Icon icon={ListTree} size={MENU_ICON_SIZE} />}
        onClick={() => onAction?.("reveal-layer", fileId)}
      >
        Reveal layer
      </MenuItem>
    </>
  );
};

"use client";

import React, { useState, useCallback } from "react";
import { Menu } from "./Menu";

export interface ContextMenuProps {
  children: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
  className?: string;
  width?: number | string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  content,
  disabled = false,
  className = "",
  width,
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      setCoords({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    [disabled]
  );

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <div onContextMenu={handleContextMenu} className={className}>
        {children}
      </div>

      <Menu
        open={open}
        onClose={handleClose}
        position={coords}
        width={width}
        variant="context"
      >
        {content}
      </Menu>
    </>
  );
};


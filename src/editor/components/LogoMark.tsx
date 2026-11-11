"use client";

import React from "react";
import { LOGO_ICON_SIZE } from "./topbar-constants";

export interface LogoMarkProps {
  saving?: boolean;
  size?: number;
  className?: string;
  "data-testid"?: string;
}

export const LogoMark: React.FC<LogoMarkProps> = ({
  saving = false,
  size = LOGO_ICON_SIZE,
  className = "",
  "data-testid": dataTestId,
}) => {
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      aria-hidden="true"
      data-testid={dataTestId}
      data-saving={saving ? "true" : undefined}
      className={`ll:shrink-0 ${saving ? "ll-saving-on" : ""} ${className}`}
    >
      <path
        className="ll-tro"
        pathLength={100}
        d="M256 256H128L0 128H128ZM256 128H128L0 0H128Z"
      />
      <path
        className="ll-tfl"
        d="M256 256H128L0 128H128ZM256 128H128L0 0H128Z"
      />
    </svg>
  );
};

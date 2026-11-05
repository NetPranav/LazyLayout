"use client";

import React from "react";

export interface PropertyRowProps {
  label?: React.ReactNode;
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  align?: "center" | "start";
}

export const PropertyRow: React.FC<PropertyRowProps> = ({
  label,
  children,
  columns = 1,
  className = "",
  align = "center",
}) => {
  let gridCols = "ll:flex-1";
  if (columns === 2) {
    gridCols = "ll:grid ll:grid-cols-2 ll:gap-1.5 ll:flex-1";
  } else if (columns === 3) {
    gridCols = "ll:grid ll:grid-cols-3 ll:gap-1.5 ll:flex-1";
  } else if (columns === 4) {
    gridCols = "ll:grid ll:grid-cols-4 ll:gap-1.5 ll:flex-1";
  }

  return (
    <div
      className={`ll:flex ${
        align === "start" ? "ll:items-start" : "ll:items-center"
      } ll:gap-3 ll:min-h-7.5 ll:w-full ${className}`}
    >
      {label && (
        <span className="ll:w-20 ll:shrink-0 ll:text-small ll:text-secondary ll:truncate ll:select-none">
          {label}
        </span>
      )}

      <div className={gridCols}>{children}</div>
    </div>
  );
};


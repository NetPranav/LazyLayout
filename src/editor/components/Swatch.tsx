import React from "react";

export interface SwatchProps {
  role: string;
  token: string;
  hex: string;
  bgClass?: string;
  borderClass?: string;
  sample?: React.ReactNode;
}

export function Swatch({
  role,
  token,
  hex,
  bgClass = "ll:bg-surface-canvas",
  borderClass = "ll:border-border",
  sample,
}: SwatchProps) {
  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:min-w-0">
      {sample ? (
        <div
          className={`ll:h-24 ll:w-full ll:rounded-md ll:border ${borderClass} ll:overflow-hidden ll:flex ll:items-center ll:justify-center`}
        >
          {sample}
        </div>
      ) : (
        <div
          className={`ll:h-24 ll:w-full ll:rounded-md ll:border ${borderClass} ${bgClass}`}
        />
      )}
      <div className="ll:flex ll:flex-col ll:gap-1 ll:min-w-0">
        <span className="ll:text-body ll:font-medium ll:text-primary ll:truncate">
          {role}
        </span>
        <span className="ll:font-mono ll:text-small ll:text-secondary ll:truncate">
          {token}
        </span>
        <span className="ll:font-mono ll:text-small ll:text-secondary ll:truncate">
          {hex}
        </span>
      </div>
    </div>
  );
}

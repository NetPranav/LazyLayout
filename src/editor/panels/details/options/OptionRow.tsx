"use client";

import React from "react";

export interface OptionGroupProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

/** Group container (.dmg) with hairline border separator */
export const OptionGroup: React.FC<OptionGroupProps> = ({
  children,
  className = "",
  title,
}) => (
  <div
    className={`dmg ll-dmg ${className}`}
  >
    {title && (
      <span className="dsub dgn ll-dsub ll:text-micro ll:font-medium ll:uppercase ll:tracking-wider ll:text-muted ll:mb-1">
        {title}
      </span>
    )}
    {children}
  </div>
);

export interface OptionRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Standard row with 72px label column (.dlbl) and 1fr control column (.dtc) */
export const OptionRow: React.FC<OptionRowProps> = ({
  label,
  children,
  className = "",
}) => (
  <div
    className={`dtrow ll-dtrow ll:min-h-7 ll:w-full ${className}`}
  >
    <span className="dlbl ll-dlbl ll:text-small ll:font-normal ll:text-muted ll:truncate ll:select-none">
      {label}
    </span>
    <div className="dtc ll-dtc ll:flex ll:items-center ll:gap-1.5 ll:min-w-0 ll:w-full">
      {children}
    </div>
  </div>
);

export interface OptionGridLabelProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Block label above a grid (.dgl) */
export const OptionGridLabel: React.FC<OptionGridLabelProps> = ({
  label,
  children,
  className = "",
}) => (
  <div className={`dgl ll-dgl ll:flex ll:flex-col ll:gap-1.5 ll:w-full ${className}`}>
    <span className="dlbl ll-dlbl ll:text-small ll:font-normal ll:text-muted ll:select-none">
      {label}
    </span>
    {children}
  </div>
);

export interface OptionTwoProps {
  children: React.ReactNode;
  className?: string;
}

/** Two-column grid for paired values (.dgrid) */
export const OptionTwo: React.FC<OptionTwoProps> = ({ children, className = "" }) => (
  <div className={`dgrid ll-dgrid ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full ${className}`}>
    {children}
  </div>
);

export interface OptionGrid4Props {
  children: React.ReactNode;
  className?: string;
}

/** Four-column grid (.dgrid4) */
export const OptionGrid4: React.FC<OptionGrid4Props> = ({ children, className = "" }) => (
  <div className={`dgrid4 ll-dgrid4 ll:grid ll:grid-cols-4 ll:gap-1.5 ll:w-full ${className}`}>
    {children}
  </div>
);

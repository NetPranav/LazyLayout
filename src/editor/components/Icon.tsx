"use client";

import React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

export interface IconProps extends Omit<LucideProps, "ref"> {
  icon: LucideIcon;
}

/**
 * Shared Lucide Icon wrapper enforcing single 1.5 stroke-width across Lazy Layout.
 */
export const Icon: React.FC<IconProps> = ({
  icon: LucideComp,
  size = 16,
  strokeWidth = 1.5,
  className = "",
  ...props
}) => {
  return (
    <LucideComp
      size={size}
      strokeWidth={strokeWidth}
      className={`ll:shrink-0 ${className}`}
      {...props}
    />
  );
};


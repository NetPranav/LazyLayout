"use client";

import React, { useRef } from "react";
import { Check, Send } from "lucide-react";
import { pressEl } from "../motion/surface";
import { Icon } from "./Icon";

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: "sm" | "md";
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = "User",
  src,
  size = "md",
  className = "",
}) => {
  const isSm = size === "sm";
  const sizeStyles = isSm
      ? "ll:w-6 ll:h-6 ll:text-nano ll:rounded-sm"
      : "ll:w-7 ll:h-7 ll:text-micro ll:rounded-md";

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${sizeStyles} ll:object-cover ll:border ll:border-border ll:shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`av ${sizeStyles} ll:inline-grid ll:place-items-center ll:box-border ll:bg-avatar-bg ll:text-avatar-fg ll:border ll:border-border ll:font-sans ll:font-medium ll:select-none ll:shrink-0 ${className}`}
    >
      {initials}
    </span>
  );
};

export interface AvatarStackProps {
  users: readonly { id: string; name: string; src?: string }[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

export const AvatarStack: React.FC<AvatarStackProps> = ({
  users,
  max = 3,
  size = "md",
  className = "",
}) => {
  const visible = users.slice(0, max);
  const remaining = users.length - max;
  const isSm = size === "sm";
  const sizeStyles = isSm
      ? "ll:w-6 ll:h-6 ll:text-nano ll:rounded-sm"
      : "ll:w-7 ll:h-7 ll:text-micro ll:rounded-md";

  return (
    <div className={`avs ll:inline-flex ll:items-center -ll:space-x-1.5 ${className}`}>
      {visible.map((u) => (
        <Avatar
          key={u.id}
          name={u.name}
          src={u.src}
          size={size}
          className="ll:ring-1 ll:ring-surface-panel"
        />
      ))}

      {remaining > 0 && (
        <span
          className={`av more ${sizeStyles} ll:inline-grid ll:place-items-center ll:box-border ll:bg-surface-bar ll:text-muted ll:border ll:border-border ll:font-mono ll:select-none ll:ring-1 ll:ring-surface-panel`}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
};

export interface ShipButtonProps {
  issueCount?: number;
  ready?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const ShipButton: React.FC<ShipButtonProps> = ({
  issueCount = 0,
  ready: propReady,
  onClick,
  disabled = false,
  className = "",
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const isReady = propReady !== undefined ? propReady : issueCount === 0;

  const handlePointerDown = () => {
    if (!disabled && btnRef.current) {
      pressEl(btnRef.current, true);
    }
  };

  const handlePointerUp = () => {
    if (!disabled && btnRef.current) {
      pressEl(btnRef.current, false);
    }
  };

  return (
    <button
      ref={btnRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      aria-label={isReady ? "Ship, ready" : `Ship, ${issueCount} to fix`}
      className={`ship ${isReady ? "ready" : ""
        } ll:inline-flex ll:items-center ll:gap-2 ll:h-8 ll:px-3 ll:rounded-md ll:border-0 ll:font-sans ll:text-small ll:font-medium ll:cursor-pointer ll:select-none ll:shrink-0 ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${isReady
          ? "ll:bg-control-primary ll:text-control-primary-fg ll:hover:opacity-90"
          : "ll:bg-ship-bg ll:text-ship-fg ll:hover:opacity-90"
        } ${disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""} ${className}`}
    >
      {isReady ? (
        <Icon icon={Check} size={14} />
      ) : (
        <Icon icon={Send} size={14} />
      )}

      <span>Ship</span>

      <span
        className={`shipc ll:font-mono ll:text-micro ll:tabular-nums ${isReady ? "ll:text-control-primary-fg/80" : "ll:text-ship-fg/80"
          }`}
      >
        {isReady ? "Ready" : `${issueCount} to fix`}
      </span>
    </button>
  );
};

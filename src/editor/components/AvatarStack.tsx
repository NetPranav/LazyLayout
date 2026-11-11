"use client";

import React, { useState, useRef, useId } from "react";
import { Menu, MenuItem, MenuSeparator } from "./Menu";
import { USERS_MENU_WIDTH } from "./topbar-constants";

export interface CollabUser {
  id: string;
  name: string;
  initials?: string;
  status?: string;
  src?: string;
  /** Peer colour, used behind initials when there is no image. */
  color?: string;
}

export interface AvatarStackProps {
  users?: readonly CollabUser[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

const AVATAR_CLASS =
  "ll-av ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:shrink-0 ll:rounded-md ll:bg-avatar-bg ll:text-avatar-fg ll:text-micro ll:font-medium";

function initialsOf(u: CollabUser): string {
  return (
    u.initials ||
    u.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  );
}

export const AvatarStack: React.FC<AvatarStackProps> = ({
  users = [],
  max = 3,
  size = "md",
  className = "",
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const stackId = useId();

  if (!users || users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;
  const label = `${users.length} ${users.length === 1 ? "person" : "people"}`;
  const isSm = size === "sm";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={stackId}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={label}
        title="People"
        onClick={() => setMenuOpen((prev) => !prev)}
        className={`ll-avs ll:flex ll:items-center ll:gap-0.5 ll:self-center ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ${className}`}
      >
        {visibleUsers.map((u) => {
          const initials =
            u.initials ||
            u.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

          return (
            <span
              key={u.id}
              className={`ll-av ${
                isSm ? "ll:w-6 ll:h-6 ll:text-nano ll:rounded-sm" : "ll:w-7 ll:h-7 ll:text-micro ll:rounded-md"
              } ll:grid ll:place-items-center ll:bg-avatar-bg ll:text-avatar-fg ll:font-sans ll:font-medium`}
            >
              {initials}
            </span>
          );
        })}

        {remainingCount > 0 && (
          <span
            className={`ll-av ll-more ${
              isSm ? "ll:w-6 ll:h-6 ll:text-nano ll:rounded-sm" : "ll:w-7 ll:h-7 ll:text-micro ll:rounded-md"
            } ll:grid ll:place-items-center ll:bg-avatar-bg ll:text-muted ll:font-sans ll:font-medium`}
          >
            +{remainingCount}
          </span>
        )}
      </button>

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={btnRef}
        width={USERS_MENU_WIDTH}
        aria-label="Collaborators"
      >
        {users.slice(1).map((u) => (
          <div
            key={u.id}
            className="ll-urow ll:flex ll:items-center ll:gap-2 ll:w-full ll:min-h-10 ll:px-3 ll:text-left ll:text-primary"
          >
            <span className={AVATAR_CLASS}>{initialsOf(u)}</span>
            <span className="ll:flex ll:flex-col ll:min-w-0">
              <b className="ll:text-body ll:font-medium ll:truncate">{u.name}</b>
              {u.status && <small className="ll:text-micro ll:text-muted">{u.status}</small>}
            </span>
          </div>
        ))}

        {users.length > 1 && <MenuSeparator />}

        <MenuItem onClick={() => setMenuOpen(false)}>Invite people</MenuItem>

        <button
          type="button"
          role="menuitem"
          onClick={() => setMenuOpen(false)}
          className="ll-urow ll:relative ll:z-10 ll:flex ll:items-center ll:gap-2 ll:w-full ll:h-10 ll:px-3 ll:bg-transparent ll:border-0 ll:text-left ll:text-primary ll:cursor-pointer ll:outline-none ll:font-sans"
        >
          <span className={AVATAR_CLASS}>{initialsOf(users[0])}</span>
          <span className="ll:flex ll:flex-col ll:min-w-0">
            <b className="ll:text-body ll:font-medium ll:truncate">Account</b>
            <small className="ll:text-micro ll:text-muted">{users[0].name} · You</small>
          </span>
        </button>
      </Menu>
    </>
  );
};

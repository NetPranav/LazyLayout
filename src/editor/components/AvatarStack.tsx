"use client";

import React, { useState, useRef, useId } from "react";
import { UserPlus, User } from "lucide-react";
import { Menu, MenuItem, MenuSeparator } from "./Menu";
import { Icon } from "./Icon";
import { USERS_MENU_WIDTH } from "./topbar-constants";

export interface CollabUser {
  id: string;
  name: string;
  initials?: string;
  status?: string;
  src?: string;
}

export interface AvatarStackProps {
  users?: readonly CollabUser[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
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
  const label = `${users.length} collaborator${users.length === 1 ? "" : "s"}`;
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
        title={label}
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
            } ll:grid ll:place-items-center ll:bg-avatar-bg ll:text-avatar-fg ll:font-sans ll:font-medium`}
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
        {users.slice(1).map((u) => {
          const initials =
            u.initials ||
            u.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

          return (
            <div
              key={u.id}
              className="ll-urow ll:flex ll:items-center ll:gap-2.5 ll:px-3 ll:py-1.5 ll:text-small ll:text-primary"
            >
              <span className="ll-av ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:bg-avatar-bg ll:text-avatar-fg ll:text-nano ll:font-medium ll:shrink-0">
                {initials}
              </span>
              <div className="ll:flex ll:flex-col ll:min-w-0 ll:flex-1">
                <span className="ll:font-medium ll:truncate">{u.name}</span>
                {u.status && (
                  <span className="ll:text-micro ll:text-muted ll:truncate">
                    {u.status}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {users.length > 1 && <MenuSeparator />}

        <MenuItem
          icon={<Icon icon={UserPlus} size={14} />}
          onClick={() => setMenuOpen(false)}
        >
          Invite people
        </MenuItem>

        <MenuItem
          icon={<Icon icon={User} size={14} />}
          onClick={() => setMenuOpen(false)}
        >
          Account · You ({users[0].name})
        </MenuItem>
      </Menu>
    </>
  );
};

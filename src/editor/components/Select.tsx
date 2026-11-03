"use client";

import React, { useState, useRef, useCallback, useId } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "./Icon";
import { Menu, MenuItem } from "./Menu";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  width?: number | string;
  "aria-label"?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  disabled = false,
  size = "md",
  className = "",
  width,
  "aria-label": ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const selectedOption = options.find((o) => o.value === value);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSelect = useCallback(
    (optValue: string) => {
      onChange(optValue);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  const isSm = size === "sm";
  const heightStyles = isSm ? "ll:h-7 ll:px-2 ll:gap-1.5" : "ll:h-7.5 ll:px-2.5 ll:gap-2";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-1 ll:w-full ${className}`}>
      {label && (
        <span className="ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
          {label}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={handleToggle}
        className={`ll:relative ll:inline-flex ll:items-center ll:justify-between ll:box-border ll:w-full ll:rounded-sm ll:border ll:transition-colors ll:duration-100 ll:bg-surface-bar ll:text-left ll:cursor-pointer ll:select-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${heightStyles} ${
          open
            ? "ll:border-primary"
            : "ll:border-border ll:hover:border-muted"
        } ${disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""}`}
      >
        <span className="ll:flex ll:items-center ll:gap-2 ll:truncate ll:text-body">
          {selectedOption?.icon}
          <span className={selectedOption ? "ll:text-primary" : "ll:text-muted"}>
            {selectedOption?.label ?? placeholder}
          </span>
        </span>

        <Icon
          icon={ChevronDown}
          size={14}
          className={`ll:text-muted ll:shrink-0 ll:transition-transform ll:duration-120 ${
            open ? "ll:rotate-180" : ""
          }`}
        />
      </button>

      <Menu
        id={menuId}
        open={open}
        onClose={handleClose}
        anchorRef={triggerRef}
        width={width}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            role="menuitemradio"
            checked={option.value === value}
            disabled={option.disabled}
            icon={option.icon}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

"use client";

import React, { useRef, useCallback } from "react";

export type AlignmentMatrixIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface AlignmentGridProps {
  selectedIndex?: AlignmentMatrixIndex;
  onChange?: (
    index: AlignmentMatrixIndex,
    justify: "flex-start" | "center" | "flex-end",
    align: "flex-start" | "center" | "flex-end"
  ) => void;
  disabled?: boolean;
  className?: string;
}

const ALIGN_LABELS: readonly string[] = [
  "Top left",
  "Top center",
  "Top right",
  "Middle left",
  "Center",
  "Middle right",
  "Bottom left",
  "Bottom center",
  "Bottom right",
];

const MATRIX_MAPPINGS: readonly {
  justify: "flex-start" | "center" | "flex-end";
  align: "flex-start" | "center" | "flex-end";
}[] = [
  { justify: "flex-start", align: "flex-start" }, // 0: Top left
  { justify: "center", align: "flex-start" },     // 1: Top center
  { justify: "flex-end", align: "flex-start" },   // 2: Top right
  { justify: "flex-start", align: "center" },     // 3: Middle left
  { justify: "center", align: "center" },         // 4: Center
  { justify: "flex-end", align: "center" },       // 5: Middle right
  { justify: "flex-start", align: "flex-end" },   // 6: Bottom left
  { justify: "center", align: "flex-end" },       // 7: Bottom center
  { justify: "flex-end", align: "flex-end" },     // 8: Bottom right
];

export function getAlignmentMatrixIndex(
  justify?: string | null,
  align?: string | null
): AlignmentMatrixIndex {
  const j = justify === "center" ? "center" : justify === "flex-end" ? "flex-end" : "flex-start";
  const a = align === "center" ? "center" : align === "flex-end" ? "flex-end" : "flex-start";

  const idx = MATRIX_MAPPINGS.findIndex(
    (m) => m.justify === j && m.align === a
  );
  return (idx >= 0 ? idx : 4) as AlignmentMatrixIndex;
}

export const AlignmentGrid: React.FC<AlignmentGridProps> = ({
  selectedIndex = 4,
  onChange,
  disabled = false,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (index: AlignmentMatrixIndex) => {
      if (disabled) return;
      const m = MATRIX_MAPPINGS[index];
      onChange?.(index, m.justify, m.align);
    },
    [disabled, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let delta = 0;
    if (e.key === "ArrowLeft") delta = -1;
    else if (e.key === "ArrowRight") delta = 1;
    else if (e.key === "ArrowUp") delta = -3;
    else if (e.key === "ArrowDown") delta = 3;

    if (delta !== 0) {
      e.preventDefault();
      const nextIndex = Math.max(0, Math.min(8, currentIndex + delta)) as AlignmentMatrixIndex;
      handleSelect(nextIndex);

      const buttons = containerRef.current?.querySelectorAll("button");
      if (buttons && buttons[nextIndex]) {
        buttons[nextIndex].focus();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Alignment matrix"
      className={`dal ll:grid ll:grid-cols-3 ll:grid-rows-3 ll:w-25 ll:h-25 ll:p-0.5 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-border ${
        disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""
      } ${className}`}
    >
      {ALIGN_LABELS.map((label, i) => {
        const isPressed = selectedIndex === i;
        const indexTyped = i as AlignmentMatrixIndex;

        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            aria-label={label}
            title={label}
            aria-pressed={isPressed}
            onClick={() => handleSelect(indexTyped)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="ll:grid ll:place-items-center ll:rounded-sm ll:transition-colors ll:duration-100 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
          >
            <i
              aria-hidden="true"
              className={`ll:rounded-xs ll:transition-all ll:duration-100 ${
                isPressed
                  ? "ll:w-2.5 ll:h-1.5 ll:bg-primary"
                  : "ll:w-1 ll:h-1 ll:bg-muted ll:hover:bg-primary"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

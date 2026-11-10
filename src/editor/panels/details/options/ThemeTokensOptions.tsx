"use client";

import React, { useState } from "react";
import { OptionGroup, OptionRow } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import type { InspectorSectionProps } from "../types";

export interface ThemeTokensOptionsProps extends InspectorSectionProps {
  feedback?: "None" | "Subtle" | "Strong";
  onChangeFeedback?: (fb: "None" | "Subtle" | "Strong") => void;
}

const FEEDBACK_OPTIONS = [
  { value: "None", label: "None" },
  { value: "Subtle", label: "Subtle" },
  { value: "Strong", label: "Strong" },
] as const;

export const ThemeTokensOptions: React.FC<ThemeTokensOptionsProps> = ({
  getValue,
  onUpdateProp,
  feedback: propFb = "Subtle",
  onChangeFeedback,
}) => {
  const getInitial = (): typeof propFb => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ll_theme_feedback");
      if (stored === "None" || stored === "Subtle" || stored === "Strong") return stored;
    }
    const fromProp = getValue?.("theme.feedback") as typeof propFb | undefined;
    return fromProp || propFb;
  };

  const [feedback, setFeedback] = useState<"None" | "Subtle" | "Strong">(getInitial);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Feedback">
          <Select
            size="sm"
            aria-label="Interactive feedback"
            value={feedback}
            options={FEEDBACK_OPTIONS}
            onChange={(val) => {
              const next = val as typeof feedback;
              setFeedback(next);
              if (typeof window !== "undefined") {
                localStorage.setItem("ll_theme_feedback", next);
                document.documentElement.dataset.feedback = next.toLowerCase();
              }
              onUpdateProp?.("theme.feedback", next);
              onChangeFeedback?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

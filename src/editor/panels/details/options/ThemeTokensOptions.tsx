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
  feedback: propFb = "Subtle",
  onChangeFeedback,
}) => {
  const [feedback, setFeedback] = useState(propFb);

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
              onChangeFeedback?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

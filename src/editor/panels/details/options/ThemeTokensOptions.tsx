"use client";

import React from "react";
import { OptionGroup, OptionRow } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { useEnvironmentStore } from "@/core/store/useEnvironmentStore";
import type { InteractiveFeedbackStyle } from "@/core/types/environment";
import type { InspectorSectionProps } from "../types";

export interface ThemeTokensOptionsProps extends InspectorSectionProps {
  feedback?: InteractiveFeedbackStyle;
  onChangeFeedback?: (fb: InteractiveFeedbackStyle) => void;
}

const FEEDBACK_OPTIONS = [
  { value: "none", label: "None" },
  { value: "subtle_lift", label: "Subtle lift" },
  { value: "glow_accent", label: "Glow accent" },
  { value: "scale_pop", label: "Scale pop" },
  { value: "glass_frost", label: "Glass frost" },
] as const;

/** The page's interactive feedback (hover and press look). It is the engine's theme setting, saved with the project. */
export const ThemeTokensOptions: React.FC<ThemeTokensOptionsProps> = ({ onChangeFeedback }) => {
  const feedback = useEnvironmentStore((s) => s.environment.theme.feedback);
  const updateEnvironment = useEnvironmentStore((s) => s.updateEnvironment);

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
              const next = val as InteractiveFeedbackStyle;
              updateEnvironment((env) => ({ ...env, theme: { ...env.theme, feedback: next } }));
              onChangeFeedback?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};

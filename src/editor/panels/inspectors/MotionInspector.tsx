"use client";

import React from "react";
import { KeyframeInspector } from "./KeyframeInspector";
import type { KeyframeInspectorProps } from "./types";
import type { KeyframeActions } from "./KeyframeInspector";

export interface MotionInspectorProps extends KeyframeInspectorProps, KeyframeActions {}

/**
 * MotionInspector is the primary right-panel inspector for Motion Mode.
 * It selects between Composition, Layer Clip, and Keyframe inspector views
 * based on current motion model and document selection stores.
 */
export const MotionInspector: React.FC<MotionInspectorProps> = (props) => {
  return <KeyframeInspector {...props} />;
};

export default MotionInspector;

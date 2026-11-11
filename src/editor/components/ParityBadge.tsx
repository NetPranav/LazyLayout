"use client";

import React, { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { parityEnabled, parityStore } from "@/core/engine/stage/parity";

/**
 * ROADMAP Phase 60: whether what the engines draw matches `evaluate()`. Idle while nothing runs on an engine of its own
 * (Web Animations), "Parity OK" while they match, "Parity drift" when they don't, with what differs in the tooltip.
 * Dev builds, tests and `?parity=1` only; in production it renders nothing.
 */
const subscribeNever = () => () => undefined;

export interface ParityBadgeProps {
  className?: string;
}

export const ParityBadge: React.FC<ParityBadgeProps> = ({ className = "" }) => {
  // read on the client only: the server and the first client render agree (off), then it turns on
  const enabled = useSyncExternalStore(subscribeNever, parityEnabled, () => false);
  const state = useStore(parityStore);
  if (!enabled) return null;

  const label = state.status === "drift" ? "Parity drift" : state.status === "ok" ? "Parity OK" : "Parity idle";
  const detail =
    state.status === "drift"
      ? state.drifts.map((d) => `${d.layerId} ${d.property}: engine ${d.actual}, evaluate() ${d.expected}`).join("\n")
      : state.status === "ok"
        ? `${state.checked} layer${state.checked === 1 ? "" : "s"} on an engine match evaluate()`
        : "Nothing is running on an engine of its own";
  const dot = state.status === "drift" ? "ll:bg-label-4" : state.status === "ok" ? "ll:bg-label-2" : "ll:bg-muted";

  return (
    <span
      role="status"
      aria-label="Engine parity"
      data-parity={state.status}
      title={detail}
      className={`ll:inline-flex ll:items-center ll:gap-1 ll:whitespace-nowrap ll:text-micro ll:text-secondary ${className}`}
    >
      <span aria-hidden="true" className={`ll:size-1.5 ll:rounded-full ${dot}`} />
      {label}
    </span>
  );
};

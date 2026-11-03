import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR and true immediately upon hydration on client.
 * Uses useSyncExternalStore to eliminate hydration mismatches and prevent
 * setState-in-effect cascading render lint warnings.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}


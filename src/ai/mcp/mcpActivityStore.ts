import { create } from "zustand";

export type McpApprovalStatus = "pending" | "approved" | "rejected";

export interface McpActivityEntry {
  id: string;
  timestamp: string;
  toolName: string;
  summary: string;
  status: McpApprovalStatus;
  argsPreview?: string;
}

export interface McpActivityStoreState {
  entries: McpActivityEntry[];
  recordAction: (entry: Omit<McpActivityEntry, "id" | "timestamp">) => string;
  setStatus: (id: string, status: McpApprovalStatus) => void;
  clear: () => void;
}

let seq = 0;

export const useMcpActivityStore = create<McpActivityStoreState>((set) => ({
  entries: [],
  recordAction: (entry) => {
    seq += 1;
    const id = `mcp_${Date.now().toString(36)}_${seq}`;
    const fullEntry: McpActivityEntry = {
      ...entry,
      id,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      entries: [fullEntry, ...state.entries].slice(0, 100),
    }));
    return id;
  },
  setStatus: (id, status) =>
    set((state) => ({
      entries: state.entries.map((item) => (item.id === id ? { ...item, status } : item)),
    })),
  clear: () => set({ entries: [] }),
}));

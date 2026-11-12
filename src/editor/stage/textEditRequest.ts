"use client";

import { create } from "zustand";

/** A text just made with the Text tool opens for typing at once (as in Figma): the stage asks, the artboard opens its editor. */
export const useTextEditRequest = create<{ id: string | null; seq: number }>(() => ({ id: null, seq: 0 }));
export const requestTextEdit = (id: string): void => useTextEditRequest.setState((s) => ({ id, seq: s.seq + 1 }));

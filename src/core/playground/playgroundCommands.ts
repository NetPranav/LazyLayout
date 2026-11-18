/** Animation Playground commands (ROADMAP Phase 90, Law 20). They only change how the canvas is looked at, except the knobs, which are the component commands that already exist. */
import { z } from "zod";
import { defineTypedCommand } from "../commands";
import { transport } from "../time/transport";
import { getDocument } from "../store/documentState";
import { useCanvasViewStore } from "../store/useCanvasViewStore";
import { usePlaygroundStore } from "../store/usePlaygroundStore";
import { statesOf } from "../states/states";
import { OVERLAYS, clampScale } from "./playground";

export function registerPlaygroundCommands(): () => void {
  const category = "Playground";
  const offs = [
    defineTypedCommand({
      id: "view.playground", title: "Open the Animation Playground", category,
      args: z.object({ on: z.boolean().optional() }).default({}),
      run: ({ on }) => {
        const store = usePlaygroundStore.getState();
        const next = on ?? !store.open;
        if (next === store.open) return { ok: true, on: next };
        const view = useCanvasViewStore.getState();
        if (next) {
          store.setOpen(true, view.mode);
          view.setMode("preview");
        } else {
          const back = store.before;
          store.setOpen(false);
          if (back && view.mode === "preview") view.setMode(back);
        }
        return { ok: true, on: next };
      },
    }),
    defineTypedCommand({
      id: "playground.timeScale", title: "Playground: Set Speed", category,
      args: z.object({ scale: z.number() }),
      run: ({ scale }) => {
        const rate = clampScale(scale);
        transport.setRate(rate);
        return { ok: true, rate };
      },
    }),
    defineTypedCommand({
      id: "playground.hold", title: "Playground: Hold a State", category,
      args: z.object({ layerId: z.string(), name: z.string().nullable() }),
      run: ({ layerId, name }) => {
        if (name === null) {
          usePlaygroundStore.getState().hold(null);
          return { ok: true };
        }
        if (!statesOf(getDocument(), layerId).some((s) => s.name === name)) return { ok: false, code: "NO_STATE", message: "That layer has no state with that name." };
        usePlaygroundStore.getState().hold({ layerId, name });
        return { ok: true };
      },
    }),
    defineTypedCommand({
      id: "playground.overlay", title: "Playground: Show or Hide an Overlay", category,
      args: z.object({ overlay: z.enum(OVERLAYS), on: z.boolean() }),
      run: ({ overlay, on }) => {
        usePlaygroundStore.getState().setOverlay(overlay, on);
        return { ok: true };
      },
    }),
  ];
  return () => offs.forEach((off) => off());
}

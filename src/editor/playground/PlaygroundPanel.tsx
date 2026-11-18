"use client";
import React, { useEffect, useState } from "react";
import { useStore } from "zustand";
import { Pause, Play, StepBack, StepForward, X } from "lucide-react";
import { Button } from "@/editor/components/Button";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { Toggle } from "@/editor/components/Toggle";
import { invokeCommand, tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useCanvasViewStore, BACKDROPS, type Backdrop } from "@/core/store/useCanvasViewStore";
import { useFramePreviewStore } from "@/core/store/useFramePreviewStore";
import { useMotionPreferenceStore } from "@/core/store/useMotionPreferenceStore";
import { usePlaygroundStore } from "@/core/store/usePlaygroundStore";
import { transport, transportStore, LOOP_MODES, type LoopMode } from "@/core/time/transport";
import { frameScheduler } from "@/core/time/scheduler";
import { statesOf } from "@/core/states/states";
import { instanceRootOf } from "@/core/components/instances";
import { OVERLAYS, OVERLAY_LABEL, TIME_SCALES } from "@/core/playground/playground";

/**
 * The Animation Playground (ROADMAP Phase 90): a panel on the canvas, open while the canvas is in Preview. It holds
 * no player of its own: speed, loop and stepping are the transport's, the backdrop and device screen are the
 * canvas's, reduced motion is Phase 93's switch, and the frame rate is the scheduler's. The knobs are the component
 * commands, so changing one is an edit to the instance (and undoable). Everything else only changes how it is looked at.
 */
const SPEEDS = TIME_SCALES.map((s) => ({ value: String(s), label: `${s}×` }));
const LOOPS: Array<{ value: LoopMode; label: string }> = [{ value: "off", label: "Once" }, { value: "loop", label: "Loop" }, { value: "ping-pong", label: "Ping-pong" }];
const BACKDROP_LABEL: Record<Backdrop, string> = { light: "Light", dark: "Dark", checker: "Checkerboard" };
const row = "ll:flex ll:items-center ll:justify-between ll:gap-2";
const label = "ll:font-mono ll:text-micro ll:text-muted ll:shrink-0";

export const PlaygroundPanel: React.FC = () => {
  const open = usePlaygroundStore((s) => s.open);
  const held = usePlaygroundStore((s) => s.held);
  const overlays = usePlaygroundStore((s) => s.overlays);
  const doc = useStore(documentStore, (s) => s.document);
  const selected = useSelectionStore((s) => s.selectedIds[0] ?? null);
  const playing = useStore(transportStore, (t) => t.playing);
  const rate = useStore(transportStore, (t) => t.rate);
  const loop = useStore(transportStore, (t) => t.loop);
  const backdrop = useCanvasViewStore((s) => s.backdrop);
  const activeFrame = useCanvasViewStore((s) => s.activeFrameId);
  const device = useFramePreviewStore((s) => (activeFrame ? !!s.previewing[activeFrame] : false));
  const reduced = useMotionPreferenceStore((s) => s.reduced);
  const mode = useCanvasViewStore((s) => s.mode);
  const [fps, setFps] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setFps(Math.round(frameScheduler.stats.fps)), 500);
    return () => clearInterval(t);
  }, [open]);

  // leaving Preview (Esc, the Exit button) closes the Playground: it only makes sense while the page is live
  useEffect(() => {
    if (open && mode !== "preview") usePlaygroundStore.getState().setOpen(false);
  }, [open, mode]);

  if (!open) return null;
  const layer = selected ? doc.layers[selected] : undefined;
  const states = layer ? statesOf(doc, layer.id) : [];
  const rootId = layer ? instanceRootOf(doc.layers, layer.id) : null;
  const root = rootId ? doc.layers[rootId] : undefined;
  const comp = root?.instance ? doc.designComponents?.[root.instance.component] : undefined;
  const variantProps = comp?.variantProps ?? [];
  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, args);
    setMessage(out.ok ? "" : (out.message ?? "That did not work."));
  };

  return (
    <div
      data-testid="playground-panel"
      role="dialog"
      aria-label="Animation Playground"
      className="ll:absolute ll:left-3 ll:bottom-3 ll:z-50 ll:w-[260px] ll:max-h-[70%] ll:overflow-y-auto ll:flex ll:flex-col ll:gap-2 ll:p-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-panel ll:text-primary ll:shadow-md"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={row}>
        <strong className="ll:text-micro">Animation Playground</strong>
        <span data-testid="playground-fps" aria-label="Frames per second" className="ll:font-mono ll:text-nano ll:text-muted">{fps} fps</span>
        <Button size="sm" aria-label="Close the Playground" onClick={() => void invokeCommand("view.playground", { on: false })}><Icon icon={X} size={12} /></Button>
      </div>

      <div className={row}>
        <Button size="sm" aria-label="Step back one frame" onClick={() => transport.stepFrame(-1)}><Icon icon={StepBack} size={12} /></Button>
        <Button size="sm" aria-label={playing ? "Pause" : "Play"} onClick={() => transport.togglePlay()}><Icon icon={playing ? Pause : Play} size={12} /></Button>
        <Button size="sm" aria-label="Step forward one frame" onClick={() => transport.stepFrame(1)}><Icon icon={StepForward} size={12} /></Button>
        <Button size="sm" aria-label="Back to the start" onClick={() => transport.stop()}>Start</Button>
      </div>
      <div className={row}>
        <span className={label}>Speed</span>
        <Select aria-label="Playground speed" size="sm" width="110px" options={SPEEDS} value={String(TIME_SCALES.find((s) => s === rate) ?? rate)} onChange={(v) => run("playground.timeScale", { scale: Number(v) })} />
      </div>
      <div className={row}>
        <span className={label}>Loop</span>
        <Select aria-label="Playground loop" size="sm" width="110px" options={LOOPS.filter((l) => LOOP_MODES.includes(l.value))} value={loop} onChange={(v) => transport.setLoop(v as LoopMode)} />
      </div>

      {layer && states.length > 0 && (
        <div className="ll:flex ll:flex-col ll:gap-1" data-section="playground-states">
          <span className={label}>State of {layer.name}</span>
          <div className="ll:flex ll:flex-wrap ll:gap-1">
            <Button size="sm" aria-label="Hold no state" aria-pressed={!held} onClick={() => run("playground.hold", { layerId: layer.id, name: null })}>Rest</Button>
            {states.map((s) => (
              <Button key={s.id} size="sm" aria-label={`Hold ${s.name} state`} aria-pressed={held?.layerId === layer.id && held.name === s.name} onClick={() => run("playground.hold", { layerId: layer.id, name: s.name })}>{s.name}</Button>
            ))}
          </div>
        </div>
      )}

      {root && variantProps.length > 0 && (
        <div className="ll:flex ll:flex-col ll:gap-1" data-section="playground-props">
          <span className={label}>Props of {root.name}</span>
          {variantProps.map((p) => (
            <div key={p.name} className={row}>
              <span className={label}>{p.name}</span>
              <Select aria-label={`Playground ${p.name}`} size="sm" width="110px" options={p.values.map((v) => ({ value: v, label: v }))} value={root.instance?.variant?.[p.name] ?? p.values[0]} onChange={(v) => run("component.setVariant", { values: { [p.name]: v }, ids: [root.id] })} />
            </div>
          ))}
        </div>
      )}

      <div className={row}>
        <span className={label}>Backdrop</span>
        <Select aria-label="Playground backdrop" size="sm" width="110px" options={BACKDROPS.map((b) => ({ value: b, label: BACKDROP_LABEL[b] }))} value={backdrop} onChange={(v) => useCanvasViewStore.getState().setBackdrop(v as Backdrop)} />
      </div>
      <div className={row}>
        <span className={label}>Device screen</span>
        <Toggle size="sm" aria-label="Show the page as a device screen" checked={device} disabled={!activeFrame} onChange={(on) => activeFrame && useFramePreviewStore.getState().setPreview(activeFrame, on)} />
      </div>
      <div className={row}>
        <span className={label}>Reduced motion</span>
        <Toggle size="sm" aria-label="Playground reduced motion" checked={reduced} onChange={(on) => run("view.reducedMotion", { on })} />
      </div>
      {OVERLAYS.map((o) => (
        <div key={o} className={row}>
          <span className={label}>{OVERLAY_LABEL[o]}</span>
          <Toggle size="sm" aria-label={`Show ${OVERLAY_LABEL[o]}`} checked={overlays.includes(o)} onChange={(on) => run("playground.overlay", { overlay: o, on })} />
        </div>
      ))}
      {message && <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">{message}</p>}
    </div>
  );
};

"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { Minus, Power } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { Button } from "@/editor/components/Button";
import { documentStore } from "@/core/store/documentState";
import { addBinding, bindingsOf, removeBinding, setBindingEnabled, setDriversNamed } from "@/core/bindings/bindingCommands";
import { DEFAULT_FOLLOW, FOLLOW_NAME, LOOK_NAME, PRESET_PIN_NAMES, followDrafts, lookAtDrafts, type PresetPinName } from "@/core/bindings/follow";
import { unservedSignals } from "@/core/bindings/inputBus";
import type { BindingDraft, Operator, Signal } from "@/core/document/signals";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Driven by (Design track D4): make a property follow the pointer, the scroll, the pointer's speed or time. Each driver is a
 * binding in the document (signal, then operators, then a property), so the engine, an export and the code view all read the
 * same thing. The editor shows drivers in Motion and Preview; Design shows the design itself.
 */

interface SignalChoice {
  label: string;
  hint: string;
  signal: Signal;
  /** Operators applied before the range map (to get one number from the signal). */
  pre: Operator[];
  /** The input range the map starts from: [min, max]. */
  range: [number, number];
  unit: string;
}
const SIGNALS: Record<string, SignalChoice> = {
  pointerX: { label: "Pointer, left to right", hint: "0 at the left edge of the page, 1 at the right", signal: { kind: "pointerIn", channel: "uv", space: "page" }, pre: [{ op: "component", axis: "x" }], range: [0, 1], unit: "" },
  pointerY: { label: "Pointer, top to bottom", hint: "0 at the top of the page, 1 at the bottom", signal: { kind: "pointerIn", channel: "uv", space: "page" }, pre: [{ op: "component", axis: "y" }], range: [0, 1], unit: "" },
  speed: { label: "Pointer speed", hint: "How fast the pointer moves, in px per second", signal: { kind: "pointer", channel: "speed" }, pre: [], range: [0, 2000], unit: "px/s" },
  scroll: { label: "Scroll", hint: "How far the page is scrolled, 0 at the top to 1 at the bottom (the editor does not measure scroll yet)", signal: { kind: "scroll", channel: "progress" }, pre: [], range: [0, 1], unit: "" },
  view: { label: "Section in view", hint: "How far a section has scrolled through the screen: 0 as it enters at the bottom, 1 as it leaves at the top (a section of the page you choose below)", signal: { kind: "view", layer: "", channel: "progress" }, pre: [], range: [0, 1], unit: "" },
  hover: { label: "Pointer over a layer", hint: "1 while the pointer is over the layer you choose, 0 when it is not, easing over 80 ms", signal: { kind: "layerState", channel: "hover", layer: "" }, pre: [], range: [0, 1], unit: "" },
  proximity: { label: "Distance to a layer", hint: "How far the pointer is from the edge of the layer you choose, in px (0 when over it)", signal: { kind: "proximity", layer: "" }, pre: [], range: [0, 400], unit: "px" },
  time: { label: "Time", hint: "Seconds on the timeline", signal: { kind: "time" }, pre: [], range: [0, 10], unit: "s" },
};
const SIGNAL_OPTIONS = Object.entries(SIGNALS).map(([value, s]) => ({ value, label: s.label, hint: s.hint }));

interface PropertyChoice {
  label: string;
  path: string;
  out: [number, number];
}
const PROPERTIES: Record<string, PropertyChoice> = {
  x: { label: "Position X", path: "transform.x", out: [0, 200] },
  y: { label: "Position Y", path: "transform.y", out: [0, 200] },
  rotate: { label: "Rotation", path: "transform.rotate", out: [0, 360] },
  scale: { label: "Scale", path: "transform.scale", out: [1, 1.5] },
  opacity: { label: "Opacity", path: "appearance.opacity", out: [0, 1] },
  cssvar: { label: "CSS variable", path: "", out: [0, 1] },
};
const PROPERTY_OPTIONS = Object.entries(PROPERTIES).map(([value, p]) => ({ value, label: p.label }));

const PIN_LABEL: Record<PresetPinName, string> = { topLeft: "Top left", top: "Top", topRight: "Top right", left: "Left", center: "Center", right: "Right", bottomLeft: "Bottom left", bottom: "Bottom", bottomRight: "Bottom right" };

const labelOf = (b: { expr: { signal: Signal }; target: { kind: string; path?: string; name?: string } }): string => {
  if (b.target.kind === "cssvar") {
    const sg = Object.values(SIGNALS).find((x) => "layer" in x.signal ? x.signal.kind === b.expr.signal.kind : JSON.stringify(x.signal) === JSON.stringify(b.expr.signal));
    return `${sg?.label ?? "Signal"} → --${b.target.name}`;
  }
  const k = b.expr.signal.kind;
  const sig = k === "view" ? SIGNALS.view : k === "proximity" ? SIGNALS.proximity : k === "layerState" ? SIGNALS.hover : Object.values(SIGNALS).find((s) => JSON.stringify(s.signal) === JSON.stringify(b.expr.signal));
  const prop = Object.values(PROPERTIES).find((p) => p.path === b.target.path);
  return `${sig?.label ?? "Signal"} → ${prop?.label ?? b.target.path ?? b.target.kind}`;
};
const rowLabel = (b: { name?: string; expr: { signal: Signal }; target: { kind: string; path?: string; name?: string } }): string => (b.name === LOOK_NAME ? LOOK_NAME : b.name === FOLLOW_NAME ? `${FOLLOW_NAME} (${b.target.path === "transform.y" ? "Y" : "X"})` : labelOf(b));

export const DrivenBySection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, layer, className = "" }) => {
  const bindings = useStore(documentStore, (s) => s.document.bindings); // re-read when drivers change (undo, redo, another panel)
  const layers = useStore(documentStore, (s) => s.document.layers);
  const [viewLayer, setViewLayer] = useState("");
  const [varName, setVarName] = useState("driven");
  const [signalKey, setSignalKey] = useState("pointerX");
  const [propKey, setPropKey] = useState("x");
  const [outRange, setOutRange] = useState<[number, number]>(PROPERTIES.x.out);
  const [inRange, setInRange] = useState<[number, number]>(SIGNALS.pointerX.range);
  const [smooth, setSmooth] = useState(0);
  const [pin, setPin] = useState<PresetPinName>(DEFAULT_FOLLOW.pin);
  const [lag, setLag] = useState(DEFAULT_FOLLOW.lag);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [followNote, setFollowNote] = useState("");
  const [lookOffset, setLookOffset] = useState(0);
  if (!selectedId || isMulti) return null;
  void bindings;
  const mine = bindingsOf(selectedId);
  const sig = SIGNALS[signalKey];

  const add = () => {
    const prop = PROPERTIES[propKey];
    const operators: Operator[] = [...sig.pre, { op: "remap", inMin: inRange[0], inMax: inRange[1], outMin: outRange[0], outMax: outRange[1], clamp: true }];
    if (smooth > 0) operators.push({ op: "smooth", tau: smooth });
    const signal: Signal = "layer" in sig.signal ? { ...sig.signal, layer: viewLayer || selectedId } : sig.signal;
    const cleanVar = varName.trim().replace(/^--/, "");
    if (propKey === "cssvar" && !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(cleanVar)) return; // the name is shown as invalid below
    const draft: BindingDraft = { expr: { signal, operators }, target: propKey === "cssvar" ? { kind: "cssvar", on: { kind: "layer", ref: selectedId }, name: cleanVar } : { kind: "property", on: { kind: "layer", ref: selectedId }, path: prop.path } };
    addBinding(draft, selectedId);
  };

  /** The layer's own box and pose in page px, measured from the page (zoom and pan do not matter): its unturned, unscaled size, centred where it is drawn. */
  const measure = () => {
    const el = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-element-id="${selectedId}"]`);
    const pageEl = el?.closest<HTMLElement>('[data-testid="stage-page"]');
    if (!el || !pageEl) return null;
    const r = el.getBoundingClientRect();
    const pr = pageEl.getBoundingClientRect();
    const k = pageEl.offsetWidth > 0 ? pr.width / pageEl.offsetWidth : 1;
    const t = getComputedStyle(el).transform;
    const m = new DOMMatrix(t === "none" ? undefined : t);
    const fr = layer?.properties["frame.rotation"];
    const pose = { rotate: (Math.atan2(m.b, m.a) * 180) / Math.PI, scaleX: Math.hypot(m.a, m.b) || 1, scaleY: Math.hypot(m.c, m.d) || 1, frameRotation: typeof fr === "number" ? fr : 0 };
    // the box the layer fills before it is turned or scaled (a shape's own svg has no offsetWidth; its client size is the same)
    const w = el.offsetWidth || el.clientWidth || parseFloat(el.getAttribute("width") ?? "") || r.width / k / pose.scaleX;
    const h = el.offsetHeight || el.clientHeight || parseFloat(el.getAttribute("height") ?? "") || r.height / k / pose.scaleY;
    const cx = (r.left + r.width / 2 - pr.left) / k;
    const cy = (r.top + r.height / 2 - pr.top) / k;
    return { box: { x: cx - w / 2, y: cy - h / 2, width: w, height: h }, pose };
  };
  const follow = () => {
    const m = measure();
    if (!m) {
      setFollowNote("The layer is not on the page right now.");
      return;
    }
    setDriversNamed(selectedId, FOLLOW_NAME, followDrafts(selectedId, m.box, { pin, lag, offsetX: offX, offsetY: offY, axis: "both" }, m.pose), "Follow pointer");
    setFollowNote("");
  };
  const look = () => {
    const m = measure();
    if (!m) {
      setFollowNote("The layer is not on the page right now.");
      return;
    }
    setDriversNamed(selectedId, LOOK_NAME, lookAtDrafts(selectedId, m.box, lookOffset), "Look at pointer");
    setFollowNote("");
  };
  const hasFollow = mine.some((b) => b.name === FOLLOW_NAME);
  const hasLook = mine.some((b) => b.name === LOOK_NAME);

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      {mine.map((b) => {
        const unserved = unservedSignals(b.expr);
        return (
          <div key={b.id} data-driver-id={b.id} className="ll:flex ll:items-center ll:gap-1.5 ll:min-h-7">
            <span className={`ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ${b.enabled ? "ll:text-primary" : "ll:text-muted"}`} title={unserved.length > 0 ? "This driver reads a signal the editor does not measure yet." : undefined}>
              {rowLabel(b)}
            </span>
            <button type="button" aria-label={`${b.enabled ? "Turn off" : "Turn on"} driver ${rowLabel(b)}`} aria-pressed={b.enabled} title={b.enabled ? "Turn off" : "Turn on"} onClick={() => setBindingEnabled(b.id, !b.enabled)} className="ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:text-secondary ll:hover:text-primary">
              <Icon icon={Power} size={14} />
            </button>
            <button type="button" aria-label={`Remove driver ${rowLabel(b)}`} title="Remove" onClick={() => removeBinding(b.id)} className="ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:text-secondary ll:hover:text-primary">
              <Icon icon={Minus} size={14} />
            </button>
          </div>
        );
      })}

      <OptionRow label="Driven by">
        <Select
          aria-label="Driver signal"
          size="sm"
          width="100%"
          options={SIGNAL_OPTIONS}
          value={signalKey}
          onChange={(v) => {
            setSignalKey(v);
            setInRange(SIGNALS[v].range);
          }}
        />
      </OptionRow>
      {"layer" in sig.signal && (
        <OptionRow label={signalKey === "view" ? "Section" : "Layer"}>
          <Select
            aria-label="Driver section"
            size="sm"
            width="100%"
            options={Object.values(layers).filter((l) => l.parentId !== null).map((l) => ({ value: l.id, label: l.name }))}
            value={viewLayer || selectedId}
            onChange={setViewLayer}
          />
        </OptionRow>
      )}
      <OptionRow label="Property">
        <Select
          aria-label="Driver property"
          size="sm"
          width="100%"
          options={PROPERTY_OPTIONS}
          value={propKey}
          onChange={(v) => {
            setPropKey(v);
            setOutRange(PROPERTIES[v].out);
          }}
        />
      </OptionRow>
      {propKey === "cssvar" && (
        <OptionRow label="Name">
          <input
            aria-label="Driver CSS variable name"
            title="The CSS variable this sets on the layer, without the leading --. Use it in your own CSS as var(--name)."
            spellCheck={false}
            value={varName}
            onChange={(e) => setVarName(e.target.value)}
            aria-invalid={!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(varName.trim().replace(/^--/, ""))}
            className="ll-dfield ll:w-full ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
          />
        </OptionRow>
      )}
      <OptionRow label="From">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <NumberField size="sm" aria-label="Driver input from" title={`The input value that gives the first output (${sig.unit || "unitless"}).`} value={inRange[0]} step={sig.range[1] > 100 ? 10 : 0.1} onChange={(v) => setInRange([v, inRange[1]])} />
          <NumberField size="sm" aria-label="Driver input to" title="The input value that gives the second output." value={inRange[1]} step={sig.range[1] > 100 ? 10 : 0.1} onChange={(v) => setInRange([inRange[0], v])} />
        </div>
      </OptionRow>
      <OptionRow label="To">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <NumberField size="sm" aria-label="Driver output from" title="What the property is when the input is at its first value." value={outRange[0]} step={1} onChange={(v) => setOutRange([v, outRange[1]])} />
          <NumberField size="sm" aria-label="Driver output to" title="What the property is when the input is at its second value." value={outRange[1]} step={1} onChange={(v) => setOutRange([outRange[0], v])} />
        </div>
      </OptionRow>
      <OptionRow label="Smoothing">
        <NumberField size="sm" aria-label="Driver smoothing" title="Seconds the value takes to catch up with the input. 0 follows it at once." value={smooth} min={0} step={0.05} onChange={(v) => setSmooth(Math.max(0, v))} />
      </OptionRow>
      <Button size="sm" aria-label="Add driver" onClick={add}>
        Add driver
      </Button>

      <OptionRow label="Follow">
        <Select aria-label="Follow pin" size="sm" width="100%" options={PRESET_PIN_NAMES.map((p) => ({ value: p, label: PIN_LABEL[p] }))} value={pin} onChange={(v) => setPin(v as PresetPinName)} />
      </OptionRow>
      <OptionRow label="Lag">
        <NumberField size="sm" aria-label="Follow lag" title="Seconds the layer takes to catch up with the pointer. 0 sticks to it." value={lag} min={0} step={0.05} onChange={(v) => setLag(Math.max(0, v))} />
      </OptionRow>
      <OptionRow label="Offset">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <NumberField size="sm" aria-label="Follow offset X" title="Keeps the point this many px to the right of the pointer (negative: left)." value={offX} step={1} onChange={setOffX} />
          <NumberField size="sm" aria-label="Follow offset Y" title="Keeps the point this many px below the pointer (negative: above)." value={offY} step={1} onChange={setOffY} />
        </div>
      </OptionRow>
      <Button size="sm" aria-label={hasFollow ? "Update follow" : "Follow the pointer"} onClick={follow}>
        {hasFollow ? "Update follow" : "Follow the pointer"}
      </Button>
      <OptionRow label="Face">
        <NumberField size="sm" aria-label="Look at offset" title="Degrees added to the turn, for artwork that does not point right when it is not turned: 90 for artwork that points up." value={lookOffset} step={15} onChange={setLookOffset} />
      </OptionRow>
      <Button size="sm" aria-label={hasLook ? "Update look at" : "Look at the pointer"} onClick={look}>
        {hasLook ? "Update look at" : "Look at the pointer"}
      </Button>
      {followNote && (
        <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">
          {followNote}
        </p>
      )}
    </div>
  );
};

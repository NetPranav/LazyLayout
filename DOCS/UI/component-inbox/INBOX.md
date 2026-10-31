# Paste components here

Paste whatever the site gives you under a new heading: the import instruction, the install command (for example `npx shadcn add ...`), the prompt, the code, or just the link. Add a line on where you want it in Lazy Layout. No need to clean anything up.

Workers do not run install commands, because we add no new dependencies. They read the instruction, take the component's code and rewrite it to our rules (`ll:` Tailwind classes, our tokens, no pills, no glass).


squish switch -

## Integrate the <SquishSwitch /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: SquishSwitch
### Variant: TypeScript + Tailwind
### Dependencies: motion

---

### Usage Example
```jsx
import { useState } from 'react';
import SquishSwitch from './SquishSwitch';

const [airplane, setAirplane] = useState(false);

<SquishSwitch
  checked={airplane}
  onChange={setAirplane}
  label="Airplane mode"
  trackColor="#27272a"
  trackOnColor="#f5f5f5"
  width={76}
  height={38}
  radius={19}
  speed={50}
  stretch={36}
  hoverScale={1.035}
  colorDuration={320}
/>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| checked | boolean | undefined | Controlled state. Leave it out to let the switch keep its own. |
| defaultChecked | boolean | false | Initial state when uncontrolled. |
| onChange | (checked: boolean) => void | - | A tap, a drag past the middle, or a key. |
| label | string | "" | A label beside the switch, wired to it. |
| disabled | boolean | false | Dimmed and inert. |
| trackColor | string | "#27272a" | The track while off. |
| trackOnColor | string | "#f5f5f5" | The track while on. |
| thumbColor | string | "" | The thumb while off. Empty mixes the on colour faintly into the track. |
| thumbOnColor | string | "" | The thumb while on. Empty uses the off track colour. |
| width | number | 76 | Track width in px. |
| height | number | 38 | Track height in px. The thumb and its inset follow. |
| radius | number | 19 | Track corner radius in px, capped at half the height. |
| speed | number | 50 | Stiffness of the settle spring, 0 to 100. Low is lazy, high is snappy. |
| stretch | number | 36 | How much the thumb lengthens with speed, 0 to 100. It narrows to keep its area. |
| hoverScale | number | 1.035 | The thumb swells to this on hover. |
| colorDuration | number | 320 | The colour cross-fade, in ms. |
| ariaLabel | string | - | Accessible name when there is no label. |
| className | string | "" | Extra classes for the root element. |
| id | string | - | Id for the switch button; the label uses it. |

### Full Component Source
```tsx
'use client';

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent
} from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from 'motion/react';
export interface SquishSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  trackColor?: string;
  trackOnColor?: string;
  thumbColor?: string;
  thumbOnColor?: string;
  width?: number;
  height?: number;
  radius?: number;
  speed?: number;
  stretch?: number;
  hoverScale?: number;
  colorDuration?: number;
  ariaLabel?: string;
  className?: string;
  id?: string;
}

interface Grip {
  id: number;
  grab: number | null;
  moved: boolean;
  startX: number;
  onAtPress: boolean;
  slop: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const FLOW_SPRING = { stiffness: 320, damping: 40, mass: 0.6 };
const SWELL_SPRING = { stiffness: 520, damping: 34, mass: 0.6 };
const MAX_STRETCH = 0.4;
const STRETCH_SPEED = 600;
const TAP_SLOP = { fine: 4, coarse: 8 };

const SquishSwitch: React.FC<SquishSwitchProps> = ({
  checked,
  defaultChecked = false,
  onChange,
  label = '',
  disabled = false,
  trackColor = '#27272a',
  trackOnColor = '#f5f5f5',
  thumbColor = '',
  thumbOnColor = '',
  width = 76,
  height = 38,
  radius = 19,
  speed = 50,
  stretch = 36,
  hoverScale = 1.035,
  colorDuration = 320,
  ariaLabel,
  className = '',
  id
}) => {
  const reduce = useReducedMotion();
  const inset = Math.max(3, Math.round(height * 0.11));
  const thumb = height - inset * 2;
  const min = inset;
  const max = width - inset - thumb;
  const mid = (min + max) / 2;
  const trackRadius = Math.min(radius, height / 2);
  const thumbRadius = Math.max(2, trackRadius - inset);

  const isControlled = checked !== undefined;
  const [inner, setInner] = useState(defaultChecked);
  const on = isControlled ? checked : inner;
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLSpanElement>(null);
  const grip = useRef<Grip | null>(null);
  const onRef = useRef(on);
  onRef.current = on;
  const skipClick = useRef(false);
  const autoId = useId();
  const buttonId = id ?? autoId;

  const x = useMotionValue(on ? max : min);
  const flow = useSpring(useVelocity(x), FLOW_SPRING);
  const swell = useSpring(1, SWELL_SPRING);
  const gain = reduce ? 0 : clamp(stretch, 0, 100) / 100;
  const stretchOf = (v: number) => 1 + Math.min(MAX_STRETCH, Math.abs(v) / STRETCH_SPEED) * gain;
  const scaleX = useTransform([flow, swell], ([v, h]: number[]) => stretchOf(v) * h);
  const scaleY = useTransform([flow, swell], ([v, h]: number[]) => h / stretchOf(v));

  const commit = (next: boolean) => {
    if (next === onRef.current) return;
    onRef.current = next;
    if (!isControlled) setInner(next);
    onChange?.(next);
  };

  useEffect(() => {
    if (dragging) return undefined;
    const target = on ? max : min;
    if (reduce) {
      x.jump(target);
      return undefined;
    }
    const controls = animate(x, target, {
      type: 'spring',
      stiffness: 170 - (50 - clamp(speed, 0, 100)) * 1.1,
      damping: 21.5,
      mass: 0.9,
      restDelta: 0.001,
      restSpeed: 0.01
    });
    return () => controls.stop();
  }, [on, dragging, min, max, speed, reduce, x]);

  const localX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / (el.offsetWidth || rect.width) || 1;
    return (clientX - rect.left) / scale;
  };
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || grip.current || e.button !== 0) return;
    grip.current = {
      id: e.pointerId,
      grab: null,
      moved: false,
      startX: e.clientX,
      onAtPress: onRef.current,
      slop: e.pointerType === 'touch' ? TAP_SLOP.coarse : TAP_SLOP.fine
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const lx = localX(e.clientX);
    if (g.grab === null) {
      g.grab = lx - x.get();
      return;
    }
    if (!g.moved && Math.abs(e.clientX - g.startX) > g.slop) g.moved = true;
    if (!g.moved) return;
    const nx = clamp(lx - g.grab, min, max);
    x.set(nx);
    commit(nx > mid);
  };
  const up = (e: { pointerId: number; currentTarget: HTMLButtonElement }, cancelled: boolean) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (cancelled) commit(g.onAtPress);
    else if (!g.moved) commit(!onRef.current);
    skipClick.current = true;
    setTimeout(() => {
      skipClick.current = false;
    }, 0);
    setDragging(false);
  };
  const click = () => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (!disabled) commit(!onRef.current);
  };

  return (
    <span className={`inline-flex items-center gap-2.5${className ? ` ${className}` : ''}`}>
      <button
        id={buttonId}
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
        className="group relative m-0 inline-block cursor-pointer touch-pan-y border-0 bg-transparent p-0 outline-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] after:absolute after:-inset-2 after:content-[''] data-[held]:cursor-grabbing aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        data-on={on ? '' : undefined}
        data-held={dragging ? '' : undefined}
        style={
          {
            '--ss-w': `${width}px`,
            '--ss-h': `${height}px`,
            '--ss-inset': `${inset}px`,
            '--ss-thumb': `${thumb}px`,
            '--ss-r': `${trackRadius}px`,
            '--ss-thumb-r': `${thumbRadius}px`,
            '--ss-track': trackColor,
            '--ss-track-on': trackOnColor,
            '--ss-thumb-color': thumbColor || `color-mix(in srgb, ${trackOnColor} 19%, ${trackColor})`,
            '--ss-thumb-on': thumbOnColor || trackColor,
            '--ss-fade': `${colorDuration}ms`
          } as CSSProperties
        }
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={e => up(e, false)}
        onPointerCancel={e => up(e, true)}
        onPointerEnter={(e: PointerEvent<HTMLButtonElement>) => {
          if (e.pointerType === 'mouse' && !disabled) swell.set(hoverScale);
        }}
        onPointerLeave={() => swell.set(1)}
        onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
          if (e.key === 'Escape' && grip.current)
            up({ pointerId: grip.current.id, currentTarget: e.currentTarget }, true);
        }}
        onClick={click}
      >
        <span
          ref={trackRef}
          className="relative block [width:var(--ss-w)] [height:var(--ss-h)] [border-radius:var(--ss-r)] [background:var(--ss-track)] [transition:background-color_var(--ss-fade)_ease] group-data-[on]:[background:var(--ss-track-on)] motion-reduce:[transition-duration:1ms]"
        >
          <motion.span
            className="absolute left-0 [top:var(--ss-inset)] [width:var(--ss-thumb)] [height:var(--ss-thumb)] [border-radius:var(--ss-thumb-r)] [background:var(--ss-thumb-color)] [transition:background-color_var(--ss-fade)_ease] group-data-[on]:[background:var(--ss-thumb-on)] motion-reduce:[transition-duration:1ms]"
            aria-hidden="true"
            style={{ x, scaleX, scaleY }}
          />
        </span>
      </button>
      {label ? (
        <label htmlFor={buttonId} className="cursor-pointer select-none">
          {label}
        </label>
      ) : null}
    </span>
  );
};

export default SquishSwitch;

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import and render the component using the usage example above as a starting point.
4. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.


2. Scrub Field - 

## Integrate the <ScrubField /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: ScrubField
### Variant: TypeScript + CSS
### Dependencies: motion

---

### Usage Example
```jsx
import ScrubField from './ScrubField';

<ScrubField
  label="Radius"
  suffix="px"
  defaultValue={24}
  min={0}
  max={100}
  step={1}
  size="md"
  sensitivity={2}
  rubberReach={8}
  returnDuration={300}
  coarseMultiplier={10}
  fineMultiplier={0.1}
  showDelta
  showDirty={false}
  showFill
  accent="#f5f5f5"
  chipColor="#27272a"
  onChange={value => setRadius(value)}
  onCommit={value => save(value)}
/>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| label | string | "Radius" | The field name. Drag anywhere on the chip to scrub; click without moving to type. |
| suffix | string | "px" | Unit after the number, also read by screen readers. |
| value | number | undefined | Controlled value; changes from outside land without motion. |
| defaultValue | number | 24 | Initial value and the dirty baseline: the ring turns off exactly here. |
| min | number | 0 | Lower bound; the rubber band starts here. |
| max | number | 100 | Upper bound; the rubber band starts here. |
| step | number | 1 | Granularity of drag and arrows; sets the decimals shown. |
| size | "sm" | "md" | "lg" | "md" | Chip height 28, 34 or 44 pixels. |
| sensitivity | number | 2 | Pixels of travel per step. 1 is twitchy, 6 is precise. |
| rubberReach | number | 8 | How far past a bound the number can be pushed, as a percent of the range. 0 is a hard stop. |
| returnDuration | number | 300 | Duration in milliseconds of the critically damped snap back to the bound. |
| coarseMultiplier | number | 10 | Step multiplier while Shift is held, and for Page Up and Page Down. |
| fineMultiplier | number | 0.1 | Step multiplier while Alt or Option is held; adds a decimal. |
| showDelta | boolean | true | Shows the signed change in a pill riding the pointer. |
| showDirty | boolean | false | Rings the chip while the value differs from the default. |
| showFill | boolean | true | Fills the chip from the left in proportion to where the value sits in the range. |
| accent | string | "#f5f5f5" | Fill band, dirty ring and delta pill. |
| chipColor | string | "#27272a" | Chip surface. Text inherits from the page. |
| disabled | boolean | false | Dims the chip and ignores input. |
| onChange | (value: number) => void | - | Called on every step, key and typed commit. |
| onCommit | (value: number) => void | - | Called on release, on a key step and on blur or Enter. |
| className | string | "" | Extra classes for the chip. |

### Full Component Source
```tsx
'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionStyle
} from 'motion/react';

import './ScrubField.css';

export type ScrubFieldSize = 'sm' | 'md' | 'lg';

export interface ScrubFieldProps {
  label?: string;
  suffix?: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  size?: ScrubFieldSize;
  sensitivity?: number;
  rubberReach?: number;
  returnDuration?: number;
  coarseMultiplier?: number;
  fineMultiplier?: number;
  showDelta?: boolean;
  showDirty?: boolean;
  showFill?: boolean;
  accent?: string;
  chipColor?: string;
  disabled?: boolean;
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
  className?: string;
}

interface DragState {
  id: number;
  x: number;
  raw: number;
  mult: number;
  moved: boolean;
  before: number;
  slack: number;
  left: number;
}

type Modifiers = { shiftKey: boolean; altKey: boolean };

const SPRING_UI = { type: 'spring' as const, duration: 0.3, bounce: 0 };
const LEAN = 4;
const SIZES: Record<ScrubFieldSize, { height: number; font: number; radius: number; width: number }> = {
  sm: { height: 28, font: 12, radius: 6, width: 104 },
  md: { height: 34, font: 13, radius: 8, width: 128 },
  lg: { height: 44, font: 16, radius: 10, width: 160 }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const decimalsOf = (n: number) => {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};
const onColor = (hex: string) => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? [...raw].map(ch => ch + ch).join('') : raw.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '#ffffff';
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq >= 128 ? '#111111' : '#ffffff';
};

const ScrubField: React.FC<ScrubFieldProps> = ({
  label = 'Radius',
  suffix = 'px',
  value: valueProp,
  defaultValue = 24,
  min = 0,
  max = 100,
  step = 1,
  size = 'md',
  sensitivity = 2,
  rubberReach = 8,
  returnDuration = 300,
  coarseMultiplier = 10,
  fineMultiplier = 0.1,
  showDelta = true,
  showDirty = false,
  showFill = true,
  accent = '#f5f5f5',
  chipColor = '#27272a',
  disabled = false,
  onChange,
  onCommit,
  className = ''
}) => {
  const id = useId();
  const reduce = useReducedMotion();
  const controlled = valueProp !== undefined;
  const [value, setValue] = useState<number>(controlled ? (valueProp as number) : defaultValue);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const display = useMotionValue(value);
  const chipRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<DragState | null>(null);
  const valueRef = useRef(value);
  const typingRef = useRef(false);
  const movedRef = useRef(false);
  const endRef = useRef<(cancel?: boolean) => void>(() => {});
  const escRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  const mounted = useRef(false);

  const baseDecimals = decimalsOf(step);
  const fineDecimals = Math.min(6, baseDecimals + decimalsOf(fineMultiplier));
  const preset = SIZES[size] || SIZES.md;

  const fmt = (v: number) => {
    const scaled = v * 10 ** baseDecimals;
    return v.toFixed(Math.abs(scaled - Math.round(scaled)) < 1e-6 ? baseDecimals : fineDecimals);
  };
  const signed = (d: number) => (d < 0 ? '−' : '+') + fmt(Math.abs(d));

  const reach = (rubberReach / 100) * Math.max(max - min, Number.EPSILON);
  const bend = (raw: number) => (reach ? Math.sign(raw) * reach * Math.log1p(Math.abs(raw) / reach) : 0);
  const unbend = (over: number) => (reach ? Math.sign(over) * reach * Math.expm1(Math.abs(over) / reach) : 0);
  const toShown = (raw: number) => {
    const c = clamp(raw, min, max);
    return c + bend(raw - c);
  };
  const toRaw = (shown: number) => {
    const c = clamp(shown, min, max);
    return c + unbend(shown - c);
  };
  const multiplierOf = (e: Modifiers) => (e.shiftKey ? coarseMultiplier : e.altKey ? fineMultiplier : 1);

  const commit = (next: number) => {
    const rounded = clamp(Number(next.toFixed(fineDecimals)), min, max);
    if (rounded === valueRef.current) return;
    valueRef.current = rounded;
    setValue(rounded);
    onChange?.(rounded);
  };

  useMotionValueEvent(display, 'change', d => {
    if (!typingRef.current && inputRef.current) inputRef.current.value = fmt(d);
    if (chipRef.current) chipRef.current.dataset.over = d < min || d > max ? 'true' : 'false';
  });
  const lean = useTransform(display, d =>
    reduce || !reach ? 0 : clamp((d - clamp(d, min, max)) / reach, -1, 1) * LEAN
  );
  const chipTransform = useMotionTemplate`translateX(${lean}px)`;
  const fill = useTransform(display, d => (clamp(d, min, max) - min) / Math.max(max - min, Number.EPSILON));
  const fillTransform = useMotionTemplate`scaleX(${fill})`;

  const adopt = (next: number) => {
    valueRef.current = next;
    setValue(next);
    display.jump(next);
    if (!typingRef.current && inputRef.current) inputRef.current.value = fmt(next);
  };

  useEffect(() => {
    if (controlled && !drag.current && valueProp !== valueRef.current) adopt(clamp(valueProp as number, min, max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueProp]);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!controlled && !drag.current) adopt(clamp(defaultValue, min, max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);
  useEffect(() => {
    if (!typingRef.current && inputRef.current) inputRef.current.value = fmt(valueRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDecimals, fineDecimals]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || drag.current || e.button !== 0 || typingRef.current) return;
    if (e.pointerType !== 'touch') e.preventDefault();
    display.stop();
    movedRef.current = false;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      raw: toRaw(display.get()),
      mult: multiplierOf(e),
      moved: false,
      before: valueRef.current,
      slack: e.pointerType === 'touch' ? 8 : 3,
      left: chipRef.current ? chipRef.current.getBoundingClientRect().left : 0
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    escRef.current = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') endRef.current(true);
    };
    window.addEventListener('keydown', escRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || e.pointerId !== g.id) return;
    if (!g.moved) {
      if (Math.abs(e.clientX - g.x) < g.slack) return;
      g.moved = true;
      movedRef.current = true;
      g.x = e.clientX;
      setDragging(true);
      document.documentElement.style.cursor = 'ew-resize';
    }
    const m = multiplierOf(e);
    if (m !== g.mult) {
      g.mult = m;
      g.raw = toRaw(display.get());
      g.x = e.clientX;
    }
    const raw = g.raw + Math.round((e.clientX - g.x) / sensitivity) * step * m;
    const shown = toShown(raw);
    display.set(shown);
    commit(clamp(raw, min, max));
    if (ghostRef.current) {
      ghostRef.current.style.translate = `calc(${e.clientX - g.left}px - 50%) -100%`;
      ghostRef.current.textContent = signed(shown - g.before);
    }
  };

  const end = (cancel = false) => {
    const g = drag.current;
    if (!g) return;
    drag.current = null;
    setDragging(false);
    document.documentElement.style.cursor = '';
    if (escRef.current) {
      window.removeEventListener('keydown', escRef.current);
      escRef.current = null;
    }
    if (cancel) {
      commit(g.before);
      display.jump(g.before);
      return;
    }
    if (!g.moved) {
      inputRef.current?.focus();
      return;
    }
    const bound = clamp(display.get(), min, max);
    if (display.get() !== bound) {
      if (reduce) display.jump(bound);
      else animate(display, bound, { ...SPRING_UI, duration: returnDuration / 1000 });
    }
    if (g.moved && valueRef.current !== g.before) onCommit?.(valueRef.current);
  };
  endRef.current = end;

  const leaveTyping = () => {
    typingRef.current = false;
    setDraft(null);
    if (inputRef.current) inputRef.current.value = fmt(valueRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const typedNumber = draft !== null && draft.trim() !== '' ? Number(draft) : NaN;
    const from = Number.isNaN(typedNumber) ? valueRef.current : typedNumber;
    const deltas: Record<string, number> = {
      ArrowUp: step * multiplierOf(e),
      ArrowDown: -step * multiplierOf(e),
      PageUp: step * coarseMultiplier,
      PageDown: -step * coarseMultiplier
    };
    const delta = deltas[e.key];
    if (delta !== undefined || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      leaveTyping();
      commit(delta !== undefined ? from + delta : e.key === 'Home' ? min : max);
      display.jump(valueRef.current);
      if (inputRef.current) inputRef.current.value = fmt(valueRef.current);
      onCommit?.(valueRef.current);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      leaveTyping();
      e.currentTarget.blur();
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    typingRef.current = true;
    setDraft(e.target.value);
    e.target.select();
  };

  const handleBlur = () => {
    const n = draft === null ? NaN : parseFloat(draft.replace(/[^\d.-]/g, ''));
    if (!Number.isNaN(n)) {
      commit(n);
      onCommit?.(valueRef.current);
    }
    leaveTyping();
    display.jump(valueRef.current);
  };

  useEffect(
    () => () => {
      document.documentElement.style.cursor = '';
      if (escRef.current) window.removeEventListener('keydown', escRef.current);
    },
    []
  );

  const dirty = showDirty && value !== defaultValue;

  return (
    <motion.div
      ref={chipRef}
      className={`scrub-field${className ? ` ${className}` : ''}`}
      data-dirty={dirty ? 'true' : 'false'}
      data-dragging={dragging ? 'true' : 'false'}
      data-typing={draft !== null ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => end()}
      onPointerCancel={() => end(true)}
      onLostPointerCapture={() => end()}
      style={
        {
          '--sf-accent': accent,
          '--sf-chip': chipColor,
          '--sf-ghost-ink': onColor(accent),
          '--sf-h': `${preset.height}px`,
          '--sf-fs': `${preset.font}px`,
          '--sf-r': `${preset.radius}px`,
          '--sf-w': `${preset.width}px`,
          transform: chipTransform
        } as MotionStyle
      }
    >
      {showFill ? (
        <span className="scrub-field__track" aria-hidden="true">
          <motion.span className="scrub-field__fill" style={{ transform: fillTransform }} />
        </span>
      ) : null}
      <label
        htmlFor={id}
        className="scrub-field__handle"
        onClick={e => {
          if (movedRef.current) e.preventDefault();
        }}
      >
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className="scrub-field__input"
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${fmt(value)}${suffix ? ` ${suffix}` : ''}`}
        defaultValue={fmt(value)}
        disabled={disabled}
        onFocus={handleFocus}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {suffix ? (
        <span className="scrub-field__suffix" aria-hidden="true">
          {suffix}
        </span>
      ) : null}
      {showDelta ? <span ref={ghostRef} className="scrub-field__ghost" aria-hidden="true" /> : null}
    </motion.div>
  );
};

export default ScrubField;

```

### Component CSS
```css
.scrub-field {
  --sf-accent: #f5f5f5;
  --sf-chip: #27272a;
  --sf-ghost-ink: #111111;
  --sf-h: 34px;
  --sf-fs: 13px;
  --sf-r: 8px;
  --sf-w: 128px;
  --sf-ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: var(--sf-w);
  height: var(--sf-h);
  padding: 0 8px 0 4px;
  border-radius: var(--sf-r);
  background: var(--sf-chip);
  font-family: inherit;
  font-size: var(--sf-fs);
  line-height: 1;
  box-shadow: 0 0 0 1px transparent;
  cursor: ew-resize;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 200ms ease,
    box-shadow 200ms ease;
}

.scrub-field[data-dirty='true'] {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sf-accent) 55%, transparent);
  transition-duration: 0ms;
}

.scrub-field[data-typing='true'] {
  background: color-mix(in srgb, currentColor 7%, var(--sf-chip));
  cursor: text;
}

.scrub-field__track {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
}

.scrub-field__fill {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--sf-accent) 16%, transparent);
  transform-origin: left center;
}

.scrub-field[data-disabled='true'] {
  opacity: 0.5;
  cursor: default;
}

.scrub-field__handle {
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 6px;
  border-radius: calc(var(--sf-r) - 2px);
  color: color-mix(in srgb, currentColor 55%, transparent);
  font-weight: 500;
  white-space: nowrap;
  cursor: inherit;
  transition:
    color 120ms ease,
    transform 160ms var(--sf-ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .scrub-field:not([data-disabled='true']):hover .scrub-field__handle {
    color: color-mix(in srgb, currentColor 85%, transparent);
  }
}

.scrub-field:not([data-disabled='true']):not([data-typing='true']):active .scrub-field__handle,
.scrub-field[data-dragging='true'] .scrub-field__handle {
  transform: scale(0.96);
  color: currentColor;
}

.scrub-field__input {
  flex: 1;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
  cursor: inherit;
  transition: color 120ms ease;
}

.scrub-field[data-typing='true'] .scrub-field__input {
  cursor: text;
}

.scrub-field[data-over='true'] .scrub-field__input {
  color: color-mix(in srgb, currentColor 55%, transparent);
}

.scrub-field__suffix {
  color: color-mix(in srgb, currentColor 45%, transparent);
  font-weight: 500;
}

.scrub-field__ghost {
  position: absolute;
  top: -6px;
  left: 0;
  translate: 0 -100%;
  transform-origin: 50% 100%;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--sf-accent);
  color: var(--sf-ghost-ink);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  scale: 0.95;
  transition:
    opacity 125ms var(--sf-ease-out),
    scale 125ms var(--sf-ease-out);
}

.scrub-field[data-dragging='true'] .scrub-field__ghost {
  opacity: 1;
  scale: 1;
}

@media (prefers-reduced-motion: reduce) {
  .scrub-field .scrub-field__handle {
    transform: none;
    transition: color 120ms ease;
  }

  .scrub-field .scrub-field__ghost {
    scale: 1;
    transition: opacity 200ms ease;
  }
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.


3. Elastic Slider - 

## Integrate the <ElasticSlider /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: ElasticSlider
### Variant: TypeScript + CSS
### Dependencies: @hugeicons/react @hugeicons/core-free-icons

---

### Usage Example
```jsx
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon, VolumeLowIcon } from '@hugeicons/core-free-icons';
import ElasticSlider from './ElasticSlider';

<ElasticSlider
  defaultValue={50}
  leftIcon={<HugeiconsIcon icon={VolumeLowIcon} size={20} />}
  rightIcon={<HugeiconsIcon icon={VolumeHighIcon} size={20} />}
  onChange={value => console.log(value)}
/>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| value | number | - | Controlled value. Pair it with onChange. |
| defaultValue | number | 50 | Starting value when uncontrolled. |
| startingValue | number | 0 | Lowest value of the range. |
| maxValue | number | 100 | Highest value of the range. |
| isStepped | boolean | false | Snaps the value to stepSize increments. |
| stepSize | number | 1 | Size of each step when isStepped is on. |
| onChange | (value: number) => void | - | Called as the value changes. |
| onChangeEnd | (value: number) => void | - | Called when a drag, key press or scroll finishes. |
| orientation | 'horizontal' | 'vertical' | 'horizontal' | Direction of the track. Vertical sliders fill from the bottom. |
| leftIcon | ReactNode | volume low icon | Icon at the start of the track. Pass null to hide it. |
| rightIcon | ReactNode | volume high icon | Icon at the end of the track. Pass null to hide it. |
| iconPlacement | 'outside' | 'inside' | 'outside' | Puts the icons beside the track, or inside it once the track is thick enough to hold them. |
| valuePosition | 'top' | 'bubble' | 'inside' | 'none' | 'top' | Where the value shows. Bubble rides above the fill while the slider is active. |
| formatValue | (value: number) => string | - | Formats the shown value and the value read by screen readers. |
| ticks | boolean | number[] | false | Marks along the track. True marks every step, or every tenth when not stepped. An array marks those values. |
| thumb | boolean | false | Shows a round handle at the end of the fill. |
| fillFrom | number | startingValue | Value the fill grows from. Set it to the middle of the range for a centered, two-way fill. |
| thickness | number | 6 | Track thickness in px at rest. |
| activeThickness | number | 12 | Track thickness in px while hovered, focused or dragged. |
| radius | number | - | Corner radius of the track in px. Fully round when left out. |
| restOpacity | number | 0.7 | Opacity while idle. The slider brightens to full when active. |
| growOnHover | boolean | true | Hovering activates the slider. When off it only grows while pressed or focused. |
| maxStretch | number | 50 | Furthest the track stretches in px when pulled past an end. 0 turns the stretch off. |
| bounce | number | 0.5 | How much the track wobbles as it springs back, from 0 to 0.95. |
| jumpToClick | boolean | true | Pressing the track jumps to the pointer. When off, dragging moves the value from where it was. |
| wheel | boolean | false | Lets the scroll wheel change the value. |
| trackColor | string | 'color-mix(in srgb, currentColor 18%, transparent)' | Color of the empty track. |
| rangeColor | string | 'currentColor' | Color of the fill. |
| iconColor | string | 'currentColor' | Color of the outside icons. |
| contentColor | string | 'currentColor' | Color of icons, values and ticks over the empty track. |
| fillContentColor | string | 'auto' | Color of icons, values and ticks over the fill. Auto picks light or dark from the fill color. |
| thumbColor | string | '#ffffff' | Color of the handle. |
| disabled | boolean | false | Turns off interaction and dims the slider. |
| ariaLabel | string | 'Slider' | Accessible name of the slider. |
| className | string | '' | Extra class names for the root. |
| style | CSSProperties | - | Inline styles for the root. |

### Full Component Source
```tsx
'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon, VolumeLowIcon } from '@hugeicons/core-free-icons';
import './ElasticSlider.css';

export interface ElasticSliderProps {
  value?: number;
  defaultValue?: number;
  startingValue?: number;
  maxValue?: number;
  isStepped?: boolean;
  stepSize?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  orientation?: 'horizontal' | 'vertical';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  iconPlacement?: 'outside' | 'inside';
  valuePosition?: 'top' | 'bubble' | 'inside' | 'none';
  formatValue?: (value: number) => string;
  ticks?: boolean | number[];
  thumb?: boolean;
  fillFrom?: number;
  thickness?: number;
  activeThickness?: number;
  radius?: number;
  restOpacity?: number;
  growOnHover?: boolean;
  maxStretch?: number;
  bounce?: number;
  jumpToClick?: boolean;
  wheel?: boolean;
  trackColor?: string;
  rangeColor?: string;
  iconColor?: string;
  contentColor?: string;
  fillContentColor?: string;
  thumbColor?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

interface Motion {
  p: number;
  vp: number;
  target: number;
  s: number;
  vs: number;
  side: number;
  held: boolean;
  a: number;
  va: number;
  goal: number;
  length: number;
  dragging: boolean;
  hovered: boolean;
  focused: boolean;
  raf: number;
  last: number;
  ready: boolean;
}

interface Drag {
  id: number;
  origin: number;
  from: number | null;
}

const ROOT = 'elastic-slider';
const VALUE = 'elastic-slider__value';
const BODY = 'elastic-slider__body';
const ICON = 'elastic-slider__icon';
const ICON_INNER = 'elastic-slider__icon-inner';
const HIT = 'elastic-slider__hit';
const TRACK = 'elastic-slider__track';
const RANGE = 'elastic-slider__range';
const CONTENT = 'elastic-slider__content';
const FILL_CONTENT = 'elastic-slider__content elastic-slider__content--fill';
const TICK = 'elastic-slider__tick';
const FILL_TICK = 'elastic-slider__tick elastic-slider__tick--fill';
const THUMB = 'elastic-slider__thumb';
const BUBBLE = 'elastic-slider__bubble';
const BUBBLE_TEXT = 'elastic-slider__bubble-text';

const TAU = Math.PI * 2;
const VALUE_POSITIONS = ['top', 'bubble', 'inside', 'none'];
const DARK_INK = 'rgba(18, 15, 23, 0.86)';
const LIGHT_INK = 'rgba(255, 255, 255, 0.94)';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const decimalsOf = (step: number) => {
  const text = String(step);
  return text.includes('.') ? text.split('.')[1].length : 0;
};

const rubber = (distance: number, limit: number) =>
  limit > 0 ? 2 * (1 / (1 + Math.exp(-distance / limit)) - 0.5) * limit : 0;

const prefersReduced = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

let probe: CanvasRenderingContext2D | null = null;

const readColor = (text: string): number[] | null => {
  const match = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(text);
  if (match)
    return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
  if (typeof document === 'undefined') return null;
  if (!probe) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    probe = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!probe) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000000';
  probe.fillStyle = text;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
};

function ElasticSlider({
  value,
  defaultValue = 50,
  startingValue = 0,
  maxValue = 100,
  isStepped = false,
  stepSize = 1,
  onChange,
  onChangeEnd,
  orientation = 'horizontal',
  leftIcon = <HugeiconsIcon icon={VolumeLowIcon} size={20} strokeWidth={1.75} />,
  rightIcon = <HugeiconsIcon icon={VolumeHighIcon} size={20} strokeWidth={1.75} />,
  iconPlacement = 'outside',
  valuePosition = 'top',
  formatValue,
  ticks = false,
  thumb = false,
  fillFrom,
  thickness = 6,
  activeThickness = 12,
  radius,
  restOpacity = 0.7,
  growOnHover = true,
  maxStretch = 50,
  bounce = 0.5,
  jumpToClick = true,
  wheel = false,
  trackColor = 'color-mix(in srgb, currentColor 18%, transparent)',
  rangeColor = 'currentColor',
  iconColor = 'currentColor',
  contentColor = 'currentColor',
  fillContentColor = 'auto',
  thumbColor = '#ffffff',
  disabled = false,
  ariaLabel = 'Slider',
  className = '',
  style
}: ElasticSliderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const startIconRef = useRef<HTMLSpanElement>(null);
  const endIconRef = useRef<HTMLSpanElement>(null);
  const motion = useRef<Motion>({
    p: 0,
    vp: 0,
    target: 0,
    s: 0,
    vs: 0,
    side: 1,
    held: false,
    a: 0,
    va: 0,
    goal: 0,
    length: 0,
    dragging: false,
    hovered: false,
    focused: false,
    raf: 0,
    last: 0,
    ready: false
  });
  const drag = useRef<Drag | null>(null);

  const lo = Math.min(startingValue, maxValue);
  const hi = Math.max(startingValue, maxValue);
  const span = hi - lo || 1;
  const step = isStepped && stepSize > 0 ? stepSize : 0;
  const vertical = orientation === 'vertical';
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = clamp(controlled ? value : inner, lo, hi);
  const currentRef = useRef(current);

  const settings = {
    lo,
    hi,
    span,
    step,
    vertical,
    origin: clamp(((fillFrom ?? lo) - lo) / span, 0, 1),
    thickness: Math.max(1, thickness),
    activeThickness: Math.max(1, activeThickness),
    radius,
    restOpacity: clamp(restOpacity, 0, 1),
    growOnHover,
    maxStretch: Math.max(0, maxStretch),
    bounce: clamp(bounce, 0, 0.95),
    jumpToClick,
    controlled,
    onChange,
    onChangeEnd
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const snap = (raw: number) => {
    const s = settingsRef.current;
    let next = clamp(raw, s.lo, s.hi);
    if (s.step) next = clamp(s.lo + Math.round((next - s.lo) / s.step) * s.step, s.lo, s.hi);
    return Number(next.toFixed(10));
  };

  const paint = () => {
    const m = motion.current;
    const s = settingsRef.current;
    const track = trackRef.current;
    const range = rangeRef.current;
    if (!track || !range) return;
    const thick = s.thickness + (s.activeThickness - s.thickness) * m.a;
    track.style.width = s.vertical ? `${thick.toFixed(2)}px` : '';
    track.style.height = s.vertical ? '' : `${thick.toFixed(2)}px`;
    track.style.setProperty('--elastic-slider-reveal', clamp((thick - 14) / 10, 0, 1).toFixed(3));
    const length = Math.max(1, m.length);
    const along = 1 + m.s / length;
    const across = 1 - 0.22 * clamp(m.s / Math.max(1, s.maxStretch), -1, 1);
    const atEnd = m.side > 0;
    track.style.transformOrigin = s.vertical ? (atEnd ? '50% 100%' : '50% 0%') : atEnd ? '0% 50%' : '100% 50%';
    const scaleX = s.vertical ? across : along;
    const scaleY = s.vertical ? along : across;
    track.style.transform = `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
    track.style.setProperty(
      '--elastic-slider-unscale',
      `scale(${(1 / scaleX).toFixed(4)}, ${(1 / scaleY).toFixed(4)})`
    );
    const p = clamp(m.p, 0, 1);
    const from = (Math.min(s.origin, p) * 100).toFixed(3);
    const to = ((1 - Math.max(s.origin, p)) * 100).toFixed(3);
    const round = (s.radius ?? thick / 2).toFixed(2);
    range.style.clipPath = s.vertical
      ? `inset(${to}% 0 ${from}% 0 round ${round}px)`
      : `inset(0 ${to}% 0 ${from}% round ${round}px)`;
    const position = atEnd ? p * length * along : length - (1 - p) * length * along;
    const shift = s.vertical
      ? `translate3d(0, ${(-position).toFixed(2)}px, 0)`
      : `translate3d(${position.toFixed(2)}px, 0, 0)`;
    if (thumbRef.current) thumbRef.current.style.transform = `${shift} scale(${(1 + 0.12 * m.a).toFixed(3)})`;
    if (bubbleRef.current) {
      const center = s.vertical ? 'translate(0, 50%)' : 'translate(-50%, 0)';
      bubbleRef.current.style.transform = `${shift} ${center} scale(${(0.7 + 0.3 * m.a).toFixed(3)})`;
      bubbleRef.current.style.opacity = clamp(m.a * 1.4 - 0.2, 0, 1).toFixed(3);
    }
    const startShift = atEnd ? 0 : m.s;
    const endShift = atEnd ? m.s : 0;
    const iconScale = (1 + 0.08 * m.a).toFixed(3);
    if (startIconRef.current) {
      startIconRef.current.style.transform = s.vertical
        ? `translate3d(0, ${startShift.toFixed(2)}px, 0) scale(${iconScale})`
        : `translate3d(${(-startShift).toFixed(2)}px, 0, 0) scale(${iconScale})`;
    }
    if (endIconRef.current) {
      endIconRef.current.style.transform = s.vertical
        ? `translate3d(0, ${(-endShift).toFixed(2)}px, 0) scale(${iconScale})`
        : `translate3d(${endShift.toFixed(2)}px, 0, 0) scale(${iconScale})`;
    }
    if (bodyRef.current) {
      bodyRef.current.style.opacity = s.restOpacity < 1 ? (s.restOpacity + (1 - s.restOpacity) * m.a).toFixed(3) : '';
    }
  };

  const frame = (now: number) => {
    const m = motion.current;
    m.raf = 0;
    const s = settingsRef.current;
    const elapsed = clamp((now - m.last) / 1000, 0, 1 / 20);
    m.last = now;
    if (prefersReduced()) {
      m.p = m.target;
      m.vp = 0;
      if (!m.held) {
        m.s = 0;
        m.vs = 0;
      }
      m.a = m.goal;
      m.va = 0;
    } else {
      const steps = Math.max(1, Math.ceil(elapsed / (1 / 240)));
      const dt = elapsed / steps;
      const fillOmega = TAU / (m.dragging ? 0.09 : 0.3);
      const fillZeta = m.dragging ? 1 : 0.86;
      const stretchOmega = TAU / 0.42;
      const stretchZeta = 1 - 0.9 * s.bounce;
      const activeOmega = TAU / 0.32;
      for (let i = 0; i < steps; i++) {
        m.vp += (-fillOmega * fillOmega * (m.p - m.target) - 2 * fillZeta * fillOmega * m.vp) * dt;
        m.p += m.vp * dt;
        if (!m.held) {
          m.vs += (-stretchOmega * stretchOmega * m.s - 2 * stretchZeta * stretchOmega * m.vs) * dt;
          m.s += m.vs * dt;
        }
        m.va += (-activeOmega * activeOmega * (m.a - m.goal) - 2 * 0.9 * activeOmega * m.va) * dt;
        m.a += m.va * dt;
      }
    }
    const settled =
      Math.abs(m.p - m.target) < 0.0004 &&
      Math.abs(m.vp) < 0.002 &&
      (m.held || (Math.abs(m.s) < 0.05 && Math.abs(m.vs) < 0.5)) &&
      Math.abs(m.a - m.goal) < 0.002 &&
      Math.abs(m.va) < 0.005;
    if (settled) {
      m.p = m.target;
      m.vp = 0;
      m.a = m.goal;
      m.va = 0;
      if (!m.held) {
        m.s = 0;
        m.vs = 0;
      }
    }
    paint();
    if (!settled || m.dragging) m.raf = requestAnimationFrame(frame);
  };

  const kick = () => {
    const m = motion.current;
    if (m.raf || typeof window === 'undefined') return;
    m.last = performance.now();
    m.raf = requestAnimationFrame(frame);
  };

  const autoInk = () => {
    const root = rootRef.current;
    const range = rangeRef.current;
    if (!root || !range || fillContentColor !== 'auto') return;
    const color = readColor(getComputedStyle(range).backgroundColor);
    const ink =
      !color || color[3] < 0.5
        ? 'var(--elastic-slider-content)'
        : (0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) / 255 > 0.55
          ? DARK_INK
          : LIGHT_INK;
    root.style.setProperty('--elastic-slider-fill-content', ink);
  };

  const refreshGoal = () => {
    const m = motion.current;
    m.goal = (m.hovered && settingsRef.current.growOnHover) || m.dragging || m.focused ? 1 : 0;
    kick();
  };

  const pulse = (side: number) => {
    const icon = (side > 0 ? endIconRef : startIconRef).current?.firstElementChild;
    if (!icon || prefersReduced()) return;
    icon.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], {
      duration: 280,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    });
  };

  const bump = (side: number) => {
    const m = motion.current;
    const s = settingsRef.current;
    if (!s.maxStretch || m.held || Math.abs(m.vs) > 40 || Math.abs(m.s) > 2) return;
    m.side = side;
    m.vs = s.maxStretch * 5.5;
    pulse(side);
    kick();
  };

  const commit = (next: number) => {
    const s = settingsRef.current;
    motion.current.target = (next - s.lo) / s.span;
    kick();
    if (next === currentRef.current) return;
    currentRef.current = next;
    if (!s.controlled) setInner(next);
    s.onChange?.(next);
  };

  const snapRef = useRef(snap);
  snapRef.current = snap;
  const bumpRef = useRef(bump);
  bumpRef.current = bump;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const goalRef = useRef(refreshGoal);
  goalRef.current = refreshGoal;

  useIsoLayoutEffect(() => {
    const m = motion.current;
    currentRef.current = current;
    const fraction = (current - lo) / span;
    if (!m.dragging) m.target = fraction;
    if (!m.ready) {
      m.ready = true;
      m.p = fraction;
      paint();
      return;
    }
    kick();
  }, [current, lo, span]);

  useIsoLayoutEffect(() => {
    const hit = hitRef.current;
    if (!hit) return undefined;
    const measure = () => {
      motion.current.length = settingsRef.current.vertical ? hit.clientHeight : hit.clientWidth;
      paint();
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(hit);
    return () => observer.disconnect();
  }, [vertical]);

  useIsoLayoutEffect(() => {
    autoInk();
    paint();
  });

  useEffect(() => {
    goalRef.current();
  }, [growOnHover]);

  useEffect(() => {
    const hit = hitRef.current;
    if (!hit || !wheel || disabled) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const s = settingsRef.current;
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? -event.deltaY : event.deltaX;
      if (!delta) return;
      const amount = s.step ? Math.sign(delta) * s.step : (delta * s.span) / 800;
      const next = snapRef.current(currentRef.current + amount);
      if (next === currentRef.current) {
        bumpRef.current(Math.sign(delta));
        return;
      }
      commitRef.current(next);
      clearTimeout(timer);
      timer = setTimeout(() => settingsRef.current.onChangeEnd?.(currentRef.current), 200);
    };
    hit.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(timer);
      hit.removeEventListener('wheel', onWheel);
    };
  }, [wheel, disabled]);

  useEffect(() => {
    const m = motion.current;
    return () => cancelAnimationFrame(m.raf);
  }, []);

  const along = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = hitRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return settingsRef.current.vertical ? rect.bottom - event.clientY : event.clientX - rect.left;
  };

  const follow = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const m = motion.current;
    const s = settingsRef.current;
    const length = Math.max(1, m.length);
    const position = along(event);
    const fraction = d.from === null ? position / length : d.from + (position - d.origin) / length;
    const over = fraction < 0 ? -fraction * length : fraction > 1 ? (fraction - 1) * length : 0;
    if (over > 0 && s.maxStretch > 0) {
      const side = fraction < 0 ? -1 : 1;
      if (!m.held || m.side !== side) pulse(side);
      m.held = true;
      m.side = side;
      m.s = rubber(over, s.maxStretch);
      m.vs = 0;
    } else if (m.held) {
      m.held = false;
    }
    commit(snap(s.lo + clamp(fraction, 0, 1) * s.span));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const hit = hitRef.current;
    if (disabled || event.button !== 0 || !hit) return;
    hit.setPointerCapture(event.pointerId);
    const m = motion.current;
    const s = settingsRef.current;
    drag.current = {
      id: event.pointerId,
      origin: along(event),
      from: s.jumpToClick ? null : m.target
    };
    m.dragging = true;
    hit.setAttribute('data-dragging', '');
    refreshGoal();
    if (s.jumpToClick) commit(snap(s.lo + clamp(along(event) / Math.max(1, m.length), 0, 1) * s.span));
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    follow(event);
  };

  const release = () => {
    if (!drag.current) return;
    const m = motion.current;
    drag.current = null;
    m.dragging = false;
    m.held = false;
    hitRef.current?.removeAttribute('data-dragging');
    refreshGoal();
    settingsRef.current.onChangeEnd?.(currentRef.current);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const s = settingsRef.current;
    const unit = s.step || s.span / 100;
    const large = Math.max(unit, s.span / 10);
    const now = currentRef.current;
    const keys: Record<string, number> = {
      ArrowRight: now + unit,
      ArrowUp: now + unit,
      ArrowLeft: now - unit,
      ArrowDown: now - unit,
      PageUp: now + large,
      PageDown: now - large,
      Home: s.lo,
      End: s.hi
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const wanted = keys[event.key];
    const next = snap(wanted);
    if (next === now) {
      if (wanted !== now) bump(wanted > now ? 1 : -1);
      return;
    }
    commit(next);
    s.onChangeEnd?.(next);
  };

  const label = formatValue
    ? formatValue(current)
    : step
      ? current.toFixed(decimalsOf(step))
      : String(Math.round(current));
  const place = VALUE_POSITIONS.includes(valuePosition) ? valuePosition : 'top';
  const inside = iconPlacement === 'inside';
  const insideStart = inside ? leftIcon : null;
  const insideEnd = place === 'inside' ? <span>{label}</span> : inside ? rightIcon : null;
  const count = step ? Math.round((hi - lo) / step) : 0;
  const tickValues = Array.isArray(ticks)
    ? ticks
    : ticks
      ? count > 0 && count <= 40
        ? Array.from({ length: count + 1 }, (_, index) => lo + index * step)
        : Array.from({ length: 11 }, (_, index) => lo + (index / 10) * (hi - lo))
      : [];
  const marks = tickValues.map(tick => (tick - lo) / span).filter(fraction => fraction > 0.001 && fraction < 0.999);
  const marksFor = (name: string) =>
    marks.map(fraction => (
      <span
        key={fraction}
        className={name}
        style={vertical ? { bottom: `${fraction * 100}%` } : { left: `${fraction * 100}%` }}
      />
    ));
  const contentFor = (name: string) =>
    insideStart || insideEnd ? (
      <span className={name}>
        <span>{insideStart}</span>
        <span>{insideEnd}</span>
      </span>
    ) : null;
  const thumbSize = clamp(activeThickness + 6, 16, 28);

  return (
    <div
      ref={rootRef}
      className={[ROOT, className].filter(Boolean).join(' ')}
      style={
        {
          '--elastic-slider-track': trackColor,
          '--elastic-slider-range': rangeColor,
          '--elastic-slider-icon': iconColor,
          '--elastic-slider-content': contentColor,
          ...(fillContentColor !== 'auto' ? { '--elastic-slider-fill-content': fillContentColor } : {}),
          '--elastic-slider-thumb': thumbColor,
          '--elastic-slider-thumb-size': `${thumbSize}px`,
          '--elastic-slider-hit': `${Math.max(34, thickness, activeThickness)}px`,
          '--elastic-slider-pad': `${Math.max(8, Math.round(thickness * 0.32))}px`,
          '--elastic-slider-bubble-offset': `${(thumb ? thumbSize * 1.12 : activeThickness) / 2 + 8}px`,
          ...(radius !== undefined ? { '--elastic-slider-radius': `${radius}px` } : {}),
          ...style
        } as CSSProperties
      }
      data-orientation={vertical ? 'vertical' : 'horizontal'}
      data-disabled={disabled ? '' : undefined}
      onPointerEnter={() => {
        motion.current.hovered = true;
        autoInk();
        refreshGoal();
      }}
      onPointerLeave={() => {
        motion.current.hovered = false;
        refreshGoal();
      }}
    >
      {place === 'top' && (
        <span className={VALUE} aria-hidden="true">
          {label}
        </span>
      )}
      <div className={BODY} ref={bodyRef}>
        {!inside && leftIcon && (
          <span className={ICON} ref={startIconRef} aria-hidden="true">
            <span className={ICON_INNER}>{leftIcon}</span>
          </span>
        )}
        <div
          ref={hitRef}
          className={HIT}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={lo}
          aria-valuemax={hi}
          aria-valuenow={current}
          aria-valuetext={label}
          aria-orientation={vertical ? 'vertical' : 'horizontal'}
          aria-disabled={disabled || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onKeyDown={onKeyDown}
          onFocus={event => {
            motion.current.focused = event.currentTarget.matches(':focus-visible');
            refreshGoal();
          }}
          onBlur={() => {
            motion.current.focused = false;
            refreshGoal();
          }}
        >
          <div className={TRACK} ref={trackRef}>
            {marksFor(TICK)}
            {contentFor(CONTENT)}
            <div className={RANGE} ref={rangeRef}>
              {marksFor(FILL_TICK)}
              {contentFor(FILL_CONTENT)}
            </div>
          </div>
          {thumb && <span className={THUMB} ref={thumbRef} aria-hidden="true" />}
          {place === 'bubble' && (
            <span className={BUBBLE} ref={bubbleRef} aria-hidden="true">
              <span className={BUBBLE_TEXT}>{label}</span>
            </span>
          )}
        </div>
        {!inside && rightIcon && (
          <span className={ICON} ref={endIconRef} aria-hidden="true">
            <span className={ICON_INNER}>{rightIcon}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default ElasticSlider;

```

### Component CSS
```css
.elastic-slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 12rem;
  color: inherit;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.elastic-slider[data-orientation='vertical'] {
  width: auto;
  height: 12rem;
}

.elastic-slider[data-disabled] {
  opacity: 0.45;
  pointer-events: none;
}

.elastic-slider__value {
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  opacity: 0.6;
}

.elastic-slider__body {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 0;
}

.elastic-slider[data-orientation='vertical'] .elastic-slider__body {
  flex-direction: column-reverse;
  width: auto;
  height: 100%;
}

.elastic-slider__icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  color: var(--elastic-slider-icon, currentColor);
  will-change: transform;
}

.elastic-slider__icon-inner {
  display: grid;
  place-items: center;
}

.elastic-slider__hit {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  height: var(--elastic-slider-hit, 34px);
  outline: none;
  cursor: grab;
  touch-action: none;
}

.elastic-slider[data-orientation='vertical'] .elastic-slider__hit {
  flex-direction: column;
  justify-content: flex-end;
  width: var(--elastic-slider-hit, 34px);
  height: auto;
  min-height: 0;
}

.elastic-slider__hit[data-dragging] {
  cursor: grabbing;
}

.elastic-slider__hit:focus-visible .elastic-slider__track {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}

.elastic-slider__track {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: var(--elastic-slider-radius, 999px);
  background: var(--elastic-slider-track);
  will-change: transform;
}

.elastic-slider[data-orientation='vertical'] .elastic-slider__track {
  width: 6px;
  height: 100%;
}

.elastic-slider__range {
  position: absolute;
  inset: 0;
  background: var(--elastic-slider-range);
  clip-path: inset(0 100% 0 0);
}

.elastic-slider__content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--elastic-slider-pad, 12px);
  color: var(--elastic-slider-content);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  opacity: var(--elastic-slider-reveal, 1);
  pointer-events: none;
}

.elastic-slider__content > span {
  display: grid;
  place-items: center;
  transform: var(--elastic-slider-unscale, none);
}

.elastic-slider[data-orientation='vertical'] .elastic-slider__content {
  flex-direction: column-reverse;
  padding: var(--elastic-slider-pad, 12px) 0;
}

.elastic-slider__content--fill {
  color: var(--elastic-slider-fill-content);
}

.elastic-slider__tick {
  position: absolute;
  top: 50%;
  width: 3px;
  height: 3px;
  margin: -1.5px 0 0 -1.5px;
  border-radius: 999px;
  background: var(--elastic-slider-content);
  opacity: 0.4;
}

.elastic-slider[data-orientation='vertical'] .elastic-slider__tick {
  top: auto;
  left: 50%;
  margin: 0 0 -1.5px -1.5px;
}

.elastic-slider__tick--fill {
  background: var(--elastic-slider-fill-content);
  opacity: 0.5;
}

.elastic-slider__thumb {
  position: absolute;
  top: 50%;
  left: 0;
  width: var(--elastic-slider-thumb-size, 18px);
  height: var(--elastic-slider-thumb-size, 18px);
  margin-top: calc(var(--elastic-slider-thumb-size, 18px) / -2);
  margin-left: calc(var(--elastic-slider-thumb-size, 18px) / -2);
  border-radius: 999px;
  background: var(--elastic-slider-thumb, #ffffff);
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.28),
    0 0 0 0.5px rgba(0, 0, 0, 0.12);
  pointer-events: none;
  will-change: transform;
}

.elastic-slider[data-orientation='vertical'] .elastic-slider__thumb {
  top: auto;
  bottom: 0;
  left: 50%;
  margin-top: 0;
  margin-bottom: calc(var(--elastic-slider-thumb-size, 18px) / -2);
}

.elastic-slider__bubble {
  position: absolute;
  bottom: calc(50% + var(--elastic-slider-bubble-offset, 14px));
  left: 0;
  padding: 5px 8px;
  border-radius: 8px;
  background: var(--elastic-slider-range);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0;
  transform-origin: 50% 100%;
  pointer-events: none;
  will-change: transform, opacity;
}

.elastic-slider[data-orientation='vertical'] .elastic-slider__bubble {
  bottom: 0;
  left: calc(50% + var(--elastic-slider-bubble-offset, 14px));
  transform-origin: 0% 50%;
}

.elastic-slider__bubble-text {
  color: var(--elastic-slider-fill-content);
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.


cursor - 

# Cursor (/docs/primitives/animate-ui/cursor)



## Installation [#installation]

```bash
npm install @animate-ui/react motion
```

## Usage [#usage]

```tsx
import {
  Cursor,
  CursorContainer,
  CursorFollow,
  CursorProvider,
} from '@animate-ui/react/primitives/cursor';

export function Canvas() {
  return (
    <div className="relative h-72">
      <CursorProvider>
        <CursorContainer>
          <Cursor>
            <ArrowIcon />
          </Cursor>
          <CursorFollow side="bottom" align="end">
            <span>Designer</span>
          </CursorFollow>
        </CursorContainer>
      </CursorProvider>
    </div>
  );
}
```

By default, the cursor lives in the parent of `CursorContainer`. With `global`, it replaces the pointer on the whole page.

## Animation [#animation]

* Entering the area hides the native pointer and pops the cursor and the follower in: they scale up from 0 on a spring with a little overshoot (stiffness 550, damping 30) while fading in (300ms). Leaving scales them back to 0 without overshoot and fades them out, then restores the pointer.
* `Cursor` sticks to the pointer, its top-left corner on it (where an arrow's tip goes). `CursorFollow` trails it on a spring without bounce (stiffness 500, damping 50), so it feels attached without being rigid. It springs from where it last was: the first time, it flies in from near the area's top-left corner.
* The position is driven by motion values with a hardware-accelerated transform (`x` / `y`): moving the pointer never re-renders React.
* Touch pointers are ignored: a custom cursor only makes sense for pointers that hover.
* `<AnimateUIProvider tempo>` paces the pop and the follow spring.
* Under reduced motion, the cursors only fade in and out, and `CursorFollow` sticks to the pointer too.

## API Reference [#api-reference]

### CursorProvider [#cursorprovider]

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `global` | `boolean` | `false` | Replace the pointer on the whole page instead of the parent of `CursorContainer`. |
| `children` (required) | `React.ReactNode` |  | The container and cursors. |

### CursorContainer [#cursorcontainer]

Marks the area: the cursor shows inside its parent element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `asChild` | `boolean` | `false` | Render the child element instead of a div, merging their props and behavior. |
| `...props` | `HTMLMotionProps<'div'>` |  | Props of the container. |

### Cursor [#cursor]

Its top-left corner sits on the pointer.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `asChild` | `boolean` | `false` | Render the child element instead of a div, merging their props and behavior. |
| `children` (required) | `React.ReactNode` |  | The cursor, an icon for instance. |
| `...props` | `HTMLMotionProps<'div'>` |  | Props of the cursor. |

### CursorFollow [#cursorfollow]

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `asChild` | `boolean` | `false` | Render the child element instead of a div, merging their props and behavior. |
| `side` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'bottom'` | Side of the pointer it sits on. |
| `sideOffset` | `number` | `0` | Distance from the pointer, in pixels. |
| `align` | `'start' \| 'center' \| 'end'` | `'end'` | Alignment along that side. |
| `alignOffset` | `number` | `0` | Offset along that side, in pixels. |
| `transition` | `SpringOptions` | `{ stiffness: 500, damping: 50, bounce: 0 }` | Spring of the follow (useSpring options). |
| `children` (required) | `React.ReactNode` |  | The label. |
| `...props` | `Omit<HTMLMotionProps<'div'>, 'transition'>` |  | Props of the element. |

### useCursor [#usecursor]

Returns the cursor state: `cursorX` and `cursorY` motion values, `active`, `global`, `containerRef`, `cursorRef`, and `cursorPos` (a snapshot of the position when read).


Avatar Group - 

# Avatar Group (/docs/primitives/animate-ui/avatar-group)



## Installation [#installation]

```bash
npm install @animate-ui/react motion
```

The tooltips are Animate UI's [Tooltip](/docs/primitives/animate-ui/tooltip), positioned with [Floating UI](https://floating-ui.com), a peer dependency of this primitive:

```bash
npm install @floating-ui/react
```

## Usage [#usage]

```tsx
import {
  AvatarGroup,
  AvatarGroupTooltip,
  AvatarGroupTooltipArrow,
} from '@animate-ui/react/primitives/avatar-group';

export function Team({ people }: { people: { name: string; src: string }[] }) {
  return (
    <AvatarGroup className="h-12 -space-x-3" invertOverlap>
      {people.map((person) => (
        <img
          key={person.name}
          src={person.src}
          alt={person.name}
          className="size-12 rounded-full border-3 border-background"
        />
      ))}
    </AvatarGroup>
  );
}
```

Each child is an avatar. Put an `AvatarGroupTooltip` inside an avatar to give it a tooltip:

```tsx
<div className="size-12 rounded-full border-3 border-background bg-muted">
  SK
  <AvatarGroupTooltip className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
    <AvatarGroupTooltipArrow className="size-2.5 fill-foreground" />
    <p>Skyleen</p>
  </AvatarGroupTooltip>
</div>
```

## Animation [#animation]

* The hovered (or pressed) avatar rises by `translate` on a bouncy spring (stiffness 300, damping 17): it overshoots by about 17% before it settles, and dips below its place the same way when it comes back down.
* The tooltips share one popup ([Tooltip](/docs/primitives/animate-ui/tooltip)): it opens at once (`openDelay` is 0) and glides from avatar to avatar on its spring (stiffness 400, damping 29), a little past the next avatar before it settles.
* `<AnimateUIProvider tempo>` paces the default springs.
* Under reduced motion, the avatar rises at once and the tooltip only fades.

## API Reference [#api-reference]

### AvatarGroup [#avatargroup]

Takes the [TooltipProvider](/docs/primitives/animate-ui/tooltip#tooltipprovider) and [Tooltip](/docs/primitives/animate-ui/tooltip#tooltip) props, with other defaults.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` (required) | `React.ReactElement \| React.ReactElement[]` |  | The avatars. |
| `invertOverlap` | `boolean` | `false` | Stack the avatars the other way: each one above the next instead of below. |
| `translate` | `string \| number` | `'-30%'` | How far the hovered avatar rises (a `y` value). |
| `transition` | `Transition` | `{ type: 'spring', stiffness: 300, damping: 17 }` | Transition of the rise. |
| `tooltipTransition` | `Transition` | `{ type: 'spring', stiffness: 400, damping: 29 }` | Transition of the tooltip. |
| `openDelay` | `number` | `0` | Delay in milliseconds before a tooltip opens. |
| `closeDelay` | `number` | `0` | Delay in milliseconds before a tooltip closes. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Side of the avatar the tooltip is placed on. |
| `sideOffset` | `number` | `25` | Distance in pixels from the avatar. |
| `align` | `"start" \| "center" \| "end"` | `"center"` | How the tooltip is aligned on that side. |
| `alignOffset` | `number` | `0` | Offset in pixels from the alignment. |
| `...props` | `React.ComponentProps<'div'>` |  | Props of the container (a flex row). |

### AvatarGroupTooltip [#avatargrouptooltip]

The [TooltipContent](/docs/primitives/animate-ui/tooltip#tooltipcontent) props.

### AvatarGroupTooltipArrow [#avatargrouptooltiparrow]

The [TooltipArrow](/docs/primitives/animate-ui/tooltip#tooltiparrow) props.

## Credits [#credits]

* Inspired by [Jhey](https://codepen.io/jh3y/pen/yyLmmMW).


tooltip - 

# Tooltip (/docs/primitives/animate-ui/tooltip)



## Installation [#installation]

```bash
npm install @animate-ui/react motion
```

The popup is positioned with [Floating UI](https://floating-ui.com), a peer dependency of this primitive:

```bash
npm install @floating-ui/react
```

## Usage [#usage]

```tsx
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@animate-ui/react/primitives/tooltip';

export function Toolbar() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button aria-label="Bold">B</button>
        </TooltipTrigger>
        <TooltipContent className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
          <TooltipArrow className="size-2.5 fill-foreground" />
          <p>Bold</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip side="bottom">
        <TooltipTrigger asChild>
          <button aria-label="Italic">I</button>
        </TooltipTrigger>
        <TooltipContent className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
          <TooltipArrow className="size-2.5 fill-foreground" />
          <p>Italic</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

Unlike the library tooltips, this one is Animate UI's own: no Radix UI, Base UI or React Aria underneath. `TooltipContent` renders nothing where it is written: it declares what the provider's single popup shows when its trigger is hovered or focused. Its content is laid out in a layer inside the popup (which takes the popup's `display`, flex and grid layout), and its `TooltipArrow` is drawn by the popup itself, outside that layer. The layer keeps the content from stretching while the popup resizes between triggers: no `layout` prop is needed on it (one would correct it twice).

## Animation [#animation]

The motion of Animate UI v1's Tooltip, on a spring a touch calmer than the library tooltips':

* The popup grows from 0.7 and fades in from the point facing its trigger, like the Radix UI, Base UI and React Aria tooltips, on a spring as quick as theirs but a touch calmer (stiffness 400, damping 31: it goes about 2% past its size before it settles, theirs about 4%), and goes back the same way when it closes.
* Hovering the next trigger while a tooltip is showing doesn't close it: the popup and its arrow glide to the new trigger and resize to the new content (a shared layout animation), on the same spring. Right after a tooltip closes (within `closeDelay`), the next one opens without the `openDelay`.
* Meanwhile its content changes in the way the popup goes, like a tab panel: the previous label leaves the other way into a 6px blur, fading out and sliding 40px in 0.13s, and the next one slides 40px in from the side the popup goes to, out of the blur, showing from the start of its slide (0.34s, so its slide outlasts the popup's glide, which goes the other way on screen). Moving right, the previous label leaves to the left and the next comes from the right; moving up, the previous one goes down and the next comes from above. It follows the triggers on screen, so right to left and stacked triggers too. Neither label is ever stretched by the popup resizing: both are shown at their size, around the point the popup grows from, and clipped by the popup. The arrow only glides. Going back and forth faster than that, a label coming back goes on from where it is, and the one that was coming in leaves from where it is. Nothing of this on the first open or the close.
* With `asChild`, the same happens inside the child, which is the popup.
* `<AnimateUIProvider tempo>` paces the spring and the swap.
* Under reduced motion, the popup only fades, and moving between triggers jumps, its content changing at once.

## API Reference [#api-reference]

### TooltipProvider [#tooltipprovider]

Holds the shared popup. Every `Tooltip` must be inside one.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` (required) | `React.ReactNode` |  | The tooltips. |
| `id` | `string` |  | Identifies the shared popup (its layout id). Defaults to a generated id. |
| `openDelay` | `number` | `0` | Delay in milliseconds before a tooltip opens. |
| `closeDelay` | `number` | `300` | Delay in milliseconds before a tooltip closes. A tooltip opened within this window after one closed opens at once. |
| `transition` | `Transition` | `{ type: 'spring', stiffness: 400, damping: 31 }` | Transition of the entrance, of the exit and of the move between triggers. |

### Tooltip [#tooltip]

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` (required) | `React.ReactNode` |  | The trigger and the content. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Which side of the trigger the popup is placed on. It flips when there is no room. |
| `sideOffset` | `number` | `10` | Distance in pixels from the trigger. |
| `align` | `"start" \| "center" \| "end"` | `"center"` | How the popup is aligned on that side. |
| `alignOffset` | `number` | `0` | Offset in pixels from the alignment. |

### TooltipTrigger [#tooltiptrigger]

Opens the tooltip on hover and focus, and closes it on leave, blur, a press, <kbd>Escape</kbd>, scroll and resize. While open, it gets `aria-describedby` pointing at the popup (`role="tooltip"`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `asChild` | `boolean` | `false` | Render the child element instead of a div, merging their props and behavior. |
| `...props` | `HTMLMotionProps<'div'>` |  | Props of the trigger. It gets `data-state`, `data-side` and `data-align`. |

### TooltipContent [#tooltipcontent]

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `asChild` | `boolean` | `false` | Render the child element instead of a div, merging their props and behavior. |
| `...props` | `HTMLMotionProps<'div'>` |  | Props of the popup, rendered in a portal. It gets `role="tooltip"`, `data-state`, `data-side` and `data-align`. |

### TooltipArrow [#tooltiparrow]

Place it inside `TooltipContent`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `withTransition` | `boolean` | `true` | Glide the arrow with the popup when it moves. |
| `...props` | `Omit<React.ComponentProps<typeof motion.create(FloatingArrow)>, 'context'>` |  | Props of Floating UI's arrow (an `<svg>`) and Motion props, except `context`. |

### useGlobalTooltip, useTooltip [#useglobaltooltip-usetooltip]

Return the provider's and the tooltip's state: the current tooltip, `showTooltip`, `hideTooltip`, `hideImmediate`, the `transition` and the reference element; the tooltip's props, side, alignment, offsets and id.


selsct - 

# Select (/docs/primitives/base-ui/select)



## Installation [#installation]

```bash
npm install @animate-ui/react motion
```

Add the shadcn/ui component, then animate it:

```bash
npx shadcn@latest add select
npx @animate-ui/cli@latest animate select
```

## Usage [#usage]

Import the primitive from Animate UI instead of Base UI. Everything else stays the same.

```tsx
import { Select } from '@animate-ui/react/primitives/base-ui/select';

const fonts = [
  { label: 'Inter', value: 'inter' },
  { label: 'Geist', value: 'geist' },
];

export function FontPicker() {
  return (
    <Select.Root items={fonts} defaultValue="geist">
      <Select.Trigger aria-label="Font">
        <Select.Value />
        <Select.Icon />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner alignItemWithTrigger={false} sideOffset={4}>
          <Select.Popup>
            <Select.List>
              {fonts.map((font) => (
                <Select.Item key={font.value} value={font.value}>
                  <Select.ItemText>{font.label}</Select.ItemText>
                  <Select.ItemIndicator>✓</Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
```

Using the `@base-ui/react` umbrella import instead? The barrel mirrors it: `import { Select } from '@animate-ui/react/primitives/base-ui'`.

### Check animation [#check-animation]

The chosen item's check draws itself while the previous one erases itself. With `animation="pop"` on every item's ItemIndicator, the check glides from the previous item to the chosen one instead (a first choice pops it in from half its size):

```tsx
<Select.Item key={font.value} value={font.value}>
  <Select.ItemText>{font.label}</Select.ItemText>
  <Select.ItemIndicator animation="pop">✓</Select.ItemIndicator>
</Select.Item>
```

With a multiple selection, each check pops in and shrinks back out on its own.

The same demo with `checkAnimation="pop"` (its Controls switch it back to `draw`):

To pop every check of your app at once (checkboxes, menus, selects, comboboxes), set `checkAnimation="pop"` on an [`AnimateUIProvider`](/docs/installation#choose-how-checks-animate-optional) instead.

## Animation [#animation]

Base UI's Select has no Animate UI v1 counterpart: it moves like v1's Base UI Menu.

* **Popup** fades and scales in from 0.9, from the trigger (`--transform-origin`), in 220ms (`{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }`, a soft ease-out), and closes the same way; then Base UI unmounts it (or hides it, when it keeps the items mounted for typeahead on the closed trigger).
* **Stagger**: opening from closed, the options (and labels, separators) come in one after another, 33ms apart (closer past 10 rows: 33ms × √(10 / rows), so a long list doesn't wait): each slides 8px in from the right and clears from a 4px blur as it fades in, in 0.3s on a soft ease-out (`{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }`). The box itself is there at once (its opacity in 0.1s, its scale as before), so the rows bring the fade, and a disabled row comes in at its own opacity. An item highlighted as it opens (the chosen one) shows its highlight once its row has landed. Reopened while it closes it doesn't stagger again, closing shows every row at once, and under reduced motion nothing staggers.
* **Value**: when the choice changes, the old text rises 6px into a 4px blur and fades, while the new one rises 6px into place out of the same blur, in 400ms on a soft ease-out (`{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }`), instead of changing in one frame. The trigger keeps its size. When the list is laid over the trigger, the old value stays under it, and the swap waits until it has mostly faded out (30% opacity), so it's seen.
* With `alignItemWithTrigger` (Base UI's default), the list is laid over the trigger with the selected item on the value, like a native select: it only fades.
* **The highlight**: one surface glides behind the highlighted item on a spring (stiffness 500, damping 40), following the pointer and the arrow keys alike, like v1's menu highlight. Moving to another item, it carries on from where it is, at its speed: however fast the pointer or the arrow keys go, there's one highlight on screen. It only fades in (200ms, on CSS's `ease`) when it appears from nothing, and its color changes the same way when the item's highlighted background differs from the previous one's. It glides on the compositor (a Web Animation of `transform`), so a busy main thread, a heavy render for instance, doesn't stall it. When the pointer leaves the list, it stays on the last item. It wears the item's own highlighted background (`focus:bg-accent`, `data-highlighted:bg-accent`…), read from your styles: the item's background is cleared while it's highlighted; its text colors stay.
* **ItemIndicator** (kept mounted on every item, so a check can hide itself): with a single value, the chosen item's check draws itself like a Checkbox's check (its stroke and opacity in 0.3s on Motion's easeOut, at once) while the previous one erases itself, and the list holds still for 250ms before it closes, so the change is seen nearly done before the list fades out. With `animation="pop"` (or `checkAnimation="pop"` on an `AnimateUIProvider`), the check glides there instead, on the highlight's spring (stiffness 500, damping 40), and the list holds for 150ms, and a first choice pops it in from half its size out of a 2px blur (a spring, stiffness 500, damping 24). The demo's Controls switch between the two. Choosing the item already chosen, and closing any other way (Escape, a click outside), don't wait. With `multiple`, the list stays open: a selected item's check draws itself, and erases itself when it's deselected; with `pop`, it pops in from half its size and shrinks back out in 0.15s; a check written as text ("✓") fades (or pops). Only a change of selection animates the checks: opening the list shows them at rest.
* Reopening while the list is closing picks up from where it is.
* Base UI's Select has no `keepMounted`: Animate UI passes an `actionsRef` to the Root and unmounts the popup when its exit is over. Your own `actionsRef` still works, and `onOpenChangeComplete` fires after the entrance and after the exit.
* Open from the start (`defaultOpen`), the list plays its entrance on page load.
* Under reduced motion, nothing scales or glides: the popup and the checks only fade, and the list doesn't hold; the highlight jumps from item to item and only fades in when it appears.

## API Reference [#api-reference]

Every part takes exactly the props of [Base UI's Select](https://base-ui.com/react/components/select#api-reference). Animate UI adds the animation props below.

### Root, Trigger, Value, Icon, Portal, Backdrop, Positioner, List, ItemText, Group, GroupLabel, Separator, ScrollUpArrow, ScrollDownArrow, Arrow, Label [#root-trigger-value-icon-portal-backdrop-positioner-list-itemtext-group-grouplabel-separator-scrolluparrow-scrolldownarrow-arrow-label]

[Base UI props](https://base-ui.com/react/components/select#root) only. They are not animated.

### Item [#item]

[Base UI props](https://base-ui.com/react/components/select#item) only. It takes part in the highlight; it needs nothing more.

### Popup [#popup]

[Base UI props](https://base-ui.com/react/components/select#popup), except `render` (Animate UI renders the popup as a `motion.div`), plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `transition` | `Transition` | `{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }` | Transition of the opening, and of the closing unless `exitTransition` is set. |
| `exitTransition` | `Transition` | `transition` | Transition of the closing. |

### ItemIndicator [#itemindicator]

[Base UI props](https://base-ui.com/react/components/select#item-indicator), plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `animation` | `'draw' \| 'pop'` | `the closest AnimateUIProvider's checkAnimation, else 'draw'` | How the check shows and hides: `draw` (it draws itself and erases itself) or `pop` (it pops in from half its size and shrinks back out; a single selection's check glides to the chosen item). |
| `transition` | `Transition` | `draw: 0.3s on Motion's easeOut both ways (a Checkbox's, without its delay); pop: a spring (stiffness 500, damping 24) in, 0.15s out, and the highlight's spring (stiffness 500, damping 40) for the glide` | Transition of the check showing and hiding itself, and of a single selection's check gliding (`pop`). |


menubar - 

# Menubar (/docs/primitives/base-ui/menubar)



## Installation [#installation]

```bash
npm install @animate-ui/react motion
```

Add the shadcn/ui component, then animate it:

```bash
npx shadcn@latest add menubar
npx @animate-ui/cli@latest animate menubar
```

## Usage [#usage]

Import `Menubar` and `Menu` from Animate UI instead of Base UI. Everything else stays the same.

```tsx
import { Menu } from '@animate-ui/react/primitives/base-ui/menu';
import { Menubar } from '@animate-ui/react/primitives/base-ui/menubar';

export function EditorMenubar() {
  return (
    <Menubar>
      <Menu.Root>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8}>
            <Menu.Popup>
              <Menu.Item>New file</Menu.Item>
              <Menu.Item>Save</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8}>
            <Menu.Popup>
              <Menu.Item>Undo</Menu.Item>
              <Menu.Item>Redo</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menubar>
  );
}
```

Using the `@base-ui/react` umbrella import instead? The barrel mirrors it: `import { Menu, Menubar } from '@animate-ui/react/primitives/base-ui'`.

`Menubar` takes Base UI's props as they are and lets its menus hand their popover over to one another: each menu is an animated [Menu](/docs/primitives/base-ui/dropdown-menu). Take both from Animate UI: under Base UI's own `Menubar`, each menu closes and opens on its own.

### Check animation [#check-animation]

Checkbox and radio items show their check in a Menu's `CheckboxItemIndicator` or `RadioItemIndicator`: it draws itself when the item is checked, and erases itself when it's unchecked (a radio item's while the new one draws). With `animation="pop"`, it pops in from half its size and shrinks back out instead, and a radio item's check glides to the newly checked item:

```tsx
import { Menu } from '@animate-ui/react/primitives/base-ui/menu';
import { Menubar } from '@animate-ui/react/primitives/base-ui/menubar';

export function ViewMenubar() {
  return (
    <Menubar>
      <Menu.Root>
        <Menu.Trigger>View</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8}>
            <Menu.Popup>
              <Menu.CheckboxItem defaultChecked>
                <Menu.CheckboxItemIndicator animation="pop">
                  <CheckIcon />
                </Menu.CheckboxItemIndicator>
                Status bar
              </Menu.CheckboxItem>
              <Menu.Separator />
              <Menu.RadioGroup defaultValue="bottom">
                <Menu.RadioItem value="top">
                  <Menu.RadioItemIndicator animation="pop">
                    <CheckIcon />
                  </Menu.RadioItemIndicator>
                  Top
                </Menu.RadioItem>
                <Menu.RadioItem value="bottom">
                  <Menu.RadioItemIndicator animation="pop">
                    <CheckIcon />
                  </Menu.RadioItemIndicator>
                  Bottom
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menubar>
  );
}
```

The same demo with `checkAnimation="pop"` (its Controls switch it back to `draw`):

To pop every check of your app at once (checkboxes, menus, selects, comboboxes), set `checkAnimation="pop"` on an [`AnimateUIProvider`](/docs/installation#choose-how-checks-animate-optional) instead.

## Animation [#animation]

Base UI's Menubar has no Animate UI v1 counterpart: each menu opens and closes like v1's Base UI Menu, and moving between menus hands one popover from menu to menu.

* Opening the bar fades and scales the menu in from 0.9 in 220ms (a soft ease-out), from its trigger; closing it takes 220ms too.
* **Stagger**: opening from closed, the rows (items, labels, separators) come in one after another, 33ms apart (closer past 10 rows: 33ms × √(10 / rows), so a long list doesn't wait): each slides 8px in from the right and clears from a 4px blur as it fades in, in 0.3s on a soft ease-out (`{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }`). The box itself is there at once (its opacity in 0.1s, its scale as before), so the rows bring the fade, and a disabled row comes in at its own opacity. Moving to another menu of the bar or reopening while it closes doesn't stagger again, closing shows every row at once, and under reduced motion nothing staggers.
* Moving from one open menu to another (hovering, clicking or tapping a trigger, or pressing the arrow keys), the popover doesn't close and reopen: it moves to the next menu and resizes on a spring (stiffness 660, damping 52): it starts gently, is most of the way there in \~155ms and eases in without going past, settled by \~300ms (the Popup's `transition`, if you set one), sliding over the content, which stays where it is on screen. Going from File to Edit, File's items leave to the left, 6px, while they fade out (220ms, a soft ease-out), and Edit's come in from 6px to the right on a spring (stiffness 450, damping 43) and fade in behind them (260ms, on a slow start); going back, the other way around. The popover clips them as it goes.
* The popover that moves is the next menu's Popup, interactive from its first frame: it starts where the previous one was, at its size and opacity, without an entrance, and the previous menu (with its open submenus) is hidden in that frame and unmounted at once, so there's one popover on screen however fast the pointer sweeps the bar, whichever order Base UI closes and opens them in. A copy of the previous items (`aria-hidden`, `inert`) leaves inside it. It moves and resizes on Web Animations (`translate`, added to its own, and `width`/`height`, its margins making up the difference so Base UI places it once, above the bar or against an edge as well), never scaled, so the items keep their size, and nothing is left on it once it has landed. Moving on again before it has landed, it leaves from where it is, with what it shows, keeping its speed toward the next menu (as much of it as never takes it past that menu; sent back the way it came, it turns back at once), so sweeping across the bar is one glide. Going back and forth faster than the content settles, each menu's content shows once: what's still leaving goes on leaving from where it is, and back to a menu whose items are still leaving, they come back from there (where they are, as they show) instead of coming in again. With a `transition` of 0, it moves and swaps at once.
* **The triggers' highlight**: the triggers share one highlight, like a menu's items: a trigger hovered, focused or with its menu open wears its own background (`hover:bg-muted`, `aria-expanded:bg-muted`…, read from your styles and cleared on the trigger), and that background glides from trigger to trigger on the highlight's spring (stiffness 500, damping 40), along with the popover when a menu is open. It fades in (200ms, on CSS's `ease`) when it appears from nothing and fades out where it is the same way when no trigger is lit anymore (the pointer leaving the bar with no menu open, a menu closed); lit again meanwhile, it comes back from there. The bar becomes its own stacking context (`isolation: isolate`), so the highlight goes under the triggers' text and above the bar's background.
* A menu open from the start (`defaultOpen` on its `Menu.Root`) plays its entrance on page load, like v1's menus.
* Under reduced motion, nothing moves between menus: each one fades in place, the next in as the previous one fades out; the triggers' highlight jumps from trigger to trigger, and only fades.
* Everything else works like the [Menu](/docs/primitives/base-ui/dropdown-menu): the highlight gliding behind the highlighted item, submenus, item indicators, focus and reduced motion.

## API Reference [#api-reference]

Every part takes exactly the props of [Base UI's Menubar](https://base-ui.com/react/components/menubar#api-reference) and [Menu](https://base-ui.com/react/components/menu#api-reference).

### Menubar [#menubar]

[Base UI props](https://base-ui.com/react/components/menubar#api-reference) only. It is not animated itself: its menus hand their popover over through it, and its menus' triggers (each menu's `Menu.Trigger`, nothing more needed) share one highlight through it.

### Menu parts [#menu-parts]

See the [Menu](/docs/primitives/base-ui/dropdown-menu#api-reference) page: `Popup` takes `transition` and `exitTransition`, `CheckboxItemIndicator` and `RadioItemIndicator` take `animation` and `transition`. In a Menubar, the Popup's `transition`, if you set one, also moves and resizes the popover to the next menu (by default, a spring: `{ type: 'spring', stiffness: 660, damping: 52 }`).


dropdown menu - 

# Dropdown Menu (/docs/primitives/base-ui/dropdown-menu)



## Installation [#installation]

```bash
npm install @animate-ui/react motion
```

Add the shadcn/ui component, then animate it:

```bash
npx shadcn@latest add dropdown-menu
npx @animate-ui/cli@latest animate dropdown-menu
```

## Usage [#usage]

Import the primitive from Animate UI instead of Base UI. Everything else stays the same.

```tsx
import { Menu } from '@animate-ui/react/primitives/base-ui/menu';

export function AccountMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger>Account</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup>
            <Menu.Item>Profile</Menu.Item>
            <Menu.Item>Billing</Menu.Item>
            <Menu.Separator />
            <Menu.Item>Log out</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
```

Using the `@base-ui/react` umbrella import instead? The barrel mirrors it: `import { Menu } from '@animate-ui/react/primitives/base-ui'`.

shadcn/ui's Dropdown Menu is built on it.

### Check animation [#check-animation]

Checkbox and radio items show their check in a `CheckboxItemIndicator` or a `RadioItemIndicator`: it draws itself when the item is checked, and erases itself when it's unchecked (a radio item's while the new one draws). With `animation="pop"`, it pops in from half its size and shrinks back out instead, and a radio item's check glides to the newly checked item:

```tsx
import { Menu } from '@animate-ui/react/primitives/base-ui/menu';

export function ViewMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger>View</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup>
            <Menu.CheckboxItem defaultChecked>
              <Menu.CheckboxItemIndicator animation="pop">
                <CheckIcon />
              </Menu.CheckboxItemIndicator>
              Status bar
            </Menu.CheckboxItem>
            <Menu.Separator />
            <Menu.RadioGroup defaultValue="bottom">
              <Menu.RadioItem value="top">
                <Menu.RadioItemIndicator animation="pop">
                  <CheckIcon />
                </Menu.RadioItemIndicator>
                Top
              </Menu.RadioItem>
              <Menu.RadioItem value="bottom">
                <Menu.RadioItemIndicator animation="pop">
                  <CheckIcon />
                </Menu.RadioItemIndicator>
                Bottom
              </Menu.RadioItem>
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
```

The same demo with `checkAnimation="pop"` (its Controls switch it back to `draw`):

To pop every check of your app at once (checkboxes, menus, selects, comboboxes), set `checkAnimation="pop"` on an [`AnimateUIProvider`](/docs/installation#choose-how-checks-animate-optional) instead.

## Animation [#animation]

The motion of Animate UI v1's Base UI Menu:

* **Popup** fades and scales in from 0.9, from the trigger (`--transform-origin`, set inline so it works without styles), in 220ms (`{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }`, a soft ease-out), and closes the same way. Submenu popups grow from the side of their trigger the same way.
* **Stagger**: opening from closed, the rows (items, labels, separators) come in one after another, 33ms apart (closer past 10 rows: 33ms × √(10 / rows), so a long list doesn't wait): each slides 8px in from the right and clears from a 4px blur as it fades in, in 0.3s on a soft ease-out (`{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }`). The box itself is there at once (its opacity in 0.1s, its scale as before), so the rows bring the fade, and a disabled row comes in at its own opacity. An item highlighted as it opens (the chosen one) shows its highlight once its row has landed. Reopened while it closes it doesn't stagger again, closing shows every row at once, and under reduced motion nothing staggers.
* Base UI keeps the popup mounted after it closes, and Animate UI unmounts it once the exit has played (`onOpenChangeComplete` fires then).
* **The highlight**: one surface glides behind the highlighted item on a spring (stiffness 500, damping 40), following the pointer and the arrow keys alike, and into submenus. Moving to another item, it carries on from where it is, at its speed: however fast the pointer or the arrow keys go, there's one highlight on screen. It only fades in (200ms, on CSS's `ease`) when it appears from nothing, and its color changes the same way when the item's highlighted background differs from the previous one's. It glides on the compositor (a Web Animation of `transform`), so a busy main thread, a submenu opening for instance, doesn't stall it. Into a submenu or back out of it, each menu clips its own part, as in v1: the previous surface glides along with the new one, the same box on screen, so the two make one highlight crossing from one menu into the other; the entering part fades in as it glides. When the pointer leaves the menu, it stays on the last item. It wears the item's own highlighted background (`focus:bg-accent`, `data-highlighted:bg-accent`…), read from your styles: the item's background is cleared while it's highlighted (or still has the focus, or its submenu is open), and a `focus:` background is read again once the item has the focus; its text colors stay.
* **CheckboxItemIndicator** and **RadioItemIndicator** draw themselves like a Checkbox's check (their stroke and opacity in 0.3s on Motion's easeOut, at once: there's no box to fill first) when the item is checked, and erase themselves in 0.3s when it's unchecked (Animate UI keeps them mounted for that). Checking another radio item erases the old check while the new one draws itself. Only checking and unchecking animate: opening the menu shows its checks at rest, and closing it leaves them as they are.
* With `animation="pop"` on an indicator (or `checkAnimation="pop"` on an `AnimateUIProvider`), checks pop instead: in from half their size out of a 2px blur (a spring, stiffness 500, damping 24), and back into their blur in 0.15s. A radio item's check doesn't pop from one item to another: it glides from the item it leaves to the newly checked one, on the highlight's spring (stiffness 500, damping 40), like a select's. The demo's Controls switch between the two.
* With `closeOnClick` on an item, choosing it closes the menu: when its check changes (a checkbox item's, or another radio item's than the checked one), the menu holds still first (250ms while a check draws itself, 150ms while it pops or glides), so the change is seen. Escape and outside clicks don't wait.
* When the menu closes with focus inside, focus goes back to the trigger at once instead of after the exit, and the leaving popup ignores the pointer.
* With `keepMounted` on the Portal, the closed popup stays in the DOM and Base UI hides it after the exit.
* Open from the start (`defaultOpen`), the menu plays its entrance on page load, like v1.
* Under reduced motion, nothing scales or glides: the menu and the checks only fade, and the menu doesn't hold; the highlight jumps from item to item and only fades in when it appears.

## API Reference [#api-reference]

Every part takes exactly the props of [Base UI's Menu](https://base-ui.com/react/components/menu#api-reference). Animate UI adds the animation props below. The Popup's `render` prop is used by the animation.

### Root, SubmenuRoot, Trigger, Portal, Positioner, Group, GroupLabel, RadioGroup, Separator, Arrow, Backdrop, Viewport [#root-submenuroot-trigger-portal-positioner-group-grouplabel-radiogroup-separator-arrow-backdrop-viewport]

[Base UI props](https://base-ui.com/react/components/menu#api-reference) only. They are not animated.

### Item, LinkItem, CheckboxItem, RadioItem, SubmenuTrigger [#item-linkitem-checkboxitem-radioitem-submenutrigger]

[Base UI props](https://base-ui.com/react/components/menu#api-reference) only. They take part in the highlight; it needs nothing more.

### Popup [#popup]

[Base UI props](https://base-ui.com/react/components/menu#popup), plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `transition` | `Transition` | `{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }` | Transition of the opening, and of the closing unless `exitTransition` is set. |
| `exitTransition` | `Transition` | `transition` | Transition of the closing. |

### CheckboxItemIndicator, RadioItemIndicator [#checkboxitemindicator-radioitemindicator]

[Base UI props](https://base-ui.com/react/components/menu#checkbox-item-indicator), plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `animation` | `'draw' \| 'pop'` | `the closest AnimateUIProvider's checkAnimation, else 'draw'` | How the check shows and hides: `draw` (it draws itself and erases itself) or `pop` (it pops in from half its size and shrinks back out; a radio item's check glides to the newly checked item). |
| `transition` | `Transition` | `draw: 0.3s on Motion's easeOut both ways (a Checkbox's, without its delay); pop: a spring (stiffness 500, damping 24) in, 0.15s out, and the highlight's spring (stiffness 500, damping 40) for the glide` | Transition of the check showing and hiding itself, and of a radio item's check gliding (`pop`). |


context menu - 

# Context Menu (/docs/primitives/base-ui/context-menu)



## Installation [#installation]

```bash
npm install @animate-ui/react motion
```

Add the shadcn/ui component, then animate it:

```bash
npx shadcn@latest add context-menu
npx @animate-ui/cli@latest animate context-menu
```

## Usage [#usage]

Import the primitive from Animate UI instead of Base UI. Everything else stays the same.

```tsx
import { ContextMenu } from '@animate-ui/react/primitives/base-ui/context-menu';

export function CanvasMenu() {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup>
            <ContextMenu.Item>Undo</ContextMenu.Item>
            <ContextMenu.Item>Duplicate</ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item>Delete</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
```

Using the `@base-ui/react` umbrella import instead? The barrel mirrors it: `import { ContextMenu } from '@animate-ui/react/primitives/base-ui'`.

### Check animation [#check-animation]

Checkbox and radio items show their check in a `CheckboxItemIndicator` or a `RadioItemIndicator`: it draws itself when the item is checked, and erases itself when it's unchecked (a radio item's while the new one draws). With `animation="pop"`, it pops in from half its size and shrinks back out instead, and a radio item's check glides to the newly checked item:

```tsx
import { ContextMenu } from '@animate-ui/react/primitives/base-ui/context-menu';

export function CanvasMenu() {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup>
            <ContextMenu.CheckboxItem defaultChecked>
              <ContextMenu.CheckboxItemIndicator animation="pop">
                <CheckIcon />
              </ContextMenu.CheckboxItemIndicator>
              Show grid
            </ContextMenu.CheckboxItem>
            <ContextMenu.Separator />
            <ContextMenu.RadioGroup defaultValue="fit">
              <ContextMenu.RadioItem value="fit">
                <ContextMenu.RadioItemIndicator animation="pop">
                  <CheckIcon />
                </ContextMenu.RadioItemIndicator>
                Zoom to fit
              </ContextMenu.RadioItem>
              <ContextMenu.RadioItem value="100">
                <ContextMenu.RadioItemIndicator animation="pop">
                  <CheckIcon />
                </ContextMenu.RadioItemIndicator>
                Zoom to 100%
              </ContextMenu.RadioItem>
            </ContextMenu.RadioGroup>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
```

The same demo with `checkAnimation="pop"` (its Controls switch it back to `draw`):

To pop every check of your app at once (checkboxes, menus, selects, comboboxes), set `checkAnimation="pop"` on an [`AnimateUIProvider`](/docs/installation#choose-how-checks-animate-optional) instead.

## Animation [#animation]

Base UI's Context Menu has no Animate UI v1 counterpart: it moves like v1's Base UI Menu.

* **Popup** fades and scales in from 0.9, from the pointer (`--transform-origin`, set inline so it works without styles), in 220ms (`{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }`, a soft ease-out), and closes the same way. Submenu popups grow from the side of their trigger the same way.
* **Stagger**: opening from closed, the rows (items, labels, separators) come in one after another, 33ms apart (closer past 10 rows: 33ms × √(10 / rows), so a long list doesn't wait): each slides 8px in from the right and clears from a 4px blur as it fades in, in 0.3s on a soft ease-out (`{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }`). The box itself is there at once (its opacity in 0.1s, its scale as before), so the rows bring the fade, and a disabled row comes in at its own opacity. An item highlighted as it opens (the chosen one) shows its highlight once its row has landed. Reopened while it closes it doesn't stagger again, closing shows every row at once, and under reduced motion nothing staggers.
* Base UI keeps the popup mounted after it closes, and Animate UI unmounts it once the exit has played (`onOpenChangeComplete` fires then).
* **The highlight**: one surface glides behind the highlighted item on a spring (stiffness 500, damping 40), following the pointer and the arrow keys alike, and into submenus. Moving to another item, it carries on from where it is, at its speed: however fast the pointer or the arrow keys go, there's one highlight on screen. It only fades in (200ms, on CSS's `ease`) when it appears from nothing, and its color changes the same way when the item's highlighted background differs from the previous one's. It glides on the compositor (a Web Animation of `transform`), so a busy main thread, a submenu opening for instance, doesn't stall it. Into a submenu or back out of it, each menu clips its own part, as in v1: the previous surface glides along with the new one, the same box on screen, so the two make one highlight crossing from one menu into the other; the entering part fades in as it glides. When the pointer leaves the menu, it stays on the last item. It wears the item's own highlighted background (`focus:bg-accent`, `data-highlighted:bg-accent`…), read from your styles: the item's background is cleared while it's highlighted (or still has the focus, or its submenu is open), and a `focus:` background is read again once the item has the focus; its text colors stay.
* **CheckboxItemIndicator** and **RadioItemIndicator** draw themselves like a Checkbox's check (their stroke and opacity in 0.3s on Motion's easeOut, at once: there's no box to fill first) when the item is checked, and erase themselves in 0.3s when it's unchecked (Animate UI keeps them mounted for that). Checking another radio item erases the old check while the new one draws itself. Only checking and unchecking animate: opening the menu shows its checks at rest, and closing it leaves them as they are.
* With `animation="pop"` on an indicator (or `checkAnimation="pop"` on an `AnimateUIProvider`), checks pop instead: in from half their size out of a 2px blur (a spring, stiffness 500, damping 24), and back into their blur in 0.15s. A radio item's check doesn't pop from one item to another: it glides from the item it leaves to the newly checked one, on the highlight's spring (stiffness 500, damping 40), like a select's. The demo's Controls switch between the two.
* With `closeOnClick` on an item, choosing it closes the menu: when its check changes (a checkbox item's, or another radio item's than the checked one), the menu holds still first (250ms while a check draws itself, 150ms while it pops or glides), so the change is seen. Escape and outside clicks don't wait.
* When the menu closes with focus inside, focus goes back to where it was before the menu opened at once instead of after the exit, and the leaving popup ignores the pointer.
* With `keepMounted` on the Portal, the closed popup stays in the DOM and Base UI hides it after the exit.
* Open from the start (`defaultOpen`), the menu plays its entrance on page load.
* Under reduced motion, nothing scales or glides: the menu and the checks only fade, and the menu doesn't hold; the highlight jumps from item to item and only fades in when it appears.

## API Reference [#api-reference]

Every part takes exactly the props of [Base UI's Context Menu](https://base-ui.com/react/components/context-menu#api-reference). Animate UI adds the animation props below. The Popup's `render` prop is used by the animation.

### Root, Trigger, Portal, Positioner, Group, GroupLabel, RadioGroup, SubmenuRoot, Separator, Arrow, Backdrop [#root-trigger-portal-positioner-group-grouplabel-radiogroup-submenuroot-separator-arrow-backdrop]

[Base UI props](https://base-ui.com/react/components/context-menu#api-reference) only. They are not animated.

### Item, LinkItem, CheckboxItem, RadioItem, SubmenuTrigger [#item-linkitem-checkboxitem-radioitem-submenutrigger]

[Base UI props](https://base-ui.com/react/components/context-menu#api-reference) only. They take part in the highlight; it needs nothing more.

### Popup [#popup]

[Base UI props](https://base-ui.com/react/components/context-menu#popup), plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `transition` | `Transition` | `{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }` | Transition of the opening, and of the closing unless `exitTransition` is set. |
| `exitTransition` | `Transition` | `transition` | Transition of the closing. |

### CheckboxItemIndicator, RadioItemIndicator [#checkboxitemindicator-radioitemindicator]

[Base UI props](https://base-ui.com/react/components/context-menu#checkbox-item-indicator), plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `animation` | `'draw' \| 'pop'` | `the closest AnimateUIProvider's checkAnimation, else 'draw'` | How the check shows and hides: `draw` (it draws itself and erases itself) or `pop` (it pops in from half its size and shrinks back out; a radio item's check glides to the newly checked item). |
| `transition` | `Transition` | `draw: 0.3s on Motion's easeOut both ways (a Checkbox's, without its delay); pop: a spring (stiffness 500, damping 24) in, 0.15s out, and the highlight's spring (stiffness 500, damping 40) for the glide` | Transition of the check showing and hiding itself, and of a radio item's check gliding (`pop`). |


scroll fade - 

# Scroll Fade (/docs/primitives/animate-ui/scroll-fade)



## Installation [#installation]

```bash
npm install @animate-ui/react motion
```

## Usage [#usage]

```tsx
import { ScrollFade } from '@animate-ui/react/primitives/effects/scroll-fade';

export function Changelog() {
  return (
    <ScrollFade className="h-64">
      <ul>{/* … */}</ul>
    </ScrollFade>
  );
}
```

`orientation="horizontal"` fades the left and right edges, `"both"` all four. With `asChild`, the child element becomes the scroll container.

To fade a scroll element you don't render yourself (a library's viewport), pass its ref to `useScrollFade`:

```tsx
import { useRef } from 'react';
import { ScrollArea } from 'radix-ui';
import { useScrollFade } from '@animate-ui/react/primitives/effects/scroll-fade';

function Sidebar() {
  const viewportRef = useRef<HTMLDivElement>(null);
  useScrollFade(viewportRef, { size: 32 });
  return <ScrollArea.Viewport ref={viewportRef}>{/* … */}</ScrollArea.Viewport>;
}
```

## Animation [#animation]

* An edge fades only when there is content past it: none at the edge you're at, none at all when nothing overflows. The fade follows the scroll position directly, with no lag: over the first half of `size` scrolled away from an edge (20px by default), that edge goes from sharp to faded, and back as you return. The fade keeps its depth (`size`); only how much the edge clears changes.
* On page load, the fade is already in place: nothing animates in.
* The items shrink and blur into the fade with it: from 1.75 times `size` away from a faded edge, each one eases toward 97% (`shrink`, 0.03) and a 4px blur (`blur`) as its center nears the edge, following the scroll the same way. Their places are measured when the content changes and once as a scroll starts, never every frame, and they're written once per frame. An item with its own `filter` keeps it and isn't blurred. The items are the children of the first element holding several (a list's items, through its `ul`), and a group among them is opened up: a `ul`, `ol`, `role="list"` or `role="group"`, or an element holding one (a section with its title and list), shrinks line by line, never as a whole. They're shrunk with the `scale` property so their own `transform` stays.
* It's a `mask-image`, so the content itself dissolves: it works on any background, in light and dark.
* Scrolling never re-renders React: the amounts are motion values written to CSS variables (`--scroll-fade-top`, `--scroll-fade-bottom`, `--scroll-fade-left`, `--scroll-fade-right`, from 0 to 1).
* When the content changes size without a scroll (items added or removed), the edges ease to their new amount (200ms, `transition`).
* Under reduced motion, the fade and the blur follow the scroll position the same way, and jump when the content changes size; nothing shrinks.

## API Reference [#api-reference]

### ScrollFade [#scrollfade]

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `asChild` | `boolean` | `false` | Make the child element the scroll container instead of a wrapping div, merging their props and refs. |
| `orientation` | `'vertical' \| 'horizontal' \| 'both'` | `'vertical'` | Which edges fade. Also sets the overflow of that axis to `auto`. |
| `size` | `number` | `40` | Depth of the fade, in pixels, once an edge is fully faded. An edge fades in over the first half of `size` scrolled away from it. |
| `shrink` | `number` | `0.03` | How much the items shrink at the deepest of the fade (0 turns it off). |
| `blur` | `number` | `4` | Blur of the items at the deepest of the fade, in pixels (0 turns it off). |
| `transition` | `Transition` | `{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }` | How the edges ease when the content changes size without a scroll (a Motion transition, `duration` in seconds). Scrolling itself is followed directly. |
| `enabled` | `boolean` | `true` | Apply the fade. |
| `...props` | `React.ComponentProps<'div'>` |  | Props of the scroll container. |

### useScrollFade [#usescrollfade]

`useScrollFade(ref, options)` applies the fade to the element of `ref`. It takes the options of `ScrollFade` (`orientation`, `size`, `shrink`, `blur`, `transition`, `enabled`) and returns the motion values of each edge (`top`, `bottom`, `left`, `right`). It doesn't set the overflow: the element must already scroll.


file tree - 

---
title: File Tree
description: Animated file-tree component with spring folder expand/collapse, animated hover highlight, and automatic file-type icons.
author:
  name: Léo
  url: https://x.com/leouiux
---

## Installation

<CliTabs command="@unlumen-ui/file-tree" />

## File Structure

<ComponentFiles name="file-tree" />

## Usage

```tsx
import {
  FileTree,
  type FileTreeElement,
} from "@/components/unlumen-ui/file-tree";

const elements: FileTreeElement[] = [
  {
    id: "src",
    name: "src",
    type: "folder",
    children: [
      {
        id: "components",
        name: "components",
        type: "folder",
        children: [
          { id: "button", name: "button.tsx", highlight: true },
          { id: "card", name: "card.tsx", highlight: true },
        ],
      },
      { id: "page", name: "page.tsx" },
    ],
  },
  { id: "package-json", name: "package.json" },
];

export default function Example() {
  return <FileTree elements={elements} defaultOpenIds={["src"]} />;
}
```

## API Reference

### FileTree

<TypeTable
  type={{
    elements: {
      description: "Tree nodes rendered by the component.",
      type: "FileTreeElement[]",
      required: true,
    },
    className: {
      description: "Additional classes applied to the root element.",
      type: "string",
      required: false,
    },
    highlightColor: {
      description: "Text color used for nodes marked with `highlight: true`.",
      type: "string",
      required: false,
      default: '"#f472b6"',
    },
    indentSize: {
      description: "Horizontal indent in pixels for nested folder content.",
      type: "number",
      required: false,
      default: "24",
    },
    showIcons: {
      description: "Whether file and folder icons are rendered.",
      type: "boolean",
      required: false,
      default: "true",
    },
    defaultOpenIds: {
      description: "Folder ids that should be open on first render.",
      type: "string[]",
      required: false,
      default: "[]",
    },
  }}
/>

### FileTreeElement

<TypeTable
  type={{
    id: {
      description: "Stable unique id used as the React key.",
      type: "string",
      required: true,
    },
    name: {
      description: "Label shown for the file or folder.",
      type: "string",
      required: true,
    },
    type: {
      description:
        'Node type. Use `"folder"` for collapsible branches; omit it for files.',
      type: '"folder" | "file"',
      required: false,
    },
    children: {
      description: "Nested nodes rendered inside a folder.",
      type: "FileTreeElement[]",
      required: false,
    },
    icon: {
      description: "Custom icon component for file nodes.",
      type: "React.ComponentType<{ className?: string }>",
      required: false,
    },
    highlight: {
      description: "Marks the node as visually highlighted.",
      type: "boolean",
      required: false,
    },
    defaultOpen: {
      description: "Whether a folder starts expanded.",
      type: "boolean",
      required: false,
    },
  }}
/>

## Notes

- Folders are closed by default. Use `defaultOpenIds` on `<FileTree />` or `defaultOpen` on a folder node to choose what starts expanded.
- Opening a folder does not automatically open its nested folders.
- File icons are resolved from common extensions like `tsx`, `json`, `mdx`, `svg`, and image formats.
- The hover background is rendered once and moves between rows with spring animation.

## Credits

Built by [leo](https://x.com/leouiux) and inspired by the file tree in [Animate UI](https://animate-ui.com/docs/components/radix/files).

<KeepInMind />

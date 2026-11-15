/**
 * @file soundAndHaptics.ts
 * @module core/signals/soundAndHaptics
 * @description Phase 171: Licence-clean original procedural interface SFX library
 * (`click`, `pop`, `whoosh`, `tick`, `chime`), signal-bound pitch/volume/pan modulation,
 * mobile haptics vibration patterns, global mute toggle, and strict user-gesture
 * unlock gating (zero playback before interaction).
 */

export type SynthSoundPreset = "click" | "pop" | "whoosh" | "tick" | "chime";

export interface SynthSoundRecipe {
  readonly preset: SynthSoundPreset;
  readonly waveform: "sine" | "triangle" | "noise_bandpass";
  readonly startFreqHz: number;
  readonly endFreqHz: number;
  readonly durationSec: number;
  readonly baseGain: number;
  readonly hapticPatternMs: readonly number[];
}

export const ORIGINAL_SFX_LIBRARY: Readonly<Record<SynthSoundPreset, SynthSoundRecipe>> = {
  click: {
    preset: "click",
    waveform: "triangle",
    startFreqHz: 1100,
    endFreqHz: 320,
    durationSec: 0.032,
    baseGain: 0.38,
    hapticPatternMs: [8],
  },
  pop: {
    preset: "pop",
    waveform: "sine",
    startFreqHz: 260,
    endFreqHz: 780,
    durationSec: 0.065,
    baseGain: 0.45,
    hapticPatternMs: [14],
  },
  whoosh: {
    preset: "whoosh",
    waveform: "noise_bandpass",
    startFreqHz: 240,
    endFreqHz: 1450,
    durationSec: 0.19,
    baseGain: 0.34,
    hapticPatternMs: [12, 20, 12],
  },
  tick: {
    preset: "tick",
    waveform: "sine",
    startFreqHz: 1760,
    endFreqHz: 1320,
    durationSec: 0.018,
    baseGain: 0.25,
    hapticPatternMs: [5],
  },
  chime: {
    preset: "chime",
    waveform: "sine",
    startFreqHz: 880,
    endFreqHz: 1318.5,
    durationSec: 0.38,
    baseGain: 0.42,
    hapticPatternMs: [18, 24, 18],
  },
};

export interface SoundSignalInputs {
  /** Normalized or px/s speed magnitude increasing pitch and loudness. */
  readonly dragSpeedNorm?: number;
  /** Normalized viewport X in [0..1], mapped to stereo pan [-1..1]. */
  readonly normalizedX?: number;
  readonly customGainScale?: number;
}

export interface ModulatedSoundParameters {
  readonly pitchMultiplier: number;
  readonly gain: number;
  readonly pan: number;
  readonly startFreqHz: number;
  readonly endFreqHz: number;
}

/** Map live signal inputs (e.g. faster drag -> higher pitch, pointer X -> stereo pan) into synth params. */
export function bindSoundParamsToSignal(
  preset: SynthSoundPreset,
  inputs: SoundSignalInputs = {}
): ModulatedSoundParameters {
  const recipe = ORIGINAL_SFX_LIBRARY[preset];
  const speed = Math.max(0, Math.min(2, Number.isFinite(inputs.dragSpeedNorm) ? (inputs.dragSpeedNorm ?? 0) : 0));
  const pitchMultiplier = Number((1 + speed * 0.45).toFixed(4));
  const gain = Number(
    Math.max(0, Math.min(1, recipe.baseGain * (0.75 + speed * 0.35) * (inputs.customGainScale ?? 1))).toFixed(4)
  );
  const rawX = inputs.normalizedX ?? 0.5;
  const clampedX = Math.max(0, Math.min(1, Number.isFinite(rawX) ? rawX : 0.5));
  const pan = Number((clampedX * 2 - 1).toFixed(4));
  return {
    pitchMultiplier,
    gain,
    pan: Math.abs(pan) < 1e-12 ? 0 : pan,
    startFreqHz: Number((recipe.startFreqHz * pitchMultiplier).toFixed(2)),
    endFreqHz: Number((recipe.endFreqHz * pitchMultiplier).toFixed(2)),
  };
}

export interface ScheduledAudioHapticEvent {
  readonly frame: number;
  readonly timeSec: number;
  readonly preset: SynthSoundPreset;
  readonly modulated: ModulatedSoundParameters;
  readonly hapticPatternMs: readonly number[];
  readonly hapticDispatched: boolean;
}

export interface AudioBackendDriver {
  triggerSynth(recipe: SynthSoundRecipe, params: ModulatedSoundParameters): void;
  vibrate?(patternMs: readonly number[]): boolean;
}

export interface SoundAndHapticsEngine {
  unlockAudioFromUserGesture(): void;
  isUnlocked(): boolean;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  trigger(
    preset: SynthSoundPreset,
    options?: {
      readonly frame?: number;
      readonly timeSec?: number;
      readonly signals?: SoundSignalInputs;
      readonly withHaptics?: boolean;
    }
  ): ScheduledAudioHapticEvent | null;
  getFiredEvents(): readonly ScheduledAudioHapticEvent[];
  clearLog(): void;
}

/**
 * Deterministic sound & haptics coordinator honoring user-gesture autoplay lock,
 * global mute, WebAudio procedural synthesis drivers, and Vibration API fallback.
 */
export function createSoundAndHapticsEngine(driver?: AudioBackendDriver): SoundAndHapticsEngine {
  let unlocked = false;
  let muted = false;
  const fired: ScheduledAudioHapticEvent[] = [];

  return {
    unlockAudioFromUserGesture(): void {
      unlocked = true;
    },

    isUnlocked(): boolean {
      return unlocked;
    },

    setMuted(nextMuted: boolean): void {
      muted = Boolean(nextMuted);
    },

    isMuted(): boolean {
      return muted;
    },

    trigger(preset, options = {}): ScheduledAudioHapticEvent | null {
      // Strictly suppress audio/haptic playback before first real user interaction or while muted
      if (!unlocked || muted) {
        return null;
      }

      const recipe = ORIGINAL_SFX_LIBRARY[preset];
      const modulated = bindSoundParamsToSignal(preset, options.signals);
      driver?.triggerSynth(recipe, modulated);

      let hapticDispatched = false;
      if (options.withHaptics !== false) {
        if (driver?.vibrate) {
          hapticDispatched = driver.vibrate(recipe.hapticPatternMs);
        } else if (
          typeof globalThis.navigator !== "undefined" &&
          typeof globalThis.navigator.vibrate === "function"
        ) {
          hapticDispatched = globalThis.navigator.vibrate([...recipe.hapticPatternMs]);
        }
      }

      const record: ScheduledAudioHapticEvent = {
        frame: options.frame ?? 0,
        timeSec: options.timeSec ?? 0,
        preset,
        modulated,
        hapticPatternMs: recipe.hapticPatternMs,
        hapticDispatched,
      };
      fired.push(record);
      return record;
    },

    getFiredEvents: () => [...fired],

    clearLog(): void {
      fired.length = 0;
    },
  };
}

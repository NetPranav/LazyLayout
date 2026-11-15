/**
 * ============================================================================
 * STAGE 5 · PHASE 213 — FACES: EXPRESSIONS, BLINKS & LIP SYNC
 * ============================================================================
 * Viseme extraction from audio band levels or transcripts within 1 frame, plus
 * natural automatic blinking and idle breathing modulation.
 * ============================================================================
 */

export type VisemeId = "REST" | "AA" | "EE" | "IH" | "OH" | "OU" | "FV" | "MBP";

export interface AudioLipSyncBands {
  readonly sub: number;
  readonly low: number;
  readonly mid: number;
  readonly high: number;
  readonly rms: number;
}

export interface VisemeKeyframe {
  readonly timeSec: number;
  readonly viseme: VisemeId;
  readonly intensity?: number;
}

export interface FaceRigState {
  readonly timeSec: number;
  readonly viseme: VisemeId;
  readonly jawOpen: number;
  readonly mouthWidth: number;
  readonly lipRound: number;
  readonly blinkLeft: number;
  readonly blinkRight: number;
  readonly browRaiseLeft: number;
  readonly browRaiseRight: number;
  readonly breathOffset: number;
}

export interface FaceEvalOptions {
  readonly blinkIntervalSec?: number;
  readonly blinkDurationSec?: number;
  readonly enableAutoBlink?: boolean;
  readonly enableBreathing?: boolean;
  readonly browExpression?: "neutral" | "happy" | "surprised" | "angry";
}

const VISEME_SHAPES: Record<VisemeId, { jawOpen: number; mouthWidth: number; lipRound: number }> = {
  REST: { jawOpen: 0, mouthWidth: 0.5, lipRound: 0 },
  MBP: { jawOpen: 0.02, mouthWidth: 0.42, lipRound: 0 },
  FV: { jawOpen: 0.14, mouthWidth: 0.58, lipRound: 0.1 },
  OU: { jawOpen: 0.35, mouthWidth: 0.22, lipRound: 0.92 },
  OH: { jawOpen: 0.62, mouthWidth: 0.35, lipRound: 0.78 },
  IH: { jawOpen: 0.34, mouthWidth: 0.72, lipRound: 0.12 },
  EE: { jawOpen: 0.28, mouthWidth: 0.9, lipRound: 0.05 },
  AA: { jawOpen: 0.85, mouthWidth: 0.65, lipRound: 0.25 },
};

/** Classify an instantaneous mouth viseme from audio frequency energies. */
export function classifyVisemeFromAudioBands(bands: AudioLipSyncBands): VisemeId {
  if (bands.rms < 0.04) return "REST";
  if (bands.high > bands.mid * 1.15 && bands.high > 0.22) return "FV";
  if (bands.low > bands.mid * 1.25 && bands.sub > 0.25) return "OU";
  if (bands.mid > 0.55 && bands.high > 0.3) return "EE";
  if (bands.rms > 0.45 && bands.mid >= bands.low) return "AA";
  if (bands.low > 0.32 && bands.mid <= 0.35) return "OH";
  if (bands.rms >= 0.04 && bands.rms < 0.15) return "MBP";
  return "IH";
}

function charPairToViseme(ch: string): VisemeId {
  const c = ch.toUpperCase();
  if ("MBP".includes(c)) return "MBP";
  if ("FV".includes(c)) return "FV";
  if ("UW".includes(c)) return "OU";
  if ("O".includes(c)) return "OH";
  if ("EIY".includes(c)) return "EE";
  if ("A".includes(c)) return "AA";
  if (/[A-Z]/.test(c)) return "IH";
  return "REST";
}

/** Compile a spoken transcript into timed viseme keyframes over `durationSec`. */
export function compileTranscriptToVisemeTrack(
  transcript: string,
  durationSec: number,
): VisemeKeyframe[] {
  const cleaned = transcript.trim();
  if (!cleaned) return [{ timeSec: 0, viseme: "REST" }];
  const chars = Array.from(cleaned);
  const step = durationSec / Math.max(1, chars.length);
  const track: VisemeKeyframe[] = [];

  for (let i = 0; i < chars.length; i++) {
    const v = charPairToViseme(chars[i]);
    const t = i * step;
    if (track.length === 0 || track[track.length - 1].viseme !== v) {
      track.push({ timeSec: t, viseme: v, intensity: v === "REST" ? 0 : 1 });
    }
  }
  track.push({ timeSec: durationSec, viseme: "REST", intensity: 0 });
  return track;
}

/**
 * Evaluate exact face viseme, automatic blink envelope, brow expression,
 * and idle breathing offset at `timeSec`.
 */
export function evaluateFaceRigAtTime(
  timeSec: number,
  visemeTrack: readonly VisemeKeyframe[],
  options: FaceEvalOptions = {},
): FaceRigState {
  let activeViseme: VisemeId = "REST";
  let intensity = 1;
  if (visemeTrack.length > 0) {
    const sorted = [...visemeTrack].sort((a, b) => a.timeSec - b.timeSec);
    activeViseme = sorted[0].viseme;
    intensity = sorted[0].intensity ?? 1;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].timeSec <= timeSec + 1e-6) {
        activeViseme = sorted[i].viseme;
        intensity = sorted[i].intensity ?? 1;
      } else {
        break;
      }
    }
  }

  const shape = VISEME_SHAPES[activeViseme];

  let blinkAmount = 0;
  if (options.enableAutoBlink ?? true) {
    const interval = Math.max(0.5, options.blinkIntervalSec ?? 3.2);
    const dur = Math.max(0.05, options.blinkDurationSec ?? 0.16);
    const mod = ((timeSec % interval) + interval) % interval;
    if (mod >= interval - dur) {
      const u = (mod - (interval - dur)) / dur; // 0..1
      blinkAmount = Math.sin(u * Math.PI);
    }
  }

  const browMap: Record<NonNullable<FaceEvalOptions["browExpression"]>, [number, number]> = {
    neutral: [0, 0],
    happy: [0.35, 0.35],
    surprised: [0.85, 0.85],
    angry: [-0.55, -0.55],
  };
  const [browL, browR] = browMap[options.browExpression ?? "neutral"];
  const breath = (options.enableBreathing ?? true) ? Math.sin(timeSec * 2.1) * 0.5 + 0.5 : 0;

  return {
    timeSec,
    viseme: activeViseme,
    jawOpen: shape.jawOpen * intensity,
    mouthWidth: shape.mouthWidth,
    lipRound: shape.lipRound * intensity,
    blinkLeft: blinkAmount,
    blinkRight: blinkAmount,
    browRaiseLeft: browL,
    browRaiseRight: browR,
    breathOffset: breath,
  };
}

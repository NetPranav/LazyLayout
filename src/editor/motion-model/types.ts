export type PropId = "opacity" | "x" | "y" | "scale" | "rot";
export type EaseName = "Linear" | "Ease in" | "Ease out" | "Ease in out" | "Back out" | "Anticipate" | "Spring" | "Custom";
export type Bezier = readonly [number, number, number, number];
export interface SpringParams { response: number; damping: number }
export interface Keyframe { id: string; t: number; v: number; ease: EaseName; bz?: Bezier; spring?: SpringParams }
export interface PropTrack { p: PropId; keys: Keyframe[] }
export interface Clip { s: number; e: number }
export type Trigger = "On load" | "On hover" | "On click" | "On scroll into view" | "While scrolling";
export type RepeatMode = "Once" | "Number" | "Forever";
export interface MotionLayer {
  id: string; lbl: number; gopen: boolean; clips: Clip[]; open: boolean; mute: boolean; lock: boolean; solo: boolean;
  trig: Trigger; ease: EaseName; rep: RepeatMode; rn: number; yoyo: boolean; ss: string; se: string;
  scrub: boolean; pin: boolean; sprev: number; stag: number; sfrom: "Start" | "End" | "Center"; tr: PropTrack[];
}
export interface Marker { id: string; t: number; name: string }
export interface Composition { fps: number; dur: number; layers: MotionLayer[]; markers: Marker[] }
export interface PropSpec { n: string; u: string; d: number; lo: number; hi: number }

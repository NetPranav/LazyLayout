/**
 * ============================================================================
 * TEMPLATE SPECS (ROADMAP Phase 51)
 * ============================================================================
 * A template is a tree of plain descriptions: a frame with a stack, a piece of text, a button, a picture placeholder.
 * Colours and radii name a brand token instead of a value (`bg: "surface"`), so the layers that get built are bound to
 * the document's variables and restyle when the theme does. The builder in `templateOps.ts` turns the tree into layers.
 * ============================================================================
 */

import type { PropValue } from "../document/registry";
import { BRAND_DEFAULTS, type Token } from "./brand";

export interface TNode {
  archetype: "container" | "text" | "button" | "divider";
  name: string;
  props: Record<string, PropValue>;
  /** Property path to the brand token it is bound to. */
  bind: Record<string, Token>;
  children: TNode[];
  /** For a link in a navigation bar: the section or page (by name) it should lead to once that exists. */
  goes?: string;
}

type Size = "fill" | "hug" | number;
type Pad = number | [number, number, number, number] | [number, number];

export interface FrameOptions {
  dir?: "row" | "column";
  gap?: number;
  pad?: Pad;
  align?: "flex-start" | "center" | "flex-end" | "stretch";
  justify?: "flex-start" | "center" | "flex-end" | "space-between";
  wrap?: boolean;
  w?: Size;
  h?: Size;
  bg?: Token;
  /** Corner radius from the brand radius token. */
  round?: boolean;
  border?: boolean;
  maxWidth?: number;
  minWidth?: number;
  /** Share the free space of a row equally with its siblings. */
  grow?: boolean;
}

const padOf = (pad: Pad | undefined): { top: number; right: number; bottom: number; left: number } => {
  if (pad === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof pad === "number") return { top: pad, right: pad, bottom: pad, left: pad };
  if (pad.length === 2) return { top: pad[0], right: pad[1], bottom: pad[0], left: pad[1] };
  return { top: pad[0], right: pad[1], bottom: pad[2], left: pad[3] };
};

/** Width or height on one axis: a number is fixed, `fill` and `hug` are the sizing modes. */
function sizing(axis: "horizontal" | "vertical", size: Size | undefined): Record<string, PropValue> {
  if (size === undefined) return {};
  if (typeof size === "number") return { [`sizing.${axis}`]: "fixed", [axis === "horizontal" ? "frame.width" : "frame.height"]: size };
  return { [`sizing.${axis}`]: size };
}

export function frame(name: string, o: FrameOptions, children: TNode[] = []): TNode {
  const props: Record<string, PropValue> = {
    positioning: "flow",
    ...({
      "layout.auto": true,
      "layout.display": "flex",
      "layout.flexDirection": o.dir ?? "column",
      "layout.gap": o.gap ?? 0,
      "layout.padding": 0,
      "layout.paddingTop": padOf(o.pad).top,
      "layout.paddingRight": padOf(o.pad).right,
      "layout.paddingBottom": padOf(o.pad).bottom,
      "layout.paddingLeft": padOf(o.pad).left,
      "layout.justifyContent": o.justify ?? "flex-start",
      "layout.alignItems": o.align ?? "flex-start",
      "layout.flexWrap": o.wrap ? "wrap" : "nowrap",
    } satisfies Record<string, PropValue>),
    ...sizing("horizontal", o.w ?? "hug"),
    ...sizing("vertical", o.h ?? "hug"),
    ...(o.maxWidth ? { "layout.maxWidth": o.maxWidth } : {}),
    ...(o.minWidth ? { "layout.minWidth": o.minWidth } : {}),
    ...(o.grow ? { "layout.flexGrow": 1 } : {}),
    "appearance.background.color": o.bg ? (BRAND_DEFAULTS[o.bg].light as string) : "transparent",
  };
  const bind: Record<string, Token> = {};
  if (o.bg) bind["appearance.background.color"] = o.bg;
  if (o.round) {
    props["appearance.radius"] = BRAND_DEFAULTS.radius.light as number;
    bind["appearance.radius"] = "radius";
  }
  if (o.border) {
    props["appearance.border.width"] = 1;
    props["appearance.border.style"] = "solid";
    props["appearance.border.color"] = BRAND_DEFAULTS.border.light as string;
    bind["appearance.border.color"] = "border";
  }
  return { archetype: "container", name, props, bind, children };
}

export interface TextOptions {
  size?: number;
  weight?: number;
  color?: Token;
  align?: "left" | "center" | "right";
  w?: "fill" | "hug";
  maxWidth?: number;
  lineHeight?: number;
}

export function text(name: string, content: string, o: TextOptions = {}): TNode {
  const color = o.color ?? "text";
  return {
    archetype: "text",
    name,
    props: {
      positioning: "flow",
      "content.text": content,
      "typography.fontSize": o.size ?? 16,
      "typography.fontWeight": o.weight ?? 400,
      "typography.lineHeight": o.lineHeight ?? 1.5,
      "typography.textAlign": o.align ?? "left",
      "typography.color": BRAND_DEFAULTS[color].light as string,
      "sizing.horizontal": o.w ?? "hug",
      "sizing.vertical": "hug",
      ...(o.maxWidth ? { "layout.maxWidth": o.maxWidth } : {}),
    },
    bind: { "typography.color": color },
    children: [],
  };
}

export type ButtonVariant = "primary" | "secondary" | "inverse";

export function button(name: string, label: string, variant: ButtonVariant = "primary"): TNode {
  const bg: Token | null = variant === "primary" ? "primary" : variant === "inverse" ? "on-primary" : null;
  const ink: Token = variant === "primary" ? "on-primary" : variant === "inverse" ? "primary" : "text";
  const props: Record<string, PropValue> = {
    positioning: "flow",
    "content.label": label,
    "typography.fontSize": 16,
    "typography.fontWeight": 600,
    "typography.color": BRAND_DEFAULTS[ink].light as string,
    "appearance.background.color": bg ? (BRAND_DEFAULTS[bg].light as string) : "transparent",
    "appearance.radius": BRAND_DEFAULTS.radius.light as number,
    "layout.paddingX": 22,
    "layout.paddingY": 13,
    "sizing.horizontal": "hug",
    "sizing.vertical": "hug",
  };
  const bind: Record<string, Token> = { "typography.color": ink, "appearance.radius": "radius" };
  if (bg) bind["appearance.background.color"] = bg;
  if (variant === "secondary") {
    props["appearance.border.width"] = 1;
    props["appearance.border.style"] = "solid";
    props["appearance.border.color"] = BRAND_DEFAULTS.border.light as string;
    bind["appearance.border.color"] = "border";
  }
  return { archetype: "button", name, props, bind, children: [] };
}

/** A picture stand-in: a rounded, outlined surface of a given height. */
export function picture(name: string, h: number, w: Size = "fill"): TNode {
  return frame(name, { w, h, bg: "surface", round: true, border: true });
}

/** A hairline across the width of its parent. */
export function rule(name: string): TNode {
  return frame(name, { w: "fill", h: 1, bg: "border" });
}

/** Marks a text node as a link to a section or page by name (see `linkNavigation`). */
export const goes = (node: TNode, target: string): TNode => ({ ...node, goes: target });

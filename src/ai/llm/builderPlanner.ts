import { buildReactivityDrafts, type ReactivityAffordance, type ReactivitySource } from "@/core/bindings/reactivityCard";
import { SurfaceSchema } from "@/core/document/effects";
import { BindingSchema, type Binding } from "@/core/document/signals";
import { FULL_EFFECT_LIBRARY } from "@/core/effects/libraryWaves10To13";
import { LIBRARY_WAVES_2_TO_9 } from "@/core/effects/libraryWaves2To9";
import type { EffectDefinitionV1 } from "@/core/effects/effectSdk";
import type { Clip } from "@/core/document/motion";
import type { AiChatMessageInput, AiDocumentContext, MdmJsonPatch } from "./types";

export interface PlannedEffectChoice {
  definitionId: string;
  mdmEffectId: string;
  name: string;
  family: string;
  fallbackMode: string;
  propOverrides: Record<string, number | string | boolean>;
  bindingOverrides: Record<string, { enabled?: boolean; strength?: number }>;
}

export interface EngineChoiceSummary {
  clipId: string;
  layerId: string;
  layerName: string;
  backend: "css" | "svg" | "three";
  reasons: string[];
}

export interface BuilderPlanResult {
  summary: string;
  patches: MdmJsonPatch[];
  explanation: string;
  matchedEffects: PlannedEffectChoice[];
  engineChoices: EngineChoiceSummary[];
  targetLayerIds: string[];
}

const ALL_EFFECT_LIBRARY: readonly EffectDefinitionV1[] = [
  ...LIBRARY_WAVES_2_TO_9,
  ...FULL_EFFECT_LIBRARY,
];

function deterministicSlug(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function toMdmEffectId(defId: string): string {
  const normalized = defId.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return normalized.startsWith("fx_") ? normalized : `fx_${normalized}`;
}

/**
 * Scores curated library effects (`FULL_EFFECT_LIBRARY`) against the user prompt
 * so Phase 243 prefers tested library recipes over raw bespoke keyframes when they fit.
 */
export function matchLibraryEffects(prompt: string, maxMatches = 2): EffectDefinitionV1[] {
  const lower = prompt.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return [];

  const scored: Array<{ def: EffectDefinitionV1; score: number }> = [];
  const wantsMagnetic = /\b(megnatic|magnetic|pull|attract|cursor)\b/.test(lower);
  for (const def of ALL_EFFECT_LIBRARY) {
    const haystack = `${def.id} ${def.name} ${def.family} ${def.affordances.join(" ")}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += token.length >= 5 ? 3 : 2;
      }
    }
    if (wantsMagnetic && def.id === "w2_magnetic_pull") {
      score += 8;
    }
    if (score >= 3) {
      scored.push({ def, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.def.id.localeCompare(b.def.id));
  return scored.slice(0, maxMatches).map((entry) => entry.def);
}

/**
 * Infers rendering backend (`css`, `svg`, `three`) for a clip without importing
 * `"use client"` rules modules on the server.
 */
export function inferClipEngineChoice(
  clip: Pick<Clip, "id" | "layerId" | "tracks">,
  layerName: string,
): EngineChoiceSummary {
  const props = clip.tracks.map((t) => t.property);
  if (props.some((p) => p.startsWith("scene3d.") || p.startsWith("3d."))) {
    return {
      clipId: clip.id,
      layerId: clip.layerId,
      layerName,
      backend: "three",
      reasons: ["3D scene property animated via three.js renderer."],
    };
  }
  if (props.some((p) => p.startsWith("svg.") || p.startsWith("path."))) {
    return {
      clipId: clip.id,
      layerId: clip.layerId,
      layerName,
      backend: "svg",
      reasons: ["Vector/path property routed to SVG attribute engine."],
    };
  }
  return {
    clipId: clip.id,
    layerId: clip.layerId,
    layerName,
    backend: "css",
    reasons: [`GPU-composited properties (${props.join(", ")}) run on the CSS/WAAPI compositor.`],
  };
}

/**
 * Formats a concise human-readable summary explaining engine routing choices and
 * library effects selected by the planner.
 */
export function formatEngineSummary(
  engineChoices: readonly EngineChoiceSummary[],
  effects: readonly PlannedEffectChoice[],
): string {
  const parts: string[] = [];
  if (effects.length > 0) {
    parts.push(
      `Library effects: ${effects
        .map((e) => `${e.name} (${e.family}, fallback: ${e.fallbackMode})`)
        .join("; ")}.`,
    );
  }
  if (engineChoices.length > 0) {
    parts.push(
      `Engine choices: ${engineChoices
        .map((c) => `${c.layerName} → ${c.backend.toUpperCase()} (${c.reasons[0]})`)
        .join("; ")}.`,
    );
  }
  return parts.join(" ");
}

/**
 * Phase 243 Planner + Builder:
 * Picks target/new layers, prefers curated library effects when they match the prompt,
 * creates rule-compliant clips & compositions, supports follow-up turns, and explains engine choices.
 */
export function planBuilderTurn(input: {
  prompt: string;
  documentContext?: AiDocumentContext;
  messages?: readonly AiChatMessageInput[];
  targetLayerIds?: readonly string[];
}): BuilderPlanResult {
  const { prompt, documentContext: ctx, messages = [] } = input;
  const lower = prompt.toLowerCase();
  const layers = ctx?.layers ?? [];
  const requestedIds =
    input.targetLayerIds && input.targetLayerIds.length > 0
      ? input.targetLayerIds
      : (ctx?.selectedIds ?? []);
  const explicitTargetLayers = requestedIds
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  const mentionsButton = /\bbutton|btn|cta|get started\b/.test(lower);
  const mentionsCard = /\bcard|panel|box|container\b/.test(lower);
  const mentionsTitle = /\btitle|headline|heading|text\b/.test(lower);
  const namedLayer = layers.find(
    (l) => l.name && l.id !== "elem_canvas_root" && lower.includes(l.name.toLowerCase()),
  );
  const roleMatchedLayer = mentionsButton
    ? layers.find((l) => l.type === "button" || /button|cta|get started/i.test(l.name))
    : mentionsTitle
      ? layers.find((l) => l.type === "text" || /title|headline/i.test(l.name))
      : mentionsCard
        ? layers.find((l) => (l.type === "container" && l.parentId !== null) || /card|hero/i.test(l.name))
        : undefined;
  const fallbackLayer =
    namedLayer ??
    roleMatchedLayer ??
    layers.find((l) => l.type !== "page" && l.id !== "elem_canvas_root" && l.parentId !== null) ??
    layers.find((l) => l.type !== "page") ??
    layers[0];
  const targetLayers = explicitTargetLayers.length > 0 ? explicitTargetLayers : fallbackLayer ? [fallbackLayer] : [];
  const preferredLayer = targetLayers[0];

  // Combine follow-up context clues if user says "make it faster/slower/stronger"
  const priorUserText = messages
    .filter((m) => m.role === "user")
    .slice(0, -1)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  const isFollowUpSpeed = /\b(faster|quicker|snappier|slower|smoother)\b/.test(lower);
  const duration = /\b(faster|quicker|snappier)\b/.test(lower)
    ? 0.3
    : /\b(slower|smoother|gentle)\b/.test(lower)
      ? 1.0
      : 0.6;

  const suffix = deterministicSlug(`${prompt}:${messages.length}`);
  const wantsMagneticOrCursor = /\b(megnatic|magnetic|pull|follow|repel|tilt|cursor|pointer|toward|towards)\b/.test(lower);
  const wantsMotion =
    isFollowUpSpeed ||
    wantsMagneticOrCursor ||
    /\b(fade|slide|bounce|scale|zoom|rotate|hover|tap|press|scroll|loop|pulse|float|animate|entrance|exit|reveal|pop)\b/.test(
      lower,
    );

  // Match curated library effects when prompt asks for rich FX / interactions
  const effectMatches = matchLibraryEffects(
    `${prompt}${isFollowUpSpeed ? ` ${priorUserText}` : ""}`,
    1,
  );

  // Create a new layer if none exists or user asks to create/add UI without motion/effect-only phrasing
  const explicitCreateLayer =
    !preferredLayer ||
    (!wantsMotion &&
      effectMatches.length === 0 &&
      /\b(create|add|new|build|make)\b.*\b(card|hero|banner|frame|box|button|text|headline|badge|section)\b/.test(
        lower,
      ));

  if (explicitCreateLayer) {
    const isButton = /\bbutton\b/.test(lower);
    const isText = /\btext|headline|title\b/.test(lower) && !isButton;
    const isBadge = /\bbadge|pill|tag\b/.test(lower);
    const archetype = isButton ? "button" : isText ? "text" : isBadge ? "badge" : "container";
    const layerId = `layer_${suffix}`;
    const name = isButton
      ? "CTA Button"
      : isText
        ? "Headline"
        : isBadge
          ? "Status Badge"
          : /\bhero\b/.test(lower)
            ? "Hero Section"
            : "Container";

    const patches: MdmJsonPatch[] = [
      {
        op: "add",
        path: `/layers/${layerId}`,
        value: {
          id: layerId,
          name,
          archetype,
          parentId: null,
          children: [],
          properties: {
            "transform.x": 80,
            "transform.y": 80,
            "frame.width": isButton ? 180 : isBadge ? 120 : 360,
            "frame.height": isButton ? 48 : isBadge ? 32 : 200,
            ...(isText ? { "text.content": "LazyLayout Studio", "typography.fontSize": 32 } : {}),
            ...(archetype === "container" ? { "appearance.radius": 12 } : {}),
          },
        },
      },
    ];

    return {
      summary: `Create ${name} (${archetype})`,
      patches,
      explanation: `Added root ${archetype} layer "${name}" (${layerId}) with canonical geometry properties.`,
      matchedEffects: [],
      engineChoices: [],
      targetLayerIds: [layerId],
    };
  }

  const patches: MdmJsonPatch[] = [];
  const matchedEffects: PlannedEffectChoice[] = [];
  const engineChoices: EngineChoiceSummary[] = [];

  for (let tIdx = 0; tIdx < targetLayers.length; tIdx += 1) {
    const curTarget = targetLayers[tIdx];
    const targetId = curTarget.id;
    const layerSuffix = targetLayers.length === 1 ? suffix : `${suffix}_${tIdx}`;

    // 1. Prefer curated library effect instances when they fit the prompt
    for (let i = 0; i < effectMatches.length; i += 1) {
      const def = effectMatches[i];
      const instId = `eff_${layerSuffix}_${i}`;
      const mdmEffectId = toMdmEffectId(def.id);
      const propOverrides: Record<string, number | string | boolean> = {};
      for (const [k, spec] of Object.entries(def.props)) {
        if (spec.simpleFaceVisible) {
          propOverrides[k] = spec.defaultValue;
        }
      }
      const bindingOverrides: Record<string, { enabled?: boolean; strength?: number }> = {};
      if (def.bindings[0]) {
        bindingOverrides[def.bindings[0].signal] = { enabled: true, strength: 1 };
      }

      patches.push({
        op: "add",
        path: `/effects/${instId}`,
        value: {
          id: instId,
          layerId: targetId,
          effectId: mdmEffectId,
          version: "1.0.0",
          propOverrides,
          bindingOverrides,
          seed: 1,
        },
      });

      if (tIdx === 0) {
        matchedEffects.push({
          definitionId: def.id,
          mdmEffectId,
          name: def.name,
          family: def.family,
          fallbackMode: def.fallback.mode,
          propOverrides,
          bindingOverrides,
        });
      }
    }

    // 1b. Cursor / hover reactive driver bindings so Preview executes magnetic pull / tilt / glow live!
    if (wantsMagneticOrCursor) {
      const source: ReactivitySource = /\bscroll\b/.test(lower) ? "scroll" : "cursor";
      const affordance: ReactivityAffordance = /\brepel|push\b/.test(lower)
        ? "repel"
        : /\btilt\b/.test(lower)
          ? "tilt"
          : /\bglow|bright\b/.test(lower)
            ? "glow"
            : "follow";
      const drafts = buildReactivityDrafts({
        ownerLayerId: targetId,
        layerName: curTarget.name,
        source,
        affordance,
        strength: 55,
        smoothness: 45,
      });
      const driverLabel = /\b(megnatic|magnetic|pull)\b/.test(lower) ? "Magnetic Pull" : `Cursor ${affordance}`;
      const isAlreadySurface = curTarget.type === "effectSurface";
      const surfaceLayerId = isAlreadySurface ? targetId : `lay_srf_${layerSuffix}`;
      if (!isAlreadySurface) {
        patches.push({
          op: "add",
          path: `/layers/${surfaceLayerId}`,
          value: {
            id: surfaceLayerId,
            name: `${curTarget.name} ${driverLabel} Surface`,
            archetype: "effectSurface",
            parentId: null,
            children: [],
            properties: {
              "transform.x": 0,
              "transform.y": 0,
              "frame.width": 1,
              "frame.height": 1,
            },
          },
        });
      }
      const surfaceId = `srf_${layerSuffix}`;
      const surface = SurfaceSchema.parse({
        id: surfaceId,
        layerId: surfaceLayerId,
        role: "inline",
        program: { kind: "css", ref: driverLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
        fallback: ["css", "poster"],
        cost: { tier: "T0", estimateMsAt1080p: 0.45 },
        policies: {
          touch: "tap",
          reducedMotion: { mode: "calm", at: 0 },
        },
        poster: { at: 0 },
      });
      patches.push({
        op: "add",
        path: `/surfaces/${surfaceId}`,
        value: surface,
      });
      drafts.forEach((draft, idx) => {
        const bindingId = `bnd_${layerSuffix}_${idx}`;
        const binding: Binding = BindingSchema.parse({
          ...draft,
          id: bindingId,
          ownerLayerId: surfaceLayerId,
          enabled: true,
          name: driverLabel,
        });
        patches.push({
          op: "add",
          path: `/bindings/${bindingId}`,
          value: binding,
        });
      });
    }

    // 2. Motion / reaction clip planning (when prompt asks for motion or no effect matched)
    const isButtonOrInteractive =
      curTarget.type === "button" ||
      curTarget.type === "link" ||
      curTarget.type === "input";

    if (wantsMotion) {
      const effectiveLower = `${priorUserText} ${lower}`;
      const isTap = /\b(tap|press|click)\b/.test(lower) || (isFollowUpSpeed && /\b(tap|press|click)\b/.test(effectiveLower));
      const isHover = /\b(hover)\b/.test(lower) || (isFollowUpSpeed && /\b(hover)\b/.test(effectiveLower));
      const isScroll = /\b(scroll|in view|reveal)\b/.test(lower);
      const isLoop = /\b(loop|pulse|float)\b/.test(lower);

      const clipType =
        isTap && isButtonOrInteractive
          ? "tap"
          : isHover && isButtonOrInteractive
            ? "hover"
            : isScroll
              ? "scroll"
              : isLoop
                ? "loop"
                : "entrance";
      const trigger =
        clipType === "tap"
          ? "press"
          : clipType === "hover"
            ? "hover"
            : clipType === "scroll"
              ? "inView"
              : "mount";

      const clipId = `clip_${layerSuffix}`;
      const trackId = `trk_${layerSuffix}`;
      const isSlide = /\b(slide|move|enter|float)\b/.test(lower);
      const isScale = /\b(scale|zoom|bounce|pop|pulse|tap)\b/.test(lower);
      const isRotate = /\b(rotate|spin|turn)\b/.test(lower);

      const property = isRotate
        ? "transform.rotate"
        : isScale
          ? "transform.scale"
          : isSlide
            ? "transform.y"
            : "appearance.opacity";
      const fromVal = isRotate ? 0 : isScale ? (clipType === "tap" ? 1 : 0.92) : isSlide ? 24 : 0;
      const toVal = isRotate ? 12 : isScale ? (clipType === "tap" ? 0.96 : 1.04) : isSlide ? 0 : 1;

      const clip: Clip = {
        id: clipId,
        layerId: targetId,
        name: `${curTarget.name} ${clipType}`,
        type: clipType,
        trigger,
        duration,
        easing: "power2.out",
        enabled: true,
        tracks: [
          {
            id: trackId,
            property,
            keyframes: [
              { id: `kf_${layerSuffix}_0`, time: 0, value: fromVal },
              { id: `kf_${layerSuffix}_1`, time: duration, value: toVal },
            ],
          },
        ],
      };

      patches.push({ op: "add", path: `/clips/${clipId}`, value: clip });
      patches.push(
        trigger === "mount"
          ? { op: "add", path: "/compositions/comp_main/clips/-", value: { clipId, offset: Number((tIdx * 0.08).toFixed(2)) } }
          : {
              op: "add",
              path: `/compositions/comp_${clipId}`,
              value: {
                id: `comp_${clipId}`,
                name: `${curTarget.name} ${clipType}`,
                kind: "interaction",
                duration: Math.max(duration, 1),
                fps: 60,
                workArea: { start: 0, end: Math.max(duration, 1) },
                trigger: {
                  on: trigger,
                  layerId: targetId,
                  playback:
                    trigger === "hover" ? "play-reverse" : trigger === "press" ? "restart" : "play",
                },
                markers: [],
                layers: {},
                clips: [{ clipId, offset: 0 }],
                nested: [],
              },
            },
      );

      engineChoices.push(inferClipEngineChoice(clip, curTarget.name));
    }

    // 3. Direct design property edits if no motion/effect patch emitted yet
    if (effectMatches.length === 0 && !wantsMagneticOrCursor && !wantsMotion) {
      if (/\bhide|invisible\b/.test(lower)) {
        patches.push({ op: "replace", path: `/layers/${targetId}/visible`, value: false });
      } else if (/\bshow|visible\b/.test(lower)) {
        patches.push({ op: "replace", path: `/layers/${targetId}/visible`, value: true });
      } else if (/\bopacity|transparent|translucent\b/.test(lower)) {
        const numMatch = lower.match(/\b(0(?:\.\d+)?|1(?:\.0+)?|\d{1,3}%)\b/);
        let nextOpacity = 0.5;
        if (numMatch) {
          nextOpacity = numMatch[1].endsWith("%")
            ? Math.min(1, Math.max(0, parseFloat(numMatch[1]) / 100))
            : Math.min(1, Math.max(0, parseFloat(numMatch[1])));
        }
        patches.push({
          op: "replace",
          path: `/layers/${targetId}/properties/appearance.opacity`,
          value: nextOpacity,
        });
      } else if (/\bmove|shift|nudge|right|left|down|up\b/.test(lower)) {
        const curX = Number(curTarget.propsSample?.["transform.x"] ?? 0);
        const delta = /\bleft\b/.test(lower) ? -40 : 40;
        patches.push({
          op: "replace",
          path: `/layers/${targetId}/properties/transform.x`,
          value: curX + delta,
        });
      } else if (/\bradius|round|corner\b/.test(lower)) {
        patches.push({
          op: "replace",
          path: `/layers/${targetId}/properties/appearance.radius`,
          value: 16,
        });
      } else {
        patches.push({
          op: "replace",
          path: `/layers/${targetId}/name`,
          value: `${curTarget.name} (Edited)`,
        });
      }
    }
  }

  const targetNames = targetLayers.map((l) => l.name).join(", ");
  const engineNote = formatEngineSummary(engineChoices, matchedEffects);
  const summary =
    matchedEffects.length > 0 && engineChoices.length > 0
      ? `Add ${matchedEffects[0].name} effect & ${engineChoices[0].backend.toUpperCase()} motion on ${targetNames}`
      : matchedEffects.length > 0
        ? `Apply library effect ${matchedEffects[0].name} on ${targetNames}`
        : engineChoices.length > 0
          ? `Add ${engineChoices[0].backend.toUpperCase()} motion on ${targetNames}`
          : `Update ${targetNames}`;

  const explanation = [
    `Planned changes for ${targetLayers.map((l) => `"${l.name}"`).join(", ")}.`,
    engineNote,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    summary,
    patches,
    explanation,
    matchedEffects,
    engineChoices,
    targetLayerIds: targetLayers.map((l) => l.id),
  };
}

import React, { useMemo } from "react";
import type { Layer } from "../document/schema";
import { getLayerGeometry } from "../document/properties";
import { isMeshConvex, meshInLayer, meshTiles } from "../geometry/meshWarp";
import { MAX_RENDERED_LAYERS, MAX_TREE_DEPTH } from "./limits";
import { RENDER_DEFINITIONS } from "./definitions";
import { resolveProps } from "./resolve";
import type { RenderContext } from "./types";
import { EffectDefs, effectEntries } from "./effectsRender";
import { layerBoxStyle } from "./geometry";
import { mirrorSourceId } from "../frames/devices";
import { isEditorOnlyLayer } from "../document/editorOnly";
import { readRepeater, repeatCopies } from "./repeater";
import { cloneTransform, clonerCopies, readCloner } from "./cloner";

/**
 * What may be drawn: each renderable layer id mapped to the ids of its renderable children, in paint
 * order. Visible layers reachable from `rootIds` only, stopping at `MAX_TREE_DEPTH` levels and
 * `MAX_RENDERED_LAYERS` layers, and with any edge that would close a cycle cut. Pure, so the limits are
 * decided once, up front, and rendering itself needs no counters and cannot recurse without end.
 */
export type RenderPlan = ReadonlyMap<string, readonly string[]>;

/**
 * With any layer soloed (Phase 61), only soloed layers are drawn, with what contains them and what they contain.
 * Returns null when nothing is soloed (everything draws).
 */
function soloKeep(layers: Record<string, Layer>): Set<string> | null {
  let keep: Set<string> | null = null;
  for (const id in layers) {
    if (layers[id].solo !== true) continue;
    keep ??= new Set();
    for (let cur: Layer | undefined = layers[id], guard = 0; cur && guard++ < MAX_TREE_DEPTH + 1; cur = cur.parentId ? layers[cur.parentId] : undefined) keep.add(cur.id);
    const down = [id];
    for (let next = down.pop(); next !== undefined; next = down.pop()) {
      keep.add(next);
      for (const child of layers[next]?.children ?? []) if (!keep.has(child)) down.push(child);
    }
  }
  return keep;
}

export function selectRenderable(layers: Record<string, Layer>, rootIds: readonly string[], previewOrExport = false): RenderPlan {
  const plan = new Map<string, string[]>();
  const keep = soloKeep(layers);
  const visit = (id: string, depth: number, path: ReadonlySet<string>): boolean => {
    const layer = layers[id];
    if (!layer || layer.visible === false || (keep && !keep.has(id))) return false;
    if (previewOrExport && isEditorOnlyLayer(layer)) return false;
    if (depth > MAX_TREE_DEPTH || path.has(id) || plan.has(id) || plan.size >= MAX_RENDERED_LAYERS) return false;
    const kept: string[] = [];
    plan.set(id, kept);
    const below = new Set(path).add(id);
    for (const childId of layer.children) if (visit(childId, depth + 1, below)) kept.push(childId);
    return true;
  };
  for (const id of rootIds) visit(id, 0, new Set());
  return plan;
}

interface RenderLayerProps {
  layerId: string;
  layers: Record<string, Layer>;
  ctx?: RenderContext;
  /** From `RenderTree`; when omitted the layer and its descendants are planned here. */
  plan?: RenderPlan;
  /** A root of the drawing: it defines the effect filters of everything it draws (FigCraft port F7), as its last child. */
  root?: boolean;
}

/** Draws one layer and its children through the archetype's render definition. */
export const RenderLayer: React.FC<RenderLayerProps> = ({ layerId, layers, ctx = {}, plan, root }) => {
  const own = useMemo(() => (plan ? null : selectRenderable(layers, [layerId])), [plan, layers, layerId]);
  const permitted = plan ?? own!;
  const stored = layers[layerId];
  const childIds = permitted.get(layerId);
  if (!stored || !childIds) return null;

  // A linked view is as tall as what it shows at its breakpoint (never shorter than it was made). A frame shown as the
  // device's screen is that tall instead, and what is below scrolls.
  const sourceOf = mirrorSourceId(stored);
  const shownLayers = sourceOf ? (ctx.mirrorViews?.[stored.id] ?? layers) : null;
  const shown = sourceOf && shownLayers ? shownLayers[sourceOf] : undefined;
  const screen = ctx.screenFrames?.[stored.id];
  const layer: Layer =
    screen !== undefined
      ? { ...stored, properties: { ...stored.properties, "frame.height": screen, "layout.overflowX": "hidden", "layout.overflowY": "hidden" } }
      : shown
        ? { ...stored, properties: { ...stored.properties, "frame.height": Math.max(Number(stored.properties["frame.height"] ?? 0), Number(shown.properties["frame.height"] ?? 0)) } }
        : stored;
  if (isEditorOnlyLayer(layer) && (ctx.mode === "preview" || ctx.mode === "export")) return null;

  const resolved = resolveProps(layer);
  const g = getLayerGeometry(layer);
  const mesh = meshInLayer(resolved.get("transform.mesh"), [g.frame.x, g.frame.y]);
  const isMeshed = mesh !== null && isMeshConvex(mesh) && g.frame.width > 0 && g.frame.height > 0 && !ctx.inMeshTile;

  const Definition = RENDER_DEFINITIONS[layer.archetype];
  const isFlexContainer = layer.archetype === "container" || layer.archetype === "form";
  const childDirection = isFlexContainer && resolved.str("layout.display", "flex") === "grid" ? "grid" : isFlexContainer && resolved.str("layout.flexDirection", "column") === "row" ? "row" : "column";
  const childCtx: RenderContext = { ...ctx, parentDirection: childDirection, layers, stackZ: undefined };
  const reverseZ = resolved.bool("layout.reverseZ", false);

  if (isMeshed) {
    const tiles = meshTiles(g.frame.width, g.frame.height, mesh, [0, 0]);
    const outerBox = layerBoxStyle(layer, resolved, ctx, { shadow: "none" });
    delete outerBox.transform;
    delete outerBox.transformOrigin;
    const tileCtx: RenderContext = { ...(ctx.layers ? ctx : { ...ctx, layers }), inMeshTile: true };
    const numCols = mesh.cols - 1;
    const numRows = mesh.rows - 1;

    return (
      <div
        data-element-id={layer.id}
        data-archetype={layer.archetype}
        data-mesh-warped="true"
        style={{
          ...outerBox,
          overflow: "visible",
        }}
      >
        {tiles.map((tile) => {
          const [srcX0, srcY0, srcW, srcH] = tile.srcRect;
          const x0 = tile.col > 0 ? Math.max(0, srcX0 - 0.5) : srcX0;
          const y0 = tile.row > 0 ? Math.max(0, srcY0 - 0.5) : srcY0;
          const x1 = tile.col < numCols - 1 ? Math.min(g.frame.width, srcX0 + srcW + 0.5) : srcX0 + srcW;
          const y1 = tile.row < numRows - 1 ? Math.min(g.frame.height, srcY0 + srcH + 0.5) : srcY0 + srcH;

          return (
            <div
              key={`mesh-tile-${tile.col}-${tile.row}`}
              data-mesh-tile="true"
              data-tile-col={tile.col}
              data-tile-row={tile.row}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: g.frame.width,
                height: g.frame.height,
                clipPath: `polygon(${x0}px ${y0}px, ${x1}px ${y0}px, ${x1}px ${y1}px, ${x0}px ${y1}px)`,
                transform: tile.matrix3d,
                transformOrigin: "0 0",
                pointerEvents: "none",
              }}
            >
              <Definition layer={layer} resolved={resolved} ctx={tileCtx}>
                {childIds.map((childId) => (
                  <RenderLayer key={childId} layerId={childId} layers={layers} ctx={reverseZ ? { ...childCtx, stackZ: layer.children.length - layer.children.indexOf(childId) } : childCtx} plan={permitted} />
                ))}
              </Definition>
            </div>
          );
        })}
        {(root || !plan) && <EffectDefs entries={effectEntries(layers, subtreeOf(permitted, layerId))} />}
      </div>
    );
  }

  const definitionCtx = ctx.layers ? ctx : { ...ctx, layers };
  const kids =
    shown && shownLayers ? (
      shown.children.map((childId) => (
        <div key={`mirror-wrap-${layer.id}-${childId}`} style={{ display: "contents" }} data-mirror-id={layer.id}>
          <RenderLayer layerId={childId} layers={shownLayers} ctx={{ ...childCtx, layers: shownLayers, mirrorId: layer.id }} />
        </div>
      ))
    ) : (
      childIds.map((childId) => (
        <RenderLayer key={childId} layerId={childId} layers={layers} ctx={reverseZ ? { ...childCtx, stackZ: layer.children.length - layer.children.indexOf(childId) } : childCtx} plan={permitted} />
      ))
    );
  const effectDefs = (root || !plan) && <EffectDefs entries={effectEntries(layers, subtreeOf(permitted, layerId))} />;
  const main = (
    <Definition layer={layer} resolved={resolved} ctx={definitionCtx}>
      {kids}
      {effectDefs}
    </Definition>
  );

  // Repeater (Design track D8): copies of an absolutely placed layer, each in a zero-size wrapper at its parent's origin, so the
  // layer's own left and top still apply. Copies are drawn, not selectable, and carry no layer id (the editor and the export
  // both treat `data-repeat-copy` as editor-only).
  const repeater = g.positioning === "absolute" ? readRepeater(resolved.get) : null;
  const cloner = g.positioning === "absolute" ? readCloner(resolved.get) : null;
  if (repeater || cloner) {
    // The cloner (D9) wins when both are on. A fill measures the layer's parent frame.
    const parentFrame = layer.parentId ? layers[layer.parentId] && getLayerGeometry(layers[layer.parentId]).frame : null;
    const copies = cloner
      ? clonerCopies(cloner, g.frame, { width: parentFrame?.width ?? 0, height: parentFrame?.height ?? 0 }).map((c) => ({
          index: c.index,
          transform: cloneTransform(c),
          origin: `${g.frame.x + g.frame.width / 2}px ${g.frame.y + g.frame.height / 2}px`,
          opacity: 1,
        }))
      : repeatCopies(repeater!, g.frame);
    return (
      <>
        {main}
        {copies.map((c) => (
          <div
            key={`repeat-${layer.id}-${c.index}`}
            data-repeat-copy={c.index}
            aria-hidden="true"
            style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "visible", pointerEvents: "none", transform: c.transform, transformOrigin: c.origin, opacity: c.opacity }}
          >
            <Definition layer={{ ...layer, id: `${layer.id}`, properties: { ...layer.properties, "repeat.count": 1 } }} resolved={resolveProps({ archetype: layer.archetype, properties: { ...layer.properties, "repeat.count": 1 } })} ctx={definitionCtx}>
              {kids}
            </Definition>
          </div>
        ))}
      </>
    );
  }
  return main;
};

/** Every layer the plan draws under `rootId`, the root included. */
function subtreeOf(plan: RenderPlan, rootId: string): string[] {
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length > 0 && out.length < MAX_RENDERED_LAYERS) {
    const id = stack.pop()!;
    out.push(id);
    for (const k of plan.get(id) ?? []) stack.push(k);
  }
  return out;
}

/** Draws every top-level layer of a document, within one layer budget. */
export const RenderTree: React.FC<{ layers: Record<string, Layer>; rootIds?: string[]; ctx?: RenderContext }> = ({ layers, rootIds, ctx }) => {
  const roots = useMemo(() => rootIds ?? Object.values(layers).filter((l) => l.parentId === null).map((l) => l.id), [layers, rootIds]);
  const shipping = ctx?.mode === "preview" || ctx?.mode === "export";
  const plan = useMemo(() => selectRenderable(layers, roots, shipping), [layers, roots, shipping]);
  return (
    <>
      {roots.map((id) => (
        <RenderLayer key={id} layerId={id} layers={layers} ctx={ctx} plan={plan} root />
      ))}
    </>
  );
};

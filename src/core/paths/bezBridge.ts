/**
 * Between our editable paths (`pathData.ts`: subpaths of nodes with absolute bezier handles, Phases 39–40) and the
 * curve paths the FigCraft-port geometry works on (`geometry/bezpath.ts`).
 */
import { BezPath } from "../geometry/bezpath";
import { parsePathData, type SubPath } from "./pathData";
import type { PathNode } from "./pathFit";

/** Subpaths of nodes as a curve path: a segment is a cubic when either end has a handle, else a line. */
export function subPathsToBez(subpaths: readonly SubPath[]): BezPath {
  const out = new BezPath();
  for (const sp of subpaths) {
    const n = sp.nodes;
    if (n.length === 0) continue;
    out.moveTo({ x: n[0].x, y: n[0].y });
    const count = sp.closed ? n.length : n.length - 1;
    for (let i = 0; i < count; i++) {
      const a = n[i];
      const b = n[(i + 1) % n.length];
      if (a.hout || b.hin) out.curveTo(a.hout ?? { x: a.x, y: a.y }, b.hin ?? { x: b.x, y: b.y }, { x: b.x, y: b.y });
      else out.lineTo({ x: b.x, y: b.y });
    }
    if (sp.closed) out.closePath();
  }
  return out;
}

/** SVG path data as a curve path; null when it doesn't parse. */
export function pathDataToBez(d: string): BezPath | null {
  const sp = parsePathData(d);
  return sp ? subPathsToBez(sp) : null;
}

/** A curve path as subpaths of nodes (the reverse of `subPathsToBez`): a cubic's control points become handles. */
export function bezToSubPaths(path: BezPath): SubPath[] {
  const out: SubPath[] = [];
  let nodes: PathNode[] = [];
  const same = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
  const end = (closed: boolean) => {
    if (closed && nodes.length > 1 && same(nodes[0], nodes[nodes.length - 1])) {
      // the last segment came back to the start: its incoming handle belongs to the first node
      const last = nodes.pop()!;
      if (last.hin) nodes[0] = { ...nodes[0], hin: last.hin };
    }
    if (nodes.length > 0) out.push({ nodes, closed });
    nodes = [];
  };
  for (const el of path.els) {
    if (el.t === "M") {
      end(false);
      nodes = [{ x: el.p.x, y: el.p.y }];
    } else if (el.t === "L") {
      nodes.push({ x: el.p.x, y: el.p.y });
    } else if (el.t === "C" || el.t === "Q") {
      const prev = nodes[nodes.length - 1];
      if (!prev) continue;
      const to = el.t === "C" ? el.p3 : el.p2;
      const c1 = el.t === "C" ? el.p1 : { x: prev.x + (2 / 3) * (el.p1.x - prev.x), y: prev.y + (2 / 3) * (el.p1.y - prev.y) };
      const c2 = el.t === "C" ? el.p2 : { x: to.x + (2 / 3) * (el.p1.x - to.x), y: to.y + (2 / 3) * (el.p1.y - to.y) };
      if (!same(c1, prev)) nodes[nodes.length - 1] = { ...prev, hout: { x: c1.x, y: c1.y } };
      nodes.push({ x: to.x, y: to.y, ...(same(c2, to) ? {} : { hin: { x: c2.x, y: c2.y } }) });
    } else {
      end(true);
    }
  }
  end(false);
  return out;
}

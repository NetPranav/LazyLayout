"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/editor/components/Button";
import { Slider } from "@/editor/components/Slider";
import { getAssetStore } from "@/core/assets/AssetStore";
import { importFiles } from "@/core/assets/assetImport";
import { assetSrc, isAssetSrc, ASSET_SCHEME } from "@/core/assets/useAssetUrl";
import { replaceImage } from "@/core/paint/paintOps";
import { setLayerProps, transaction } from "@/core/editing/editOps";
import { documentCommands } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { worldBox } from "@/core/editing/layerBoxes";
import {
  autoSubject as findSubject,
  featherMask,
  fillHoles,
  growMask,
  invertMask,
  maskBounds,
  newMask,
  pictureBox,
  polygonMask,
  removeSpecks,
  subtractMask,
  unionMask,
  visibleWindow,
  wandSelect,
  type Mask,
  type PictureFit,
  type Pixels,
} from "@/core/image/cutout";
import { connectedFrom, depthAt, depthBand, depthLayerMasks, estimateDepth, snapToEdges } from "@/core/image/smart";

const MAX_WORK = 1400; // the longest side the cutout is worked on at
const MAX_SAVE = 2880; // the longest side the piece is saved at: as sharp as the photo it sits on, on a retina screen
const MAX_ZOOM = 8;

type Click = "keep" | "cut";

/** The picture's bytes as something a canvas can draw: an imported file's blob URL, or the source as it is. */
async function loadPicture(src: string): Promise<HTMLImageElement> {
  const url = isAssetSrc(src) ? await getAssetStore().urlFor(src.slice(ASSET_SCHEME.length)) : src;
  if (!url) throw new Error("The picture is missing from the asset store.");
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

function pixelsOf(img: HTMLImageElement): { pixels: Pixels; natural: { w: number; h: number }; img: HTMLImageElement } {
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const k = Math.min(1, MAX_WORK / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * k));
  const h = Math.max(1, Math.round(nh * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(img, 0, 0, w, h);
  return { pixels: { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }, natural: { w: nw, h: nh }, img };
}

const rowClass = "ll:flex ll:items-center ll:gap-2 ll:min-w-0";
const labelClass = "ll:font-sans ll:text-small ll:text-muted ll:w-20 ll:shrink-0";

/** A picture that is a layer's fill, not an image layer: where it comes from and how the fill draws it. */
export interface CutoutFill {
  src: string;
  fit: PictureFit;
}

export const CutoutDialog: React.FC<{ layerId: string; fill?: CutoutFill; onClose: () => void }> = ({ layerId, fill, onClose }) => {
  const layer = getDocument().layers[layerId];
  const src = fill?.src ?? String(layer?.properties["media.src"] ?? "");
  // A frame holds the piece cut from its own fill; anything else has it beside it, in the same parent.
  const insideItself = !!fill && layer?.archetype === "container";

  const [picture, setPicture] = useState<{ pixels: Pixels; natural: { w: number; h: number }; img: HTMLImageElement } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<Mask | null>(null);
  const [history, setHistory] = useState<Mask[]>([]);
  const [click, setClick] = useState<Click>("keep");
  const [how, setHow] = useState<"click" | "draw" | "depth">("click");
  // Smart: a drawn shape settles onto the object's real edge; the picture's depth is estimated for picking by depth and for depth layers
  // Marking first: picks highlight an area on the whole picture; Select keeps it, and only then can it be applied
  const [phase, setPhase] = useState<"mark" | "done">("mark");
  const [snap, setSnap] = useState(true);
  const [reach, setReach] = useState(14);
  const [depth, setDepth] = useState<Float32Array | null>(null);
  const [depthWanted, setDepthWanted] = useState(false);
  const [showDepth, setShowDepth] = useState(false);
  const [depthRange, setDepthRange] = useState(12);
  const [layerCount, setLayerCount] = useState(3);
  const [path, setPath] = useState<Array<{ x: number; y: number }>>([]);
  const justDrew = useRef(false);
  const [tolerance, setTolerance] = useState(22);
  const [contiguous, setContiguous] = useState(true);
  const [edge, setEdge] = useState(0);
  const [soft, setSoft] = useState(0);
  const [crop, setCrop] = useState(true);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pinch or Ctrl + wheel zooms the picture for drawing close to an edge; a plain wheel scrolls it.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [baseWidth, setBaseWidth] = useState(0);
  const zoomAnchor = useRef<{ fx: number; fy: number; px: number; py: number } | null>(null);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const c = canvasRef.current;
      if (!c) return;
      const r = c.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      zoomAnchor.current = { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, px: e.clientX - s.left, py: e.clientY - s.top };
      setBaseWidth((w) => w || r.width);
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z * Math.exp(-e.deltaY * 0.01))));
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, []);
  // what was under the pointer stays under it
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const scroller = scrollerRef.current;
    const c = canvasRef.current;
    if (!a || !scroller || !c) return;
    zoomAnchor.current = null;
    const r = c.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    scroller.scrollLeft += r.left - s.left + a.fx * r.width - a.px;
    scroller.scrollTop += r.top - s.top + a.fy * r.height - a.py;
  }, [zoom]);

  useEffect(() => {
    let live = true;
    loadPicture(src)
      .then((img) => {
        if (!live) return;
        const p = pixelsOf(img);
        setPicture(p);
        setBase(newMask(p.pixels.width, p.pixels.height, 255));
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "The picture could not be read."));
    return () => {
      live = false;
    };
  }, [src]);

  // Depth is estimated the first time something needs it (a moment's work), not when the dialog opens.
  useEffect(() => {
    if (!picture || depth || !(depthWanted || how === "depth" || showDepth)) return undefined;
    const timer = window.setTimeout(() => setDepth(estimateDepth(picture.pixels)), 30);
    return () => window.clearTimeout(timer);
  }, [picture, depth, depthWanted, how, showDepth]);

  // The dialog takes focus when it opens, so Escape (handled on the dialog itself) closes it.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  /** What the cutout keeps now: the picked area, with the edge moved and softened. */
  const kept = useMemo<Mask | null>(() => {
    if (!base || !picture) return null;
    const { width, height } = picture.pixels;
    let m = base;
    if (edge !== 0) m = growMask(m, width, height, edge);
    if (soft > 0) m = featherMask(m, width, height, soft);
    return m;
  }, [base, picture, edge, soft]);

  // Draw: the kept part in full, the cut part faint so you can see what is going.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !picture || !kept) return;
    const { width, height, data } = picture.pixels;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    const out = ctx.createImageData(width, height);
    const tint = showDepth && depth ? depth : null;
    const marking = phase === "mark";
    const anyMarked = marking && !kept.every((v) => v === 255);
    for (let i = 0; i < kept.length; i++) {
      const o = i * 4;
      let r = data[o];
      let g = data[o + 1];
      let b = data[o + 2];
      if (tint) {
        // far is cool and near is warm
        const t = tint[i];
        r = r * 0.45 + 255 * Math.min(1, t * 1.6) * 0.55;
        g = g * 0.45 + 255 * (1 - Math.abs(t - 0.5) * 2) * 0.55;
        b = b * 0.45 + 255 * Math.min(1, (1 - t) * 1.6) * 0.55;
      }
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      if (marking) {
        // the marked area is highlighted on the whole picture; nothing is cut yet
        if (anyMarked) {
          const m = kept[i] / 255;
          out.data[o] = r * (1 - 0.4 * m) * (1 - 0.25 * (1 - m)) + 47 * 0.4 * m;
          out.data[o + 1] = g * (1 - 0.4 * m) * (1 - 0.25 * (1 - m)) + 107 * 0.4 * m;
          out.data[o + 2] = b * (1 - 0.4 * m) * (1 - 0.25 * (1 - m)) + 255 * 0.4 * m;
        }
        out.data[o + 3] = data[o + 3];
      } else out.data[o + 3] = Math.round(data[o + 3] * (0.14 + 0.86 * (kept[i] / 255)));
    }
    ctx.putImageData(out, 0, 0);
  }, [picture, kept, depth, showDepth, phase]);

  const commit = useCallback(
    (next: Mask) => {
      setPhase("mark");
      setHistory((h) => (base ? [...h.slice(-19), base] : h));
      setBase(next);
    },
    [base],
  );

  /** Applies a mask the way the Keep / Cut choice says. The first Keep after a reset starts from nothing. */
  /** A drawn or depth-picked region, settled onto the object's real edge when Snap to edges is on. */
  const refine = (rough: Mask): Mask => (snap && picture ? snapToEdges(picture.pixels, rough, { reach }) : rough);

  const applyPicked = (picked: Mask) => {
    if (!base) return;
    if (click === "keep") commit(base.every((v) => v === 255) ? picked : unionMask(base, picked));
    else commit(subtractMask(base, picked));
  };

  const toPicture = (e: { clientX: number; clientY: number }, el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * (picture?.pixels.width ?? 1), y: ((e.clientY - r.top) / r.height) * (picture?.pixels.height ?? 1) };
  };

  // Draw mode: drag a shape around what to keep or cut (the outline closes itself when you let go).
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (how !== "draw" || !picture || e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const pts = [toPicture(e, el)];
    setPath(pts);
    const move = (ev: PointerEvent) => {
      pts.push(toPicture(ev, el));
      setPath([...pts]);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setPath([]);
      justDrew.current = true;
      if (pts.length >= 3) applyPicked(refine(polygonMask(pts, picture.pixels.width, picture.pixels.height)));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (how === "draw" || justDrew.current) {
      justDrew.current = false;
      return;
    }
    if (!picture || !base) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * picture.pixels.width;
    const y = ((e.clientY - r.top) / r.height) * picture.pixels.height;
    if (how === "depth") {
      if (!depth) return; // still being estimated
      const near = depthAt(depth, picture.pixels.width, picture.pixels.height, x, y);
      applyPicked(refine(connectedFrom(depthBand(depth, near, depthRange / 100), picture.pixels.width, picture.pixels.height, x, y)));
      return;
    }
    const picked = wandSelect(picture.pixels, [{ x, y }], tolerance, contiguous);
    applyPicked(picked);
  };

  const autoSubject = () => {
    if (!picture) return;
    const { width, height } = picture.pixels;
    let { mask: subject } = findSubject(picture.pixels, tolerance);
    // drop dust and close pinholes
    subject = removeSpecks(subject, width, height, Math.round(width * height * 0.0008));
    subject = fillHoles(subject, width, height, Math.round(width * height * 0.0008));
    commit(subject);
  };

  /** The box the picture is shown in on the page, and where that box is in the parent the piece will go in. */
  const shownIn = () => {
    const measured = worldBox(layerId);
    const stored = (path: string) => (typeof layer?.properties[path] === "number" ? (layer.properties[path] as number) : null);
    const width = measured?.w ?? stored("frame.width") ?? picture?.pixels.width ?? 1;
    const height = measured?.h ?? stored("frame.height") ?? picture?.pixels.height ?? 1;
    if (insideItself) return { x: 0, y: 0, width, height };
    const parent = layer?.parentId ? worldBox(layer.parentId) : null;
    const from = (at: "x" | "y") => {
      const own = stored(`frame.${at}`);
      if (own !== null) return own;
      if (!measured || !parent) return 0;
      return at === "x" ? measured.cx - measured.w / 2 - (parent.cx - parent.w / 2) : measured.cy - measured.h / 2 - (parent.cy - parent.h / 2);
    };
    return { x: from("x"), y: from("y"), width, height };
  };

  /** What gets saved for a mask: the part of what shows on the page it keeps, and exactly where it belongs there. */
  const resultFor = (source: Mask | null) => {
    if (!picture || !source) return null;
    const { width: pw, height: ph } = picture.pixels;
    const shown = shownIn();
    const fit: PictureFit = fill?.fit ?? ((String(layer?.properties["media.objectFit"] ?? "cover")) as PictureFit);
    const drawn = pictureBox(fit, shown.width, shown.height, pw, ph);
    const win = visibleWindow(drawn, shown.width, shown.height, pw, ph);
    // what the frame crops away is not on the page, so it is not in the piece
    const mask: Mask = new Uint8Array(source.length) as Mask;
    for (let y = win.y; y < win.y + win.height; y++) mask.set(source.subarray(y * pw + win.x, y * pw + win.x + win.width), y * pw + win.x);
    const box = crop ? maskBounds(mask, pw, ph) : win;
    if (!box) return null;
    const kx = drawn.width / pw;
    const ky = drawn.height / ph;
    const round = (n: number) => Math.round(n * 100) / 100;
    return { mask, box, where: { x: round(shown.x + drawn.x + box.x * kx), y: round(shown.y + drawn.y + box.y * ky), width: Math.max(1, round(box.width * kx)), height: Math.max(1, round(box.height * ky)) } };
  };

  const result = () => resultFor(kept);

  /** The piece as a file, cut from the picture itself at up to MAX_SAVE, not from the smaller copy it was worked on. */
  const toFile = async (r: NonNullable<ReturnType<typeof resultFor>>): Promise<{ file: File; width: number; height: number }> => {
    if (!picture) throw new Error("The picture is not loaded.");
    const { width: pw, height: ph } = picture.pixels;
    const { w: nw, h: nh } = picture.natural;
    const k = Math.max(1, Math.min(nw / pw, MAX_SAVE / Math.max(pw, ph)));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(r.box.width * k));
    c.height = Math.max(1, Math.round(r.box.height * k));
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(picture.img, (r.box.x / pw) * nw, (r.box.y / ph) * nh, (r.box.width / pw) * nw, (r.box.height / ph) * nh, 0, 0, c.width, c.height);
    const m = document.createElement("canvas");
    m.width = r.box.width;
    m.height = r.box.height;
    const alpha = new ImageData(r.box.width, r.box.height);
    for (let y = 0; y < r.box.height; y++) {
      for (let x = 0; x < r.box.width; x++) alpha.data[(y * r.box.width + x) * 4 + 3] = r.mask[(r.box.y + y) * pw + r.box.x + x];
    }
    (m.getContext("2d") as CanvasRenderingContext2D).putImageData(alpha, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(m, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    if (!blob) throw new Error("The cutout could not be saved.");
    const name = (layer?.name || "Image").replace(/\.[^.]+$/, "");
    return { file: new File([blob], `${name} cutout.png`, { type: "image/png" }), width: c.width, height: c.height };
  };

  /** Stacks aligned copies of the picture from far to near, each showing only what is nearer than a depth: something can then go between them. */
  const makeDepthLayers = async () => {
    if (!picture || !layer || !depth) return;
    setBusy(true);
    setError(null);
    try {
      const pieces: Array<{ where: { x: number; y: number; width: number; height: number }; src: string }> = [];
      // the picture itself stays as the farthest layer, so only the nearer ones are made
      for (const m of depthLayerMasks(depth, layerCount).slice(1)) {
        const r = resultFor(m);
        if (!r) continue;
        const saved = await toFile(r);
        const [outcome] = await importFiles([saved.file]);
        if (!outcome?.entry) throw new Error(outcome?.error ?? "A depth layer could not be kept.");
        pieces.push({ where: r.where, src: assetSrc(outcome.entry.id) });
      }
      let last: string | null = null;
      transaction("Depth layers", () => {
        pieces.forEach((piece, i) => {
          last = documentCommands.addLayer(
            {
              archetype: "image",
              parentId: insideItself ? layer.id : layer.parentId,
              name: `${layer.name} depth ${i + 2} of ${pieces.length + 1}`,
              properties: {
                positioning: "absolute",
                "media.src": piece.src,
                "media.alt": String(layer.properties["media.alt"] ?? layer.name),
                "media.objectFit": "fill",
                "frame.x": piece.where.x,
                "frame.y": piece.where.y,
                "frame.width": piece.where.width,
                "frame.height": piece.where.height,
              },
            },
            "Depth layer",
          );
        });
      });
      if (last) useSelectionStore.getState().select(last, "element");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async (asNewLayer: boolean) => {
    const r = result();
    if (!r || !layer) return;
    setBusy(true);
    try {
      const saved = await toFile(r);
      const [outcome] = await importFiles([saved.file]);
      if (!outcome?.entry) throw new Error(outcome?.error ?? "The cutout could not be kept.");
      const where = r.where;
      const srcNew = assetSrc(outcome.entry.id);
      if (asNewLayer) {
        const id = documentCommands.addLayer(
          {
            archetype: "image",
            parentId: insideItself ? layer.id : layer.parentId,
            name: `${layer.name} cutout`,
            properties: {
              positioning: "absolute",
              "media.src": srcNew,
              "media.alt": String(layer.properties["media.alt"] ?? layer.name),
              "media.objectFit": "fill",
              "frame.x": where.x,
              "frame.y": where.y,
              "frame.width": where.width,
              "frame.height": where.height,
            },
          },
          "Cut out subject",
        );
        useSelectionStore.getState().select(id, "element");
      } else {
        replaceImage([layerId], srcNew, { w: saved.width, h: saved.height });
        setLayerProps([layerId], { "frame.x": where.x, "frame.y": where.y, "frame.width": where.width, "frame.height": where.height, "media.objectFit": "fill" }, "Cut out subject");
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const keptPixels = useMemo(() => (kept ? kept.reduce((n, v) => n + (v > 127 ? 1 : 0), 0) : 0), [kept]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cut out subject"
      data-testid="cutout-dialog"
      style={{ position: "fixed", inset: 0, zIndex: 1000, outline: "none", display: "grid", placeItems: "center", background: "rgba(0,0,0,0.5)" }}
      ref={dialogRef}
      tabIndex={-1}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:rounded-lg ll:bg-surface-panel ll:border ll:border-border ll:text-primary"
        style={{ width: "min(1040px, 94vw)", maxHeight: "92vh", overflow: "auto" }}
      >
        <div className="ll:flex ll:items-center ll:justify-between">
          <span className="ll:font-sans ll:text-title">Cut out subject</span>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close cutout">
            Close
          </Button>
        </div>

        <div style={{ display: "flex", gap: 16, minHeight: 0, flexWrap: "wrap" }}>
          <div
            ref={scrollerRef}
            data-testid="cutout-scroller"
            className={`${zoom > 1 ? "ll:block ll:overflow-auto" : "ll:grid ll:place-items-center ll:overflow-hidden"} ll:rounded-sm ll:border ll:border-border`}
            style={{ flex: "1 1 460px", minWidth: 0, minHeight: 280, maxHeight: "62vh", backgroundImage: "conic-gradient(#d4d4d0 25%, #f0f0ec 0 50%, #d4d4d0 0 75%, #f0f0ec 0)", backgroundSize: "16px 16px" }}
          >
            {error ? (
              <span role="alert" className="ll:p-4 ll:font-sans ll:text-small">
                {error}
              </span>
            ) : picture ? (
              <div style={{ position: "relative", display: "inline-block", maxWidth: zoom > 1 ? "none" : "100%", lineHeight: 0 }}>
                <canvas
                  ref={canvasRef}
                  data-testid="cutout-canvas"
                  onPointerDown={startDrawing}
                  onClick={onCanvasClick}
                  aria-label="Picture: click or draw to keep or cut"
                  className="ll:cursor-crosshair"
                  style={zoom > 1 ? { width: baseWidth * zoom, height: "auto", maxWidth: "none", maxHeight: "none", touchAction: "none" } : { maxWidth: "100%", maxHeight: "60vh", width: "auto", height: "auto", touchAction: "none" }}
                />
                {path.length > 1 && (
                  <svg
                    data-testid="cutout-lasso"
                    viewBox={`0 0 ${picture.pixels.width} ${picture.pixels.height}`}
                    preserveAspectRatio="none"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                  >
                    <polygon points={path.map((q) => `${q.x},${q.y}`).join(" ")} fill="rgba(47,107,255,.2)" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
              </div>
            ) : (
              <span className="ll:font-sans ll:text-small ll:text-muted">Loading the picture…</span>
            )}
          </div>

          <div className="ll:flex ll:flex-col ll:gap-3" style={{ flex: "0 0 300px", maxWidth: "100%" }}>
            <p className="ll:font-sans ll:text-small ll:text-muted ll:m-0">
              Click takes the colour under the pointer; Draw takes the shape you drag around something. Keep adds to the marked area, Cut removes from it; the area is highlighted until you press Select. Draw a rough shape and it settles onto the object&apos;s edge. Depth picks everything at about the depth you click. Pinch or Ctrl + wheel zooms in to draw along an edge. Auto finds the subject from the edges of the picture.
            </p>
            <div role="radiogroup" aria-label="What a click does" className="ll:flex ll:gap-1">
              {(["keep", "cut"] as const).map((m) => (
                <Button key={m} size="sm" variant={click === m ? "strong" : "default"} role="radio" aria-checked={click === m} onClick={() => setClick(m)}>
                  {m === "keep" ? "Keep" : "Cut"}
                </Button>
              ))}
              <Button size="sm" variant="secondary" onClick={autoSubject} disabled={!picture}>
                Auto
              </Button>
            </div>
            <div role="radiogroup" aria-label="How to pick" className="ll:flex ll:gap-1">
              {(["click", "draw", "depth"] as const).map((m) => (
                <Button key={m} size="sm" variant={how === m ? "strong" : "default"} role="radio" aria-checked={how === m} onClick={() => setHow(m)}>
                  {m === "click" ? "Click" : m === "draw" ? "Draw" : "Depth"}
                </Button>
              ))}
            </div>
            <label className={`${rowClass} ll:font-sans ll:text-small`} title="A shape you draw (or a depth you pick) settles onto the real edge of the object, within Reach of the line.">
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} aria-label="Snap to edges" />
              Snap to edges
            </label>
            {snap && (
              <div className={rowClass}>
                <span className={labelClass}>Reach</span>
                <div style={{ flex: 1, minWidth: 120 }}><Slider ariaLabel="Reach" min={2} max={60} value={reach} onChange={setReach} /></div>
              </div>
            )}
            {how === "depth" && (
              <div className={rowClass}>
                <span className={labelClass}>Depth range</span>
                <div style={{ flex: 1, minWidth: 120 }}><Slider ariaLabel="Depth range" min={2} max={40} value={depthRange} onChange={setDepthRange} /></div>
              </div>
            )}
            <label className={`${rowClass} ll:font-sans ll:text-small`} title="Colours the picture by how near each part is: cool is far, warm is near. An estimate from haze, height and detail, so it suits landscapes best.">
              <input type="checkbox" checked={showDepth} onChange={(e) => setShowDepth(e.target.checked)} aria-label="Show depth" />
              Show depth {(how === "depth" || showDepth) && !depth ? "(estimating…)" : ""}
            </label>
            <div className={rowClass}>
              <span className={labelClass}>Tolerance</span>
              <div style={{ flex: 1, minWidth: 120 }}><Slider ariaLabel="Tolerance" min={1} max={80} value={tolerance} onChange={setTolerance} /></div>
            </div>
            <label className={`${rowClass} ll:font-sans ll:text-small`}>
              <input type="checkbox" checked={contiguous} onChange={(e) => setContiguous(e.target.checked)} aria-label="Only connected pixels" />
              Only connected pixels
            </label>
            <div className={rowClass}>
              <span className={labelClass}>Edge</span>
              <div style={{ flex: 1, minWidth: 120 }}><Slider ariaLabel="Edge" min={-12} max={12} value={edge} onChange={setEdge} /></div>
            </div>
            <div className={rowClass}>
              <span className={labelClass}>Softness</span>
              <div style={{ flex: 1, minWidth: 120 }}><Slider ariaLabel="Softness" min={0} max={12} value={soft} onChange={setSoft} /></div>
            </div>
            <label className={`${rowClass} ll:font-sans ll:text-small`}>
              <input type="checkbox" checked={crop} onChange={(e) => setCrop(e.target.checked)} aria-label="Crop to the subject" />
              Crop to the subject
            </label>
            <div className={rowClass} title="Adds copies of the picture on top of it, each showing only what is nearer than a depth. Put something between two of them and the nearer one covers it.">
              <span className={labelClass}>Depth layers</span>
              <div style={{ flex: 1, minWidth: 120 }}><Slider ariaLabel="Depth layers" min={2} max={6} value={layerCount} onChange={setLayerCount} /></div>
              <Button
                size="sm"
                onClick={() => (depth ? void makeDepthLayers() : setDepthWanted(true))}
                disabled={busy || !picture}
                aria-label="Make depth layers"
              >
                {depth ? `Make ${layerCount - 1}` : depthWanted ? "Estimating…" : "Make layers"}
              </Button>
            </div>
            <div className="ll:flex ll:gap-1 ll:flex-wrap">
              <Button size="sm" onClick={() => base && commit(invertMask(base))} disabled={!base}>
                Invert
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const h = history[history.length - 1];
                  if (h) {
                    setBase(h);
                    setHistory((x) => x.slice(0, -1));
                  }
                }}
                disabled={history.length === 0}
              >
                Undo
              </Button>
              <Button size="sm" onClick={() => picture && commit(newMask(picture.pixels.width, picture.pixels.height, 255))} disabled={!picture}>
                Reset
              </Button>
            </div>
            <span className="ll:font-mono ll:text-micro ll:text-muted" data-testid="cutout-kept">
              {picture ? `${Math.round((keptPixels / (picture.pixels.width * picture.pixels.height)) * 100)}% kept` : ""}
            </span>
          </div>
        </div>

        <div className="ll:flex ll:justify-end ll:gap-2">
          {phase === "mark" ? (
            <Button size="sm" variant="strong" onClick={() => setPhase("done")} disabled={!picture || keptPixels === 0 || (base?.every((v) => v === 255) ?? true)} title="Happy with the marked area? Select it, then add it as a layer or apply it.">
              Select
            </Button>
          ) : (
            <Button size="sm" onClick={() => setPhase("mark")} title="Go back to adding to or removing from the marked area.">
              Edit selection
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => void apply(true)} disabled={busy || !picture || keptPixels === 0 || phase !== "done"} title={phase !== "done" ? "Press Select first" : undefined}>
            Add as new layer
          </Button>
          {!fill && (
            <Button size="sm" variant="primary" onClick={() => void apply(false)} disabled={busy || !picture || keptPixels === 0 || phase !== "done"} title={phase !== "done" ? "Press Select first" : undefined}>
              Apply to this image
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

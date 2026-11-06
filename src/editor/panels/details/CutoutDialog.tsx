"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/editor/components/Button";
import { Slider } from "@/editor/components/Slider";
import { getAssetStore } from "@/core/assets/AssetStore";
import { importFiles } from "@/core/assets/assetImport";
import { assetSrc, isAssetSrc, ASSET_SCHEME } from "@/core/assets/useAssetUrl";
import { replaceImage } from "@/core/paint/paintOps";
import { setLayerProps } from "@/core/editing/editOps";
import { documentCommands } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import {
  applyMask,
  autoSubject as findSubject,
  featherMask,
  fillHoles,
  growMask,
  invertMask,
  maskBounds,
  newMask,
  polygonMask,
  removeSpecks,
  subtractMask,
  unionMask,
  wandSelect,
  type Mask,
  type Pixels,
} from "@/core/image/cutout";

const MAX_WORK = 1400; // the longest side the cutout is worked and saved at

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

function pixelsOf(img: HTMLImageElement): { pixels: Pixels; natural: { w: number; h: number } } {
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
  return { pixels: { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }, natural: { w: nw, h: nh } };
}

const rowClass = "ll:flex ll:items-center ll:gap-2 ll:min-w-0";
const labelClass = "ll:font-sans ll:text-small ll:text-muted ll:w-20 ll:shrink-0";

export const CutoutDialog: React.FC<{ layerId: string; onClose: () => void }> = ({ layerId, onClose }) => {
  const layer = getDocument().layers[layerId];
  const src = String(layer?.properties["media.src"] ?? "");

  const [picture, setPicture] = useState<{ pixels: Pixels; natural: { w: number; h: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<Mask | null>(null);
  const [history, setHistory] = useState<Mask[]>([]);
  const [click, setClick] = useState<Click>("keep");
  const [how, setHow] = useState<"click" | "draw">("click");
  const [path, setPath] = useState<Array<{ x: number; y: number }>>([]);
  const justDrew = useRef(false);
  const [tolerance, setTolerance] = useState(22);
  const [contiguous, setContiguous] = useState(true);
  const [edge, setEdge] = useState(0);
  const [soft, setSoft] = useState(0);
  const [crop, setCrop] = useState(true);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    for (let i = 0; i < kept.length; i++) {
      const o = i * 4;
      out.data[o] = data[o];
      out.data[o + 1] = data[o + 1];
      out.data[o + 2] = data[o + 2];
      out.data[o + 3] = Math.round(data[o + 3] * (0.14 + 0.86 * (kept[i] / 255)));
    }
    ctx.putImageData(out, 0, 0);
  }, [picture, kept]);

  const commit = useCallback(
    (next: Mask) => {
      setHistory((h) => (base ? [...h.slice(-19), base] : h));
      setBase(next);
    },
    [base],
  );

  /** Applies a mask the way the Keep / Cut choice says. The first Keep after a reset starts from nothing. */
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
      if (pts.length >= 3) applyPicked(polygonMask(pts, picture.pixels.width, picture.pixels.height));
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

  const result = (): { pixels: Pixels; offset: { x: number; y: number }; scale: number } | null => {
    if (!picture || !kept) return null;
    const { width, height } = picture.pixels;
    const box = crop ? maskBounds(kept, width, height) : { x: 0, y: 0, width, height };
    if (!box) return null;
    return { pixels: applyMask(picture.pixels, kept, box), offset: { x: box.x, y: box.y }, scale: picture.natural.w / width };
  };

  const toFile = async (p: Pixels): Promise<File> => {
    const c = document.createElement("canvas");
    c.width = p.width;
    c.height = p.height;
    (c.getContext("2d") as CanvasRenderingContext2D).putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    if (!blob) throw new Error("The cutout could not be saved.");
    const name = (layer?.name || "Image").replace(/\.[^.]+$/, "");
    return new File([blob], `${name} cutout.png`, { type: "image/png" });
  };

  /** Where the cutout sits: the original's frame, moved so the kept part stays exactly where it was, at the same scale on the page. */
  const placement = (r: NonNullable<ReturnType<typeof result>>) => {
    const fw = Number(layer?.properties["frame.width"]) || r.pixels.width;
    const fx = Number(layer?.properties["frame.x"]) || 0;
    const fy = Number(layer?.properties["frame.y"]) || 0;
    const k = fw / (picture?.pixels.width ?? 1); // page pixels per working pixel
    return { x: Math.round((fx + r.offset.x * k) * 100) / 100, y: Math.round((fy + r.offset.y * k) * 100) / 100, width: Math.max(1, Math.round(r.pixels.width * k)), height: Math.max(1, Math.round(r.pixels.height * k)) };
  };

  const apply = async (asNewLayer: boolean) => {
    const r = result();
    if (!r || !layer) return;
    setBusy(true);
    try {
      const [outcome] = await importFiles([await toFile(r.pixels)]);
      if (!outcome?.entry) throw new Error(outcome?.error ?? "The cutout could not be kept.");
      const where = placement(r);
      const srcNew = assetSrc(outcome.entry.id);
      if (asNewLayer) {
        const id = documentCommands.addLayer(
          {
            archetype: "image",
            parentId: layer.parentId,
            name: `${layer.name} cutout`,
            properties: {
              positioning: "absolute",
              "media.src": srcNew,
              "media.alt": String(layer.properties["media.alt"] ?? layer.name),
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
        replaceImage([layerId], srcNew, { w: r.pixels.width, h: r.pixels.height });
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
            className="ll:grid ll:place-items-center ll:overflow-hidden ll:rounded-sm ll:border ll:border-border"
            style={{ flex: "1 1 460px", minWidth: 0, minHeight: 280, backgroundImage: "conic-gradient(#d4d4d0 25%, #f0f0ec 0 50%, #d4d4d0 0 75%, #f0f0ec 0)", backgroundSize: "16px 16px" }}
          >
            {error ? (
              <span role="alert" className="ll:p-4 ll:font-sans ll:text-small">
                {error}
              </span>
            ) : picture ? (
              <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", lineHeight: 0 }}>
                <canvas
                  ref={canvasRef}
                  data-testid="cutout-canvas"
                  onPointerDown={startDrawing}
                  onClick={onCanvasClick}
                  aria-label="Picture: click or draw to keep or cut"
                  className="ll:cursor-crosshair"
                  style={{ maxWidth: "100%", maxHeight: "60vh", width: "auto", height: "auto", touchAction: "none" }}
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
              Click takes the colour under the pointer; Draw takes the shape you drag around something. Keep adds to what stays, Cut removes from it. Auto finds the subject from the edges of the picture.
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
              {(["click", "draw"] as const).map((m) => (
                <Button key={m} size="sm" variant={how === m ? "strong" : "default"} role="radio" aria-checked={how === m} onClick={() => setHow(m)}>
                  {m === "click" ? "Click" : "Draw"}
                </Button>
              ))}
            </div>
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
          <Button size="sm" variant="secondary" onClick={() => void apply(true)} disabled={busy || !picture || keptPixels === 0}>
            Add as new layer
          </Button>
          <Button size="sm" variant="primary" onClick={() => void apply(false)} disabled={busy || !picture || keptPixels === 0}>
            Apply to this image
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

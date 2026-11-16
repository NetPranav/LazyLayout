"use client";

/**
 * Icons & photos (Phase 126): search an open-licence icon set and insert an icon as editable vectors, or search
 * openly licensed stock photos and insert one as an image. Each goes into the asset store with its source and licence
 * (the photo's credit line too), shown here before it is inserted. Opens from the Image tool and "Icons & Photos…".
 */

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaLibraryStore } from "@/core/store/useMediaLibraryStore";
import { insertIcon, insertPhoto } from "@/core/assets/mediaOps";
import { ICON_SETS, OPENVERSE, openverseSearchUrl, parseOpenverse, searchIcons, titleOf, type IconNode, type StockPhoto } from "@/core/assets/mediaLibrary";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { TextField } from "@/editor/components/TextField";
import { Button } from "@/editor/components/Button";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { X } from "lucide-react";

type Loader = Record<string, () => Promise<{ __iconNode?: IconNode }>>;
let loader: Promise<Loader> | null = null;
/** Lucide's icons, loaded one by one when shown (the list of names first, when the library opens). */
const icons = () => (loader ??= import("lucide-react/dynamicIconImports").then((m) => (m.default ?? m) as unknown as Loader));

const TABS = [
  { value: "icons", label: "Icons" },
  { value: "photos", label: "Photos" },
] as const;

function IconTile({ name, load, onInsert }: { name: string; load: Loader; onInsert: (node: IconNode) => void }) {
  const [node, setNode] = useState<IconNode | null>(null);
  useEffect(() => {
    let live = true;
    void load[name]?.().then((m) => live && setNode(m.__iconNode ?? null));
    return () => {
      live = false;
    };
  }, [name, load]);
  return (
    <button
      type="button"
      aria-label={`Insert icon ${titleOf(name)}`}
      title={titleOf(name)}
      disabled={!node}
      onClick={() => node && onInsert(node)}
      className="ll:w-10 ll:h-10 ll:grid ll:place-items-center ll:rounded-sm ll:bg-transparent ll:border ll:border-transparent ll:hover:border-border ll:hover:bg-surface-hover ll:text-primary ll:cursor-pointer"
    >
      {node && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {node.map(([tag, attrs], i) => React.createElement(tag, { ...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== "key")), key: i }))}
        </svg>
      )}
    </button>
  );
}

function IconsTab({ onInserted }: { onInserted: (what: string) => void }) {
  const [load, setLoad] = useState<Loader | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void icons().then(setLoad);
  }, []);
  const names = useMemo(() => (load ? Object.keys(load) : []), [load]);
  const found = useMemo(() => searchIcons(names, query, 96), [names, query]);
  const set = ICON_SETS[0];
  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:min-h-0">
      <TextField size="sm" aria-label="Search icons" placeholder={`Search ${names.length || ""} icons`} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div role="list" aria-label="Icons" className="ll:grid ll:grid-cols-7 ll:gap-1 ll:overflow-auto ll:max-h-80">
        {load &&
          found.map((n) => (
            <div role="listitem" key={n}>
              <IconTile name={n} load={load} onInsert={(node) => void insertIcon(n, node).then((ids) => ids.length && onInserted(titleOf(n)))} />
            </div>
          ))}
      </div>
      <p className="ll:text-micro ll:text-muted">
        {set.name} icons, {set.licence} licence ({set.licenceUrl}). Each one inserted is kept with its source and licence.
      </p>
    </div>
  );
}

function PhotosTab({ onInserted }: { onInserted: (what: string) => void }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ busy: boolean; photos: StockPhoto[]; error: string | null }>({ busy: false, photos: [], error: null });
  const search = async () => {
    if (!query.trim()) return;
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const r = await fetch(openverseSearchUrl(query));
      const photos = r.ok ? parseOpenverse(await r.json()) : [];
      setState({ busy: false, photos, error: r.ok ? (photos.length ? null : "No openly licensed photos found.") : `${OPENVERSE.name} answered ${r.status}.` });
    } catch {
      setState({ busy: false, photos: [], error: `${OPENVERSE.name} couldn't be reached.` });
    }
  };
  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:min-h-0">
      <form
        className="ll:flex ll:gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <TextField size="sm" aria-label="Search photos" placeholder="Search openly licensed photos" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button size="sm" variant="secondary" type="submit" disabled={state.busy}>
          Search
        </Button>
      </form>
      {state.error && <p className="ll:text-micro ll:text-muted">{state.error}</p>}
      <div role="list" aria-label="Photos" className="ll:grid ll:grid-cols-3 ll:gap-2 ll:overflow-auto ll:max-h-80">
        {state.photos.map((p) => (
          <div role="listitem" key={p.id} className="ll:flex ll:flex-col ll:gap-1">
            <button type="button" aria-label={`Insert photo ${p.title}`} onClick={() => void insertPhoto(p).then((id) => id && onInserted(p.title))} className="ll:p-0 ll:border ll:border-border ll:rounded-sm ll:overflow-hidden ll:bg-surface-bar ll:cursor-pointer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail} alt={p.title} className="ll:block ll:w-full ll:h-20 ll:object-cover" loading="lazy" />
            </button>
            <span className="ll:text-nano ll:text-muted ll:truncate" title={p.source.attribution}>
              {p.source.author ? `${p.source.author} · ` : ""}
              {p.source.licence}
            </span>
          </div>
        ))}
      </div>
      <p className="ll:text-micro ll:text-muted">Photos from {OPENVERSE.name} ({OPENVERSE.url}): each keeps its licence and credit line in the asset store. Your search is sent to {OPENVERSE.name}.</p>
    </div>
  );
}

export const MediaLibraryDialog: React.FC = () => {
  const { isOpen, tab, open, close } = useMediaLibraryStore();
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);
  if (!isOpen || typeof document === "undefined") return null;
  const done = (what: string) => setNotice(`Inserted ${what}`);
  return createPortal(
    <div
      role="dialog"
      aria-label="Icons and photos"
      data-stage-chrome=""
      onPointerDown={(e) => e.stopPropagation()}
      className="ll:fixed ll:z-80 ll:top-16 ll:left-1/2 ll:-translate-x-1/2 ll:w-panel ll:flex ll:flex-col ll:gap-3 ll:p-3 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:font-sans ll:text-small ll:text-primary"
    >
      <div className="ll:flex ll:items-center ll:gap-2">
        <SegmentedControl size="compact" ariaLabel="Library" options={TABS} value={tab} onChange={(t) => open(t)} className="ll:flex-1" />
        <IconButton size="sm" variant="ghost" aria-label="Close icons and photos" tooltip="Close" icon={<Icon icon={X} size={14} />} onClick={close} />
      </div>
      {tab === "icons" ? <IconsTab onInserted={done} /> : <PhotosTab onInserted={done} />}
      {notice && (
        <p role="status" className="ll:text-micro ll:text-secondary">
          {notice}
        </p>
      )}
    </div>,
    document.body,
  );
};

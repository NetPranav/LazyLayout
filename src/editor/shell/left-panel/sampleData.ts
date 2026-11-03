import type { LayerItem, FileItem, TrackItem, AssetItem } from "./types";

export const DEFAULT_EXPANDED_IDS: string[] = [
  "hero",
  "others",
  "f-src",
  "f-components",
  "f-pages",
  "f-styles",
];

export const DEFAULT_SELECTED_IDS: string[] = ["hero"];
export const DEFAULT_SELECTED_TRACK_ID: string = "headline";

export const SAMPLE_LAYERS: LayerItem[] = [
  {
    id: "hero",
    name: "Hero",
    type: "frame",
    level: 0,
    hasChildren: true,
    expanded: true,
    children: [
      { id: "headline", name: "Headline", type: "text", level: 1, parentId: "hero" },
      { id: "subtitle", name: "Subtitle", type: "text", level: 1, parentId: "hero" },
      { id: "button", name: "Get started", type: "button", level: 1, parentId: "hero" },
      { id: "image", name: "Hero image", type: "image", level: 1, parentId: "hero" },
    ],
  },
  {
    id: "features",
    name: "Features",
    type: "frame",
    level: 0,
    hasChildren: false,
    expanded: false,
  },
  {
    id: "footer",
    name: "Footer",
    type: "frame",
    level: 0,
    hasChildren: false,
    expanded: false,
  },
  {
    id: "others",
    name: "Other elements",
    type: "frame",
    level: 0,
    hasChildren: true,
    expanded: true,
    children: [
      { id: "input", name: "Email input", type: "input", level: 1, parentId: "others" },
      { id: "toggle", name: "Newsletter toggle", type: "toggle", level: 1, parentId: "others" },
      { id: "divider", name: "Section divider", type: "divider", level: 1, parentId: "others" },
      { id: "background", name: "Page background", type: "image", level: 1, parentId: "others" },
      { id: "icon", name: "Menu icon", type: "star", level: 1, parentId: "others" },
      { id: "shape", name: "Star shape", type: "poly", level: 1, parentId: "others" },
      { id: "counter", name: "Visitors counter", type: "text", level: 1, parentId: "others" },
      { id: "object3d", name: "3D model", type: "box", level: 1, parentId: "others" },
    ],
  },
];

export const SAMPLE_FILES: FileItem[] = [
  {
    id: "f-src",
    name: "src",
    isFolder: true,
    level: 0,
    hasChildren: true,
    expanded: true,
    children: [
      {
        id: "f-components",
        name: "components",
        isFolder: true,
        level: 1,
        hasChildren: true,
        expanded: true,
        parentId: "f-src",
        children: [
          { id: "f-hero", name: "Hero.tsx", isFolder: false, level: 2, parentId: "f-components" },
          { id: "f-features", name: "Features.tsx", isFolder: false, level: 2, parentId: "f-components" },
          { id: "f-footer", name: "Footer.tsx", isFolder: false, level: 2, parentId: "f-components" },
        ],
      },
      {
        id: "f-pages",
        name: "pages",
        isFolder: true,
        level: 1,
        hasChildren: true,
        expanded: true,
        parentId: "f-src",
        children: [
          { id: "f-home", name: "Home.tsx", isFolder: false, level: 2, parentId: "f-pages" },
        ],
      },
      {
        id: "f-styles",
        name: "styles",
        isFolder: true,
        level: 1,
        hasChildren: true,
        expanded: true,
        parentId: "f-src",
        children: [
          { id: "f-globals", name: "globals.css", isFolder: false, level: 2, parentId: "f-styles" },
        ],
      },
    ],
  },
  {
    id: "f-pkg",
    name: "package.json",
    isFolder: false,
    level: 0,
    hasChildren: false,
    expanded: false,
  },
];

export const SAMPLE_TRACKS: TrackItem[] = [
  { id: "headline", name: "Headline" },
  { id: "button", name: "Get started" },
  { id: "image", name: "Hero image" },
];

export const SAMPLE_ASSETS: AssetItem[] = [
  { id: "a-logo", name: "logo.svg", kind: "svg" },
  { id: "a-hero", name: "hero.jpg", kind: "image" },
  { id: "a-font", name: "Geist.woff2", kind: "font" },
  { id: "a-icons", name: "icons.svg", kind: "svg" },
];

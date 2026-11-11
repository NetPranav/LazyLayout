"use client";

import React, { useState, useRef } from "react";
import {
  Menu,
  MenuItem,
  MenuSeparator,
  MenuHeading,
  SubMenu,
} from "../../components/Menu";
import { OptionsPopover } from "../../components/OptionsPopover";
import { ColorPicker } from "../../components/ColorPicker";
import { Select } from "../../components/Select";
import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import { Icon } from "../../components/Icon";
import {
  File,
  Copy,
  Eye,
  Sliders,
  MoreHorizontal,
  Folder,
  Layers,
  Sparkles,
  Palette,
  Check,
  Undo2,
  Redo2,
  Download,
  Share2,
} from "lucide-react";

export function F6Demos() {
  // Demo 1: Menu Bar Retargeting
  const [activeMenu, setActiveMenu] = useState<"file" | "edit" | "view" | null>(null);
  const fileBtnRef = useRef<HTMLButtonElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const viewBtnRef = useRef<HTMLButtonElement>(null);

  // Demo 2: OptionsPopover Retargeting
  const [activeOptionsSection, setActiveOptionsSection] = useState<"fill" | "stroke" | "effects" | null>(null);
  const fillBtnRef = useRef<HTMLButtonElement>(null);
  const strokeBtnRef = useRef<HTMLButtonElement>(null);
  const effectsBtnRef = useRef<HTMLButtonElement>(null);

  // Demo 3: ColorPicker Retargeting
  const [activeColorIndex, setActiveColorIndex] = useState<number | null>(null);
  const [colors, setColors] = useState<string[]>([
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
  ]);
  const swatchRefs = [
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
  ];

  // Demo 4: Select Dropdowns
  const [selectedBlend, setSelectedBlend] = useState("Normal");
  const [selectedAlign, setSelectedAlign] = useState("Start");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8 ll:p-6 ll:max-w-4xl ll:text-primary">
      <div>
        <h2 className="ll:text-lead ll:font-semibold ll:text-primary ll:mb-1">
          F6 Menu & Popover Retargeting Demos
        </h2>
        <p className="ll:text-body ll:text-secondary">
          When an overlay or menu of the same family is already open and another trigger is activated,
          the existing container does not tear down and restart. It inherits continuous velocity and glides
          smoothly to the new anchor position with a 160ms blur-crossfade.
        </p>
      </div>

      {/* 1. Application Menu Bar Retargeting */}
      <section className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
        <div className="ll:flex ll:items-center ll:justify-between">
          <h3 className="ll:text-body ll:font-medium ll:text-primary">
            1. Menu-Bar Family Retargeting (File &rarr; Edit &rarr; View)
          </h3>
          <span className="ll:font-mono ll:text-nano ll:text-muted ll:px-2 ll:py-0.5 ll:bg-surface-raised ll:border ll:border-border ll:rounded-xs">
            family: &quot;menu&quot;
          </span>
        </div>
        <p className="ll:text-small ll:text-muted">
          Click any menu trigger to open, then click or hover another adjacent menu. Notice how the
          menu container surface morphs its position and dimensions without flicker, and child rows stagger smoothly.
        </p>

        <div className="ll:flex ll:items-center ll:gap-1 ll:p-1.5 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:w-fit">
          <button
            ref={fileBtnRef}
            type="button"
            className={`ll:px-2.5 ll:py-1 ll:text-xs ll:font-medium ll:rounded-xs ll:transition-colors ${
              activeMenu === "file"
                ? "ll:bg-surface-hover ll:text-primary"
                : "ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover/50"
            }`}
            onClick={() => setActiveMenu((prev) => (prev === "file" ? null : "file"))}
            onMouseEnter={() => {
              if (activeMenu) setActiveMenu("file");
            }}
          >
            File
          </button>
          <button
            ref={editBtnRef}
            type="button"
            className={`ll:px-2.5 ll:py-1 ll:text-xs ll:font-medium ll:rounded-xs ll:transition-colors ${
              activeMenu === "edit"
                ? "ll:bg-surface-hover ll:text-primary"
                : "ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover/50"
            }`}
            onClick={() => setActiveMenu((prev) => (prev === "edit" ? null : "edit"))}
            onMouseEnter={() => {
              if (activeMenu) setActiveMenu("edit");
            }}
          >
            Edit
          </button>
          <button
            ref={viewBtnRef}
            type="button"
            className={`ll:px-2.5 ll:py-1 ll:text-xs ll:font-medium ll:rounded-xs ll:transition-colors ${
              activeMenu === "view"
                ? "ll:bg-surface-hover ll:text-primary"
                : "ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover/50"
            }`}
            onClick={() => setActiveMenu((prev) => (prev === "view" ? null : "view"))}
            onMouseEnter={() => {
              if (activeMenu) setActiveMenu("view");
            }}
          >
            View
          </button>
        </div>

        {/* Dynamic single-menu with retargeting */}
        <Menu
          open={activeMenu !== null}
          onClose={() => setActiveMenu(null)}
          anchorRef={
            activeMenu === "file"
              ? fileBtnRef
              : activeMenu === "edit"
              ? editBtnRef
              : viewBtnRef
          }
        >
          {activeMenu === "file" && (
            <>
              <MenuHeading>File Actions</MenuHeading>
              <MenuItem icon={<Icon icon={File} size={14} />} shortcut="Ctrl+N">
                New Design
              </MenuItem>
              <MenuItem icon={<Icon icon={Folder} size={14} />} shortcut="Ctrl+O">
                Open File…
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Icon icon={Download} size={14} />} shortcut="Ctrl+S">
                Export Frame…
              </MenuItem>
              <MenuItem icon={<Icon icon={Share2} size={14} />}>
                Share Link
              </MenuItem>
            </>
          )}

          {activeMenu === "edit" && (
            <>
              <MenuHeading>Edit Operations</MenuHeading>
              <MenuItem icon={<Icon icon={Undo2} size={14} />} shortcut="Ctrl+Z">
                Undo Action
              </MenuItem>
              <MenuItem icon={<Icon icon={Redo2} size={14} />} shortcut="Ctrl+Y">
                Redo Action
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Icon icon={Copy} size={14} />} shortcut="Ctrl+C">
                Copy CSS
              </MenuItem>
              <MenuItem icon={<Icon icon={Layers} size={14} />} shortcut="Ctrl+D">
                Duplicate Layer
              </MenuItem>
            </>
          )}

          {activeMenu === "view" && (
            <>
              <MenuHeading>View Layouts</MenuHeading>
              <MenuItem icon={<Icon icon={Eye} size={14} />} shortcut="Shift+R">
                Show Rulers
              </MenuItem>
              <MenuItem icon={<Icon icon={Sliders} size={14} />} shortcut="Ctrl+G">
                Pixel Grid
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Icon icon={Sparkles} size={14} />}>
                Zen Focus Mode
              </MenuItem>
            </>
          )}
        </Menu>
      </section>

      {/* 2. Inspector Options Retargeting */}
      <section className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
        <div className="ll:flex ll:items-center ll:justify-between">
          <h3 className="ll:text-body ll:font-medium ll:text-primary">
            2. Inspector Section Options Retargeting
          </h3>
          <span className="ll:font-mono ll:text-nano ll:text-muted ll:px-2 ll:py-0.5 ll:bg-surface-raised ll:border ll:border-border ll:rounded-xs">
            family: &quot;inspector-options&quot;
          </span>
        </div>
        <p className="ll:text-small ll:text-muted">
          Click the more button on Fill, then immediately click Stroke or Effects.
          The options popover smoothly shifts vertical coordinates without collapse or spring restart.
        </p>

        <div className="ll:flex ll:flex-col ll:gap-2 ll:max-w-sm">
          {/* Fill Row */}
          <div className="ll:flex ll:items-center ll:justify-between ll:p-2 ll:bg-surface-raised ll:border ll:border-border ll:rounded-sm">
            <span className="ll:text-xs ll:font-medium ll:text-primary">Fill Section</span>
            <div className="ll:flex ll:items-center ll:gap-1">
              <button
                ref={fillBtnRef}
                type="button"
                onClick={() =>
                  setActiveOptionsSection((prev) => (prev === "fill" ? null : "fill"))
                }
                className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
                title="Fill options"
              >
                <Icon icon={MoreHorizontal} size={14} />
              </button>
            </div>
          </div>

          {/* Stroke Row */}
          <div className="ll:flex ll:items-center ll:justify-between ll:p-2 ll:bg-surface-raised ll:border ll:border-border ll:rounded-sm">
            <span className="ll:text-xs ll:font-medium ll:text-primary">Stroke Section</span>
            <div className="ll:flex ll:items-center ll:gap-1">
              <button
                ref={strokeBtnRef}
                type="button"
                onClick={() =>
                  setActiveOptionsSection((prev) => (prev === "stroke" ? null : "stroke"))
                }
                className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
                title="Stroke options"
              >
                <Icon icon={MoreHorizontal} size={14} />
              </button>
            </div>
          </div>

          {/* Effects Row */}
          <div className="ll:flex ll:items-center ll:justify-between ll:p-2 ll:bg-surface-raised ll:border ll:border-border ll:rounded-sm">
            <span className="ll:text-xs ll:font-medium ll:text-primary">Effects Section</span>
            <div className="ll:flex ll:items-center ll:gap-1">
              <button
                ref={effectsBtnRef}
                type="button"
                onClick={() =>
                  setActiveOptionsSection((prev) => (prev === "effects" ? null : "effects"))
                }
                className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
                title="Effects options"
              >
                <Icon icon={MoreHorizontal} size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic single OptionsPopover with retargeting */}
        <OptionsPopover
          open={activeOptionsSection !== null}
          onClose={() => setActiveOptionsSection(null)}
          anchorRef={
            activeOptionsSection === "fill"
              ? fillBtnRef
              : activeOptionsSection === "stroke"
              ? strokeBtnRef
              : effectsBtnRef
          }
          title={
            activeOptionsSection === "fill"
              ? "Fill Options"
              : activeOptionsSection === "stroke"
              ? "Stroke Options"
              : "Effects Options"
          }
        >
          {activeOptionsSection === "fill" && (
            <div className="ll:flex ll:flex-col ll:gap-2">
              <div className="ll:text-xs ll:text-secondary">Fill blend mode and rasterization settings.</div>
              <div className="ll:flex ll:items-center ll:justify-between ll:text-xs">
                <span>Color clip path</span>
                <span className="ll:text-muted">Enabled</span>
              </div>
            </div>
          )}
          {activeOptionsSection === "stroke" && (
            <div className="ll:flex ll:flex-col ll:gap-2">
              <div className="ll:text-xs ll:text-secondary">Stroke cap, joint, and miter limit parameters.</div>
              <div className="ll:flex ll:items-center ll:justify-between ll:text-xs">
                <span>Cap style</span>
                <span className="ll:text-muted">Round</span>
              </div>
            </div>
          )}
          {activeOptionsSection === "effects" && (
            <div className="ll:flex ll:flex-col ll:gap-2">
              <div className="ll:text-xs ll:text-secondary">Gaussian blur spread and shadow rendering.</div>
              <div className="ll:flex ll:items-center ll:justify-between ll:text-xs">
                <span>Pass-through</span>
                <span className="ll:text-muted">Hardware</span>
              </div>
            </div>
          )}
        </OptionsPopover>
      </section>

      {/* 3. ColorPicker Swatch Gliding */}
      <section className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
        <div className="ll:flex ll:items-center ll:justify-between">
          <h3 className="ll:text-body ll:font-medium ll:text-primary">
            3. ColorPicker Swatch-to-Swatch Gliding
          </h3>
          <span className="ll:font-mono ll:text-nano ll:text-muted ll:px-2 ll:py-0.5 ll:bg-surface-raised ll:border ll:border-border ll:rounded-xs">
            family: &quot;color-picker&quot;
          </span>
        </div>
        <p className="ll:text-small ll:text-muted">
          Click swatch 1 to open the color picker. Then click swatch 2, 3, or 4.
          Instead of closing and reopening from seed, the open ColorPicker glides across the row.
        </p>

        <div className="ll:flex ll:items-center ll:gap-3 ll:p-3 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:w-fit">
          {colors.map((color, idx) => (
            <button
              key={idx}
              ref={swatchRefs[idx]}
              type="button"
              onClick={() => setActiveColorIndex((prev) => (prev === idx ? null : idx))}
              className={`ll:w-8 ll:h-8 ll:rounded-xs ll:border ll:transition-all ${
                activeColorIndex === idx
                  ? "ll:border-primary ll:ring-2 ll:ring-primary/20 ll:scale-105"
                  : "ll:border-border ll:hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
              title={`Swatch ${idx + 1}: ${color}`}
            />
          ))}
        </div>

        {/* Dynamic single ColorPicker instance with retargeting */}
        {activeColorIndex !== null && (
          <ColorPicker
            color={colors[activeColorIndex]}
            onChange={(c) => {
              setColors((prev) => {
                const next = [...prev];
                next[activeColorIndex] = c;
                return next;
              });
            }}
            onClose={() => setActiveColorIndex(null)}
            anchorRef={swatchRefs[activeColorIndex]}
          />
        )}
      </section>

      {/* 4. Adjacent Select Dropdowns */}
      <section className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
        <div className="ll:flex ll:items-center ll:justify-between">
          <h3 className="ll:text-body ll:font-medium ll:text-primary">
            4. Select Dropdowns Inter-Handoff
          </h3>
          <span className="ll:font-mono ll:text-nano ll:text-muted ll:px-2 ll:py-0.5 ll:bg-surface-raised ll:border ll:border-border ll:rounded-xs">
            family: &quot;select&quot;
          </span>
        </div>
        <p className="ll:text-small ll:text-muted">
          Open the Blend Mode dropdown, then click the Alignment dropdown.
          The dropdown floating surface morphs from the first trigger to the second trigger.
        </p>

        <div className="ll:flex ll:items-center ll:gap-4 ll:max-w-md">
          <div className="ll:flex-1 ll:flex ll:flex-col ll:gap-1.5">
            <span className="ll:text-xs ll:text-secondary">Blend Mode</span>
            <Select
              value={selectedBlend}
              onChange={setSelectedBlend}
              options={[
                { value: "Normal", label: "Normal" },
                { value: "Multiply", label: "Multiply" },
                { value: "Screen", label: "Screen" },
                { value: "Overlay", label: "Overlay" },
              ]}
            />
          </div>

          <div className="ll:flex-1 ll:flex ll:flex-col ll:gap-1.5">
            <span className="ll:text-xs ll:text-secondary">Alignment</span>
            <Select
              value={selectedAlign}
              onChange={setSelectedAlign}
              options={[
                { value: "Start", label: "Start" },
                { value: "Center", label: "Center" },
                { value: "End", label: "End" },
                { value: "Stretch", label: "Stretch" },
              ]}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

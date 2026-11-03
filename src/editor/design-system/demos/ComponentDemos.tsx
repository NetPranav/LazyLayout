"use client";

import React, { useState, useRef } from "react";
import {
  Frame,
  Layers,
  Sparkles,
  Type,
  Square,
  FileCode,
  Folder,
  Sliders,
  Eye,
  Plus,
  Play,
  Settings,
  HelpCircle,
  FileText,
  Scissors,
  Grid,
} from "lucide-react";
import {
  Button,
  IconButton,
  SegmentedControl,
  Toggle,
  Checkbox,
  Tooltip,
  TextField,
  NumberField,
  Select,
  ColorSwatchField,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuLabel,
  SubMenu,
  ContextMenu,
  Popover,
  CommandPalette,
  PanelSection,
  PropertyRow,
  ListRow,
  TreeRow,
  Tabs,
  Avatar,
  AvatarStack,
  ShipButton,
  EmptyState,
  TopBar,
  LogoMark,
  ModeTabs,
  ShipPopover,
  PageSwitcher,
  type EditorMode,
  type CollabUser,
} from "../../components";
import { Icon } from "../../components/Icon";
import { flipCard } from "../../motion/flip";

/* =========================================================================
   1. BUTTON DEMO
   ========================================================================= */
export function ButtonDemo() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Button</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Primary, Secondary, Ghost, Sizes, States &amp; Nook Press Spring
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Variants &amp; Sizes
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-6">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Primary (Strongest Neutral Control)</span>
            <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
              <Button variant="primary" size="md">Primary Medium (32px)</Button>
              <Button variant="primary" size="sm">Primary Small (28px)</Button>
              <Button variant="primary" size="md" leftIcon={<Icon icon={Sparkles} size={14} />}>With Icon</Button>
            </div>
          </div>

          <div className="ll:h-px ll:w-full ll:bg-border" />

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Secondary (Raised Surface, Hairline Border)</span>
            <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
              <Button variant="secondary" size="md">Secondary Medium</Button>
              <Button variant="secondary" size="sm">Secondary Small</Button>
              <Button variant="secondary" size="md" leftIcon={<Icon icon={Frame} size={14} />}>Frame</Button>
            </div>
          </div>

          <div className="ll:h-px ll:w-full ll:bg-border" />

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Ghost (Border-free)</span>
            <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
              <Button variant="ghost" size="md">Ghost Medium</Button>
              <Button variant="ghost" size="sm">Ghost Small</Button>
            </div>
          </div>
        </div>

        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          All Interactive States
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-wrap ll:items-center ll:gap-3">
          <Button variant="secondary">Default</Button>
          <Button variant="secondary" disabled>Disabled</Button>
          <Button variant="secondary" loading={loading} onClick={() => setLoading(!loading)}>
            {loading ? "Loading..." : "Click to Toggle Loading"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. ICON BUTTON DEMO
   ========================================================================= */
export function IconButtonDemo() {
  const [pressed, setPressed] = useState(false);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">IconButton</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Square Icons, Stroke Weight 1.5, Modest Radius, Tooltips &amp; Pressed Physics
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Sizes &amp; Variants
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-6">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Medium (28x28px, Toolbar standard)</span>
            <div className="ll:flex ll:items-center ll:gap-2">
              <IconButton size="md" aria-label="Select frame" tooltip="Frame (F)" icon={<Icon icon={Frame} size={16} />} />
              <IconButton size="md" aria-label="Add shape" tooltip="Shape (R)" icon={<Icon icon={Square} size={16} />} />
              <IconButton size="md" aria-label="Text tool" tooltip="Text (T)" icon={<Icon icon={Type} size={16} />} />
              <IconButton size="md" aria-label="Settings" tooltip="Settings" icon={<Icon icon={Settings} size={16} />} />
            </div>
          </div>

          <div className="ll:h-px ll:w-full ll:bg-border" />

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Small (24x24px, Property row standard)</span>
            <div className="ll:flex ll:items-center ll:gap-2">
              <IconButton size="sm" aria-label="Add layer" tooltip="Add layer" icon={<Icon icon={Plus} size={14} />} />
              <IconButton size="sm" aria-label="Visibility" tooltip="Toggle visibility" icon={<Icon icon={Eye} size={14} />} />
              <IconButton size="sm" aria-label="Play animation" tooltip="Play" icon={<Icon icon={Play} size={14} />} />
            </div>
          </div>

          <div className="ll:h-px ll:w-full ll:bg-border" />

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Pressed / Toggled State</span>
            <div className="ll:flex ll:items-center ll:gap-3">
              <IconButton
                size="md"
                aria-label="Active selection mode"
                tooltip={pressed ? "Toggled On" : "Toggled Off"}
                pressed={pressed}
                icon={<Icon icon={Sliders} size={16} />}
                onClick={() => setPressed(!pressed)}
              />
              <span className="ll:text-small ll:text-secondary">Click to toggle aria-pressed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   3. SEGMENTED CONTROL DEMO
   ========================================================================= */
export function SegmentedControlDemo() {
  const [mode, setMode] = useState<"design" | "motion" | "code">("design");
  const [layout, setLayout] = useState<"free" | "stack" | "grid">("stack");
  const [feel, setFeel] = useState<"smooth" | "lively" | "bouncy">("smooth");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">SegmentedControl</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Boxed Track, Nook Glide Spring Sliding Marker, Concentric Radii, Keyboard Arrows
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Mode Switch (Design / Motion / Code)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-4">
          <SegmentedControl
            size="md"
            value={mode}
            onChange={setMode}
            options={[
              { value: "design", label: "Design", icon: <Icon icon={Square} size={14} /> },
              { value: "motion", label: "Motion", icon: <Icon icon={Sliders} size={14} /> },
              { value: "code", label: "Code", icon: <Icon icon={FileCode} size={14} /> },
            ]}
          />
          <span className="ll:text-small ll:text-secondary">Active mode: {mode}</span>
        </div>

        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Compact Size (Free / Stack / Grid)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-4">
          <SegmentedControl
            size="sm"
            value={layout}
            onChange={setLayout}
            options={[
              { value: "free", label: "Free" },
              { value: "stack", label: "Stack" },
              { value: "grid", label: "Grid" },
            ]}
          />
        </div>

        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Motion Feels (Smooth / Lively / Bouncy)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-4">
          <SegmentedControl
            size="sm"
            value={feel}
            onChange={setFeel}
            options={[
              { value: "smooth", label: "Smooth" },
              { value: "lively", label: "Lively" },
              { value: "bouncy", label: "Bouncy" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. TOGGLE DEMO
   ========================================================================= */
export function ToggleDemo() {
  const [rulers, setRulers] = useState(true);
  const [pixelGrid, setPixelGrid] = useState(false);
  const [snap, setSnap] = useState(true);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Toggle</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Rectangular Track, Modest Radius, Bouncy Pop Spring Knob, No Pills
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Sizes &amp; States
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-6">
          <Toggle
            checked={rulers}
            onChange={setRulers}
            label="Show canvas rulers"
            description="Displays horizontal and vertical pixel rulers"
          />

          <Toggle
            checked={pixelGrid}
            onChange={setPixelGrid}
            label="Pixel grid snapping"
            description="Snap vertices and edges to whole pixels"
          />

          <Toggle
            size="sm"
            checked={snap}
            onChange={setSnap}
            label="Compact toggle (sm)"
          />

          <Toggle
            disabled
            checked={false}
            onChange={() => {}}
            label="Disabled toggle (off)"
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   5. CHECKBOX DEMO
   ========================================================================= */
export function CheckboxDemo() {
  const [checked1, setChecked1] = useState(true);
  const [checked2, setChecked2] = useState(false);
  const [indeterminate, setIndeterminate] = useState(true);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Checkbox</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Rectangular Box, Spring Pop Check Mark, Indeterminate State
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          States
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-5">
          <Checkbox checked={checked1} onChange={setChecked1} label="Clip content" description="Hide overflow outside layer boundaries" />
          <Checkbox checked={checked2} onChange={setChecked2} label="Auto layout spacing" />
          <Checkbox checked={false} indeterminate={indeterminate} onChange={() => setIndeterminate(!indeterminate)} label="Mixed layer opacity (indeterminate)" />
          <Checkbox disabled checked={true} onChange={() => {}} label="Disabled checked" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   6. TOOLTIP DEMO
   ========================================================================= */
export function TooltipDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Tooltip</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Modest Radius, Soft Shadow, Hover Delay &amp; Keyboard Focus Trigger
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Sides &amp; Triggers
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-8 ll:flex ll:flex-wrap ll:items-center ll:justify-around ll:gap-6">
          <Tooltip content="Tooltip on top" side="top">
            <Button variant="secondary">Top Tooltip</Button>
          </Tooltip>

          <Tooltip content="Tooltip on bottom" side="bottom">
            <Button variant="secondary">Bottom Tooltip</Button>
          </Tooltip>

          <Tooltip content="Tooltip on left" side="left">
            <Button variant="secondary">Left Tooltip</Button>
          </Tooltip>

          <Tooltip content="Tooltip on right" side="right">
            <Button variant="secondary">Right Tooltip</Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   7. TEXT FIELD DEMO
   ========================================================================= */
export function TextFieldDemo() {
  const [val, setVal] = useState("Hero Artboard");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">TextField</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Labels, Placeholders, Error State &amp; Focus Rings
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Variants &amp; States
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-5 ll:max-w-md">
          <TextField
            label="Layer Name"
            value={val}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value)}
          />

          <TextField
            label="Search Query"
            placeholder="Filter components..."
            prefixLabel="FIND"
            mono
          />

          <TextField
            label="Invalid Identifier"
            defaultValue="invalid identifier with spaces"
            error="Identifiers cannot contain spaces"
          />

          <TextField
            label="Disabled Field"
            value="Read-only component ID"
            disabled
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   8. NUMBER FIELD DEMO
   ========================================================================= */
export function NumberFieldDemo() {
  const [x, setX] = useState<number | null>(120);
  const [y, setY] = useState<number | null>(64);
  const [w, setW] = useState<number | null>(320);
  const [h, setH] = useState<number | null>(240);
  const [mixed, setMixed] = useState<number | null>(null);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">NumberField (Scrub)</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Drag Label to Scrub, Arrow Keys Step, Shift x10, Alt x0.1, Unit Suffixes &amp; Mixed Value
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Inspector Scrub Geometry
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-4 ll:max-w-md">
          <div className="ll:grid ll:grid-cols-2 ll:gap-3">
            <NumberField label="X" value={x} onChange={setX} suffix="px" />
            <NumberField label="Y" value={y} onChange={setY} suffix="px" />
          </div>

          <div className="ll:grid ll:grid-cols-2 ll:gap-3">
            <NumberField label="W" value={w} onChange={setW} suffix="px" min={1} />
            <NumberField label="H" value={h} onChange={setH} suffix="px" min={1} />
          </div>

          <div className="ll:grid ll:grid-cols-2 ll:gap-3">
            <NumberField label="R" value={mixed} onChange={setMixed} suffix="°" />
            <NumberField label="OP" value={100} onChange={() => {}} suffix="%" min={0} max={100} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   9. SELECT DEMO
   ========================================================================= */
export const PROTOTYPE_FONTS = [
  "Geist", "Inter", "Playfair Display", "Roboto", "Open Sans", "Lato",
  "Montserrat", "Poppins", "Raleway", "Merriweather", "Source Sans 3",
  "Nunito", "Work Sans", "DM Sans", "DM Serif Display", "Fira Sans",
  "IBM Plex Sans", "IBM Plex Mono", "JetBrains Mono", "Space Grotesk",
  "Space Mono", "Manrope", "Outfit", "Sora", "Lora",
  "Libre Baskerville", "Oswald", "Bebas Neue", "Archivo", "Cormorant Garamond"
];

export function SelectDemo() {
  const [blend, setBlend] = useState("normal");
  const [font, setFont] = useState("Geist");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Select</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Dropdown Field Morphing into List, Flying Label Pop, Momentum Scroll &amp; Edge Bulge
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Short Select &amp; 30-Font Long List with Search
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-6 ll:max-w-sm">
          <Select
            label="Short Select (Blend Mode)"
            value={blend}
            onChange={setBlend}
            options={[
              { value: "normal", label: "Normal" },
              { value: "multiply", label: "Multiply" },
              { value: "screen", label: "Screen" },
              { value: "overlay", label: "Overlay" },
              { value: "darken", label: "Darken" },
              { value: "lighten", label: "Lighten" },
            ]}
          />

          <Select
            label="Long Font Select (30 Fonts, Search & Bulge)"
            value={font}
            onChange={setFont}
            searchable={true}
            options={PROTOTYPE_FONTS.map((f) => ({
              value: f,
              label: f,
              hint: f === "Geist" || f === "Inter" ? "Sans" : undefined,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   10. COLOR SWATCH FIELD DEMO
   ========================================================================= */
export function ColorSwatchFieldDemo() {
  const [hex, setHex] = useState("2C2C2C");
  const [opacity, setOpacity] = useState(100);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ColorSwatchField</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Swatch Button + Hex Input + Opacity Scrub Field
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Fill Color Property
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-4 ll:max-w-md">
          <ColorSwatchField
            label="Fill"
            hex={hex}
            opacity={opacity}
            onChangeHex={setHex}
            onChangeOpacity={setOpacity}
          />
          <div className="ll:text-small ll:text-secondary">
            Computed RGBA: #{hex} at {opacity}%
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   11. MENU DEMO (LOGO MENU, SUBMENUS, LONG SCROLLING ENDBUMP)
   ========================================================================= */
export function MenuDemo() {
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const [longMenuOpen, setLongMenuOpen] = useState(false);
  const [canvasSize, setCanvasSize] = useState("1440");
  const [font, setFont] = useState("Geist");
  const logoBtnRef = useRef<HTMLButtonElement>(null);
  const longBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Menu &amp; SubMenu</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Surf Spring Engine, Single Glide Highlight, Safe Triangle Submenus &amp; Wheel endBump
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          1. Prototype Logo Menu with Submenus
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-wrap ll:items-center ll:gap-4">
          <Button
            ref={logoBtnRef}
            variant="secondary"
            onClick={() => setLogoMenuOpen(!logoMenuOpen)}
          >
            Open Prototype Logo Menu
          </Button>

          <Menu
            open={logoMenuOpen}
            onClose={() => setLogoMenuOpen(false)}
            anchorRef={logoBtnRef}
            width={240}
          >
            <SubMenu id="file" label="File" icon={<Icon icon={FileText} size={14} />}>
              <MenuItem shortcut="⌘N">New project</MenuItem>
              <MenuItem shortcut="⌘O">Open...</MenuItem>
              <MenuSeparator />
              <MenuItem shortcut="⌘S">Save</MenuItem>
              <MenuItem shortcut="⇧⌘E">Export project</MenuItem>
            </SubMenu>

            <SubMenu id="edit" label="Edit" icon={<Icon icon={Scissors} size={14} />}>
              <MenuItem shortcut="⌘Z">Undo</MenuItem>
              <MenuItem shortcut="⇧⌘Z">Redo</MenuItem>
              <MenuSeparator />
              <MenuItem shortcut="⌘X">Cut</MenuItem>
              <MenuItem shortcut="⌘C">Copy</MenuItem>
              <MenuItem shortcut="⌘V">Paste</MenuItem>
            </SubMenu>

            <SubMenu id="view" label="View" icon={<Icon icon={Grid} size={14} />}>
              <MenuItem checked={true}>Rulers</MenuItem>
              <MenuItem checked={false}>Pixel grid</MenuItem>
              <MenuItem checked={true}>Snap to objects</MenuItem>
            </SubMenu>

            <MenuSeparator />
            <MenuItem shortcut="⌘K" icon={<Icon icon={Sparkles} size={14} />}>Command Palette</MenuItem>
            <MenuItem icon={<Icon icon={Settings} size={14} />}>Preferences</MenuItem>
            <MenuItem icon={<Icon icon={HelpCircle} size={14} />}>Documentation</MenuItem>
          </Menu>

          <Button
            ref={longBtnRef}
            variant="secondary"
            onClick={() => setLongMenuOpen(!longMenuOpen)}
          >
            Open Long Menu (Test Wheel endBump)
          </Button>

          <Menu
            open={longMenuOpen}
            onClose={() => setLongMenuOpen(false)}
            anchorRef={longBtnRef}
            width={260}
          >
            <MenuLabel>Scroll past ends to test bump</MenuLabel>
            {Array.from({ length: 18 }).map((_, i) => (
              <MenuItem key={i} onClick={() => console.log(`Item ${i + 1}`)}>
                Menu item row {i + 1}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          2. Right-Click Area (ContextMenu)
        </div>
        <ContextMenu
          content={
            <>
              <MenuItem shortcut="⌘C">Copy</MenuItem>
              <MenuItem shortcut="⌘V">Paste</MenuItem>
              <MenuItem shortcut="⌘D">Duplicate</MenuItem>
              <MenuSeparator />
              <MenuItem shortcut="⌫">Delete layer</MenuItem>
            </>
          }
        >
          <div className="ll:h-36 ll:w-full ll:rounded-md ll:border ll:border-dashed ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-2 ll:select-none">
            <span className="ll:text-small ll:font-medium ll:text-primary">
              Right-click anywhere inside this target area
            </span>
            <span className="ll:text-micro ll:text-secondary">
              Opens the custom spring-animated Context Menu from pointer
            </span>
          </div>
        </ContextMenu>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          3. Short Select &amp; Long Font Select (Bulge Test)
        </div>
        <div className="ll:grid ll:grid-cols-1 ll:md:grid-cols-2 ll:gap-6 ll:p-6 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar">
          <Select
            label="Canvas size (Short Select)"
            value={canvasSize}
            onChange={setCanvasSize}
            options={[
              { value: "1440", label: "Desktop", hint: "1440" },
              { value: "768", label: "Tablet", hint: "768" },
              { value: "375", label: "Mobile", hint: "375" },
            ]}
          />

          <Select
            label="Font family (30 Fonts, Search & Bulge)"
            value={font}
            onChange={setFont}
            searchable={true}
            options={PROTOTYPE_FONTS.map((f) => ({
              value: f,
              label: f,
              hint: f === "Geist" || f === "Inter" ? "Sans" : undefined,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   12. CONTEXT MENU DEMO
   ========================================================================= */
export function ContextMenuDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ContextMenu</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Pointer-Positioned Menu with Viewport Collision Bounds
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Right-Click Zone
        </div>
        <ContextMenu
          content={
            <>
              <MenuItem shortcut="⌘C">Copy</MenuItem>
              <MenuItem shortcut="⌘V">Paste</MenuItem>
              <MenuItem shortcut="⌘D">Duplicate</MenuItem>
              <MenuSeparator />
              <MenuItem shortcut="⌫">Delete layer</MenuItem>
            </>
          }
        >
          <div className="ll:h-48 ll:w-full ll:rounded-md ll:border ll:border-dashed ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-2 ll:select-none">
            <span className="ll:text-small ll:font-medium ll:text-primary">
              Right-click anywhere inside this target area
            </span>
            <span className="ll:text-micro ll:text-secondary">
              Opens the custom spring-animated Context Menu
            </span>
          </div>
        </ContextMenu>
      </div>
    </div>
  );
}

/* =========================================================================
   13. POPOVER DEMO
   ========================================================================= */
export function PopoverDemo() {
  const [popOpen, setPopOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Popover</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Anchored Surface, Surf Engine Physics, Focus Trap &amp; Escape Dismissal
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Interactive Popover Anchor
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-4">
          <Button
            ref={triggerRef}
            variant="secondary"
            onClick={() => setPopOpen(!popOpen)}
          >
            Open Settings Popover
          </Button>

          <Popover
            open={popOpen}
            onClose={() => setPopOpen(false)}
            anchorRef={triggerRef}
            title="Layer Settings"
            width={280}
          >
            <div className="ll:flex ll:flex-col ll:gap-3">
              <TextField label="Name" defaultValue="Rectangle 1" />
              <Select
                label="Blend Mode"
                value="normal"
                onChange={() => {}}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "multiply", label: "Multiply" },
                ]}
              />
              <Toggle checked={true} onChange={() => {}} label="Visible in canvas" />
            </div>
          </Popover>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   14. COMMAND PALETTE DEMO
   ========================================================================= */
export function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);

  const sampleCommands = [
    { id: "1", label: "Add frame", category: "Insert", shortcut: "F", onSelect: () => console.log("Add frame") },
    { id: "2", label: "Add text layer", category: "Insert", shortcut: "T", onSelect: () => console.log("Add text") },
    { id: "3", label: "Toggle rulers", category: "View", shortcut: "⇧R", onSelect: () => console.log("Toggle rulers") },
    { id: "4", label: "Export project", category: "File", shortcut: "⇧⌘E", onSelect: () => console.log("Export") },
    { id: "5", label: "Open settings", category: "Preferences", shortcut: "⌘,", onSelect: () => console.log("Settings") },
  ];

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">CommandPalette</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Centered Dialog, Search Filter, Keyboard Navigation &amp; Global ⌘K Shortcut
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Palette Trigger
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-4">
          <Button variant="secondary" onClick={() => setOpen(true)} leftIcon={<Icon icon={Sparkles} size={14} />}>
            Open Command Palette (⌘K)
          </Button>

          <CommandPalette
            open={open}
            onClose={() => setOpen(false)}
            commands={sampleCommands}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   15. PANEL SECTION DEMO
   ========================================================================= */
export function PanelSectionDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">PanelSection</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Collapsible Header, More (...) Advanced Drawer &amp; Add (+) Button
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Inspector Section Layout
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:max-w-sm">
          <PanelSection
            title="Layout"
            onAdd={() => console.log("Add layout")}
            moreContent={
              <div className="ll:flex ll:flex-col ll:gap-2">
                <span className="ll:text-micro ll:font-mono ll:text-muted">ADVANCED SPACING</span>
                <Toggle checked={true} onChange={() => {}} label="Clip content" />
                <Toggle checked={false} onChange={() => {}} label="Absolute position" />
              </div>
            }
          >
            <div className="ll:flex ll:flex-col ll:gap-2">
              <SegmentedControl
                size="sm"
                value="stack"
                onChange={() => {}}
                options={[
                  { value: "free", label: "Free" },
                  { value: "stack", label: "Stack" },
                  { value: "grid", label: "Grid" },
                ]}
              />
              <div className="ll:grid ll:grid-cols-2 ll:gap-2">
                <NumberField label="W" value={320} onChange={() => {}} suffix="px" />
                <NumberField label="H" value={240} onChange={() => {}} suffix="px" />
              </div>
            </div>
          </PanelSection>

          <PanelSection
            title="Fill"
            onAdd={() => console.log("Add fill")}
          >
            <ColorSwatchField hex="2C2C2C" opacity={100} onChangeHex={() => {}} />
          </PanelSection>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   16. PROPERTY ROW DEMO
   ========================================================================= */
export function PropertyRowDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">PropertyRow</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Strict Alignment, 1 to 4 Column Grid Pairs, 4px Spacing Grid
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Inspector Rows
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-4 ll:flex ll:flex-col ll:gap-3 ll:max-w-md">
          <PropertyRow label="Position" columns={2}>
            <NumberField label="X" value={100} onChange={() => {}} />
            <NumberField label="Y" value={50} onChange={() => {}} />
          </PropertyRow>

          <PropertyRow label="Dimensions" columns={2}>
            <NumberField label="W" value={300} onChange={() => {}} />
            <NumberField label="H" value={200} onChange={() => {}} />
          </PropertyRow>

          <PropertyRow label="Radius" columns={4}>
            <NumberField label="TL" value={6} onChange={() => {}} />
            <NumberField label="TR" value={6} onChange={() => {}} />
            <NumberField label="BR" value={6} onChange={() => {}} />
            <NumberField label="BL" value={6} onChange={() => {}} />
          </PropertyRow>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   17. LIST ROW DEMO
   ========================================================================= */
export function ListRowDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState([
    { id: "1", name: "Solid Fill", value: "#FFFFFF 100%", swatch: "#FFFFFF", visible: true },
    { id: "2", name: "Drop Shadow", value: "4px 16px 50%", icon: <Icon icon={Layers} size={14} />, visible: true },
    { id: "3", name: "Spring Animation", value: "response 0.34s", icon: <Icon icon={Sliders} size={14} />, visible: false },
  ]);

  const toggleVisible = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item))
    );
  };

  const removeItem = (id: string) => {
    if (containerRef.current) {
      flipCard(containerRef.current, () => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      });
    } else {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ListRow</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          One-Line Rows, Grip Reorder with Spring FLIP, Settings Popover &amp; Visibility Toggle
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Repeatable Inspector Rows
        </div>
        <div
          ref={containerRef}
          className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-3 ll:flex ll:flex-col ll:gap-1.5 ll:max-w-md"
        >
          {items.map((item) => (
            <ListRow
              key={item.id}
              id={item.id}
              name={item.name}
              value={item.value}
              swatch={item.swatch}
              icon={item.icon}
              visible={item.visible}
              onToggleVisible={() => toggleVisible(item.id)}
              onRemove={() => removeItem(item.id)}
              settingsContent={
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <span className="ll:text-small ll:font-semibold ll:text-primary">{item.name} Properties</span>
                  <TextField label="Name" defaultValue={item.name} />
                  <Toggle checked={item.visible} onChange={() => toggleVisible(item.id)} label="Enabled" />
                </div>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   18. TREE ROW DEMO
   ========================================================================= */
export function TreeRowDemo() {
  const [selectedId, setSelectedId] = useState<string>("frame-1");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "frame-1": true, "group-1": true });
  const [layers, setLayers] = useState([
    { id: "frame-1", name: "Artboard 1", level: 0, hasChildren: true, icon: <Icon icon={Frame} size={14} />, hasMotion: true },
    { id: "hero-text", name: "Heading Text", level: 1, icon: <Icon icon={Type} size={14} />, hasMotion: true },
    { id: "group-1", name: "Button Group", level: 1, hasChildren: true, icon: <Icon icon={Folder} size={14} /> },
    { id: "btn-primary", name: "Primary Button", level: 2, icon: <Icon icon={Square} size={14} /> },
    { id: "btn-secondary", name: "Secondary Button", level: 2, icon: <Icon icon={Square} size={14} /> },
  ]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRename = (id: string, newName: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name: newName } : l)));
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">TreeRow</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Layer Hierarchy, Spring Chevrons, Inline Double-Click Rename &amp; Drop Indicators
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Layer Tree (Double click any layer name to rename inline)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:py-2 ll:flex ll:flex-col ll:gap-0.5 ll:max-w-sm">
          {layers.map((layer) => (
            <TreeRow
              key={layer.id}
              id={layer.id}
              name={layer.name}
              level={layer.level}
              icon={layer.icon}
              hasChildren={layer.hasChildren}
              expanded={expanded[layer.id]}
              selected={selectedId === layer.id}
              hasMotion={layer.hasMotion}
              onSelect={() => setSelectedId(layer.id)}
              onToggleExpand={() => toggleExpand(layer.id)}
              onRename={(newName: string) => handleRename(layer.id, newName)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   19. TABS DEMO
   ========================================================================= */
export function TabsDemo() {
  const [activeTab, setActiveTab] = useState<"layers" | "assets" | "pages">("layers");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Tabs</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Left Rail Panel Tabs, Sliding Spring Indicator, Keyboard Arrow Navigation
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Line Variant (Prototype Left Rail)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-4 ll:max-w-md">
          <Tabs
            variant="line"
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: "layers", label: "Layers", icon: <Icon icon={Layers} size={14} /> },
              { id: "assets", label: "Assets", icon: <Icon icon={Folder} size={14} /> },
              { id: "pages", label: "Pages", icon: <Icon icon={FileText} size={14} /> },
            ]}
          />
          <div className="ll:pt-4 ll:text-small ll:text-secondary">
            Viewing active panel: <strong className="ll:text-primary">{activeTab}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   20. AVATAR & SHIP DEMO
   ========================================================================= */
export function AvatarDemo() {
  const [issues, setIssues] = useState(2);

  const sampleUsers = [
    { id: "1", name: "Sarah Connor" },
    { id: "2", name: "Alex Chen" },
    { id: "3", name: "Maya Lin" },
    { id: "4", name: "David Kim" },
  ];

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Avatar &amp; ShipButton</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          User Avatars, Overlapping Stacks, Ship Button Quiet vs Ready States
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          User Avatars &amp; AvatarStack
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-6">
          <Avatar name="Claude Senior" size="md" />
          <Avatar name="Antigravity Worker" size="sm" />
          <AvatarStack users={sampleUsers} max={3} />
        </div>

        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          ShipButton States
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-4">
          <div className="ll:flex ll:items-center ll:gap-4">
            <ShipButton
              issueCount={issues}
              onClick={() => setIssues(issues > 0 ? 0 : 2)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIssues(issues > 0 ? 0 : 2)}
            >
              Toggle {issues > 0 ? "Ready State" : "Issues State (2 to fix)"}
            </Button>
          </div>
          <span className="ll:text-small ll:text-secondary">
            {issues > 0
              ? "Quiet state: uses --ll-ship-bg until checklist completes"
              : "Ready state: uses --ll-control-primary-bg"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   21. EMPTY STATE DEMO
   ========================================================================= */
export function EmptyStateDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">EmptyState</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Blank Page Canvas Placeholder with Action Prompts
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Blank Canvas Empty State
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-canvas ll:p-12 ll:flex ll:items-center ll:justify-center">
          <EmptyState
            title="Start with"
            onAddFrame={() => console.log("Add frame")}
            onInsert={() => console.log("Insert")}
            onAskAi={() => console.log("Ask AI")}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   22. TOP BAR DEMO
   ========================================================================= */
const SAMPLE_COLLAB_USERS: readonly CollabUser[] = [
  { id: "1", initials: "AP", name: "Adarsh Pathade", status: "Viewing" },
  { id: "2", initials: "RK", name: "Rina Kapoor", status: "Editing Hero" },
  { id: "3", initials: "SM", name: "Sam Mori", status: "Viewing" },
  { id: "4", initials: "JL", name: "Jun Lee", status: "Viewing" },
  { id: "5", initials: "TO", name: "Tara Osei", status: "Viewing" },
];

export function TopBarDemo() {
  const [mode, setMode] = useState<EditorMode>("design");
  const [saving, setSaving] = useState(false);
  const [demoIssues, setDemoIssues] = useState([
    { id: "alt", title: "Hero image has no alt text" },
    { id: "contrast", title: "Button contrast is 3.9:1" },
  ]);
  const [selectedPage, setSelectedPage] = useState("Home");

  const handleFixIssue = (id: string) => {
    setDemoIssues((prev) => prev.filter((i) => i.id !== id));
  };

  const resetIssues = () => {
    setDemoIssues([
      { id: "alt", title: "Hero image has no alt text" },
      { id: "contrast", title: "Button contrast is 3.9:1" },
    ]);
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">TopBar</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          52px Apple-Level Header, Logo Saving Trace, Mode Tabs, Theme Toggle, Ship Popover &amp; Page Switcher
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        {/* 1. Full TopBar */}
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Full Bar Interactive Preview
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:bg-surface-panel">
          <TopBar
            projectName="MyProject"
            saving={saving}
            mode={mode}
            onSelectMode={setMode}
            issues={demoIssues}
            onFixIssue={handleFixIssue}
            users={SAMPLE_COLLAB_USERS}
          />
        </div>
        <div className="ll:flex ll:items-center ll:gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSaving((prev) => !prev)}
          >
            {saving ? "Stop Saving Trace" : "Trigger Saving Trace"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={resetIssues}
          >
            Reset Issues (2 to fix)
          </Button>
          <span className="ll:text-small ll:text-secondary">
            Current mode: <strong className="ll:text-primary">{mode}</strong> · Issues: <strong className="ll:text-primary">{demoIssues.length}</strong>
          </span>
        </div>

        {/* 2. Logo Mark States */}
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Logo Mark (Idle &amp; Saving Trace)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-8">
          <div className="ll:flex ll:flex-col ll:items-center ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Idle</span>
            <div className="ll-logo ll:w-logo ll:h-logo ll:grid ll:place-items-center ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm">
              <LogoMark saving={false} size={20} />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:items-center ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Saving Trace (1.6s loop)</span>
            <div
              data-saving="true"
              className="ll-logo ll:w-logo ll:h-logo ll:grid ll:place-items-center ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm"
            >
              <LogoMark saving={true} size={20} />
            </div>
          </div>
        </div>

        {/* 3. Mode Tabs (Interactive, Hover, Focus, Disabled) */}
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Mode Tabs (Keyboard Arrow Navigation &amp; Forced States)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-wrap ll:items-center ll:gap-6">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Interactive (Arrow Keys)</span>
            <ModeTabs mode={mode} onChange={setMode} />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Forced Hover State</span>
            <ModeTabs mode={mode} onChange={setMode} dataState="hover" />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Forced Focus State</span>
            <ModeTabs mode={mode} onChange={setMode} dataState="focus" />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Disabled State</span>
            <ModeTabs mode={mode} onChange={setMode} disabled={true} />
          </div>
        </div>

        {/* 4. Ship Button & Popover States */}
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Ship Button &amp; Popover States
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-wrap ll:items-center ll:gap-6">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">With Issues (Interactive Fix)</span>
            <ShipPopover
              issues={demoIssues}
              onFixIssue={handleFixIssue}
            />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Forced Hover State</span>
            <ShipPopover
              issues={demoIssues}
              dataState="hover"
            />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Forced Focus State</span>
            <ShipPopover
              issues={demoIssues}
              dataState="focus"
            />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Ready State (0 Issues, Inverted)</span>
            <ShipPopover
              issues={[]}
              ready={true}
            />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Disabled State</span>
            <ShipPopover
              issues={demoIssues}
              disabled={true}
            />
          </div>
        </div>

        {/* 5. Ship in All 5 Themes */}
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Ship Across All 5 Themes
        </div>
        <div className="ll:grid ll:grid-cols-1 ll:md:grid-cols-5 ll:gap-3">
          {(
            [
              { id: "paper", label: "Paper (Default)" },
              { id: "dark", label: "Noir / Dark" },
              { id: "white", label: "White" },
              { id: "warm", label: "Warm" },
              { id: "lilac", label: "Lilac (Accent)" },
            ] as const
          ).map((t) => (
            <div
              key={t.id}
              data-theme={t.id}
              className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-4 ll:flex ll:flex-col ll:gap-3"
            >
              <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                {t.label}
              </span>
              <div className="ll:flex ll:flex-col ll:gap-2">
                <ShipPopover issues={[{ id: "1", title: "Theme check" }]} />
                <ShipPopover issues={[]} ready={true} />
              </div>
            </div>
          ))}
        </div>

        {/* 6. Page Switcher (Interactive, Hover, Focus, Disabled) */}
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Page Switcher (Searchable Select-Style Dropdown &amp; Forced States)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-wrap ll:items-center ll:gap-6">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Interactive (Arrow Up/Down/Enter)</span>
            <div className="ll:bg-surface-panel ll:px-3 ll:py-1 ll:border ll:border-border ll:rounded-sm">
              <PageSwitcher
                currentPage={selectedPage}
                onSelectPage={setSelectedPage}
                onNewPage={() => setSelectedPage("New Untitled Page")}
              />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Forced Hover State</span>
            <div className="ll:bg-surface-panel ll:px-3 ll:py-1 ll:border ll:border-border ll:rounded-sm">
              <PageSwitcher
                currentPage={selectedPage}
                dataState="hover"
              />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Forced Focus State</span>
            <div className="ll:bg-surface-panel ll:px-3 ll:py-1 ll:border ll:border-border ll:rounded-sm">
              <PageSwitcher
                currentPage={selectedPage}
                dataState="focus"
              />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Disabled State</span>
            <div className="ll:bg-surface-panel ll:px-3 ll:py-1 ll:border ll:border-border ll:rounded-sm">
              <PageSwitcher
                currentPage={selectedPage}
                disabled={true}
              />
            </div>
          </div>
        </div>

        {/* 7. Avatar Stack */}
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Collaborator Avatar Stack (Reusable Component)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-6">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">5 Collaborators (Click for Menu)</span>
            <AvatarStack users={SAMPLE_COLLAB_USERS} />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:text-secondary">Single Collaborator</span>
            <AvatarStack users={[SAMPLE_COLLAB_USERS[0]]} />
          </div>
        </div>
      </div>
    </div>
  );
}

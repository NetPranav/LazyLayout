"use client";

import React, { useState } from "react";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Select } from "../../components/Select";
import { IconButton } from "../../components/IconButton";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Pipette, Sliders, Eye, EyeOff, Plus, Minus, X } from "lucide-react";

const DEMO_MODES = [
  { value: "Solid", label: "Solid" },
  { value: "Linear", label: "Linear" },
  { value: "Radial", label: "Radial" },
  { value: "Conic", label: "Conic" },
  { value: "Image", label: "Image" },
];

const DEMO_CATEGORIES = [
  { value: "All", label: "All" },
  { value: "Sans", label: "Sans" },
  { value: "Serif", label: "Serif" },
  { value: "Mono", label: "Mono" },
  { value: "Display", label: "Display" },
];

const DEMO_MODELS = [
  { value: "Hex", label: "Hex" },
  { value: "RGB", label: "RGB" },
  { value: "HSL", label: "HSL" },
  { value: "OKLCH", label: "OKLCH" },
];

const DEMO_SHADOWS = [
  { value: "None", label: "None" },
  { value: "Soft", label: "Soft" },
  { value: "Medium", label: "Medium" },
  { value: "Hard", label: "Hard" },
];

/**
 * Task F5 Native Controls Demos:
 * 1. SegmentedControl compact variant (24px, sliding highlight, no borders on tabs, top-centre button style).
 * 2. Select component with floating-surface variant (hairline outline, 28px height, morphing list).
 * 3. IconButton components (24px compact and 28px standard, ghost/secondary/subtle, no native bevel).
 * 4. Button components (sm 28px and md 32px, text buttons, proper tokens).
 * 5. Complete state coverage: default, hover, pressed/active, focus, disabled.
 */
export function F5Demos() {
  const [activeMode, setActiveMode] = useState("Solid");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeModel, setActiveModel] = useState("Hex");
  const [activeShadow, setActiveShadow] = useState("Soft");
  const [isEyedropperPressed, setIsEyedropperPressed] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8 ll:p-6 ll:max-w-4xl ll:text-primary">
      <div>
        <h2 className="ll:text-lead ll:font-semibold ll:text-primary ll:mb-1">
          F5 Native Controls Parity Demos
        </h2>
        <p className="ll:text-body ll:text-secondary">
          Zero raw browser buttons or selects. All controls use design-system components
          with 4/6/8 radii, hairline borders, and top-centre segmented styling.
        </p>
      </div>

      {/* 1. SegmentedControl Compact Variant */}
      <section className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
        <h3 className="ll:text-body ll:font-medium ll:text-primary">
          1. SegmentedControl (Compact 24px)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Used in ColorPicker fill mode tabs, FontPicker category filters, and orientation pickers.
          Sliding highlight tile, muted text when unselected, no individual button borders.
        </p>

        <div className="ll:flex ll:flex-col ll:gap-4 ll:max-w-md">
          <div>
            <span className="ll:text-micro ll:font-mono ll:text-muted ll:mb-1 ll:block">
              COLOR PICKER MODES (COMPACT 24px)
            </span>
            <SegmentedControl
              size="compact"
              options={DEMO_MODES}
              value={activeMode}
              onChange={setActiveMode}
              ariaLabel="Color picker mode demo"
            />
          </div>

          <div>
            <span className="ll:text-micro ll:font-mono ll:text-muted ll:mb-1 ll:block">
              FONT PICKER CATEGORIES (COMPACT 24px)
            </span>
            <SegmentedControl
              size="compact"
              options={DEMO_CATEGORIES}
              value={activeCategory}
              onChange={setActiveCategory}
              ariaLabel="Font category demo"
            />
          </div>

          <div>
            <span className="ll:text-micro ll:font-mono ll:text-muted ll:mb-1 ll:block">
              DISABLED STATE
            </span>
            <SegmentedControl
              size="compact"
              disabled
              options={DEMO_MODES}
              value="Solid"
              onChange={() => {}}
              ariaLabel="Disabled segmented control demo"
            />
          </div>
        </div>
      </section>

      {/* 2. Select Floating-Surface Variant */}
      <section className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
        <h3 className="ll:text-body ll:font-medium ll:text-primary">
          2. Select Component (Floating-Surface Variant, 28px)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Used for Hex format, Font, Scale, Shadow, Framework, and Styling dropdowns.
          Hairline outline, 28px height, morphing list with spring physics.
        </p>

        <div className="ll:grid ll:grid-cols-2 ll:gap-4 ll:max-w-md">
          <div>
            <span className="ll:text-micro ll:font-mono ll:text-muted ll:mb-1 ll:block">
              MODEL FORMAT
            </span>
            <Select
              size="sm"
              variant="floating"
              options={DEMO_MODELS}
              value={activeModel}
              onChange={setActiveModel}
              aria-label="Demo color model"
            />
          </div>

          <div>
            <span className="ll:text-micro ll:font-mono ll:text-muted ll:mb-1 ll:block">
              THEME SHADOW
            </span>
            <Select
              size="sm"
              variant="floating"
              options={DEMO_SHADOWS}
              value={activeShadow}
              onChange={setActiveShadow}
              aria-label="Demo shadow"
            />
          </div>
        </div>
      </section>

      {/* 3. IconButton Standard & Compact */}
      <section className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
        <h3 className="ll:text-body ll:font-medium ll:text-primary">
          3. IconButton (28px Standard & 24px Compact)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Replaces raw buttons for Eyedropper, Sliders options, Visibility eye, and Remove minus.
          Subtle hover background, zero outset borders.
        </p>

        <div className="ll:flex ll:items-center ll:gap-3">
          <IconButton
            size="md"
            variant="ghost"
            aria-label="Eyedropper"
            tooltip="Pick colour"
            icon={<Icon icon={Pipette} size={14} />}
            pressed={isEyedropperPressed}
            onClick={() => setIsEyedropperPressed((p) => !p)}
          />

          <IconButton
            size="sm"
            variant="ghost"
            aria-label="More options"
            tooltip="Options"
            icon={<Icon icon={Sliders} size={14} />}
          />

          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Toggle visibility"
            tooltip={isHidden ? "Show" : "Hide"}
            icon={<Icon icon={isHidden ? EyeOff : Eye} size={14} />}
            onClick={() => setIsHidden((p) => !p)}
          />

          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Add item"
            tooltip="Add"
            icon={<Icon icon={Plus} size={14} />}
          />

          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Remove item"
            tooltip="Remove"
            icon={<Icon icon={Minus} size={14} />}
          />

          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Close"
            tooltip="Close"
            icon={<Icon icon={X} size={14} />}
          />

          <IconButton
            size="sm"
            disabled
            aria-label="Disabled action"
            tooltip="Disabled"
            icon={<Icon icon={Plus} size={14} />}
          />
        </div>
      </section>

      {/* 4. Text Buttons */}
      <section className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
        <h3 className="ll:text-body ll:font-medium ll:text-primary">
          4. Button (sm 28px & md 32px)
        </h3>
        <p className="ll:text-small ll:text-muted">
          Used in FontPicker footer (Upload font…, Google Fonts) and FramePresetsPanel (Add frame).
        </p>

        <div className="ll:flex ll:items-center ll:gap-3">
          <Button size="sm" variant="default" leftIcon={<Icon icon={Plus} size={14} />}>
            Upload font…
          </Button>

          <Button size="sm" variant="default">
            Google Fonts
          </Button>

          <Button size="sm" variant="primary">
            Add frame
          </Button>

          <Button size="sm" variant="default" disabled>
            Disabled
          </Button>
        </div>
      </section>
    </div>
  );
}

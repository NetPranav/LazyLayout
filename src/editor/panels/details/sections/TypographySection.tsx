"use client";

import React, { useState, useRef } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpDown,
  ArrowLeftRight,
  MoveHorizontal,
  MoveVertical,
  Square,
  Italic,
  Underline,
  Strikethrough,
  Minus,
} from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { FontPicker } from "@/editor/components/FontPicker";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { Slider } from "@/editor/components/Slider";
import { invokeCommand } from "@/core/commands";
import { getDocument } from "@/core/store/documentState";
import { isLettersGroup } from "@/core/editing/splitText";
import { getLettersDepth } from "@/core/editing/standingLetters";
import {
  INSPECTOR_CONSTANTS,
  FONT_FAMILY_OPTIONS,
  TEXT_OVERFLOW_OPTIONS,
  WHITE_SPACE_OPTIONS,
  FONT_LOADING_OPTIONS,
} from "../constants";
import type { InspectorSectionProps } from "../types";

export const TypographySection: React.FC<InspectorSectionProps> = ({
  layer,
  getValue,
  onUpdateProp,
  onUpdateProps,
  className = "",
}) => {
  // Content text
  const textContent =
    (getValue?.("content.text") as string) ||
    (getValue?.("content.label") as string) ||
    "";

  // Typography properties
  const isFamilyMixed = getValue?.("typography.fontFamily") === null;
  const fontFamily = (getValue?.("typography.fontFamily") as string) || "Geist";
  const isWeightMixed = getValue?.("typography.fontWeight") === null;
  const rawWeight = (getValue?.("typography.fontWeight") as string) || "600";
  const fontWeight = String(rawWeight);

  const rawSize = getValue?.("typography.fontSize") ?? getValue?.("fontSize");
  const fontSize = typeof rawSize === "number" ? rawSize : rawSize === null ? null : INSPECTOR_CONSTANTS.DEFAULT_FONT_SIZE;

  const rawLH = getValue?.("typography.lineHeight") ?? getValue?.("lineHeight");
  const lineHeight = typeof rawLH === "number" ? rawLH : rawLH === null ? null : INSPECTOR_CONSTANTS.DEFAULT_LINE_HEIGHT;

  const rawLS = getValue?.("typography.letterSpacing") ?? getValue?.("letterSpacing");
  const letterSpacing = typeof rawLS === "number" ? rawLS : rawLS === null ? null : INSPECTOR_CONSTANTS.DEFAULT_LETTER_SPACING;

  const textAlign = (getValue?.("typography.textAlign") as string) || "left";
  const textSizing = (getValue?.("text.sizing") as string) || "autoWidth";

  const isTextOrButton =
    !layer ||
    layer.archetype === "text" ||
    layer.archetype === "button" ||
    (layer.archetype as string) === "counter";

  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const fontAnchorRef = useRef<HTMLDivElement>(null);

  const isSingleText = layer?.archetype === "text";
  const docLayers = getDocument().layers;
  const isLettersDirect = isLettersGroup(layer, docLayers);
  const parentIsLetters = Boolean(layer?.parentId && isLettersGroup(docLayers[layer.parentId], docLayers));
  const lettersGroupId = isLettersDirect ? layer?.id : parentIsLetters ? layer?.parentId : null;
  const isLetters = Boolean(lettersGroupId);

  const currentDepth = lettersGroupId ? getLettersDepth(lettersGroupId) : null;
  const [depthInput, setDepthInput] = React.useState<number>(24);
  const depthValue = currentDepth ?? depthInput;

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Split into letters & Animate / Stand / Depth controls */}
      {(isSingleText || isLetters) && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
          <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
            <Button
              size="sm"
              variant="secondary"
              className="ll:flex-1"
              disabled={!isSingleText}
              onClick={() => void invokeCommand("text.splitLetters")}
              title={isSingleText ? "Split text into one layer per letter" : "Already split into letters"}
            >
              Split into letters
            </Button>
            {isLetters && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="ll:flex-1"
                  onClick={() => void invokeCommand("text.animateLetters", { id: lettersGroupId ?? undefined })}
                  title="Animate letters with staggered entrance"
                >
                  Animate letters
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="ll:flex-1"
                  onClick={() => void invokeCommand("text.standLetters", { id: lettersGroupId ?? undefined })}
                  title="Stand letters up in 3D on a ground plane"
                >
                  Stand letters up
                </Button>
              </>
            )}
          </div>
          {isLetters && (
            <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
              <Button
                size="sm"
                variant="secondary"
                className="ll:flex-1"
                onClick={() => void invokeCommand("text.extrudeLetters", { id: lettersGroupId ?? undefined, depth: depthValue || 24 })}
                title="Give letters 3D depth"
              >
                Give letters depth
              </Button>
              {currentDepth !== null && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void invokeCommand("text.removeDepth", { id: lettersGroupId ?? undefined })}
                  title="Remove 3D depth"
                >
                  Remove depth
                </Button>
              )}
            </div>
          )}
          {isLetters && (
            <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
              <span className="ll:text-micro ll:text-muted ll:w-10">Depth</span>
              <div className="ll:flex-1">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={depthValue}
                  unit="px"
                  label="Depth"
                  ariaLabel="Letters depth"
                  onChange={(val) => {
                    setDepthInput(val);
                    if (lettersGroupId) {
                      if (val === 0) {
                        void invokeCommand("text.removeDepth", { id: lettersGroupId });
                      } else {
                        void invokeCommand("text.extrudeLetters", { id: lettersGroupId, depth: val });
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content text field: plain clean textarea matching prototype */}
      {isTextOrButton && (
        <div className="ll:w-full">
          <textarea
            rows={2}
            aria-label="Text content"
            value={textContent}
            onChange={(e) => {
              onUpdateProps?.({
                "content.text": e.target.value,
                "content.label": e.target.value,
              });
            }}
            placeholder="Text content"
            className="ll:block ll:w-full ll:box-border ll:px-2 ll:py-1.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:focus:border-border-active ll:focus:ring-1 ll:focus:ring-border-active ll:outline-none ll:rounded-sm ll:font-mono ll:text-micro ll:leading-4 ll:text-primary ll:resize-none ll:transition-colors"
          />
        </div>
      )}

      {/* Font Family Select & FontPicker */}
      <div
        ref={fontAnchorRef}
        className="ll:relative ll:w-full"
        onClickCapture={(e) => {
          if (!e.currentTarget.contains(e.target as Node)) return;
          e.stopPropagation();
          setIsFontPickerOpen(true);
        }}
      >
        <Select
          size="sm"
          aria-label="Font family"
          value={fontFamily}
          options={FONT_FAMILY_OPTIONS}
          mixed={isFamilyMixed}
          onChange={(val) => onUpdateProp?.("typography.fontFamily", val)}
        />
        <FontPicker
          open={isFontPickerOpen}
          value={fontFamily}
          anchorRef={fontAnchorRef}
          onChange={(family: string) => {
            onUpdateProp?.("typography.fontFamily", family);
          }}
          onClose={() => setIsFontPickerOpen(false)}
        />
      </div>

      {/* Font Weight & Size Row */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <Select
          size="sm"
          aria-label="Font weight"
          value={isWeightMixed ? undefined : fontWeight}
          placeholder={isWeightMixed ? "Mixed" : undefined}
          mixed={isWeightMixed}
          options={[
            { value: "100", label: "W 100 Thin" },
            { value: "200", label: "W 200 X-Light" },
            { value: "300", label: "W 300 Light" },
            { value: "400", label: "W 400 Regular" },
            { value: "500", label: "W 500 Medium" },
            { value: "600", label: "W 600 Semi" },
            { value: "700", label: "W 700 Bold" },
            { value: "800", label: "W 800 X-Bold" },
            { value: "900", label: "W 900 Black" },
          ]}
          onChange={(val) => onUpdateProp?.("typography.fontWeight", val)}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="S"
          aria-label="Size"
          min={INSPECTOR_CONSTANTS.MIN_FONT_SIZE}
          max={INSPECTOR_CONSTANTS.MAX_FONT_SIZE}
          value={fontSize}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("typography.fontSize", v);
            onUpdateProp?.("fontSize", v);
          }}
        />
      </div>

      {/* Line Height & Letter Spacing Row */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label={<Icon icon={ArrowUpDown} size={14} />}
          aria-label="Line height"
          value={lineHeight}
          step={INSPECTOR_CONSTANTS.STEP_DECIMAL}
          precision={2}
          onChange={(v) => {
            onUpdateProp?.("typography.lineHeight", v);
            onUpdateProp?.("lineHeight", v);
          }}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label={<Icon icon={ArrowLeftRight} size={14} />}
          aria-label="Tracking"
          value={letterSpacing}
          step={INSPECTOR_CONSTANTS.STEP_DECIMAL}
          precision={2}
          onChange={(v) => {
            onUpdateProp?.("typography.letterSpacing", v);
            onUpdateProp?.("letterSpacing", v);
          }}
        />
      </div>

      {/* Text Align Segmented Control: Left, Center, Right (prototype parity) */}
      <SegmentedControl
        size="sm"
        ariaLabel="Text alignment"
        value={textAlign}
        onChange={(val) => onUpdateProp?.("typography.textAlign", val)}
        options={[
          {
            value: "left",
            icon: <Icon icon={AlignLeft} size={14} />,
            ariaLabel: "Align left",
          },
          {
            value: "center",
            icon: <Icon icon={AlignCenter} size={14} />,
            ariaLabel: "Align center",
          },
          {
            value: "right",
            icon: <Icon icon={AlignRight} size={14} />,
            ariaLabel: "Align right",
          },
        ]}
      />

      {/* Text Sizing Segmented Control: Auto width / Auto height / Fixed (prototype parity) */}
      <SegmentedControl
        size="sm"
        ariaLabel="Text box sizing"
        value={textSizing}
        onChange={(val) => onUpdateProp?.("text.sizing", val)}
        options={[
          {
            value: "autoWidth",
            icon: <Icon icon={MoveHorizontal} size={14} />,
            ariaLabel: "Auto width",
          },
          {
            value: "autoHeight",
            icon: <Icon icon={MoveVertical} size={14} />,
            ariaLabel: "Auto height",
          },
          {
            value: "fixed",
            icon: <Icon icon={Square} size={14} />,
            ariaLabel: "Fixed box",
          },
        ]}
      />
    </div>
  );
};

export const TypographyMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const textTransform = (getValue?.("typography.textTransform") as string) || "none";
  const fontStyle = (getValue?.("typography.fontStyle") as string) || "normal";
  const isItalic = fontStyle === "italic";
  const textDecoration = (getValue?.("typography.textDecoration") as string) || "none";
  const wordSpacing = (getValue?.("typography.wordSpacing") as number) ?? 0;
  const textOverflow = (getValue?.("typography.textOverflow") as string) || "clip";
  const whiteSpace = (getValue?.("typography.whiteSpace") as string) || "normal";
  const fontLoading = (getValue?.("typography.fontLoading") as string) || "swap";

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Case & Decoration */}
      <div className="ll-dmg">
        <div className="ll-dgl">
          <span className="ll-dlbl">Case</span>
          <div className="ll:flex ll:items-center ll:gap-2">
            <div className="ll:flex-1">
              <SegmentedControl
                size="sm"
                ariaLabel="Text case"
                value={textTransform}
                onChange={(val) => onUpdateProp?.("typography.textTransform", val)}
                options={[
                  { value: "none", label: "—", ariaLabel: "No case change" },
                  { value: "uppercase", label: "AG", ariaLabel: "Uppercase" },
                  { value: "lowercase", label: "ag", ariaLabel: "Lowercase" },
                  { value: "capitalize", label: "Ag", ariaLabel: "Title case" },
                ]}
              />
            </div>
            <IconButton
              size="md"
              variant={isItalic ? "subtle" : "ghost"}
              pressed={isItalic}
              aria-label="Italic"
              tooltip="Italic"
              onClick={() =>
                onUpdateProp?.(
                  "typography.fontStyle",
                  isItalic ? "normal" : "italic"
                )
              }
              icon={<Icon icon={Italic} size={14} />}
              className="ll:border ll:border-border"
            />
          </div>
        </div>

        <div className="ll-dgl">
          <span className="ll-dlbl">Decoration</span>
          <SegmentedControl
            size="sm"
            ariaLabel="Text decoration"
            value={textDecoration}
            onChange={(val) => onUpdateProp?.("typography.textDecoration", val)}
            options={[
              {
                value: "none",
                icon: <Icon icon={Minus} size={14} />,
                ariaLabel: "No decoration",
              },
              {
                value: "underline",
                icon: <Icon icon={Underline} size={14} />,
                ariaLabel: "Underline",
              },
              {
                value: "line-through",
                icon: <Icon icon={Strikethrough} size={14} />,
                ariaLabel: "Strikethrough",
              },
            ]}
          />
        </div>
      </div>

      {/* Group 2: Word, Overflow, Wrap */}
      <div className="ll-dmg">
        <div className="ll-dtrow">
          <span className="ll-dlbl">Word</span>
          <div className="ll-dtc">
            <NumberField
              size="sm"
              label=""
              aria-label="Word spacing"
              value={wordSpacing}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("typography.wordSpacing", v)}
            />
          </div>
        </div>

        <div className="ll-dtrow">
          <span className="ll-dlbl">Overflow</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Text overflow"
              title="What happens to text that does not fit: Clip cuts it off, Ellipsis ends it with three dots (on one line)."
              value={textOverflow}
              options={TEXT_OVERFLOW_OPTIONS}
              onChange={(v) => onUpdateProp?.("typography.textOverflow", v)}
            />
          </div>
        </div>

        <div className="ll-dtrow">
          <span className="ll-dlbl">Wrap</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="White space"
              title="Normal wraps at the box edge; No wrap keeps one line and lets it run past the box; Pre keeps your spaces and line breaks."
              value={whiteSpace}
              options={WHITE_SPACE_OPTIONS}
              onChange={(v) => onUpdateProp?.("typography.whiteSpace", v)}
            />
          </div>
        </div>
      </div>

      {/* Group 3: Loading */}
      <div className="ll-dmg">
        <div className="ll-dtrow">
          <span className="ll-dlbl">Loading</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Font loading"
              title="How the text shows while its font downloads: Swap shows a stand-in at once, Block waits, Fallback waits briefly, Optional may skip the font."
              value={fontLoading}
              options={FONT_LOADING_OPTIONS}
              onChange={(v) => onUpdateProp?.("typography.fontLoading", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

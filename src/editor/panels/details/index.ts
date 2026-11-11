export { DetailsInspector, getInspectorDesignSections, InspectorExtras } from "./DetailsInspector";

// Individual section components per section id used by RightPanelFrame
export { PositionSection, PositionMore } from "./sections/PositionSection";
export { LayoutSection, LayoutMore } from "./sections/LayoutSection";
export { AppearanceSection, AppearanceMore } from "./sections/AppearanceSection";
export { TypographySection, TypographyMore } from "./sections/TypographySection";
export { StatesSection, StatesMore } from "./sections/StatesSection";
export { ImageSection, ImageMore } from "./sections/ImageSection";
export { InputSection, InputMore } from "./sections/InputSection";
export { ToggleSection } from "./sections/ToggleSection";
export { DividerSection, DividerMore } from "./sections/DividerSection";
export { BackgroundSection, BackgroundMore } from "./sections/BackgroundSection";
export { IconSection, IconMore } from "./sections/IconSection";
export { ShapeSection, ShapeMore } from "./sections/ShapeSection";
export { VectorSection, VectorHeaderAction, VectorOptions } from "./sections/VectorSection";
export { CounterSection, CounterMore } from "./sections/CounterSection";
export { Object3DSection, Object3DMore } from "./sections/Object3DSection";
export { FillSection } from "./sections/FillSection";
export { StrokeSection } from "./sections/StrokeSection";
export { EffectsSection } from "./sections/EffectsSection";
export { AnimationSection } from "./sections/AnimationSection";
export { DataSection } from "./sections/DataSection";
export { LogicSection } from "./sections/LogicSection";
export { AccessibilitySection } from "./sections/AccessibilitySection";
export {
  PageSection,
  PageSectionBody,
  PageBackgroundBody,
  ThemeTokensBody,
  ThemeTokensMore,
} from "./sections/PageSection";

// Direct lowercase aliases matching section ids
export { PositionSection as position } from "./sections/PositionSection";
export { LayoutSection as layout } from "./sections/LayoutSection";
export { AppearanceSection as appearance } from "./sections/AppearanceSection";
export { TypographySection as typography } from "./sections/TypographySection";
export { FillSection as fill } from "./sections/FillSection";
export { StrokeSection as stroke } from "./sections/StrokeSection";
export { EffectsSection as effects } from "./sections/EffectsSection";
export { AnimationSection as animation } from "./sections/AnimationSection";
export { DataSection as data } from "./sections/DataSection";
export { LogicSection as logic } from "./sections/LogicSection";
export { AccessibilitySection as accessibility } from "./sections/AccessibilitySection";
export { PageSection as page } from "./sections/PageSection";

// Controls
export { AlignBar } from "./controls/AlignBar";
export { AlignmentGrid, getAlignmentMatrixIndex } from "./controls/AlignmentGrid";
export { EasingCurveBox } from "./controls/EasingCurveBox";
export { RepeatableRow } from "./controls/RepeatableRow";
export { RowSettingsPopover } from "./controls/RowSettingsPopover";

// Hook
export { useSelectionInspector } from "./hooks/useSelectionInspector";

// Types & Constants
export * from "./types";
export * from "./constants";

import { PositionSection } from "./sections/PositionSection";
import { LayoutSection } from "./sections/LayoutSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { TypographySection } from "./sections/TypographySection";
import { FillSection } from "./sections/FillSection";
import { StrokeSection } from "./sections/StrokeSection";
import { EffectsSection } from "./sections/EffectsSection";
import { AnimationSection } from "./sections/AnimationSection";
import { DataSection } from "./sections/DataSection";
import { LogicSection } from "./sections/LogicSection";
import { AccessibilitySection } from "./sections/AccessibilitySection";
import { PageSection, type PageSectionProps } from "./sections/PageSection";
import type { InspectorSectionProps } from "./types";

/** Lookup map from section id string to section component */
export type SectionComponentProps = InspectorSectionProps & PageSectionProps;
export const SECTION_COMPONENTS: Record<string, React.ComponentType<SectionComponentProps>> = {
  position: PositionSection,
  layout: LayoutSection,
  appearance: AppearanceSection,
  typography: TypographySection,
  fill: FillSection,
  stroke: StrokeSection,
  effects: EffectsSection,
  animation: AnimationSection,
  data: DataSection,
  logic: LogicSection,
  accessibility: AccessibilitySection,
  page: PageSection,
};

export * from "./m1FoilButton";
export * from "./m1PlusSmallAndPointerLight";
export * from "./m2StudioAndAnimation";
export * from "./m3LivingComponents";
export * from "./m4ShipAndSimplicity";
export * from "./m5PhotoAndM6Anime";

import { type GateM1Report, runGateM1FoilButton } from "./m1FoilButton";
import { type GateAReport, evaluateFiveRecipeSizeGate, runGateAReactiveButton } from "./m1PlusSmallAndPointerLight";
import { type GateM2Report, runGateM2ProductHero } from "./m2StudioAndAnimation";
import { type GateM3Report, runGateM3LivingComponents } from "./m3LivingComponents";
import { type GateM4Report, runGateM4FullShip } from "./m4ShipAndSimplicity";
import { type GateBReport, type GateCReport, runGateBPhotoStudio, runGateCAnimeStudio } from "./m5PhotoAndM6Anime";

export interface Roadmap3dMasterGateReport {
  readonly allPassed: boolean;
  readonly phasesCoveredCount: number;
  readonly gateM1: GateM1Report;
  readonly gateA: GateAReport;
  readonly gateM2: GateM2Report;
  readonly gateM3: GateM3Report;
  readonly gateM4: GateM4Report;
  readonly gateB: GateBReport;
  readonly gateC: GateCReport;
  readonly fiveRecipeSizeGatePassed: boolean;
}

export function runAllRoadmap3dGates(): Roadmap3dMasterGateReport {
  const gateM1 = runGateM1FoilButton();
  const gateA = runGateAReactiveButton();
  const gateM2 = runGateM2ProductHero();
  const gateM3 = runGateM3LivingComponents();
  const gateM4 = runGateM4FullShip();
  const gateB = runGateBPhotoStudio();
  const gateC = runGateCAnimeStudio();
  const fiveRecipe = evaluateFiveRecipeSizeGate();

  const allPassed =
    gateM1.passed &&
    gateA.passed &&
    gateM2.passed &&
    gateM3.passed &&
    gateM4.passed &&
    gateB.passed &&
    gateC.passed &&
    fiveRecipe.passed;

  return {
    allPassed,
    phasesCoveredCount: 227,
    gateM1,
    gateA,
    gateM2,
    gateM3,
    gateM4,
    gateB,
    gateC,
    fiveRecipeSizeGatePassed: fiveRecipe.passed,
  };
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDocumentFromLayers, createLayer } from "@/core/document/factories";
import { validateMotionDocument } from "@/core/document/schema";
import { rules } from "@/core/rules";
import {
  DEFAULT_PHASE13_COMMAND_CATALOG,
  EVAL_CATEGORIES,
  OfflineDeterministicProvider,
  PHASE_244_EVAL_PROMPTS,
  animateCharacterFromPrompt,
  applyMdmJsonPatches,
  authorEffectFromPrompt,
  authorFromImageReference,
  buildInteractionFromPrompt,
  classifySampledReferenceFrames,
  computeEvalDashboard,
  explainSelectionMotion,
  filterPatchesToSelection,
  fixDiagnosticsForDocument,
  planBuilderTurn,
  remixEffectAuthoring,
  runEvalSuite,
  runSelectionScopedEdit,
} from "../index";
import {
  MCP_PROMPTS,
  MCP_RESOURCES,
  buildMcpToolRegistry,
  computeMcpCommandCoverage,
  createMcpServer,
  useMcpActivityStore,
} from "@/ai/mcp";

function buildStudioTestDoc() {
  const hero = createLayer({ id: "hero", name: "HeroCard", archetype: "container" });
  const title = createLayer({ id: "title", name: "HeadlineText", archetype: "text" });
  const cta = createLayer({ id: "button", name: "GetStartedButton", archetype: "button" });
  const badge = createLayer({ id: "badge", name: "StatusBadge", archetype: "badge" });
  const icon = createLayer({ id: "vec", name: "SparkIcon", archetype: "svgPath" });
  return createDocumentFromLayers([hero, title, cta, badge, icon]);
}

describe("Lane G · Phases 244–250", () => {
  it("Phase 244: runs >= 210 eval prompts with visual self-check >= 95% validity and CI regression gate", async () => {
    assert.ok(PHASE_244_EVAL_PROMPTS.length >= 210, `Expected >= 210 prompts, got ${PHASE_244_EVAL_PROMPTS.length}`);
    for (const cat of EVAL_CATEGORIES) {
      assert.ok(PHASE_244_EVAL_PROMPTS.some((p) => p.category === cat), `Missing category ${cat}`);
    }

    const doc = buildStudioTestDoc();
    const provider = new OfflineDeterministicProvider();
    const { dashboard } = await runEvalSuite({
      provider,
      baseDocument: doc,
      validateRules: rules.validate,
      baselineValidityRate: 0.99,
    });

    assert.ok(dashboard.validityRate >= 0.95, `Expected >=95% validity, got ${dashboard.validityRate}`);
    assert.equal(dashboard.ciBlocked, false);

    // CI blocks if validity drops > 2 points below baseline
    const regressed = computeEvalDashboard(
      Array.from({ length: 10 }, (_, idx) => ({
        id: `case-${idx}`,
        category: "motion",
        valid: idx < 9, // 90%
        repaired: false,
        accepted: idx < 9,
        visualPassed: true,
        latencyMs: 12,
        costUsd: 0,
      })),
      0.98,
    );
    assert.equal(regressed.ciBlocked, true);
  });

  it("Phase 245: selection-scoped co-pilot edits never modify unselected layers, explains routing, and fixes diagnostics", () => {
    const doc = buildStudioTestDoc();
    const edit = runSelectionScopedEdit(
      doc,
      ["button", "badge"],
      "Make the selected animation bouncier",
      rules.validate,
    );
    assert.equal(edit.accepted, true);
    assert.ok(
      edit.patches.every((p) => {
        if (p.path.startsWith("/layers/")) return /^\/layers\/(button|badge)\//.test(p.path);
        if (p.path.startsWith("/clips/") && p.value && typeof p.value === "object") {
          const lid = (p.value as { layerId?: unknown }).layerId;
          return lid === "button" || lid === "badge";
        }
        return true;
      }),
    );

    const filtered = filterPatchesToSelection(
      [
        { op: "add", path: "/layers/button/properties/opacity", value: 1 },
        { op: "add", path: "/layers/hero/properties/opacity", value: 0.5 },
      ],
      ["button"],
    );
    assert.equal(filtered.scoped.length, 1);
    assert.equal(filtered.rejectedCount, 1);

    const explainCss = explainSelectionMotion(doc, ["button"]);
    assert.equal(explainCss.engineChoice, "CSS");
    const explainSvg = explainSelectionMotion(doc, ["vec"]);
    assert.equal(explainSvg.engineChoice, "SVG");

    const fix = fixDiagnosticsForDocument(doc, rules.validate);
    assert.equal(fix.remainingDiagnostics, 0);
  });

  it("Phase 246: >= 90% of 20 interaction prompts produce valid runnable .nls rules", () => {
    const doc = buildStudioTestDoc();
    const prompts = [
      "When the button is clicked, burst confetti and flip the card",
      "On hover over the button, add magnetic pull",
      "When the card is hovered, elevate it",
      "When the user scrolls down, reveal target",
      "On form submit, show toast",
      "On escape key, dismiss modal",
      "When the badge is clicked, toggle state",
      "On page load, play transition",
      "When the button is clicked, navigate to next step",
      "On hover over the card, reveal target and elevate",
      "When the toggle is clicked, switch state",
      "On click of the button, emit confetti",
      "When hovered, flip the card",
      "On scroll, reveal target",
      "When clicked, show toast and toggle state",
      "On submit, navigate next",
      "On escape, hide target",
      "When hovered, elevate and magnetic pull",
      "On click, flip and burst confetti",
      "On load, reveal target",
    ];
    assert.equal(prompts.length, 20);
    const validCount = prompts.filter((p) => buildInteractionFromPrompt(doc, p).valid).length;
    assert.ok(validCount / prompts.length >= 0.9);
  });

  it("Phase 247: 40 effect prompts compile into typed shader graphs + particle stacks within budget and support remixing", () => {
    const basePrompts = [
      "a background like ink in water that swirls around the cursor",
      "cursor-following spotlight glow",
      "confetti particle burst on click",
      "metallic specular sheen tracking pointer",
      "soft aurora gradient drift",
      "interactive ripple wave from click",
      "starfield twinkle in dark hero",
      "glowing halo bloom on hover",
    ];
    const prompts = Array.from({ length: 40 }, (_, i) => `${basePrompts[i % basePrompts.length]} #${i + 1}`);
    const authored = prompts.map((p) => authorEffectFromPrompt(p, "hero"));
    const validCount = authored.filter((e) => e.valid && e.withinBudget && e.usesRawGlsl === false).length;
    assert.ok(validCount / authored.length >= 0.9);

    const remixed = remixEffectAuthoring(authored[0], "react to scroll too", "hero");
    assert.ok(remixed.bindings.some((b) => b.signal === "scrollProgress"));
    assert.equal(remixed.withinBudget, true);
  });

  it("Phase 248: auto-rigs character parts and animates 10 eval prompts passing visual self-check and rules", () => {
    const doc = buildStudioTestDoc();
    const parts = [
      { id: "p-head", name: "head", bounds: { x: 80, y: 20, width: 40, height: 40 } },
      { id: "p-torso", name: "torso", bounds: { x: 75, y: 65, width: 50, height: 70 } },
      { id: "p-arm-l", name: "arm_l", bounds: { x: 45, y: 70, width: 25, height: 55 } },
      { id: "p-arm-r", name: "arm_r", bounds: { x: 130, y: 70, width: 25, height: 55 } },
    ];
    const prompts = [
      "wave happily, then look at the button",
      "point at the card",
      "jump and celebrate",
      "nod politely",
      "sigh sadly",
      "wave and point",
      "look at the card and nod",
      "celebrate happily",
      "wave once",
      "point at the button and look",
    ];
    assert.equal(prompts.length, 10);
    for (const prompt of prompts) {
      const result = animateCharacterFromPrompt({
        doc,
        parts,
        prompt,
        targetLayerId: "hero",
        validateRules: rules.validate,
      });
      assert.equal(result.valid, true, `Character animation failed for "${prompt}": ${result.errors.join(", ")}`);
      assert.equal(result.visualCheck.passed, true);
    }
  });

  it("Phase 249: extracts layout/palette from image references and classifies >= 80% of 20 sampled video/GIF clips", () => {
    const imgProposal = authorFromImageReference(
      {
        sourceLabel: "hero-ref.png",
        dominantColors: ["#0f172a", "#38bdf8"],
        aspectRatio: 1.77,
        detectedBlocks: ["header", "hero", "cta"],
        userPermitted: true,
      },
      "hero",
    );
    assert.equal(imgProposal.layoutMode, "split");
    assert.equal(imgProposal.patches.length, 1);

    const clips: Array<{ expected: string; frames: Parameters<typeof classifySampledReferenceFrames>[0] }> = [
      ...Array.from({ length: 5 }, () => ({
        expected: "entrance",
        frames: [
          { timeMs: 0, translateY: 24, scale: 1, opacity: 0, rotateDeg: 0 },
          { timeMs: 400, translateY: 0, scale: 1, opacity: 1, rotateDeg: 0 },
        ],
      })),
      ...Array.from({ length: 5 }, () => ({
        expected: "attention",
        frames: [
          { timeMs: 0, translateY: 0, scale: 1, opacity: 1, rotateDeg: 0 },
          { timeMs: 220, translateY: 0, scale: 1.12, opacity: 1, rotateDeg: 0 },
          { timeMs: 450, translateY: 0, scale: 1, opacity: 1, rotateDeg: 0 },
        ],
      })),
      ...Array.from({ length: 5 }, () => ({
        expected: "ambient",
        frames: [
          { timeMs: 0, translateY: 0, scale: 1, opacity: 1, rotateDeg: 0 },
          { timeMs: 900, translateY: -10, scale: 1, opacity: 1, rotateDeg: 0 },
          { timeMs: 1800, translateY: 0, scale: 1, opacity: 1, rotateDeg: 0 },
        ],
      })),
      ...Array.from({ length: 5 }, () => ({
        expected: "hover",
        frames: [
          { timeMs: 0, translateY: 0, scale: 1, opacity: 1, rotateDeg: 0 },
          { timeMs: 240, translateY: 0, scale: 1.02, opacity: 1, rotateDeg: 12 },
        ],
      })),
    ];
    assert.equal(clips.length, 20);
    const hits = clips.filter((c) => classifySampledReferenceFrames(c.frames).category === c.expected).length;
    assert.ok(hits / clips.length >= 0.8);
  });

  it("Phase 250: MCP v1 covers 100% of commands, exposes inspection tools/resources/prompts, and logs activity", () => {
    useMcpActivityStore.getState().clear();
    const doc = buildStudioTestDoc();
    const tools = buildMcpToolRegistry(DEFAULT_PHASE13_COMMAND_CATALOG);
    const coverage = computeMcpCommandCoverage(DEFAULT_PHASE13_COMMAND_CATALOG, tools);
    assert.equal(coverage.missingCommands.length, 0);

    const server = createMcpServer({
      getDocument: () => doc,
      validateRules: rules.validate,
      commands: DEFAULT_PHASE13_COMMAND_CATALOG,
    });
    assert.equal(server.getCoverage().missingCommands.length, 0);
    assert.ok(MCP_RESOURCES.length >= 3);
    assert.ok(MCP_PROMPTS.length >= 2);

    const validation = server.callTool("validate_document", {}) as { ok: boolean };
    assert.equal(validation.ok, true);
    const swept = server.callTool("run_playground_sweep", { effectId: "fx_magnetic_pull" }) as {
      checkpoints: Array<{ withinBudget: boolean }>;
    };
    assert.equal(swept.checkpoints.every((c) => c.withinBudget), true);

    const logEntries = useMcpActivityStore.getState().entries;
    assert.ok(logEntries.length >= 2);
  });

  it("stages real runnable cursor-pull bindings and clip animations for magnetic pull & bouncier/calmer edits", () => {
    const doc = buildStudioTestDoc();
    const layers = Object.values(doc.layers).map((layer) => ({
      id: layer.id,
      name: layer.name,
      type: layer.archetype,
      parentId: layer.parentId,
      childCount: layer.children.length,
      propsSample: layer.properties,
    }));

    // Even with a typo ("megnatic") and no selection, planner targets the button and creates cursor bindings
    const plan = planBuilderTurn({
      prompt: "Add a megnatic pull to the button towards the cursor",
      documentContext: {
        documentName: "Magnetic Test",
        activeMode: "design",
        layerCount: layers.length,
        clipCount: 0,
        selectedIds: [],
        layers,
      },
    });
    assert.deepEqual(plan.targetLayerIds, ["button"]);
    assert.ok(plan.patches.some((p) => p.path.startsWith("/bindings/")));
    const appliedPlan = applyMdmJsonPatches(doc, plan.patches);
    assert.equal(appliedPlan.ok, true);
    if (appliedPlan.ok) {
      const checked = validateMotionDocument(appliedPlan.document);
      assert.equal(checked.ok, true);
      if (checked.ok) {
        assert.equal(rules.validate(checked.document).length, 0);
        assert.ok(Object.keys(checked.document.bindings ?? {}).length >= 2);
      }
    }

    // Co-pilot Bouncier & Calmer produce real animated clips on the selection
    const bouncy = runSelectionScopedEdit(doc, ["button"], "Make the selected animation bouncier", rules.validate);
    assert.equal(bouncy.accepted, true);
    assert.ok(bouncy.patches.some((p) => p.path.startsWith("/clips/")));
    const appliedBouncy = applyMdmJsonPatches(doc, bouncy.patches);
    assert.equal(appliedBouncy.ok, true);
    if (appliedBouncy.ok) {
      assert.equal(validateMotionDocument(appliedBouncy.document).ok, true);
    }

    const calmer = runSelectionScopedEdit(doc, ["button"], "Make this motion calmer on mobile", rules.validate);
    assert.equal(calmer.accepted, true);
    assert.ok(calmer.patches.some((p) => p.path.startsWith("/clips/")));
  });
});

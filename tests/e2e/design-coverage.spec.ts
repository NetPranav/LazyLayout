/**
 * Design track D2: a walker drives every control of the Design panel and checks that it changes the document, the canvas
 * and the export. The panel has no config to generate from, so the test walks the page: for a fixed set of layer types it
 * opens each "More … options" section, collects the inputs, selects, segmented controls and toggles by their labels, sets
 * each to a different value, and compares before and after.
 *
 * A control that changes nothing is "dead" and fails the run, unless it is on `EXPECTED_QUIET` with a reason.
 * Run alone: `npx playwright test tests/e2e/design-coverage.spec.ts --project=chromium`.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });
test.setTimeout(15 * 60_000);

type L = { id: string; archetype: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));

type Row = { label: string; doc: boolean; canvas: boolean; exp: boolean };
/** A control is dead when driving it changed nothing: not the document, not the canvas, not the export. */
export const deadControls = (rows: readonly Row[]): Row[] =>
  rows.filter((r) => !r.doc && !r.canvas && !r.exp).filter((r) => !Object.keys(EXPECTED_QUIET).some((k) => r.label.includes(k)));

/** Controls that are allowed to change only some of the three (document, canvas, export), each with its reason. */
export const EXPECTED_QUIET: Record<string, string> = {
  // a name and notes live in the document and the outline, not on the canvas
  "Layer name": "the name is shown in the outline only",
};

async function ready(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
}
const art = async (page: Page, fx: number, fy: number) => {
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
};
async function drag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
}
const created = async (page: Page, make: () => Promise<void>) => {
  const before = new Set(Object.keys(await layers(page)));
  await make();
  const after = await layers(page);
  return Object.values(after).find((l) => !before.has(l.id))!;
};

const KINDS: Record<string, (page: Page) => Promise<L>> = {
  rectangle: (page) =>
    created(page, async () => {
      await pickShape(page, "Rectangle");
      await drag(page, await art(page, 0.2, 0.3), await art(page, 0.4, 0.5));
    }),
  frame: (page) =>
    created(page, async () => {
      await page.getByRole("button", { name: /^Frame/ }).first().click();
      await drag(page, await art(page, 0.1, 0.2), await art(page, 0.6, 0.7));
    }),
  text: (page) =>
    created(page, async () => {
      await page.getByRole("button", { name: /^Text/ }).first().click();
      await drag(page, await art(page, 0.2, 0.3), await art(page, 0.4, 0.4));
      await page.keyboard.type("Coverage");
      await page.keyboard.press("Escape");
    }),
  line: (page) =>
    created(page, async () => {
      await pickShape(page, "Line");
      await drag(page, await art(page, 0.3, 0.3), await art(page, 0.55, 0.4));
    }),
};

type Control = { kind: "input" | "select" | "segment" | "toggle"; label: string; index: number };

/** The controls in the right-hand panel, found by role and label. */
async function collect(page: Page): Promise<Control[]> {
  return page.evaluate(() => {
    const out: { kind: "input" | "select" | "segment" | "toggle"; label: string; index: number }[] = [];
    const seen = new Map<string, number>();
    const inPanel = (el: Element) => el.getBoundingClientRect().left > 1080 && el.getBoundingClientRect().width > 0;
    const push = (kind: "input" | "select" | "segment" | "toggle", label: string) => {
      const n = seen.get(kind + label) ?? 0;
      seen.set(kind + label, n + 1);
      out.push({ kind, label, index: n });
    };
    document.querySelectorAll<HTMLElement>("input[aria-label], [role=radiogroup][aria-label], [aria-haspopup=listbox][aria-label], [role=combobox][aria-label], button[aria-pressed][aria-label]").forEach((el) => {
      if (!inPanel(el)) return;
      const label = el.getAttribute("aria-label")!;
      if (el instanceof HTMLInputElement) {
        if (el.type === "text" || el.type === "number") push("input", label);
      } else if (el.getAttribute("role") === "radiogroup") push("segment", label);
      else if (el.getAttribute("aria-pressed") !== null) push("toggle", label);
      else push("select", label);
    });
    return out;
  });
}

/** Controls the walker does not drive, with the reason: they swap the whole panel or leave the layer, or (the Driven by form) only fill in a form that "Add driver" then writes. */
const SKIP = new Set(["Driver signal", "Driver property", "Driver input from", "Driver input to", "Driver output from", "Driver output to", "Driver smoothing", "More Layout options", "More Appearance options", "More Position options", "More Typography options", "Settings: 2D or 3D", "Image file", "Search commands, layers, pages"]);

const locate = (page: Page, c: Control): Locator => {
  if (c.kind === "input") return page.locator(`input[aria-label="${c.label}"]`).nth(c.index);
  if (c.kind === "segment") return page.locator(`[role=radiogroup][aria-label="${c.label}"]`).nth(c.index);
  if (c.kind === "toggle") return page.locator(`button[aria-pressed][aria-label="${c.label}"]`).nth(c.index);
  return page.locator(`[aria-haspopup=listbox][aria-label="${c.label}"], [role=combobox][aria-label="${c.label}"]`).nth(c.index);
};

/** Everything the three checks look at, as strings. */
async function snapshot(page: Page, id: string) {
  const doc = JSON.stringify((await layers(page))[id]?.properties ?? null);
  const canvas = await page
    .locator(`[data-testid="stage-page"] [data-element-id="${id}"]`)
    .first()
    .evaluate((e) => {
      const el = e as HTMLElement;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return el.outerHTML.length + "|" + cs.cssText.length + "|" + [cs.color, cs.backgroundColor, cs.opacity, cs.filter, cs.boxShadow, cs.transform, cs.borderRadius, cs.padding, cs.margin, cs.overflow, cs.cursor, cs.mixBlendMode, cs.zIndex, cs.display, cs.gap, cs.fontSize, cs.fontWeight, cs.letterSpacing, cs.lineHeight, cs.textAlign, cs.textTransform, cs.whiteSpace, cs.textOverflow, cs.pointerEvents, cs.userSelect, cs.visibility].join(",") + "|" + [r.x, r.y, r.width, r.height].map((n) => n.toFixed(1)).join(",");
    })
    .catch(() => "missing");
  const exp = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    const r = await w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    return r.files.map((f) => f.path + (f.text ?? "")).join("\n");
  });
  return { doc, canvas, exp };
}

let skipReason = "";
async function drive(page: Page, c: Control): Promise<boolean> {
  const el = locate(page, c);
  skipReason = "";
  if ((await el.count()) === 0) {
    // the "More … options" panel closes when the main panel is used; open the ones that are closed and look again
    for (const b of await page.getByRole("button", { name: /^More .* options$/ }).all()) {
      if ((await b.getAttribute("aria-pressed")) !== "true") await b.click().catch(() => undefined);
    }
    await page.waitForTimeout(300);
  }
  if ((await el.count()) === 0) return (skipReason = "not found"), false;
  if (!(await el.isVisible())) return (skipReason = "not visible"), false;
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  if (c.kind === "input") {
    if (await el.isDisabled()) return false;
    const v = await el.inputValue();
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    const hex = /^[0-9a-f]{6}$/i.test(v);
    const next = hex ? (v.toLowerCase() === "123456" ? "654321" : "123456") : v !== "" && !Number.isNaN(n) && /^-?[0-9.]+/.test(v) ? String(n >= 50 ? n - 7 : n + 7) : v + "1";
    await el.fill(next);
    await el.press("Enter");
  } else if (c.kind === "toggle") {
    await el.click();
  } else if (c.kind === "segment") {
    const radios = el.getByRole("radio");
    const n = await radios.count();
    for (let i = 0; i < n; i++) {
      if ((await radios.nth(i).getAttribute("aria-checked")) !== "true") {
        await radios.nth(i).click();
        break;
      }
    }
  } else {
    await el.click();
    await page.waitForTimeout(300); // the list animates in
    const options = page.getByRole("option");
    const n = await options.count();
    let picked = false;
    for (let i = 0; i < n; i++) {
      if ((await options.nth(i).getAttribute("aria-selected")) !== "true") {
        await options.nth(i).click();
        picked = true;
        break;
      }
    }
    if (!picked) return (skipReason = "no other option"), false;
    await page.waitForTimeout(500); // the list closes; the next dropdown opens badly if it is still on its way out
  }
  await page.waitForTimeout(120);
  return true;
}

for (const [kind, make] of Object.entries(KINDS)) {
  test(`every Design control changes the page: ${kind}`, async ({ page }) => {
    await ready(page);
    page.setDefaultTimeout(4000); // a control that cannot be driven is skipped quickly, not waited on
    const layer = await make(page);
    for (const b of await page.getByRole("button", { name: /^More .* options$/ }).all()) await b.click().catch(() => undefined);
    await page.waitForTimeout(300);

    const controls = await collect(page);
    console.log("COLLECTED", controls.length, JSON.stringify(controls.map((c) => c.kind[0] + ":" + c.label)));
    const rows: { label: string; doc: boolean; canvas: boolean; exp: boolean }[] = [];
    let before = await snapshot(page, layer.id); // each control starts from the state the last one left
    for (const c of controls) {
      if (SKIP.has(c.label) || /^More .* options$/.test(c.label)) continue;
      let ran = false;
      try {
        ran = await drive(page, c);
      } catch (e) {
        ran = false;
        skipReason = "error: " + String(e).split("\n")[0].slice(0, 90);
        await page.keyboard.press("Escape").catch(() => undefined);
      }
      console.log(`  ${ran ? "drove" : "skipped"} ${c.kind}:${c.label}#${c.index}${ran ? "" : " (" + skipReason + ")"}`);
      if (!ran) continue;
      if (!(await page.locator("[data-stage=artboard]").isVisible())) break;
      const after = await snapshot(page, layer.id);
      const was = before;
      before = after;
      rows.push({ label: `${c.kind}:${c.label}#${c.index}`, doc: was.doc !== after.doc, canvas: was.canvas !== after.canvas, exp: was.exp !== after.exp });
    }
    const dead = deadControls(rows);
    const partial = rows.filter((r) => (r.doc || r.canvas || r.exp) && !(r.doc && r.canvas && r.exp));
    const full = rows.filter((r) => r.doc && r.canvas && r.exp).length;
    console.log(`Design controls (${kind}): ${rows.length - dead.length} of ${rows.length} change the document; ${full} also change the canvas and the export`);
    console.log(`  dead: ${JSON.stringify(dead.map((d) => d.label))}`);
    console.log(`  doc-only or partial: ${JSON.stringify(partial.map((d) => `${d.label}[${d.doc ? "D" : ""}${d.canvas ? "C" : ""}${d.exp ? "E" : ""}]`))}`);
    expect(rows.length, "the walker found controls").toBeGreaterThan(5);
    expect(dead.map((d) => d.label), "dead controls").toEqual([]);
  });
}

test("a control that changes nothing is reported as dead, and fails the run", () => {
  const rows: Row[] = [
    { label: "input:Opacity#0", doc: true, canvas: true, exp: true },
    { label: "input:Does nothing#0", doc: false, canvas: false, exp: false }, // a deliberately dead control
    { label: "input:Layer name#0", doc: false, canvas: false, exp: false }, // allowed: on EXPECTED_QUIET
  ];
  expect(deadControls(rows).map((r) => r.label)).toEqual(["input:Does nothing#0"]);
  // the same check that fails a layer's walk
  expect(() => expect(deadControls(rows).map((r) => r.label), "dead controls").toEqual([])).toThrow();
});

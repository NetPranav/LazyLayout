/**
 * ROADMAP Phase 128: 3D arrangements. For each of the 7 arrangements (ring, dome, helix, sphere, cylinder, wall,
 * stack), eight cards placed in a 2.5D space seen at an angle land within 0.5 px of the reference: each card's box on
 * screen is the bounding box of its corners projected by CSS 3D's own formula (the space's perspective and view about
 * its vanishing point, then the card's turn and depth about its centre), worked out here apart from the browser. The
 * exported site places every card the same. And the Arrange group in the inspector makes a carousel in one click.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const KINDS = ["ring", "dome", "helix", "sphere", "cylinder", "wall", "stack"] as const;
const SW = 600;
const SH = 500;
const P = 1200;
const VIEW = { x: 10, y: -15 };
const N = 8;

const run = (page: Page, id: string, args: unknown) =>
  page.evaluate(({ id, args }) => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === id)!.run(args), { id, args });

type M = number[]; // 4x4, column-major like CSS
const mul = (a: M, b: M): M => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const I = (): M => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const T = (x: number, y: number, z: number): M => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const RX = (d: number): M => {
  const a = (d * Math.PI) / 180;
  return [1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1];
};
const RY = (d: number): M => {
  const a = (d * Math.PI) / 180;
  return [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
};
const PERSP = (p: number): M => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / p, 0, 0, 0, 1];
const apply = (m: M, x: number, y: number) => {
  const X = m[0] * x + m[4] * y + m[12];
  const Y = m[1] * x + m[5] * y + m[13];
  const W = m[3] * x + m[7] * y + m[15];
  return { x: X / W, y: Y / W };
};

/** Each card's box on screen, from the space's top left, by CSS 3D's formula. */
function reference(cards: { props: Record<string, number>; w: number; h: number }[]) {
  // the space: perspective and view about its vanishing point (its middle)
  const O = { x: SW / 2, y: SH / 2 };
  const space = mul(mul(T(O.x, O.y, 0), mul(mul(PERSP(P), RX(VIEW.x)), RY(VIEW.y))), T(-O.x, -O.y, 0));
  return cards.map(({ props, w, h }) => {
    const cx = props["frame.x"] + w / 2;
    const cy = props["frame.y"] + h / 2;
    const own = mul(mul(T(cx, cy, 0), mul(mul(RX(props["transform.rotateX"] ?? 0), RY(props["transform.rotateY"] ?? 0)), T(0, 0, props["transform.translateZ"] ?? 0))), T(-w / 2, -h / 2, 0));
    const m = mul(space, own);
    const pts = [apply(m, 0, 0), apply(m, w, 0), apply(m, w, h), apply(m, 0, h)];
    return { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)), r: Math.max(...pts.map((p) => p.x)), b: Math.max(...pts.map((p) => p.y)) };
  });
}

/** The cards' boxes on screen from the space's untransformed top left, found by their size (each is a different size). */
async function measured(pg: Page, spaceSel: string) {
  return pg.evaluate(({ spaceSel, N }) => {
    const space = document.querySelector<HTMLElement>(spaceSel)!;
    const was = space.style.transform;
    space.style.transform = "none";
    const o = space.getBoundingClientRect();
    space.style.transform = was;
    const out: Record<string, { x: number; y: number; r: number; b: number }> = {};
    // each card is a rectangle drawn as an <svg> of its own size
    for (const el of space.querySelectorAll<SVGSVGElement>("svg")) {
      const w = Number(el.getAttribute("width"));
      const h = Number(el.getAttribute("height"));
      if (w >= 60 && w < 60 + N && h === w - 20) {
        const r = el.getBoundingClientRect();
        out[w] = { x: r.left - o.left, y: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top };
      }
    }
    return out;
  }, { spaceSel, N });
}

test("7 arrangements place every card within 0.5 px of the reference; the export places them the same", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const failures: string[] = [];
  let worst = 0;
  for (const kind of KINDS) {
    const { space, cards } = await page.evaluate(({ SW, SH, N }) => {
      const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
      const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
      for (const c of [...doc.get().layers[frame.id].children]) doc.commands.removeLayer(c);
      const space = doc.commands.addLayer({ archetype: "container", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 300, "frame.y": 200, "frame.width": SW, "frame.height": SH, "appearance.background.color": "#e2e8f0" } });
      const cards = Array.from({ length: N }, (_, i) => doc.commands.addLayer({ archetype: "rectangle", parentId: space, properties: { positioning: "absolute", "frame.width": 60 + i, "frame.height": 40 + i, "svg.fill": "#2563eb", "svg.strokeWidth": 0 } }));
      return { space, cards };
    }, { SW, SH, N });
    await run(page, "space.arrange", { id: space, kind, radius: 160, spacing: 50, facing: kind === "wall" || kind === "stack" ? "viewer" : "outward" });
    await run(page, "space.set", { id: space, perspective: P, viewX: VIEW.x, viewY: VIEW.y });
    await page.evaluate(() => (window as unknown as { __LL_SELECT__?: (id: string | null) => void }).__LL_SELECT__?.(null));
    await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: () => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "view.zoom100")!.run());
    await page.waitForTimeout(250);

    const props = await page.evaluate((cards) => cards.map((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties), cards);
    const ref = reference(props.map((p, i) => ({ props: p as Record<string, number>, w: 60 + i, h: 40 + i })));
    const got = await measured(page, `[data-stage=artboard] [data-archetype][data-element-id="${space}"]`);
    ref.forEach((r, i) => {
      const g = got[60 + i];
      if (!g) return failures.push(`${kind} card ${i + 1}: not drawn`);
      const off = Math.max(Math.abs(g.x - r.x), Math.abs(g.y - r.y), Math.abs(g.r - r.r), Math.abs(g.b - r.b));
      worst = Math.max(worst, off);
      if (off > 0.5) failures.push(`${kind} card ${i + 1}: ${off.toFixed(2)} px from the reference`);
    });

    // the export
    const files = await page.evaluate(async () => {
      const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
      return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => ({ path: f.path, text: f.text ?? "" }));
    });
    const site = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await site.route("http://export.test/**", (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "index.html";
      const f = files.find((x) => x.path === path || x.path.endsWith("/" + path));
      return f ? route.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : "text/html", body: f.text }) : route.fulfill({ status: 404, body: "" });
    });
    await site.goto(`http://export.test/${files.find((f) => f.path.endsWith("index.html"))!.path}`);
    await site.evaluate(({ SW, SH }) => {
      const el = [...document.querySelectorAll<HTMLElement>("body *")].find((e) => e.offsetWidth === SW && e.offsetHeight === SH);
      if (el) el.dataset.testSpace = "";
    }, { SW, SH });
    const exp = await measured(site, "[data-test-space]");
    await site.close();
    for (let i = 0; i < N; i++) {
      const a = got[60 + i];
      const b = exp[60 + i];
      if (!a || !b) {
        failures.push(`${kind} card ${i + 1}: missing in the export`);
        continue;
      }
      const off = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.r - b.r), Math.abs(a.b - b.b));
      if (off > 0.5) failures.push(`${kind} card ${i + 1}: the export is ${off.toFixed(2)} px off the canvas`);
    }
  }
  console.log(`3D arrangements: worst card ${worst.toFixed(3)} px from the reference`);
  expect(failures).toEqual([]);
});

test("a carousel of cards in one click from the inspector; each card stays its own layer", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const { group, cards } = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const group = doc.commands.addLayer({ archetype: "container", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 200, "frame.y": 150, "frame.width": 500, "frame.height": 360 } });
    const cards = Array.from({ length: 6 }, () => doc.commands.addLayer({ archetype: "image", parentId: group, properties: { positioning: "absolute", "frame.width": 120, "frame.height": 160 } }));
    return { group, cards };
  });
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), group);
  await page.getByRole("button", { name: "Arrange 6 in 3D" }).click();
  const props = (id: string) => page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties, id);
  await expect.poll(async () => (await props(group))["transform.style3d"]).toBe("preserve3d");
  const yaws = await Promise.all(cards.map(async (c) => Number((await props(c))["transform.rotateY"] ?? 0)));
  expect(yaws.map((y) => Math.round(((y % 360) + 360) % 360))).toEqual([0, 60, 120, 180, 240, 300]);
  for (const c of cards) expect((await props(c))["transform.translateZ"]).toBe(300);
  // still real layers: each one selectable and editable
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), cards[2]);
  await expect(page.getByLabel("Depth in space value")).toHaveValue("300");
});

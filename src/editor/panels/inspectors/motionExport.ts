import {
  type Composition,
  type MotionLayer,
  type PropTrack,
  type Keyframe,
  type PropId,
  PROPS,
  PORD,
  bezierOf,
  springX,
  valueAt,
  type Bezier,
  type SpringParams,
} from "@/editor/motion-model";

const DEFAULT_SPRING: SpringParams = { response: 0.35, damping: 0.6 };

function xr(v: number): number {
  return Number(Number(v).toFixed(3));
}

function xs(f: number, fps: number): number {
  return xr(f / fps);
}

function xcls(l: MotionLayer): string {
  return "ll-" + l.id;
}

function xlin(k: Keyframe, sec: number): string {
  const n = 20;
  const p: number[] = [];
  const sp = k.spring ?? DEFAULT_SPRING;
  for (let i = 0; i <= n; i++) {
    p.push(i === n ? 1 : xr(springX(sp, (i / n) * sec)));
  }
  return "linear(" + p.join(", ") + ")";
}

function xez(k: Keyframe, sec: number): string {
  if (k.ease === "Spring") return xlin(k, sec);
  if (k.ease === "Linear") return "linear";
  return "cubic-bezier(" + bezierOf(k).map(xr).join(", ") + ")";
}

function xnum(v: string | number): string | number {
  return isNaN(Number(v)) ? `"${v}"` : Number(v);
}

function xval(prop: string, v: number): string {
  return prop === "opacity" || prop === "scale" ? String(xr(v / 100)) : xr(v) + "deg";
}

const XPROP: Partial<Record<PropId, string>> = {
  opacity: "opacity",
  scale: "scale",
  rot: "rotate",
};

interface ExportChannel {
  prop: string;
  delay: number;
  dur: number;
  keys: {
    pct: number;
    val: string;
    ez: string;
  }[];
}

function xchan(l: MotionLayer, trs: PropTrack[], prop: string, fps: number): ExportChannel {
  const ts: number[] = [];
  const off = l.stag ? l.stag / 1000 : 0;

  trs.forEach((tr) => {
    tr.keys.forEach((k) => {
      if (!ts.includes(k.t)) ts.push(k.t);
    });
  });
  ts.sort((a, b) => a - b);

  const a = ts[0] ?? 0;
  const b = ts[ts.length - 1] ?? 1;

  return {
    prop,
    delay: xs(a, fps) + off,
    dur: xs(b - a, fps),
    keys: ts.map((t, i) => {
      let own: Keyframe | null = null;
      const seg = i < ts.length - 1 ? (ts[i + 1] - t) / fps : 0;

      trs.forEach((tr) => {
        if (!own) own = tr.keys.find((k) => k.t === t) ?? null;
      });
      if (!own) {
        own = trs[0].keys.filter((k) => k.t < t).pop() ?? trs[0].keys[0];
      }

      let valStr = "";
      if (prop === "translate") {
        const xTr = trs.find((q) => q.p === "x");
        const yTr = trs.find((q) => q.p === "y");
        const vx = xTr ? valueAt(l, "x", t) : 0;
        const vy = yTr ? valueAt(l, "y", t) : 0;
        valStr = `${xr(vx)}px ${xr(vy)}px`;
      } else {
        valStr = xval(prop, valueAt(l, trs[0].p, t));
      }

      return {
        pct: xr(((t - a) / (b - a || 1)) * 100),
        val: valStr,
        ez: xez(own, seg),
      };
    }),
  };
}

function xchans(l: MotionLayer, fps: number): ExportChannel[] {
  const out: ExportChannel[] = [];
  const xy: PropTrack[] = [];

  l.tr.forEach((tr) => {
    if (tr.keys.length < 2) return;
    if (tr.p === "x" || tr.p === "y") {
      xy.push(tr);
      return;
    }
    const propName = XPROP[tr.p];
    if (propName) {
      out.push(xchan(l, [tr], propName, fps));
    }
  });

  if (xy.length) {
    out.push(xchan(l, xy, "translate", fps));
  }
  return out;
}

function xlayers(comp: Composition): MotionLayer[] {
  return comp.layers.filter(
    (l) => !l.mute && l.tr.some((t) => t.keys.length > 1)
  );
}

function xcount(l: MotionLayer): string | number {
  return l.rep === "Once" ? 1 : l.rep === "Forever" ? "Infinity" : l.rn;
}

// 1. Generate CSS
export function genCSS(comp: Composition): string {
  const ls = xlayers(comp);
  const fps = comp.fps;
  if (!ls.length) {
    return `/* Lazy Layout animation, ${xs(comp.dur, fps)}s at ${fps} fps */\n/* Nothing is animated yet. Add keyframes in the timeline. */`;
  }

  const o: string[] = [`/* Lazy Layout animation, ${xs(comp.dur, fps)}s at ${fps} fps */`];
  const rm: string[] = [];

  ls.forEach((l) => {
    const chs = xchans(l, fps);
    const c = "." + xcls(l);
    const pre = l.trig === "On hover" ? ":hover" : l.trig === "On click" ? ":active" : "";
    const scroll = l.trig.includes("scroll");
    const an: string[] = [];

    o.push("");
    chs.forEach((ch) => {
      const nm = `${l.id}-${ch.prop}`;
      o.push(`@keyframes ${nm} {`);
      ch.keys.forEach((k, i) => {
        const timing = i < ch.keys.length - 1 ? ` animation-timing-function: ${k.ez};` : "";
        o.push(`  ${k.pct}% { ${ch.prop}: ${k.val};${timing} }`);
      });
      o.push("}");
      const iter = l.rep === "Once" ? "1" : l.rep === "Forever" ? "infinite" : String(l.rn);
      const dir = l.rep !== "Once" && l.yoyo ? "alternate" : "normal";
      an.push(`${nm} ${ch.dur}s linear ${ch.delay}s ${iter} ${dir} both`);
    });

    o.push("");
    o.push(`${c}${pre} {`);
    o.push("  animation:");
    an.forEach((a, i) => {
      o.push(`    ${a}${i < an.length - 1 ? "," : ";"}`);
    });
    if (scroll) {
      o.push(`  /* Start ${l.ss}, end ${l.se}, scrub ${l.scrub ? "on" : "off"}, pin ${l.pin ? "on" : "off"}${l.pin ? " (wrap the section in position: sticky)" : ""} */`);
      o.push("  animation-timeline: view();");
      o.push(`  animation-range: ${l.trig === "While scrolling" ? "entry 0% exit 100%" : "entry 0% cover 40%"};`);
    }
    o.push("}");
    rm.push(c + pre);
  });

  o.push("");
  o.push("@media (prefers-reduced-motion: reduce) {");
  o.push(`  ${rm.join(",\n  ")} {`);
  o.push("    animation: none;");
  o.push("  }");
  o.push("}");

  return o.join("\n");
}

// 2. Generate WAAPI
export function genWAAPI(comp: Composition): string {
  const ls = xlayers(comp);
  const fps = comp.fps;
  if (!ls.length) {
    return `// Lazy Layout animation, ${xs(comp.dur, fps)}s at ${fps} fps\n// Nothing is animated yet. Add keyframes in the timeline.`;
  }

  const o: string[] = [
    `// Lazy Layout animation, ${xs(comp.dur, fps)}s at ${fps} fps`,
    'const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;',
    "",
    "export const layers = {",
  ];
  const tr: string[] = [];
  let view = false;

  ls.forEach((l) => {
    o.push(`  ${l.id}() {`, `    const el = document.querySelector(".${xcls(l)}");`);
    xchans(l, fps).forEach((ch) => {
      o.push("    el?.animate(", "      [");
      ch.keys.forEach((k, i) => {
        const ez = i < ch.keys.length - 1 ? `, easing: "${k.ez}"` : "";
        o.push(`        { offset: ${xr(k.pct / 100)}, ${ch.prop}: ${xnum(k.val)}${ez} },`);
      });
      const dir = l.rep !== "Once" && l.yoyo ? ', direction: "alternate"' : "";
      o.push(
        "      ],",
        `      { duration: ${Math.round(ch.dur * 1000)}, delay: ${Math.round(ch.delay * 1000)}, fill: "both", iterations: ${xcount(l)}${dir} },`,
        "    );"
      );
    });
    o.push("  },");

    if (l.trig === "On load") {
      tr.push(`  layers.${l.id}();`);
    } else if (l.trig === "On hover" || l.trig === "On click") {
      const ev = l.trig === "On hover" ? "mouseenter" : "click";
      tr.push(`  document.querySelector(".${xcls(l)}")?.addEventListener("${ev}", layers.${l.id});`);
    } else {
      view = true;
      tr.push(`  onView(".${xcls(l)}", layers.${l.id});`);
    }
  });

  o.push("};", "");
  if (view) {
    o.push(
      "function onView(selector: string, run: () => void) {",
      '  const el = document.querySelector(selector);',
      "  if (!el) return;",
      "  new IntersectionObserver(([entry], io) => {",
      "    if (entry.isIntersecting) { run(); io.disconnect(); }",
      '  }, { rootMargin: "0px 0px -20% 0px" }).observe(el);',
      "}",
      ""
    );
  }

  o.push("if (!reduced) {");
  tr.forEach((t) => o.push(t));
  o.push("}");

  return o.join("\n");
}

// 3. Generate Framer Motion
const XFM: Record<PropId, string> = {
  opacity: "opacity",
  x: "x",
  y: "y",
  scale: "scale",
  rot: "rotate",
};

function xtv(p: PropId, v: number): number {
  return p === "opacity" || p === "scale" ? xr(v / 100) : xr(v);
}

function xspring(k: Keyframe, sec: number, fns: string[]): string {
  const sp = k.spring ?? DEFAULT_SPRING;
  const w = (2 * Math.PI) / sp.response;
  const z = sp.damping;
  const wd = w * Math.sqrt(Math.max(1e-6, 1 - z * z));
  const nm = "spring" + fns.length;
  const body =
    z >= 0.999
      ? `1 - Math.exp(-${xr(w)} * t) * (1 + ${xr(w)} * t)`
      : `1 - Math.exp(-${xr(z * w)} * t) * (Math.cos(${xr(wd)} * t) + ${xr((z * w) / wd)} * Math.sin(${xr(wd)} * t))`;
  fns.push(`const ${nm} = (u: number) => { const t = u * ${xr(sec)}; return u >= 1 ? 1 : ${body}; };`);
  return nm;
}

export function genFM(comp: Composition): string {
  const ls = xlayers(comp);
  const fps = comp.fps;
  if (!ls.length) {
    return `// Lazy Layout animation, ${xs(comp.dur, fps)}s at ${fps} fps\n// Nothing is animated yet. Add keyframes in the timeline.`;
  }

  const o: string[] = [
    `// Lazy Layout animation, ${xs(comp.dur, fps)}s at ${fps} fps`,
    "// Spread a layer onto a motion element: <motion.div {...headline} />",
    '// Wrap the app in <MotionConfig reducedMotion="user"> to respect prefers-reduced-motion.',
    'import type { MotionProps } from "framer-motion";',
    "",
  ];
  const fns: string[] = [];
  const body: string[] = [];

  ls.forEach((l) => {
    const key =
      l.trig === "On load"
        ? "animate"
        : l.trig === "On hover"
        ? "whileHover"
        : l.trig === "On click"
        ? "whileTap"
        : "whileInView";
    const off = l.stag ? l.stag / 1000 : 0;
    const init: string[] = [];
    const vals: string[] = [];
    const tx: string[] = [];
    const view = key === "whileInView";

    l.tr.forEach((tr) => {
      const ks = tr.keys;
      if (ks.length < 2) return;
      const a = ks[0].t;
      const b = ks[ks.length - 1].t;
      const p = XFM[tr.p];
      const ez: string[] = [];

      init.push(`${p}: ${xtv(tr.p, ks[0].v)}`);
      vals.push(`    ${p}: [${ks.map((k) => xtv(tr.p, k.v)).join(", ")}],`);

      ks.forEach((k, i) => {
        if (i === ks.length - 1) return;
        const sec = (ks[i + 1].t - k.t) / fps;
        ez.push(
          k.ease === "Spring"
            ? xspring(k, sec, fns)
            : k.ease === "Linear"
            ? '"linear"'
            : `[${bezierOf(k).map(xr).join(", ")}]`
        );
      });

      const rep =
        l.rep !== "Once"
          ? `, repeat: ${l.rep === "Forever" ? "Infinity" : l.rn - 1}, repeatType: "${l.yoyo ? "reverse" : "loop"}"`
          : "";
      tx.push(
        `      ${p}: { duration: ${xs(b - a, fps)}, delay: ${xs(a, fps) + off}, times: [${ks.map((k) => xr((k.t - a) / (b - a || 1))).join(", ")}], ease: [${ez.join(", ")}]${rep} },`
      );
    });

    body.push(
      `export const ${l.id}: MotionProps = {`,
      `  initial: { ${init.join(", ")} },`,
      `  ${key}: {`
    );
    vals.forEach((v) => body.push(v));
    body.push("    transition: {");
    tx.forEach((t) => body.push(t));
    body.push("    },", "  },");
    if (view) body.push('  viewport: { once: true, margin: "0px 0px -20% 0px" },');
    if (l.trig === "While scrolling") {
      body.push("  // Scrub: drive these values with useScroll() and useTransform() instead.");
    }
    body.push("};", "");
  });

  return o.concat(fns.length ? fns.concat([""]) : [], body).join("\n").trimEnd();
}

// 4. Generate GSAP
const XGS: Record<PropId, string> = {
  opacity: "opacity",
  x: "x",
  y: "y",
  scale: "scale",
  rot: "rotation",
};

export function genGSAP(comp: Composition): string {
  const ls = xlayers(comp);
  const fps = comp.fps;
  if (!ls.length) {
    return `// Lazy Layout animation, ${xs(comp.dur, fps)}s at ${fps} fps\n// Nothing is animated yet. Add keyframes in the timeline.`;
  }

  let hasScroll = false;
  ls.forEach((l) => {
    if (l.trig.includes("scroll")) hasScroll = true;
  });

  const o: string[] = [
    `// Lazy Layout animation, ${xs(comp.dur, fps)}s at ${fps} fps`,
    'import gsap from "gsap";',
    'import { CustomEase } from "gsap/CustomEase";',
  ];
  if (hasScroll) {
    o.push('import { ScrollTrigger } from "gsap/ScrollTrigger";');
  }
  o.push(
    "",
    `gsap.registerPlugin(CustomEase${hasScroll ? ", ScrollTrigger" : ""});`,
    "",
    "const mm = gsap.matchMedia();",
    "",
    'mm.add("(prefers-reduced-motion: no-preference)", () => {'
  );

  const fns: string[] = [];
  const body: string[] = [];

  ls.forEach((l) => {
    const hold = l.trig === "On hover" || l.trig === "On click";
    const sc = l.trig.includes("scroll");
    const opts: string[] = [];
    const off = l.stag ? l.stag / 1000 : 0;
    const sel = `".${xcls(l)}"`;

    if (l.rep !== "Once") {
      opts.push(`repeat: ${l.rep === "Forever" ? -1 : l.rn - 1}`);
      if (l.yoyo) opts.push("yoyo: true");
    }
    if (hold) opts.push("paused: true");
    if (sc) {
      opts.push(
        `scrollTrigger: { trigger: ${sel}, start: "${l.ss}", end: "${l.se}", scrub: ${l.scrub}, pin: ${l.pin} }`
      );
    }

    body.push(`  const ${l.id} = gsap.timeline(${opts.length ? `{ ${opts.join(", ")} }` : ""});`);

    l.tr.forEach((tr) => {
      const ks = tr.keys;
      if (ks.length < 2) return;
      const p = XGS[tr.p];
      const a = ks[0].t;

      body.push(
        `  ${l.id}.to(${sel}, {`,
        "    keyframes: [",
        `      { ${p}: ${xtv(tr.p, ks[0].v)}, duration: 0 },`
      );

      ks.forEach((k, i) => {
        if (!i) return;
        const prev = ks[i - 1];
        const sec = (k.t - prev.t) / fps;
        const ez =
          prev.ease === "Spring"
            ? xspring(prev, sec, fns)
            : prev.ease === "Linear"
            ? '"none"'
            : `CustomEase.create("${l.id}-${p}-${i}", "${bezierOf(prev).map(xr).join(", ")}")`;
        body.push(
          `      { ${p}: ${xtv(tr.p, k.v)}, duration: ${xs(k.t - prev.t, fps)}, ease: ${ez} },`
        );
      });

      body.push("    ],", `  }, ${xs(a, fps) + off});`);
    });

    if (l.trig === "On hover" || l.trig === "On click") {
      const ev = l.trig === "On hover" ? "mouseenter" : "click";
      body.push(
        `  document.querySelector(${sel})?.addEventListener("${ev}", () => ${l.id}.restart());`
      );
    }
  });

  body.push("});");

  return o.concat(fns.length ? fns.concat([""]) : [], body).join("\n");
}

export type ExportFormat = "css" | "waapi" | "fm" | "gsap";

export interface ExportMeta {
  name: string;
  ext: string;
  dep: string;
  note: string;
  gen: (comp: Composition) => string;
}

export const EXPORT_FORMATS: Record<ExportFormat, ExportMeta> = {
  css: {
    name: "CSS",
    ext: "css",
    dep: "No dependencies",
    note: "Includes a prefers-reduced-motion media query that switches the animation off.",
    gen: genCSS,
  },
  waapi: {
    name: "WAAPI",
    ext: "ts",
    dep: "No dependencies",
    note: "Skips every animation when prefers-reduced-motion is set.",
    gen: genWAAPI,
  },
  fm: {
    name: "Framer Motion",
    ext: "ts",
    dep: "framer-motion",
    note: 'Respects prefers-reduced-motion through MotionConfig reducedMotion="user".',
    gen: genFM,
  },
  gsap: {
    name: "GSAP",
    ext: "ts",
    dep: "gsap",
    note: "Runs inside gsap.matchMedia(), so reduced motion gets no animation.",
    gen: genGSAP,
  },
};

/**
 * Home (`/`): editorial landing screen in the editor's own look (theme tokens, Geist, mono labels, hairlines, grain).
 * Big headline, three pillars (Design, Motion, Code), a large ghost logo that traces on hover of "Open Editor",
 * round theme swatches, a plain "Open Editor" text link and a GitHub link. The old launcher (`ProjectHub`) is kept but not mounted.
 */

import Link from "next/link";
import { HomeThemeDots } from "./HomeThemeDots";

const GITHUB_URL = "https://github.com/NetPranav/LazyLayout";
const LOGO_PATH = "M256 256H128L0 128H128ZM256 128H128L0 0H128Z";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1.1 -.1'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const PILLARS = [
  { n: "01", name: "Design", text: "Frames, auto layout and grid, pen and vector, fills, strokes and type on one canvas." },
  { n: "02", name: "Motion", text: "Keyframes, easing, markers and a single playback clock, right next to the layout." },
  { n: "03", name: "Code", text: "The real generated project, live as you edit. Export the repo as a zip." },
];

const CSS = `
.home{position:relative;box-sizing:border-box;min-height:100dvh;display:grid;grid-template-rows:auto 1fr auto auto;gap:0;padding:24px clamp(20px,4vw,56px) 28px;overflow:hidden;
  background-color:var(--ll-surface-canvas);color:var(--ll-text-primary);font-family:var(--ll-font-sans),system-ui,sans-serif;isolation:isolate}
.home::before{content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;background-image:${GRAIN};background-size:220px 220px;opacity:.07}
.home .mono{font:500 12px var(--ll-font-mono),monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--ll-text-muted)}
.home a{color:inherit;text-decoration:none;background:none;border:0;outline:none}
.home .top{display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1px solid var(--ll-border-color)}
.home .brand{display:flex;align-items:center;gap:10px;color:var(--ll-text-primary)}
.home .brand svg{width:22px;height:22px;fill:currentColor}
.home .top a:hover,.home .top a:focus-visible{color:var(--ll-text-primary)}
.home .ghost{position:absolute;z-index:-1;right:calc(-1 * clamp(16px,5vw,80px));top:50%;height:min(86vh,980px);aspect-ratio:1;transform:translateY(-46%);color:var(--ll-text-primary);pointer-events:none;overflow:visible}
.home .ghost .fl{fill:currentColor;opacity:.07}
.home .ghost .tr{fill:none;stroke:currentColor;stroke-width:1.1;stroke-linejoin:round;stroke-dasharray:100;stroke-dashoffset:100;opacity:0}
.home .hero{align-self:center;padding:6vh 0 4vh;max-width:min(1100px,92%)}
.home h1{margin:0;font-weight:200;font-size:clamp(46px,8.4vw,138px);line-height:.98;letter-spacing:-.045em}
.home h1 b{font-weight:600}
.home .lede{margin:26px 0 0;max-width:520px;font-size:clamp(15px,1.3vw,18px);line-height:1.5;color:var(--ll-text-muted);font-weight:400}
.home .pillars{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--ll-border-color)}
.home .pillar{padding:16px 24px 22px 0}
.home .pillar+.pillar{padding-left:24px;border-left:1px solid var(--ll-border-color)}
.home .pillar p{margin:10px 0 0;font-size:14px;line-height:1.5;color:var(--ll-text-primary);opacity:.82;max-width:34ch}
.home .foot{display:flex;justify-content:space-between;align-items:center;padding-top:20px;border-top:1px solid var(--ll-border-color);gap:20px}
.home-dots{display:flex;gap:12px}
.home-dot{width:22px;height:22px;padding:0;border-radius:50%;cursor:pointer;border:1px solid var(--ll-border-color);
  background:linear-gradient(135deg,var(--ll-surface-canvas) 50%,var(--ll-control-primary-bg) 50%);
  transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .2s}
.home-dot:hover{transform:scale(1.18)}
.home-dot[aria-checked="true"]{transform:scale(1.18);box-shadow:0 0 0 2px var(--ll-surface-canvas),0 0 0 3px var(--ll-text-primary)}
.home-dot:focus-visible{outline:none;box-shadow:0 0 0 2px var(--ll-surface-canvas),0 0 0 3px var(--ll-text-primary)}
.home a.open{display:inline-flex;align-items:center;gap:12px;font-size:clamp(20px,2.2vw,30px);font-weight:300;letter-spacing:-.02em;padding:6px 0}
.home a.open span{display:inline-block;transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.home a.open:hover span,.home a.open:focus-visible span{transform:translateX(6px)}
.home a.open:hover,.home a.open:focus-visible{text-decoration:underline;text-underline-offset:7px;text-decoration-thickness:1px}
@keyframes home-tr{0%{stroke-dashoffset:100;opacity:1}85%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
.home:has(.open:hover,.open:focus-visible) .ghost .tr{animation:home-tr 2s cubic-bezier(.65,0,.35,1) 1 forwards}
:root[data-motion="off"] .home-dot,:root[data-motion="off"] .home a.open span{transition:none}
:root[data-motion="off"] .home .ghost .tr{animation:none!important}
@media (prefers-reduced-motion:reduce){.home .ghost .tr{animation:none!important}}
@media (max-width:760px){
  .home .pillars{grid-template-columns:1fr}
  .home .pillar,.home .pillar+.pillar{padding:14px 0;border-left:0;border-top:1px solid var(--ll-border-color)}
  .home .pillar:first-child{border-top:0}
  .home .ghost{height:62vh;right:-22vw;top:38%}
  .home h1{font-size:clamp(44px,14vw,80px)}
  .home .foot{flex-direction:column-reverse;align-items:flex-start}
}
`;

export default function Home() {
  return (
    <main className="home">
      <style>{CSS}</style>
      <svg className="ghost" viewBox="0 0 256 256" aria-hidden="true">
        <path className="fl" d={LOGO_PATH} />
        <path className="tr" pathLength={100} d={LOGO_PATH} />
      </svg>

      <header className="top">
        <span className="brand mono">
          <svg viewBox="0 0 256 256" aria-hidden="true">
            <path d={LOGO_PATH} />
          </svg>
          Lazy Layout
        </span>
        <a className="mono" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </header>

      <section className="hero">
        <h1>
          Design it once.
          <br />
          Ship it <b>lazily.</b>
        </h1>
        <p className="lede">
          A visual studio for web pages and motion. Design on a canvas, animate on a timeline, and get clean code out.
        </p>
      </section>

      <section className="pillars" aria-label="What it does">
        {PILLARS.map((p) => (
          <div className="pillar" key={p.n}>
            <span className="mono">
              ({p.n}) — {p.name}
            </span>
            <p>{p.text}</p>
          </div>
        ))}
      </section>

      <footer className="foot">
        <HomeThemeDots />
        <Link className="open" href="/editor">
          Open Editor <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </main>
  );
}

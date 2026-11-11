/**
 * Home (`/`): one large static logo on a flat themed canvas with a fine grain, round theme swatches, a plain
 * "Open Editor" text link and a GitHub link. The logo plays its trace once on hover/focus of the logo or "Open Editor".
 * The old launcher (`ProjectHub`) is kept in the repo but not mounted.
 */

import Link from "next/link";
import { HomeThemeDots } from "./HomeThemeDots";

const GITHUB_URL = "https://github.com/NetPranav/LazyLayout";
const LOGO_PATH = "M256 256H128L0 128H128ZM256 128H128L0 0H128Z";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1.1 -.1'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const CSS = `
.home{position:relative;box-sizing:border-box;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:28px 32px 36px;
  background-color:var(--ll-surface-canvas);color:var(--ll-text-primary);font-family:var(--ll-font-sans),system-ui,sans-serif;isolation:isolate}
.home::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:${GRAIN};background-size:220px 220px;opacity:.07}
.home .top{width:100%;display:flex;justify-content:flex-end;font:500 12px var(--ll-font-mono),monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--ll-text-muted)}
.home .top a:hover,.home .top a:focus-visible{color:var(--ll-text-primary)}
.home .mid{display:grid;place-items:center;margin-top:-6vh}
.home .logo{display:block;width:clamp(140px,22vw,230px);height:auto;overflow:visible;color:var(--ll-text-primary)}
.home .logo .fl{fill:currentColor}
.home .logo .tr{fill:none;stroke:currentColor;stroke-width:10;stroke-linejoin:round;stroke-dasharray:100;stroke-dashoffset:100;opacity:0}
.home .foot{display:flex;flex-direction:column;align-items:center;gap:18px}
.home-dots{display:flex;gap:12px}
.home-dot{width:22px;height:22px;padding:0;border-radius:50%;cursor:pointer;border:1px solid var(--ll-border-color);
  background:linear-gradient(135deg,var(--ll-surface-canvas) 50%,var(--ll-control-primary-bg) 50%);
  transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .2s}
.home-dot:hover{transform:scale(1.18)}
.home-dot[aria-checked="true"]{transform:scale(1.18);box-shadow:0 0 0 2px var(--ll-surface-canvas),0 0 0 3px var(--ll-text-primary)}
.home-dot:focus-visible{outline:none;box-shadow:0 0 0 2px var(--ll-surface-canvas),0 0 0 3px var(--ll-text-primary)}
.home a{color:inherit;text-decoration:none;background:none;border:0;outline:none}
.home a.open{font-size:15px;font-weight:500;padding:8px 14px}
.home a.open:hover,.home a.open:focus-visible{text-decoration:underline;text-underline-offset:5px}
@keyframes home-tr{0%{stroke-dashoffset:100;opacity:1}80%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
@keyframes home-fl{0%{opacity:1}12%,78%{opacity:0}100%{opacity:1}}
.home:has(.open:hover,.open:focus-visible,.logo:hover) .logo .tr{animation:home-tr 1.6s cubic-bezier(.65,0,.35,1) 1 forwards}
.home:has(.open:hover,.open:focus-visible,.logo:hover) .logo .fl{animation:home-fl 1.6s cubic-bezier(.65,0,.35,1) 1}
:root[data-motion="off"] .home-dot{transition:none}
:root[data-motion="off"] .home .logo .tr,:root[data-motion="off"] .home .logo .fl{animation:none!important}
@media (prefers-reduced-motion:reduce){.home .logo .tr,.home .logo .fl{animation:none!important}}
`;

export default function Home() {
  return (
    <main className="home">
      <style>{CSS}</style>
      <div className="top">
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </div>
      <div className="mid">
        <svg className="logo" viewBox="0 0 256 256" role="img" aria-label="Lazy Layout">
          <path className="fl" d={LOGO_PATH} />
          <path className="tr" pathLength={100} d={LOGO_PATH} />
        </svg>
      </div>
      <div className="foot">
        <HomeThemeDots />
        <Link className="open" href="/editor">
          Open Editor
        </Link>
      </div>
    </main>
  );
}

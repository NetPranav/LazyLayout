/**
 * Home (`/`): the editor's own look (theme tokens, dotted canvas, Geist) with the logo, name, tagline, round theme
 * swatches, a plain "Open Editor" text link and a GitHub link. The old launcher (`ProjectHub`) is kept but not mounted.
 */

import Link from "next/link";
import { LogoMark } from "@/editor/components/LogoMark";
import { HomeThemeDots } from "./HomeThemeDots";

const GITHUB_URL = "https://github.com/NetPranav/LazyLayout";

const CSS = `
.home{box-sizing:border-box;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:28px 32px 36px;
  background-color:var(--ll-surface-canvas);color:var(--ll-text-primary);font-family:var(--ll-font-sans),system-ui,sans-serif;
  background-image:radial-gradient(var(--ll-border-color) 1px,transparent 1px);background-size:24px 24px}
.home .top{width:100%;display:flex;justify-content:space-between;align-items:center;font:500 12px var(--ll-font-mono),monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--ll-text-muted)}
.home .top a:hover,.home .top a:focus-visible{color:var(--ll-text-primary)}
.home .mid{display:flex;flex-direction:column;align-items:center;gap:22px;text-align:center}
.home .mark{display:grid;place-items:center;width:72px;height:72px;background:var(--ll-surface-panel);border:1px solid var(--ll-border-color);color:var(--ll-text-primary)}
.home h1{margin:0;font-weight:200;font-size:clamp(44px,10vw,112px);letter-spacing:-.035em;line-height:1}
.home h1 b{font-weight:600}
.home .tag{margin:0;font:400 13px var(--ll-font-mono),monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ll-text-muted)}
.home .foot{display:flex;flex-direction:column;align-items:center;gap:18px}
.home-dots{display:flex;gap:12px}
.home-dot{width:22px;height:22px;padding:0;border-radius:50%;cursor:pointer;border:1px solid var(--ll-border-color);
  background:linear-gradient(135deg,var(--ll-surface-canvas) 50%,var(--ll-control-primary-bg) 50%);
  transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .2s}
.home-dot:hover{transform:scale(1.18)}
.home-dot[aria-checked="true"]{transform:scale(1.18);box-shadow:0 0 0 2px var(--ll-surface-canvas),0 0 0 3px var(--ll-text-primary)}
:root[data-motion="off"] .home-dot{transition:none}
.home a{color:inherit;text-decoration:none;background:none;border:0;outline:none}
.home a.open{font-size:15px;font-weight:500;padding:8px 14px}
.home a.open:hover,.home a.open:focus-visible{text-decoration:underline;text-underline-offset:5px}
.home-dot:focus-visible{outline:none;box-shadow:0 0 0 2px var(--ll-surface-canvas),0 0 0 3px var(--ll-text-primary)}
`;

export default function Home() {
  return (
    <main className="home">
      <style>{CSS}</style>
      <div className="top">
        <span>Lazy Layout</span>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </div>
      <div className="mid">
        <span className="mark">
          <LogoMark size={36} className="ll-logo" />
        </span>
        <h1>
          Lazy <b>Layout</b>
        </h1>
        <p className="tag">Design it once. Ship it lazily.</p>
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

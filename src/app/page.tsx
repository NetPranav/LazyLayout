/**
 * Home (`/`): logo, name, tagline, a plain "Open Editor" text link and a GitHub link.
 * The old project launcher (`@/editor/panels/launcher/ProjectHub`) is kept in the repo but no longer mounted here.
 */

import Link from "next/link";
import { LogoMark } from "@/editor/components/LogoMark";

const GITHUB_URL = "https://github.com/NetPranav/LazyLayout";

export default function Home() {
  return (
    <main className="home">
      <style>{`
        .home{box-sizing:border-box;--bg:#f9f7f2;--fg:#1c1b18;--dim:#7a766c;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:32px 24px 40px;background:var(--bg);color:var(--fg);font-family:var(--font-geist-sans),system-ui,sans-serif}
        @media (prefers-color-scheme: dark){.home{--bg:#0c0f15;--fg:#f4f3ef;--dim:#8a91a0}}
        .home .top{width:100%;display:flex;justify-content:flex-end;font:500 13px var(--font-geist-mono),monospace;letter-spacing:.04em}
        .home .mid{display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
        .home h1{margin:0;font-weight:200;font-size:clamp(44px,11vw,120px);letter-spacing:-.03em;line-height:1}
        .home h1 b{font-weight:600}
        .home p{margin:0;color:var(--dim);font-weight:300;font-size:clamp(14px,2vw,20px);letter-spacing:.06em;text-transform:uppercase}
        .home a{color:inherit;text-decoration:none;background:none;border:0;outline:none}
        .home a.open{font-size:16px;font-weight:500;padding:8px 12px}
        .home a.open:hover,.home a.open:focus-visible,.home .top a:hover,.home .top a:focus-visible{text-decoration:underline;text-underline-offset:4px}
      `}</style>
      <div className="top">
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
      <div className="mid">
        <LogoMark size={64} className="ll-logo" />
        <h1>
          Lazy <b>Layout</b>
        </h1>
        <p>Design it once. Ship it lazily.</p>
      </div>
      <Link className="open" href="/editor">
        Open Editor
      </Link>
    </main>
  );
}

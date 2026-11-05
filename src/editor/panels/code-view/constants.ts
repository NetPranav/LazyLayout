/**
 * Constants for Code View and Console panels.
 * Centralizes all dimensions, tokens, and sample data (no raw px/ms in components).
 */

export const CODE_VIEW_DIMENSIONS = {
  bottomHeight: "var(--ll-size-bottom-code-h)",
  headerHeight: "var(--ll-size-header-h)",
  lineNumberWidth: 28,
  linePaddingX: 16,
  lineHeight: 20,
  fontSize: 13,
} as const;

export const CODE_VIEW_TIMINGS = {
  copyFeedbackMs: 2000,
  downloadFeedbackMs: 1200,
  debounceMs: 150,
} as const;

export const TARGET_LIB_OPTIONS = [
  { value: "React", label: "React" },
  { value: "HTML", label: "HTML" },
  { value: "Vue", label: "Vue" },
] as const;

export const STYLE_TYPE_OPTIONS = [
  { value: "CSS modules", label: "CSS modules" },
  { value: "Tailwind", label: "Tailwind" },
  { value: "Inline", label: "Inline" },
] as const;

export const EXPORT_TYPE_OPTIONS = [
  { value: "named", label: "Named" },
  { value: "default", label: "Default" },
] as const;

export const PROP_TYPE_OPTIONS = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
] as const;

export const CONSOLE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "compiler", label: "Compiler" },
  { id: "blueprint", label: "Blueprint" },
  { id: "database", label: "Database" },
  { id: "api", label: "API" },
  { id: "warning", label: "Warnings" },
  { id: "error", label: "Errors" },
] as const;

export const SAMPLE_CODE_HERO = `export function Hero() {
  return (
    <section className="hero">
      <h1>Design it once. Ship it lazily.</h1>
      <a className="cta">Get started</a>
    </section>
  );
}`;

export const SAMPLE_CODE_ANIMATION = `import { useEffect, useRef } from "react";
import gsap from "gsap";

export function useHeroAnimation() {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero h1", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: "power2.out",
      });
      gsap.from(".hero .cta", {
        opacity: 0,
        y: 12,
        duration: 0.6,
        delay: 0.2,
        ease: "power2.out",
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return rootRef;
}`;

export const SAMPLE_CODE_STYLES = `.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px 24px;
  text-align: center;
}

.hero h1 {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ll-text-primary);
}

.hero .cta {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--ll-radius-md);
  font-weight: 500;
  cursor: pointer;
  background: var(--ll-control-primary-bg);
  color: var(--ll-control-primary-fg);
}`;

export const SAMPLE_CODE_README = `# Hero Component

Exported by **Lazy Layout**.

## Installation

\`\`\`bash
npm install clsx lucide-react gsap @gsap/react
\`\`\`

## Usage

\`\`\`tsx
import { Hero } from "./Hero";

export default function Page() {
  return <Hero />;
}
\`\`\`
`;

export const INITIAL_CONSOLE_LOGS = [
  {
    id: "l_1",
    time: "21:30:00.012",
    category: "compiler" as const,
    level: "success" as const,
    badge: "INIT",
    message: "Engine Wasm core initialized successfully (120 FPS Hermite spline physics)",
    timing: "32ms",
  },
  {
    id: "l_2",
    time: "21:30:00.048",
    category: "database" as const,
    level: "info" as const,
    badge: "DB",
    message: "SQLite In-Memory Schema loaded: 'Users' and 'Projects' tables verified",
    timing: "4ms",
  },
  {
    id: "l_3",
    time: "21:30:00.112",
    category: "blueprint" as const,
    level: "bp" as const,
    badge: "BLUEPRINT",
    message: "Linked Logic Graph 'AuthWorkflow' (6 nodes, 8 type-safe Hermite wires)",
  },
  {
    id: "l_4",
    time: "21:30:00.204",
    category: "compiler" as const,
    level: "info" as const,
    badge: "COMPILER",
    message: "AST Tree verified: 12 components, 3 pages, 0 compilation errors",
    timing: "18ms",
  },
  {
    id: "l_5",
    time: "21:30:01.340",
    category: "api" as const,
    level: "info" as const,
    badge: "API",
    message: "GET /api/v1/projects • 200 OK (returned 2 mock records)",
    timing: "14ms",
  },
  {
    id: "l_6",
    time: "21:30:02.120",
    category: "warning" as const,
    level: "warn" as const,
    badge: "WARN",
    message: "Responsive notice: 'comp_grid' width exceeds 375px on mobile portrait preview",
  },
  {
    id: "l_7",
    time: "21:30:03.450",
    category: "blueprint" as const,
    level: "bp" as const,
    badge: "EXEC",
    message: "Triggered 'OnComponentMount' event sequence for 'Hero Section'",
  },
  {
    id: "l_8",
    time: "21:30:04.010",
    category: "api" as const,
    level: "info" as const,
    badge: "API",
    message: "POST /api/v1/auth/session • 200 OK (Token verified)",
    timing: "22ms",
  },
];

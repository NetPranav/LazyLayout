/**
 * ============================================================================
 * ROOT APPLICATION LAYOUT
 * ============================================================================
 * UI Element: Engine Root Shell & Font Provider
 * Screen / Scope: Global (All pages & editor workspaces)
 * Role: Loads Geist, Geist Mono, Inter, and JetBrains Mono fonts, establishes CSS variable bindings,
 *       and provides global HTML document shell.
 * 
 * CSS ISOLATION & STYLING NOTE:
 * Styles imported here:
 *   1. "@/editor/styles/globals.css" (contains reset, base fonts, scrollbars)
 *   2. "@/editor/styles/animations.css" (micro-interactions and keyframes)
 * No component-specific inline styles or classes should be attached to this root layout.
 * Individual screens/panels manage their own modular stylesheets.
 * ============================================================================
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import "@/editor/styles/globals.css";
import "@/editor/styles/animations.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LazyLayout | AI-Native Motion Design Studio",
  description:
    "Visually author interactive motion, effects, and components with GSAP, Framer Motion, SVG, and CSS, and compile to production-grade code.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="warm"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("lazy-layout-theme");var themes=['paper','dark','white','warm','lilac','graphite','darkroom','noir'];if(themes.indexOf(t)>-1){document.documentElement.setAttribute("data-theme",t);}else{document.documentElement.setAttribute("data-theme","warm");}}catch(e){}try{if(localStorage.getItem("ll-animations-off")==="1"){document.documentElement.setAttribute("data-motion","off");}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

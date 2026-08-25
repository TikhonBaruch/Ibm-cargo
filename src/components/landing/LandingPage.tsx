"use client";

import { useEffect, useRef } from "react";
import { landingMarkup } from "./markup";
import { initLanding } from "./initLanding";
import "./landing.css";

/**
 * Full marketing landing ported from docs/design/refs/cargo-broker-design.html
 * (sections, assets, FX animations, interactive calculators).
 * Markup is SSR'd so the page is visible before client FX init.
 */
export function LandingPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const cleanup = initLanding(el);
      return typeof cleanup === "function" ? cleanup : undefined;
    } catch (err) {
      // Keep static markup visible if interactive FX fail (avoids app/error boundary).
      console.error("[landing] init failed", err);
      return undefined;
    }
  }, []);

  return (
    <div
      className="landing-root"
      ref={ref}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: landingMarkup }}
    />
  );
}

import type { CSSProperties } from "react";
import { HeroSection } from "@/components/landing/hero-section";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { PlatformSection } from "@/components/landing/platform-section";
import { FinalCtaSection } from "@/components/landing/final-cta";
import { MarketingNavbar } from "@/components/layout/marketing-navbar";
import { Footer } from "@/components/layout/footer";

/** Marketing surface: cool mist + ink — not generic AI purple/black. */
export function LandingPage() {
  const landingVars = {
    "--landing-bg": "#eef1f4",
    "--landing-fg": "#0b1220",
    "--landing-muted": "#5b6577",
    "--landing-line": "rgba(11,18,32,0.08)",
    "--landing-accent": "#0f766e",
    "--landing-accent-fg": "#f4fffd",
    "--landing-ink": "#070b12",
    "--landing-panel": "#ffffff",
    background:
      "radial-gradient(120% 80% at 50% -10%, #d9e4ea 0%, #eef1f4 55%)",
  } as CSSProperties;

  return (
    <div className="landing-root min-h-dvh text-[var(--landing-fg)]" style={landingVars}>
      <MarketingNavbar />
      <main>
        <HeroSection />
        <ProductShowcase />
        <PlatformSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}

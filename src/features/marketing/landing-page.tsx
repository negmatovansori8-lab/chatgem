import type { CSSProperties } from "react";
import { HeroSection } from "@/components/landing/hero-section";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { PlatformSection } from "@/components/landing/platform-section";
import { FinalCtaSection } from "@/components/landing/final-cta";
import { MarketingNavbar } from "@/components/layout/marketing-navbar";
import { Footer } from "@/components/layout/footer";

/** World-class marketing surface — deep ink + electric teal, globe brand. */
export function LandingPage() {
  const landingVars = {
    "--landing-bg": "#05070c",
    "--landing-fg": "#f4f7fb",
    "--landing-muted": "#8b95a8",
    "--landing-line": "rgba(255,255,255,0.08)",
    "--landing-accent": "#2dd4bf",
    "--landing-accent-fg": "#042f2e",
    "--landing-ink": "#02040a",
    "--landing-panel": "#0c121c",
    background: "#05070c",
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

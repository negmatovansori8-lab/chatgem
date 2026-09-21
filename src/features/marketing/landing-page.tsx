import { HeroSection } from "@/components/landing/hero-section";
import { PlatformSection } from "@/components/landing/platform-section";
import { FinalCtaSection } from "@/components/landing/final-cta";
import { MarketingNavbar } from "@/components/layout/marketing-navbar";
import { Footer } from "@/components/layout/footer";

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#050505] text-white">
      <MarketingNavbar />
      <main>
        <HeroSection />
        <PlatformSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}

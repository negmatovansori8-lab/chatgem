import { BrandMark } from "@/components/brand/brand-mark";

export default function AppLoading() {
  return (
    <div className="grid h-full w-full place-items-center px-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <BrandMark size="lg" animate="loop" />
        <span className="sr-only">Loading ChatGem…</span>
      </div>
    </div>
  );
}

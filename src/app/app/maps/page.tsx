import { Suspense } from "react";
import { MapsWorkspace } from "@/features/maps/maps-workspace";

export default function MapsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[60vh] place-items-center text-sm text-[var(--fg-muted)]">
          Loading map…
        </div>
      }
    >
      <MapsWorkspace />
    </Suspense>
  );
}

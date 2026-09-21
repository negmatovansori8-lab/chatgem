import { Suspense } from "react";
import { BillingWorkspace } from "@/features/business/billing-workspace";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--fg-muted)]">
          Загрузка…
        </div>
      }
    >
      <BillingWorkspace />
    </Suspense>
  );
}

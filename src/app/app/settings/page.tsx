import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsWorkspace } from "@/features/settings/settings-workspace";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <Suspense>
      <SettingsWorkspace />
    </Suspense>
  );
}

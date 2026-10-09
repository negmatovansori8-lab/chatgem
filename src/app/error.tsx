"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { StatusScreen } from "@/components/system/status-screen";

export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      title={t("error.title")}
      body={t("error.body")}
      primary={{ label: t("common.retry"), onClick: retry }}
      secondary={{ label: t("common.goHome"), href: "/app/chat" }}
    />
  );
}

"use client";

import { useI18n } from "@/components/i18n/locale-provider";
import { StatusScreen } from "@/components/system/status-screen";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <StatusScreen
      code="404"
      title={t("notFound.title")}
      body={t("notFound.body")}
      primary={{ label: t("common.goHome"), href: "/app/chat" }}
    />
  );
}

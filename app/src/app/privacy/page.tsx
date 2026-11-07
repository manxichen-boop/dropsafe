"use client";

import { DocPage } from "@/components/DocPage";
import { useI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const { t } = useI18n();
  return <DocPage title={t.privacy.title} items={t.privacy.items} />;
}

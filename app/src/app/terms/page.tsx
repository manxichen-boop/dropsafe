"use client";

import { DocPage } from "@/components/DocPage";
import { useI18n } from "@/lib/i18n";

export default function TermsPage() {
  const { t } = useI18n();
  return <DocPage title={t.terms.title} items={t.terms.items} />;
}

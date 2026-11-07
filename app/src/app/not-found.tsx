"use client";

import Link from "next/link";
import { Lockie } from "@/components/Lockie";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <Lockie mood="sleeping" size={200} decorative />
      <p className="mt-2 text-muted">{t.detail.notFound}</p>
      <Link href="/" className="mt-2 font-semibold underline underline-offset-4">
        {t.detail.backHome}
      </Link>
    </div>
  );
}

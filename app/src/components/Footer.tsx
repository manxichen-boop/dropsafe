"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t-[1.5px] border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted">
        <p>{t.footer.note}</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="underline underline-offset-4">
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="underline underline-offset-4">
            {t.footer.terms}
          </Link>
          <a href="https://github.com/manxichen-boop/dropsafe" target="_blank" rel="noreferrer" className="underline underline-offset-4">
            {t.footer.source}
          </a>
        </nav>
      </div>
    </footer>
  );
}

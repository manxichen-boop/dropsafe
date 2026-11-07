"use client";

import { Lockie } from "@/components/os/Lockie";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div role="alert" className="os-window left-1/2 top-1/2 w-[320px] -translate-x-1/2 -translate-y-1/2 p-5 text-center">
      <Lockie mood="sleeping" size={64} decorative className="mx-auto" />
      <p className="mt-2">{t.detail.notFound}</p>
      <a href="/" className="mt-2 inline-block underline underline-offset-4">
        {t.os.backToDesktop}
      </a>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useI18n, type Lang } from "@/lib/i18n";
import { JarIcon } from "./icons";
import { WalletButton } from "./WalletButton";

const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
];

export function Header() {
  const { lang, setLang, t } = useI18n();
  return (
    <header className="border-b-[1.5px] border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          <JarIcon size={32} />
          DropSafe
        </Link>
        <span className="rounded-lg bg-sun px-2 py-1 text-xs font-semibold">{t.nav.devnet}</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <Link href="/create" className="hidden text-sm font-medium underline-offset-4 hover:underline sm:inline">
            {t.nav.create}
          </Link>
          <div role="group" aria-label={t.nav.languageLabel} className="flex rounded-xl border-[1.5px] border-line p-0.5">
            {LANGUAGES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={lang === option.value}
                onClick={() => setLang(option.value)}
                className={`min-h-8 rounded-[10px] px-2.5 text-sm font-medium ${
                  lang === option.value ? "bg-ink text-bg" : "text-ink hover:bg-line"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

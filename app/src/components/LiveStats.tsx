"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { CoinIcon, JarIcon, PeopleIcon } from "./icons";

export interface Stats {
  lockedSol: string;
  funded: number;
  refunds: number;
}

function Stat({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <dd className="font-display text-2xl font-semibold leading-none">{value}</dd>
        <dt className="mt-1 text-sm text-muted">{label}</dt>
      </div>
    </div>
  );
}

export function LiveStats({ stats, failed }: { stats: Stats | null; failed: boolean }) {
  const { t } = useI18n();
  return (
    <section aria-label={t.home.statsLabel} className="mt-12 border-y-[1.5px] border-line py-4">
      <p className="mb-3 text-sm font-medium">{t.home.statsLabel}</p>
      {failed ? (
        <p className="text-sm text-danger-ink">{t.home.statsFailed}</p>
      ) : (
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          <Stat icon={<JarIcon size={40} />} value={stats ? stats.lockedSol : "…"} label={t.home.statLocked} />
          <Stat icon={<PeopleIcon size={40} />} value={stats ? stats.funded : "…"} label={t.home.statFunded} />
          <Stat icon={<CoinIcon size={40} />} value={stats ? stats.refunds : "…"} label={t.home.statRefunds} />
        </dl>
      )}
    </section>
  );
}

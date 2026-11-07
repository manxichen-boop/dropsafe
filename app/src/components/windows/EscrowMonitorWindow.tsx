"use client";

import { useCallback, useEffect, useState } from "react";
import { formatSol } from "@/lib/campaign";
import { chainRead } from "@/lib/chain";
import { useI18n } from "@/lib/i18n";
import { escrowPda, useDropsafe } from "@/lib/program";

const CHUNK = 100;

export function EscrowMonitorWindow() {
  const program = useDropsafe();
  const { t } = useI18n();
  const [stats, setStats] = useState<{ locked: string; funded: number; refunds: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const connection = program.provider.connection;
      const [campaigns, organizers, buyers] = await Promise.all([
        chainRead("campaigns", () => program.account.campaign.all()),
        chainRead("organizer-stats", () => program.account.organizerStats.all()),
        chainRead("buyer-stats", () => program.account.buyerStats.all()),
      ]);
      // 全部算自链上账户,不写死任何数字
      const keys = campaigns.map((row) => escrowPda(row.publicKey));
      let locked = 0;
      for (let i = 0; i < keys.length; i += CHUNK) {
        const infos = await connection.getMultipleAccountsInfo(keys.slice(i, i + CHUNK));
        const live = infos.filter((info) => info !== null);
        if (live.length > 0) {
          const rent = await connection.getMinimumBalanceForRentExemption(live[0].data.length);
          for (const info of live) locked += info.lamports - rent;
        }
      }
      setStats({
        locked: formatSol(locked),
        funded: organizers.reduce((sum, { account }) => sum + account.shielded.funded.toNumber() + account.standard.funded.toNumber() + account.trust.funded.toNumber(), 0),
        refunds: buyers.reduce((sum, { account }) => sum + account.seatsRefunded.toNumber(), 0),
      });
      setFailed(false);
    } catch (e) {
      console.warn(e);
      setFailed(true);
    }
  }, [program]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const rows = [
    { label: t.home.statLocked, value: stats?.locked },
    { label: t.home.statFunded, value: stats?.funded },
    { label: t.home.statRefunds, value: stats?.refunds },
  ];

  return (
    <div>
      <p className="text-[13px]">{t.home.statsLabel}</p>
      {failed ? (
        <p className="panel mt-3 border-red">{t.home.statsFailed}</p>
      ) : (
        <dl className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="panel flex flex-wrap items-baseline justify-between gap-2">
              <dt>{row.label}</dt>
              <dd className="pixel-num text-4xl leading-none">{row.value ?? "…"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { BuyerStats, Campaign } from "@/lib/campaign";
import { chainRead } from "@/lib/chain";
import { useI18n } from "@/lib/i18n";
import { buyerStatsPda, contributionPda, useDropsafe } from "@/lib/program";
import { Lockie } from "@/components/Lockie";

function parse(raw: string) {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

export default function BuyerPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const key = useMemo(() => parse(address), [address]);
  const program = useDropsafe();
  const { t } = useI18n();
  const b = t.buyerPage;
  const [stats, setStats] = useState<BuyerStats | null | undefined>(undefined);
  const [open, setOpen] = useState<{ publicKey: PublicKey; account: Campaign }[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!key) {
      setStats(null);
      return;
    }
    try {
      const [record, campaigns, seats] = await Promise.all([
        program.account.buyerStats.fetchNullable(buyerStatsPda(key)),
        chainRead("campaigns", () => program.account.campaign.all()),
        // buyer 字段紧跟在 8 字节的账户标识后面
        chainRead(`seats-of-${address}`, () => program.account.contribution.all([{ memcmp: { offset: 8, bytes: key.toBase58() } }])),
      ]);
      setStats(record);
      const mine = new Set(seats.map((seat) => seat.publicKey.toBase58()));
      setOpen(campaigns.filter((row) => mine.has(contributionPda(row.publicKey, key).toBase58())));
    } catch (e) {
      console.warn(e);
      setFailed(true);
    }
  }, [address, key, program]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = stats
    ? [
        { label: b.joined, value: stats.campaignsJoined.toString() },
        { label: b.confirmed, value: stats.seatsConfirmed.toString() },
        { label: b.reported, value: stats.seatsReported.toString() },
        { label: b.refunded, value: stats.seatsRefunded.toString() },
      ]
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold">{b.title}</h1>
      <p className="mt-1 break-all font-mono text-sm">{address}</p>
      <p className="mt-4 rounded-2xl bg-sun-tint p-4 text-sm leading-relaxed">{b.note}</p>

      {failed && <p className="mt-6 text-danger-ink">{t.detail.loadFailed}</p>}
      {!failed && stats === undefined && <p className="py-10 text-center text-muted">{t.detail.loading}</p>}
      {stats === null && (
        <div className="flex flex-col items-center py-10 text-center">
          <Lockie mood="sleeping" size={160} decorative />
          <p className="mt-2 text-muted">{b.noRecord}</p>
        </div>
      )}

      {stats && (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="card p-4">
                <dd className="font-display text-2xl font-semibold leading-none">{metric.value}</dd>
                <dt className="mt-1 text-sm text-muted">{metric.label}</dt>
              </div>
            ))}
          </dl>
          <section className="mt-8">
            <h2 className="font-display text-2xl font-semibold">{b.seats}</h2>
            {open.length === 0 ? (
              <p className="mt-2 text-muted">{b.noSeats}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {open.map(({ publicKey, account }) => (
                  <li key={publicKey.toBase58()}>
                    <Link href={`/campaign/${publicKey.toBase58()}`} className="font-medium underline underline-offset-4">
                      {account.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

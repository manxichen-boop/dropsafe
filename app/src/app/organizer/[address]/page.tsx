"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { formatSol, shortAddress, TIERS, type Campaign, type OrganizerStats } from "@/lib/campaign";
import { useI18n } from "@/lib/i18n";
import { organizerStatsPda, seatsByCampaign, useDropsafe } from "@/lib/program";
import { CampaignCard } from "@/components/CampaignCard";
import { Lockie } from "@/components/Lockie";
import { TierBadge } from "@/components/StatusBadge";
import { useNow } from "@/components/useNow";

type Row = { publicKey: PublicKey; account: Campaign };

function parse(raw: string) {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="font-display text-2xl font-semibold leading-none">{value}</dd>
      <dt className="mt-1 text-sm text-muted">{label}</dt>
    </div>
  );
}

export default function OrganizerPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const key = useMemo(() => parse(address), [address]);
  const program = useDropsafe();
  const now = useNow();
  const { t } = useI18n();
  const o = t.organizerPage;
  const [stats, setStats] = useState<OrganizerStats | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [buyers, setBuyers] = useState<Record<string, string[]>>({});
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!key) {
      setStats(null);
      return;
    }
    try {
      const [record, campaigns, seats] = await Promise.all([
        program.account.organizerStats.fetchNullable(organizerStatsPda(key)),
        // organizer 字段紧跟在 8 字节的账户标识后面
        program.account.campaign.all([{ memcmp: { offset: 8, bytes: key.toBase58() } }]),
        program.account.contribution.all(),
      ]);
      setStats(record);
      setRows(campaigns.sort((a, b) => b.account.campaignId.cmp(a.account.campaignId)));
      const grouped = seatsByCampaign(campaigns.map((row) => row.publicKey), seats);
      setBuyers(Object.fromEntries(Object.entries(grouped).map(([k, list]) => [k, list.map((seat) => seat.account.buyer.toBase58())])));
    } catch (e) {
      console.warn(e);
      setFailed(true);
    }
  }, [key, program]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">{o.title}</h1>
      <p className="mt-1 break-all font-mono text-sm">{key ? address : shortAddress(address)}</p>
      <p className="mt-4 max-w-2xl rounded-2xl bg-sun-tint p-4 text-sm leading-relaxed">{o.note}</p>

      {failed && <p className="mt-6 text-danger-ink">{t.detail.loadFailed}</p>}
      {!failed && stats === undefined && <p className="py-10 text-center text-muted">{t.detail.loading}</p>}
      {stats === null && (
        <div className="flex flex-col items-center py-10 text-center">
          <Lockie mood="sleeping" size={160} decorative />
          <p className="mt-2 text-muted">{o.noRecord}</p>
        </div>
      )}

      {stats && (
        <>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y-[1.5px] border-line py-4">
            <Metric label={o.paid} value={`${formatSol(stats.totalPaidToOrganizerLamports)} SOL`} />
            <Metric label={o.created} value={stats.campaignsCreated.toString()} />
            <Metric label={o.failed} value={stats.campaignsFailed.toString()} />
            <Metric label={o.abandoned} value={stats.campaignsAbandoned.toString()} />
            <Metric label={o.cancelled} value={stats.campaignsCancelled.toString()} />
          </dl>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <section key={tier} className="card p-5">
                <TierBadge tier={tier} />
                <dl className="mt-4 space-y-3">
                  <Metric label={o.funded} value={stats[tier].funded.toString()} />
                  <Metric label={o.confirmed} value={stats[tier].seatsConfirmed.toString()} />
                  <Metric label={o.unconfirmed} value={stats[tier].seatsUnconfirmed.toString()} />
                  <Metric label={o.reported} value={stats[tier].seatsReported.toString()} />
                </dl>
              </section>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">{o.growth}</p>
        </>
      )}

      {stats && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{o.campaigns}</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-muted">{o.noCampaigns}</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ publicKey, account }) => (
                <CampaignCard
                  key={publicKey.toBase58()}
                  address={publicKey.toBase58()}
                  campaign={account}
                  buyers={buyers[publicKey.toBase58()] ?? []}
                  now={now}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <Link href="/" className="mt-8 inline-block font-semibold underline underline-offset-4">
        {t.detail.backHome}
      </Link>
    </div>
  );
}

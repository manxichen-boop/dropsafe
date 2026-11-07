"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { formatSol, TIERS, type BuyerStats, type Campaign, type OrganizerStats } from "@/lib/campaign";
import { chainRead } from "@/lib/chain";
import { useI18n } from "@/lib/i18n";
import { buyerStatsPda, contributionPda, organizerStatsPda, useDropsafe } from "@/lib/program";
import { DesktopIcon, TierShield } from "@/components/os/icons";
import { useOS } from "@/components/os/OS";

function parse(raw: string) {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <dt>{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Heading({ icon, title, address }: { icon: "organizer" | "buyer"; title: string; address: string }) {
  return (
    <div className="flex flex-col items-center border-b-2 border-ink pb-3 text-center">
      <DesktopIcon name={icon} size={64} />
      <h2 className="pixel-title mt-2 text-xl">{title}</h2>
      <p className="break-all text-[13px]">{address}</p>
    </div>
  );
}

export function OrganizerWindow({ address }: { address: string }) {
  const key = useMemo(() => parse(address), [address]);
  const program = useDropsafe();
  const { t } = useI18n();
  const { open } = useOS();
  const o = t.organizerPage;
  const [stats, setStats] = useState<OrganizerStats | null | undefined>(undefined);
  const [rows, setRows] = useState<{ publicKey: PublicKey; account: Campaign }[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!key) return setStats(null);
    try {
      const [record, campaigns] = await Promise.all([
        program.account.organizerStats.fetchNullable(organizerStatsPda(key)),
        // organizer 字段紧跟在 8 字节的账户标识后面
        chainRead(`campaigns-of-${address}`, () => program.account.campaign.all([{ memcmp: { offset: 8, bytes: key.toBase58() } }])),
      ]);
      setStats(record);
      setRows(campaigns.sort((a, b) => b.account.campaignId.cmp(a.account.campaignId)));
    } catch (e) {
      console.warn(e);
      setFailed(true);
    }
  }, [address, key, program]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Heading icon="organizer" title={o.title} address={address} />
      <p className="panel mt-3 text-[13px] leading-relaxed">{o.note}</p>
      {failed && <p className="panel mt-3 border-red">{t.detail.loadFailed}</p>}
      {!failed && stats === undefined && <p className="py-6 text-center">{t.detail.loading}</p>}
      {stats === null && <p className="py-6 text-center">{o.noRecord}</p>}
      {stats && (
        <>
          <dl className="mt-3 border-b-2 border-ink pb-3">
            <Line label={o.paid} value={`${formatSol(stats.totalPaidToOrganizerLamports)} SOL`} />
            <Line label={o.created} value={stats.campaignsCreated.toString()} />
            <Line label={o.failed} value={stats.campaignsFailed.toString()} />
            <Line label={o.abandoned} value={stats.campaignsAbandoned.toString()} />
            <Line label={o.cancelled} value={stats.campaignsCancelled.toString()} />
          </dl>
          {TIERS.map((tier) => (
            <section key={tier} className="border-b-2 border-ink py-3">
              <h3 className="pixel-title flex items-center gap-2 text-base">
                <TierShield tier={tier} size={24} />
                {t.tier[tier]}
              </h3>
              <dl className="mt-1">
                <Line label={o.funded} value={stats[tier].funded.toString()} />
                <Line label={o.confirmed} value={stats[tier].seatsConfirmed.toString()} />
                <Line label={o.unconfirmed} value={stats[tier].seatsUnconfirmed.toString()} />
                {tier !== "trust" && <Line label={o.reported} value={stats[tier].seatsReported.toString()} />}
              </dl>
              {tier === "trust" && (
                // 无资金保障团的报告没有押金也没经过仲裁,只能说明有人报告,不能当成确认违约
                <div className="panel mt-2 text-[13px] leading-relaxed">
                  <p className="font-semibold">
                    {o.unsecuredReports(
                      stats.trust.seatsReported.toString(),
                      stats.trust.seatsConfirmed.add(stats.trust.seatsUnconfirmed).add(stats.trust.seatsReported).toString()
                    )}
                  </p>
                  <p>{o.unverified}</p>
                </div>
              )}
            </section>
          ))}
          <p className="mt-3 text-[13px] leading-relaxed">{o.growth}</p>
          <h3 className="pixel-title mt-4 text-base">{o.campaigns}</h3>
          {rows.length === 0 ? (
            <p className="mt-1">{o.noCampaigns}</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {rows.map(({ publicKey, account }) => (
                <li key={publicKey.toBase58()}>
                  <button type="button" className="text-left underline underline-offset-4" onClick={(e) => open("campaign", publicKey.toBase58(), e.currentTarget)}>
                    {account.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function BuyerWindow({ address }: { address: string }) {
  const key = useMemo(() => parse(address), [address]);
  const program = useDropsafe();
  const { t } = useI18n();
  const { open } = useOS();
  const b = t.buyerPage;
  const [stats, setStats] = useState<BuyerStats | null | undefined>(undefined);
  const [seats, setSeats] = useState<{ publicKey: PublicKey; account: Campaign }[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!key) return setStats(null);
    try {
      const [record, campaigns, mine] = await Promise.all([
        program.account.buyerStats.fetchNullable(buyerStatsPda(key)),
        chainRead("campaigns", () => program.account.campaign.all()),
        // buyer 字段紧跟在 8 字节的账户标识后面
        chainRead(`seats-of-${address}`, () => program.account.contribution.all([{ memcmp: { offset: 8, bytes: key.toBase58() } }])),
      ]);
      setStats(record);
      const owned = new Set(mine.map((seat) => seat.publicKey.toBase58()));
      setSeats(campaigns.filter((row) => owned.has(contributionPda(row.publicKey, key).toBase58())));
    } catch (e) {
      console.warn(e);
      setFailed(true);
    }
  }, [address, key, program]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Heading icon="buyer" title={b.title} address={address} />
      <p className="panel mt-3 text-[13px] leading-relaxed">{b.note}</p>
      {failed && <p className="panel mt-3 border-red">{t.detail.loadFailed}</p>}
      {!failed && stats === undefined && <p className="py-6 text-center">{t.detail.loading}</p>}
      {stats === null && <p className="py-6 text-center">{b.noRecord}</p>}
      {stats && (
        <>
          <dl className="mt-3 border-b-2 border-ink pb-3">
            <Line label={b.joined} value={stats.campaignsJoined.toString()} />
            <Line label={b.confirmed} value={stats.seatsConfirmed.toString()} />
            <Line label={b.reported} value={stats.seatsReported.toString()} />
            <Line label={b.refunded} value={stats.seatsRefunded.toString()} />
          </dl>
          <h3 className="pixel-title mt-3 text-base">{b.seats}</h3>
          {seats.length === 0 ? (
            <p className="mt-1">{b.noSeats}</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {seats.map(({ publicKey, account }) => (
                <li key={publicKey.toBase58()}>
                  <button type="button" className="text-left underline underline-offset-4" onClick={(e) => open("campaign", publicKey.toBase58(), e.currentTarget)}>
                    {account.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

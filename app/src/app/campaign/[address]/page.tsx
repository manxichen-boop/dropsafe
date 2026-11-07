"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  bondHeld,
  displayStatus,
  formatCountdown,
  formatSol,
  nextDeadline,
  RECOVERY_PERCENT,
  releaseAmount,
  reportAmount,
  settleAmount,
  shortAddress,
  tierOf,
  type BuyerStats,
  type Campaign,
  type Contribution,
  type DisplayStatus,
} from "@/lib/campaign";
import { chainRead, clearChainCache } from "@/lib/chain";
import { explorerAddress } from "@/lib/config";
import { translateError, type FriendlyError } from "@/lib/errors";
import { dateLocale, useI18n } from "@/lib/i18n";
import { buyerStatsPda, contributionPda, escrowPda, organizerStatsPda, seatsByCampaign, useDropsafe } from "@/lib/program";
import { ProductImage } from "@/components/CampaignCard";
import { CalendarIcon, CoinIcon, JarIcon, PeopleIcon } from "@/components/icons";
import { Lockie, type LockieMood } from "@/components/Lockie";
import { ErrorNotice, SuccessNotice, WalletHint } from "@/components/Notice";
import { SeatBuddies } from "@/components/SeatBuddies";
import { StatusBadge, TierBadge } from "@/components/StatusBadge";
import { useNow } from "@/components/useNow";
import { WalletButton } from "@/components/WalletButton";

const MOOD: Record<DisplayStatus, LockieMood> = {
  open: "waiting",
  funded: "celebrating",
  failed: "refunding",
  abandoned: "refunding",
  cancelled: "refunding",
  delivering: "guarding",
  appeal: "guarding",
  settling: "paying",
  closed: "paying",
};

type Seat = { publicKey: PublicKey; account: Contribution };

function parseAddress(raw: string): PublicKey | null {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

function Timeline({ status }: { status: DisplayStatus }) {
  const { t } = useI18n();
  const d = t.detail;
  const refundPath = status === "failed" || status === "abandoned" || status === "cancelled";
  const labels = refundPath
    ? [
        d.stepRaising,
        status === "failed" ? d.stepNotFilled : status === "cancelled" ? d.stepCancelled : d.stepAbandoned,
        d.stepRefund,
      ]
    : [d.stepRaising, d.stepFunded, d.stepReleased, d.stepDone];
  const positions: Partial<Record<DisplayStatus, number>> = { open: 0, funded: 1, delivering: 2, appeal: 2, settling: 2, closed: 3 };
  const current = refundPath ? 2 : (positions[status] ?? 0);

  return (
    <ol className="space-y-2">
      {labels.map((label, i) => {
        const done = i < current || (i === current && status === "closed");
        const active = i === current && status !== "closed";
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={`h-4 w-4 shrink-0 rounded-full border-[1.5px] ${
                done ? "border-safe bg-safe" : active ? (refundPath ? "border-danger bg-danger" : "border-ink bg-sun") : "border-line bg-surface"
              }`}
            />
            <span className={active || done ? "font-semibold" : "text-muted"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CopyAddress({ value }: { value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy} className="min-h-9 shrink-0 rounded-xl border-[1.5px] border-line bg-bg px-3 text-sm font-medium hover:border-ink">
      {copied ? t.detail.copied : t.detail.copy}
    </button>
  );
}

export default function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { address } = use(params);
  const { created } = use(searchParams);
  const campaignKey = useMemo(() => parseAddress(address), [address]);

  const program = useDropsafe();
  const { publicKey } = useWallet();
  const now = useNow();
  const { lang, t } = useI18n();
  const d = t.detail;

  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [escrowLamports, setEscrowLamports] = useState(0);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [buyerRecords, setBuyerRecords] = useState<Record<string, BuyerStats | null>>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<{ title: string; signature?: string } | null>(
    created ? { title: "created", signature: created } : null
  );
  const [error, setError] = useState<FriendlyError | null>(null);

  const escrowKey = useMemo(() => (campaignKey ? escrowPda(campaignKey) : null), [campaignKey]);

  const refresh = useCallback(async () => {
    if (!campaignKey || !escrowKey) {
      setCampaign(null);
      return;
    }
    try {
      const connection = program.provider.connection;
      const [account, escrowInfo, allSeats] = await Promise.all([
        program.account.campaign.fetchNullable(campaignKey),
        connection.getAccountInfo(escrowKey),
        chainRead("seats", () => program.account.contribution.all()),
      ]);
      setCampaign(account);
      const mine = seatsByCampaign([campaignKey], allSeats)[campaignKey.toBase58()] ?? [];
      setSeats(mine);
      if (escrowInfo) {
        // 账户余额里有一部分是租金,不属于托管的钱,要扣掉再显示
        const rent = await connection.getMinimumBalanceForRentExemption(escrowInfo.data.length);
        setEscrowLamports(escrowInfo.lamports - rent);
      }
      if (mine.length > 0) {
        const records = await program.account.buyerStats.fetchMultiple(mine.map((seat) => buyerStatsPda(seat.account.buyer)));
        setBuyerRecords(Object.fromEntries(mine.map((seat, i) => [seat.account.buyer.toBase58(), records[i]])));
      }
      setLoadFailed(false);
    } catch (e) {
      console.warn(e);
      setLoadFailed(true);
    }
  }, [campaignKey, escrowKey, program]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const send = async (title: string, build: () => Promise<string>) => {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const signature = await build();
      setSuccess({ title, signature });
      clearChainCache();
      await refresh();
    } catch (e) {
      console.warn(e);
      setError(translateError(e));
    } finally {
      setPending(false);
    }
  };

  if (campaign === undefined && !loadFailed) return <p className="py-12 text-center text-muted">{d.loading}</p>;
  if (loadFailed && !campaign) {
    return (
      <div className="py-12 text-center">
        <p className="text-danger-ink">{d.loadFailed}</p>
        <button onClick={refresh} className="mt-2 font-semibold underline underline-offset-4">
          {d.retry}
        </button>
      </div>
    );
  }
  if (!campaign || !campaignKey || !escrowKey) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Lockie mood="sleeping" size={180} decorative />
        <p className="mt-2 text-muted">{d.notFound}</p>
        <Link href="/" className="mt-2 font-semibold underline underline-offset-4">
          {d.backHome}
        </Link>
      </div>
    );
  }

  const status = displayStatus(campaign, now);
  const tier = tierOf(campaign);
  const organizer = campaign.organizer;
  const isOrganizer = publicKey?.equals(organizer) ?? false;
  const mySeat = publicKey ? seats.find((seat) => seat.account.buyer.equals(publicKey)) : undefined;
  const mySeatPaid = !!mySeat && "paid" in mySeat.account.status;
  const next = nextDeadline(campaign, status);
  const price = formatSol(campaign.price);
  const appealOver = now >= campaign.appealEnd.toNumber();
  const timeLabel = (d.timeTo as Partial<Record<DisplayStatus, string>>)[status] ?? d.timeNone;
  const bond = bondHeld(campaign);
  const buyerFunds = Math.max(0, escrowLamports - bond.toNumber());
  const formatDate = (seconds: number) => new Date(seconds * 1000).toLocaleString(dateLocale(lang));

  const organizerStats = organizerStatsPda(organizer);
  const buyerAccounts = () => ({
    buyer: publicKey!,
    campaign: campaignKey,
    escrow: escrowKey,
    contribution: contributionPda(campaignKey, publicKey!),
    buyerStats: buyerStatsPda(publicKey!),
  });

  const contribute = () =>
    send(d.done.joined, () =>
      program.methods
        .contribute()
        .accountsPartial({ ...buyerAccounts(), organizerStats, systemProgram: SystemProgram.programId })
        .rpc()
    );
  const withdraw = () => send(d.done.left, () => program.methods.withdrawBeforeFill().accountsPartial(buyerAccounts()).rpc());
  const refund = () =>
    send(d.done.refunded, () => program.methods.refund().accountsPartial({ ...buyerAccounts(), organizerStats }).rpc());
  const cancel = () =>
    send(d.done.cancelled, () =>
      program.methods.cancelCampaign().accountsPartial({ organizer: publicKey!, campaign: campaignKey, organizerStats }).rpc()
    );
  const release = () =>
    send(d.done.withdrawn, () =>
      program.methods
        .releaseUpfront()
        .accountsPartial({ organizer: publicKey!, campaign: campaignKey, escrow: escrowKey, organizerStats })
        .rpc()
    );
  const finalizeIx = () =>
    program.methods.finalizeCampaign().accountsPartial({ caller: publicKey!, campaign: campaignKey, organizerStats }).instruction();
  const reclaim = () =>
    send(d.done.reclaimed, async () => {
      // 链上状态还没更新时(比如没人退款),先在同一笔交易里记录结果
      const needsFinalize = !campaign.finalized && ("fundraising" in campaign.status || "funded" in campaign.status);
      return program.methods
        .reclaimBond()
        .accountsPartial({ organizer: publicKey!, campaign: campaignKey, escrow: escrowKey })
        .preInstructions(needsFinalize ? [await finalizeIx()] : [])
        .rpc();
    });
  const confirm = () =>
    send(d.done.confirmed, () =>
      program.methods
        .confirmDelivery()
        .accountsPartial({ buyer: publicKey!, campaign: campaignKey, contribution: contributionPda(campaignKey, publicKey!) })
        .rpc()
    );
  const report = () =>
    send(d.done.reported, () =>
      program.methods
        .reportNotReceived()
        .accountsPartial({ buyer: publicKey!, campaign: campaignKey, contribution: contributionPda(campaignKey, publicKey!) })
        .rpc()
    );
  const settle = (buyer: PublicKey) =>
    send(d.done.settled, () =>
      program.methods
        .settleSeat()
        .accountsPartial({
          caller: publicKey!,
          organizer,
          buyer,
          campaign: campaignKey,
          escrow: escrowKey,
          contribution: contributionPda(campaignKey, buyer),
          organizerStats,
          buyerStats: buyerStatsPda(buyer),
        })
        .rpc()
    );
  const finalize = () =>
    send(d.done.finalized, () =>
      program.methods.finalizeCampaign().accountsPartial({ caller: publicKey!, campaign: campaignKey, organizerStats }).rpc()
    );

  const primary = "btn-primary w-full px-3 py-3 text-base";
  const danger = "btn-secondary w-full px-3 py-3 text-base";
  const neutral = "btn-neutral w-full px-3 py-3 text-base";
  const label = (text: string) => (pending ? d.pending : text);
  const refundable = status === "failed" || status === "abandoned" || status === "cancelled";

  const buttons: React.ReactNode[] = [];
  if (publicKey) {
    if (status === "open" && !mySeat) {
      buttons.push(
        <button key="join" onClick={contribute} disabled={pending} className={primary}>
          {label(d.join(price))}
        </button>
      );
    }
    if (status === "open" && mySeat) {
      buttons.push(
        <button key="leave" onClick={withdraw} disabled={pending} className={neutral}>
          {label(d.leave(price))}
        </button>
      );
    }
    if (refundable && mySeat) {
      buttons.push(
        <button key="refund" onClick={refund} disabled={pending} className={primary}>
          {label(d.refund(price))}
        </button>
      );
    }
    if (status === "funded" && isOrganizer) {
      buttons.push(
        <button key="release" onClick={release} disabled={pending} className={primary}>
          {label(d.withdraw(formatSol(releaseAmount(campaign))))}
        </button>
      );
    }
    if ((status === "delivering" || status === "appeal") && mySeatPaid) {
      buttons.push(
        <button key="confirm" onClick={confirm} disabled={pending} className={primary}>
          {label(d.confirm)}
        </button>
      );
    }
    if (status === "appeal" && mySeatPaid) {
      buttons.push(
        <button key="report" onClick={report} disabled={pending} className={danger}>
          {label(tier === "trust" ? d.reportTrust : d.report(formatSol(reportAmount(campaign))))}
        </button>
      );
    }
    if (status === "open" && isOrganizer) {
      buttons.push(
        <button key="cancel" onClick={cancel} disabled={pending} className={neutral}>
          {label(d.cancel)}
        </button>
      );
    }
    if (refundable && isOrganizer && !campaign.bondTotal.isZero() && !campaign.bondReclaimed) {
      buttons.push(
        <button key="reclaim" onClick={reclaim} disabled={pending} className={primary}>
          {label(d.reclaim(formatSol(campaign.bondTotal)))}
        </button>
      );
    }
    if (!campaign.finalized && (refundable || status === "closed")) {
      buttons.push(
        <button key="finalize" onClick={finalize} disabled={pending} className={neutral}>
          {label(d.finalize)}
        </button>
      );
    }
  }

  const waitingMessage = () => {
    switch (status) {
      case "open":
        return mySeat ? d.wait.open : d.wait.nothing;
      case "funded":
        return mySeat ? d.wait.funded : d.wait.full;
      case "failed":
      case "abandoned":
      case "cancelled":
        return d.wait.noClaim;
      case "delivering":
        return isOrganizer ? d.wait.delivering : mySeat ? d.wait.deliveringBuyer : d.wait.other;
      case "appeal":
        return isOrganizer ? d.wait.appealOrganizer : d.wait.nothing;
      default:
        return d.wait.nothing;
    }
  };

  const seatStatusLabel = (seat: Seat) =>
    "confirmed" in seat.account.status ? d.seatConfirmed : "reported" in seat.account.status ? d.seatReported : d.seatPaid;
  const canSettle = (seat: Seat) =>
    "active" in campaign.status && (!("paid" in seat.account.status) || appealOver);
  const settleLabel = (seat: Seat) => {
    const amount = settleAmount(campaign);
    if (amount.isZero()) return d.settleNoMoney;
    return d.settle(formatSol(amount), "reported" in seat.account.status ? d.toBuyer : d.toOrganizer);
  };

  const deadlines = [
    { label: d.joinBy, at: campaign.deadline.toNumber() },
    { label: d.shipBy, at: campaign.deliveryDeadline.toNumber() },
    { label: d.reportBy, at: campaign.appealEnd.toNumber() },
  ];

  return (
    <div className="pb-48 md:pb-0">
      <Link href="/" className="text-sm font-medium underline-offset-4 hover:underline">
        ← {d.back}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words font-display text-3xl font-semibold leading-tight md:text-4xl">{campaign.title}</h1>
        <div className="flex flex-wrap gap-1.5">
          <TierBadge tier={tier} />
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 md:grid-cols-[1fr_400px]">
        {/* 手机上购买卡片排在商品图下面,说明和资金面板往后放 */}
        <div className="contents md:block md:space-y-6">
          <div className="order-1">
            <ProductImage url={campaign.imageUrl} title={campaign.title} large />
            {campaign.imageUrl && <p className="mt-2 text-xs text-muted">{d.imageNote}</p>}
            <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed">{campaign.description || d.noDescription}</p>
          </div>

          <section className="card order-3 p-5">
            <h2 className="font-display text-xl font-semibold">{d.timeline}</h2>
            <div className="mt-4">
              <Timeline status={status} />
            </div>
            <dl className="mt-4 space-y-1.5 border-t-[1.5px] border-line pt-4 text-sm">
              {deadlines.map((step) => (
                <div key={step.label} className="flex flex-wrap justify-between gap-x-4">
                  <dt className={now >= step.at ? "text-muted" : "font-medium"}>{step.label}</dt>
                  <dd className="font-mono text-muted">{formatDate(step.at)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card order-4 p-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <JarIcon size={28} />
              {d.fundsTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{d.fundsNote}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted">{d.fundsLocked}</dt>
                <dd className="mt-0.5 font-mono text-xl font-medium">{formatSol(escrowLamports)} SOL</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted">{d.fundsBuyers}</dt>
                  <dd className="font-mono">{formatSol(buyerFunds)} SOL</dd>
                </div>
                <div>
                  <dt className="text-muted">{d.fundsBond}</dt>
                  <dd className="font-mono">{formatSol(bond)} SOL</dd>
                </div>
              </div>
              <div>
                <dt className="text-muted">{d.fundsAddress}</dt>
                <dd className="mt-1 flex items-center justify-between gap-3">
                  <code className="min-w-0 break-all font-mono text-sm">{escrowKey.toBase58()}</code>
                  <CopyAddress value={escrowKey.toBase58()} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">{isOrganizer ? d.organizerYou : d.organizer}</dt>
                <dd className="mt-0.5">
                  <Link href={`/organizer/${organizer.toBase58()}`} className="font-mono underline underline-offset-4">
                    {shortAddress(organizer.toBase58())}
                  </Link>
                </dd>
              </div>
            </dl>
            <a href={explorerAddress(escrowKey.toBase58())} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
              {d.explorer}
            </a>
          </section>

          {seats.length > 0 && (
            <section className="card order-5 p-5">
              <h2 className="font-display text-xl font-semibold">{d.settleTitle}</h2>
              <ul className="mt-3 space-y-3">
                {seats.map((seat) => {
                  const buyer = seat.account.buyer.toBase58();
                  const record = buyerRecords[buyer];
                  return (
                    <li key={buyer} className="border-t-[1.5px] border-line pt-3 text-sm first:border-t-0 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/buyer/${buyer}`} className="font-mono underline underline-offset-4">
                          {shortAddress(buyer)}
                        </Link>
                        <span className="text-muted">{seatStatusLabel(seat)}</span>
                      </div>
                      {isOrganizer && (
                        <p className="mt-1 text-xs text-muted">
                          {record
                            ? d.buyerSummary(record.campaignsJoined.toString(), record.seatsConfirmed.toString(), record.seatsReported.toString())
                            : d.newBuyer}
                        </p>
                      )}
                      {publicKey && canSettle(seat) && (
                        <button onClick={() => settle(seat.account.buyer)} disabled={pending} className="btn-neutral mt-2 w-full px-3 py-2 text-sm">
                          {label(settleLabel(seat))}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="order-2 space-y-3 md:sticky md:top-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <Lockie mood={MOOD[status]} size={112} className="shrink-0" />
              <p className="text-sm leading-relaxed">{d.explain[status]}</p>
            </div>

            <p className="mt-4 rounded-2xl bg-bg p-3 text-sm font-semibold">
              {t.tier.recovery(RECOVERY_PERCENT[tier])}
              {tier !== "trust" && <span className="mt-0.5 block text-xs font-normal text-muted">{t.tier.recoveryNote}</span>}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="flex items-center gap-1.5 text-sm text-muted">
                  <CoinIcon size={20} />
                  {d.price}
                </dt>
                <dd className="mt-1 font-mono text-xl font-medium">{price} SOL</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-sm text-muted">
                  <CalendarIcon size={20} />
                  {timeLabel}
                </dt>
                <dd className="mt-1 font-mono text-xl font-medium">{next === null || next <= now ? t.ended : formatCountdown(next - now)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">{d.lockedUntil(formatDate(campaign.appealEnd.toNumber()))}</p>

            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-sm text-muted">
                <PeopleIcon size={20} />
                {d.seats}: {t.home.joinedCount(campaign.joinedCount, campaign.targetCount)}
              </p>
              <SeatBuddies
                campaign={address}
                target={campaign.targetCount}
                joined={campaign.joinedCount}
                buyers={seats.map((seat) => seat.account.buyer.toBase58())}
                size="lg"
                hop={status === "funded"}
                label={t.home.joinedCount(campaign.joinedCount, campaign.targetCount)}
              />
            </div>
          </div>

          {success && <SuccessNotice title={success.title === "created" ? d.done.created : success.title} signature={success.signature} />}
          {error && <ErrorNotice error={error} />}

          {/* 主按钮:手机上固定在屏幕底部,桌面上跟在卡片下面 */}
          <div className="fixed inset-x-0 bottom-0 z-20 max-h-[50vh] space-y-3 overflow-y-auto border-t-[1.5px] border-line bg-surface p-4 md:static md:max-h-none md:rounded-[20px] md:border-[1.5px]">
            {!publicKey ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm">{d.connect}</span>
                <WalletButton />
              </div>
            ) : buttons.length > 0 ? (
              <>
                {buttons}
                {pending && <WalletHint />}
              </>
            ) : (
              <p className="text-sm">{waitingMessage()}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

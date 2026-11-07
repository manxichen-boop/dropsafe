"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  bondHeld,
  displayStatus,
  formatCountdown,
  formatSol,
  isHttpUrl,
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
import { translateError } from "@/lib/errors";
import { dateLocale, useI18n } from "@/lib/i18n";
import { buyerStatsPda, contributionPda, escrowPda, organizerStatsPda, seatsByCampaign, useDropsafe } from "@/lib/program";
import { DitheredImage } from "@/components/os/DitheredImage";
import { TierShield } from "@/components/os/icons";
import { Lockie, type LockieMood } from "@/components/os/Lockie";
import { useOS } from "@/components/os/OS";
import { SeatBuddies } from "@/components/os/SeatBuddies";
import { useNow } from "@/components/useNow";

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

// 像素进度条:每一阶段是一格
function Timeline({ status }: { status: DisplayStatus }) {
  const { t } = useI18n();
  const d = t.detail;
  const refundPath = status === "failed" || status === "abandoned" || status === "cancelled";
  const labels = refundPath
    ? [d.stepRaising, status === "failed" ? d.stepNotFilled : status === "cancelled" ? d.stepCancelled : d.stepAbandoned, d.stepRefund]
    : [d.stepRaising, d.stepFunded, d.stepReleased, d.stepDone];
  const positions: Partial<Record<DisplayStatus, number>> = { open: 0, funded: 1, delivering: 2, appeal: 2, settling: 2, closed: 3 };
  const current = refundPath ? 2 : (positions[status] ?? 0);
  return (
    <ol className="flex border-2 border-ink">
      {labels.map((label, i) => {
        const finished = i < current || (i === current && status === "closed");
        const active = i === current && status !== "closed";
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`flex-1 border-l-2 border-ink p-1 text-center text-[13px] leading-tight first:border-l-0 ${
              finished ? "bg-safe font-semibold" : active ? (refundPath ? "bg-red font-semibold" : "bg-sun font-semibold") : ""
            }`}
          >
            {label}
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
    <button type="button" onClick={copy} className="btn shrink-0 !px-2 !py-1 !text-[13px]">
      {copied ? t.detail.copied : t.detail.copy}
    </button>
  );
}

export function CampaignWindow({ address }: { address: string }) {
  const campaignKey = useMemo(() => parseAddress(address), [address]);
  const program = useDropsafe();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const now = useNow();
  const { lang, t } = useI18n();
  const { open, confirm, done, fail } = useOS();
  const d = t.detail;
  const say = t.os.say;

  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [escrowLamports, setEscrowLamports] = useState(0);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [buyerRecords, setBuyerRecords] = useState<Record<string, BuyerStats | null>>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

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
      if (!alive.current) return;
      setCampaign(account);
      const mine = seatsByCampaign([campaignKey], allSeats)[campaignKey.toBase58()] ?? [];
      setSeats(mine);
      if (escrowInfo) {
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

  // 签名前先弹系统对话框,成功或失败再弹结果
  const send = async (text: string, doneText: string, build: () => Promise<string>, danger = false) => {
    const ok = await confirm({ text, confirmLabel: t.os.confirm, danger });
    if (!ok) return;
    setPending(true);
    try {
      const signature = await build();
      clearChainCache();
      await refresh();
      // RPC 的列表查询比交易确认慢一点,稍后再读一次
      setTimeout(() => {
        clearChainCache();
        refresh();
      }, 4_000);
      void done(doneText, signature);
    } catch (e) {
      console.warn(e);
      void fail(translateError(e));
    } finally {
      setPending(false);
    }
  };

  if (campaign === undefined && !loadFailed) return <p className="py-8 text-center">{d.loading}</p>;
  if (loadFailed && !campaign) {
    return (
      <div className="py-6 text-center">
        <p>{d.loadFailed}</p>
        <button type="button" onClick={refresh} className="btn mt-2">
          {d.retry}
        </button>
      </div>
    );
  }
  if (!campaign || !campaignKey || !escrowKey) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <Lockie mood="sleeping" size={96} decorative />
        <p className="mt-2">{d.notFound}</p>
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
    send(say.join(price), d.done.joined, () =>
      program.methods.contribute().accountsPartial({ ...buyerAccounts(), organizerStats, systemProgram: SystemProgram.programId }).rpc()
    );
  const withdraw = () => send(say.leave(price), d.done.left, () => program.methods.withdrawBeforeFill().accountsPartial(buyerAccounts()).rpc());
  const refund = () =>
    send(say.refund(price), d.done.refunded, () => program.methods.refund().accountsPartial({ ...buyerAccounts(), organizerStats }).rpc());
  const cancel = () =>
    send(
      say.cancel,
      d.done.cancelled,
      () => program.methods.cancelCampaign().accountsPartial({ organizer: publicKey!, campaign: campaignKey, organizerStats }).rpc(),
      true
    );
  const release = () =>
    send(say.withdraw(formatSol(releaseAmount(campaign))), d.done.withdrawn, () =>
      program.methods.releaseUpfront().accountsPartial({ organizer: publicKey!, campaign: campaignKey, escrow: escrowKey, organizerStats }).rpc()
    );
  const finalizeIx = () => program.methods.finalizeCampaign().accountsPartial({ caller: publicKey!, campaign: campaignKey, organizerStats }).instruction();
  const reclaim = () =>
    send(say.reclaim(formatSol(campaign.bondTotal)), d.done.reclaimed, async () => {
      // 链上状态还没更新时(比如没人退款),先在同一笔交易里记录结果
      const needsFinalize = !campaign.finalized && ("fundraising" in campaign.status || "funded" in campaign.status);
      return program.methods
        .reclaimBond()
        .accountsPartial({ organizer: publicKey!, campaign: campaignKey, escrow: escrowKey })
        .preInstructions(needsFinalize ? [await finalizeIx()] : [])
        .rpc();
    });
  const confirmDelivery = () =>
    send(say.confirm, d.done.confirmed, () =>
      program.methods.confirmDelivery().accountsPartial({ buyer: publicKey!, campaign: campaignKey, contribution: contributionPda(campaignKey, publicKey!) }).rpc()
    );
  const report = () =>
    send(
      tier === "trust" ? say.reportTrust : say.report(formatSol(reportAmount(campaign))),
      d.done.reported,
      () => program.methods.reportNotReceived().accountsPartial({ buyer: publicKey!, campaign: campaignKey, contribution: contributionPda(campaignKey, publicKey!) }).rpc(),
      true
    );
  const settleText = (seat: Seat) => {
    const amount = settleAmount(campaign);
    if (amount.isZero()) return say.settleNone;
    return say.settle(formatSol(amount), "reported" in seat.account.status ? d.toBuyer : d.toOrganizer);
  };
  const settle = (seat: Seat) =>
    send(settleText(seat), d.done.settled, () =>
      program.methods
        .settleSeat()
        .accountsPartial({
          caller: publicKey!,
          organizer,
          buyer: seat.account.buyer,
          campaign: campaignKey,
          escrow: escrowKey,
          contribution: contributionPda(campaignKey, seat.account.buyer),
          organizerStats,
          buyerStats: buyerStatsPda(seat.account.buyer),
        })
        .rpc()
    );
  const finalize = () =>
    send(say.finalize, d.done.finalized, () =>
      program.methods.finalizeCampaign().accountsPartial({ caller: publicKey!, campaign: campaignKey, organizerStats }).rpc()
    );

  const label = (text: string) => (pending ? d.pending : text);
  const refundable = status === "failed" || status === "abandoned" || status === "cancelled";

  const buttons: React.ReactNode[] = [];
  if (publicKey) {
    if (status === "open" && !mySeat)
      buttons.push(
        <button key="join" type="button" onClick={contribute} disabled={pending} className="btn-primary w-full">
          {label(d.join(price))}
        </button>
      );
    if (status === "open" && mySeat)
      buttons.push(
        <button key="leave" type="button" onClick={withdraw} disabled={pending} className="btn w-full">
          {label(d.leave(price))}
        </button>
      );
    if (refundable && mySeat)
      buttons.push(
        <button key="refund" type="button" onClick={refund} disabled={pending} className="btn-primary w-full">
          {label(d.refund(price))}
        </button>
      );
    if (status === "funded" && isOrganizer)
      buttons.push(
        <button key="release" type="button" onClick={release} disabled={pending} className="btn-primary w-full">
          {label(d.withdraw(formatSol(releaseAmount(campaign))))}
        </button>
      );
    if ((status === "delivering" || status === "appeal") && mySeatPaid)
      buttons.push(
        <button key="confirm" type="button" onClick={confirmDelivery} disabled={pending} className="btn-primary w-full">
          {label(d.confirm)}
        </button>
      );
    if (status === "appeal" && mySeatPaid)
      buttons.push(
        <button key="report" type="button" onClick={report} disabled={pending} className="btn-danger w-full">
          {label(tier === "trust" ? d.reportTrust : d.report(formatSol(reportAmount(campaign))))}
        </button>
      );
    if (status === "open" && isOrganizer)
      buttons.push(
        <button key="cancel" type="button" onClick={cancel} disabled={pending} className="btn-danger w-full">
          {label(d.cancel)}
        </button>
      );
    if (refundable && isOrganizer && !campaign.bondTotal.isZero() && !campaign.bondReclaimed)
      buttons.push(
        <button key="reclaim" type="button" onClick={reclaim} disabled={pending} className="btn-primary w-full">
          {label(d.reclaim(formatSol(campaign.bondTotal)))}
        </button>
      );
    if (!campaign.finalized && (refundable || status === "closed"))
      buttons.push(
        <button key="finalize" type="button" onClick={finalize} disabled={pending} className="btn w-full">
          {label(d.finalize)}
        </button>
      );
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
  const canSettle = (seat: Seat) => "active" in campaign.status && status !== "closed" && (!("paid" in seat.account.status) || appealOver);
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
    <div className="space-y-4">
      <div>
        <h2 className="pixel-title break-words text-xl leading-tight">{campaign.title}</h2>
        <p className="mt-1 text-[13px]">{t.status[status]}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div>
          <DitheredImage url={campaign.imageUrl} alt={campaign.title} width={128} placeholderSize={96} className="h-[180px] w-full border-2 border-ink" />
          {campaign.imageUrl && isHttpUrl(campaign.imageUrl) && (
            <>
              <a href={campaign.imageUrl} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-[13px] underline underline-offset-4">
                {t.os.groupBuys.original}
              </a>
              <p className="text-[13px]">{d.imageNote}</p>
            </>
          )}
          <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed">{campaign.description || d.noDescription}</p>
        </div>

        <div className="space-y-3">
          <div className="panel flex items-center gap-3">
            <TierShield tier={tier} size={32} />
            <div>
              <p className="pixel-title">{t.tier[tier]}</p>
              <p className="leading-snug">{t.tier.recovery(RECOVERY_PERCENT[tier])}</p>
              {tier !== "trust" && <p className="text-[13px]">{t.tier.recoveryNote}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Lockie mood={MOOD[status]} size={64} className="shrink-0" />
            <p className="text-[13px] leading-relaxed">{d.explain[status]}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[13px]">{d.price}</dt>
              <dd className="pixel-num text-xl">{price} SOL</dd>
            </div>
            <div>
              <dt className="text-[13px]">{timeLabel}</dt>
              <dd className="pixel-num text-xl">{next === null || next <= now ? t.ended : formatCountdown(next - now)}</dd>
            </div>
          </dl>
          <p className="text-[13px]">{d.lockedUntil(formatDate(campaign.appealEnd.toNumber()))}</p>
          <div>
            <p className="mb-1 text-[13px]">
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
      </div>

      <section>
        <h3 className="pixel-title mb-1">{d.timeline}</h3>
        <Timeline status={status} />
        <dl className="mt-2 space-y-0.5 text-[13px]">
          {deadlines.map((step) => (
            <div key={step.label} className="flex flex-wrap justify-between gap-x-4">
              <dt className={now >= step.at ? "" : "font-semibold"}>{step.label}</dt>
              <dd>{formatDate(step.at)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel">
        <h3 className="pixel-title">{d.fundsTitle}</h3>
        <p className="mt-1 text-[13px] leading-relaxed">{d.fundsNote}</p>
        <dl className="mt-2 space-y-2 text-[13px]">
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt>{d.fundsLocked}</dt>
            <dd className="font-semibold">{formatSol(escrowLamports)} SOL</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt>{d.fundsBuyers}</dt>
            <dd>{formatSol(buyerFunds)} SOL</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt>{d.fundsBond}</dt>
            <dd>{formatSol(bond)} SOL</dd>
          </div>
          <div>
            <dt>{d.fundsAddress}</dt>
            <dd className="mt-1 flex items-center justify-between gap-2">
              <code className="min-w-0 break-all">{escrowKey.toBase58()}</code>
              <CopyAddress value={escrowKey.toBase58()} />
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt>{isOrganizer ? d.organizerYou : d.organizer}</dt>
            <dd>
              <button type="button" className="underline underline-offset-4" onClick={(e) => open("organizer", organizer.toBase58(), e.currentTarget)}>
                {shortAddress(organizer.toBase58())}
              </button>
            </dd>
          </div>
        </dl>
        <a href={explorerAddress(escrowKey.toBase58())} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13px] underline underline-offset-4">
          {d.explorer}
        </a>
      </section>

      {seats.length > 0 && (
        <section>
          <h3 className="pixel-title mb-1">{d.settleTitle}</h3>
          <ul className="border-2 border-ink">
            {seats.map((seat) => {
              const buyer = seat.account.buyer.toBase58();
              const record = buyerRecords[buyer];
              return (
                <li key={buyer} className="border-b-2 border-line p-2 text-[13px] last:border-b-0">
                  <div className="flex flex-wrap justify-between gap-2">
                    <button type="button" className="underline underline-offset-4" onClick={(e) => open("buyer", buyer, e.currentTarget)}>
                      {shortAddress(buyer)}
                    </button>
                    <span>{seatStatusLabel(seat)}</span>
                  </div>
                  {isOrganizer && (
                    <p className="mt-0.5">
                      {record ? d.buyerSummary(record.campaignsJoined.toString(), record.seatsConfirmed.toString(), record.seatsReported.toString()) : d.newBuyer}
                    </p>
                  )}
                  {publicKey && canSettle(seat) && (
                    <button type="button" onClick={() => settle(seat)} disabled={pending} className="btn mt-2 w-full !text-[13px]">
                      {label(settleLabel(seat))}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="os-sticky-bar space-y-2 border-t-2 border-ink pt-3">
        {!publicKey ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{d.connect}</span>
            <button type="button" className="btn-primary" onClick={() => setVisible(true)}>
              {t.os.connectWallet}
            </button>
          </div>
        ) : buttons.length > 0 ? (
          <>
            {buttons}
            {pending && <p className="text-[13px]">{t.walletHint}</p>}
          </>
        ) : (
          <p>{waitingMessage()}</p>
        )}
      </div>
    </div>
  );
}

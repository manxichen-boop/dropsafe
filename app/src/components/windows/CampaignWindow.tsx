"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BN from "bn.js";
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
  remainderOf,
  reportOpen,
  seatWindow,
  reportAmount,
  settleAmount,
  shortAddress,
  tierOf,
  type BuyerStats,
  type Campaign,
  type Contribution,
  type DisplayStatus,
  type Shipment,
  type TierName,
} from "@/lib/campaign";
import { chainRead, clearChainCache } from "@/lib/chain";
import { CLUSTER, explorerAddress } from "@/lib/config";
import { translateError } from "@/lib/errors";
import { dateLocale, useI18n } from "@/lib/i18n";
import {
  buyerStatsPda,
  campaignExtPda,
  contributionPda,
  escrowPda,
  organizerStatsExtPda,
  organizerStatsPda,
  seatsByCampaign,
  SHIPMENT_BATCH,
  shipmentPda,
  useDropsafe,
} from "@/lib/program";
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

// 物流参考信息只上链哈希。拼上名额地址再哈希,单号本身很难被逐个试出来
async function referenceHash(text: string, seat: PublicKey): Promise<number[]> {
  if (!text.trim()) return Array(32).fill(0);
  const bytes = new TextEncoder().encode(`${text.trim()}|${seat.toBase58()}`);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function toLocalInput(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseAddress(raw: string): PublicKey | null {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

// 像素进度条:每一阶段是一格
// 无资金保障团成团后团长一次拿走全款,没有尾款结算这一步
function Timeline({ status, tier }: { status: DisplayStatus; tier: TierName }) {
  const { t } = useI18n();
  const d = t.detail;
  const refundPath = status === "failed" || status === "abandoned" || status === "cancelled";
  const unsecured = tier === "trust";
  const labels = refundPath
    ? [d.stepRaising, status === "failed" ? d.stepNotFilled : status === "cancelled" ? d.stepCancelled : d.stepAbandoned, d.stepRefund]
    : unsecured
      ? [d.stepRaising, d.stepFunded, d.stepPaidFull]
      : [d.stepRaising, d.stepFunded, d.stepReleased, d.stepDone];
  const positions: Partial<Record<DisplayStatus, number>> = { open: 0, funded: 1, delivering: 2, appeal: 2, settling: 2, closed: unsecured ? 2 : 3 };
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
  const { open, confirm, done, fail, setCampaignTitle } = useOS();
  const d = t.detail;
  const say = t.os.say;

  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [escrowLamports, setEscrowLamports] = useState(0);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [buyerRecords, setBuyerRecords] = useState<Record<string, BuyerStats | null>>({});
  // 有 CampaignExt 的团购按名额的发货记录和 ETA 计算窗口;没有的是旧团购
  const [maxTransit, setMaxTransit] = useState<number | null>(null);
  const [shipments, setShipments] = useState<Record<string, Shipment | null>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [eta, setEta] = useState("");
  const [reference, setReference] = useState("");
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
      const [account, escrowInfo, allSeats, ext] = await Promise.all([
        program.account.campaign.fetchNullable(campaignKey),
        connection.getAccountInfo(escrowKey),
        chainRead("seats", () => program.account.contribution.all()),
        program.account.campaignExt.fetchNullable(campaignExtPda(campaignKey)),
      ]);
      if (!alive.current) return;
      setCampaign(account);
      if (account) setCampaignTitle(address, account.title);
      const mine = seatsByCampaign([campaignKey], allSeats)[campaignKey.toBase58()] ?? [];
      setSeats(mine);
      if (escrowInfo) {
        const rent = await connection.getMinimumBalanceForRentExemption(escrowInfo.data.length);
        setEscrowLamports(escrowInfo.lamports - rent);
      }
      setMaxTransit(ext ? ext.maxTransitSeconds.toNumber() : null);
      if (mine.length > 0) {
        const [records, ships] = await Promise.all([
          program.account.buyerStats.fetchMultiple(mine.map((seat) => buyerStatsPda(seat.account.buyer))),
          ext ? program.account.shipment.fetchMultiple(mine.map((seat) => shipmentPda(campaignKey, seat.account.buyer))) : Promise.resolve([]),
        ]);
        setBuyerRecords(Object.fromEntries(mine.map((seat, i) => [seat.account.buyer.toBase58(), records[i]])));
        setShipments(Object.fromEntries(mine.map((seat, i) => [seat.account.buyer.toBase58(), (ships[i] as Shipment | null) ?? null])));
      }
      setLoadFailed(false);
    } catch (e) {
      console.warn(e);
      setLoadFailed(true);
    }
  }, [address, campaignKey, escrowKey, program, setCampaignTitle]);

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

  const hasRules = maxTransit !== null;
  const windowOf = (seat: Seat) => seatWindow(campaign, hasRules, shipments[seat.account.buyer.toBase58()] ?? null);
  // 新规则下每个名额的窗口不同:有名额还没到报告时间算"等待收货",有名额能报告算"申诉期",都过了算"可结算"
  const baseStatus = displayStatus(campaign, now);
  const openSeats = seats.filter((seat) => "paid" in seat.account.status);
  const status: DisplayStatus =
    hasRules && "active" in campaign.status && baseStatus !== "closed"
      ? openSeats.some((seat) => now < windowOf(seat).opens)
        ? "delivering"
        : openSeats.some((seat) => reportOpen(windowOf(seat), now))
          ? "appeal"
          : now < campaign.deliveryDeadline.toNumber()
            ? "delivering"
            : "settling"
      : baseStatus;
  const tier = tierOf(campaign);
  const organizer = campaign.organizer;
  const isOrganizer = publicKey?.equals(organizer) ?? false;
  const mySeat = publicKey ? seats.find((seat) => seat.account.buyer.equals(publicKey)) : undefined;
  const mySeatPaid = !!mySeat && "paid" in mySeat.account.status;
  const myWindow = mySeat ? windowOf(mySeat) : null;
  const canReport = mySeatPaid && "active" in campaign.status && !!myWindow && reportOpen(myWindow, now);
  const next = status === "appeal" && myWindow && mySeatPaid ? myWindow.closes : nextDeadline(campaign, status);
  const price = formatSol(campaign.price);
  const appeal = campaign.appealEnd.toNumber() - campaign.deliveryDeadline.toNumber();
  // 最晚锁定到:发货期限前一刻发货、ETA 用满最长运输时间、再加申诉期和一次延长
  const latestLock = hasRules ? campaign.deliveryDeadline.toNumber() + maxTransit! + appeal * 2 : campaign.appealEnd.toNumber();
  const timeLabel = (d.timeTo as Partial<Record<DisplayStatus, string>>)[status] ?? d.timeNone;
  const bond = bondHeld(campaign);
  const buyerFunds = Math.max(0, escrowLamports - bond.toNumber());
  // 团长提走预付款后,托管里买家那部分就是还没结算的尾款。
  // 金额读自链上余额;只有它正好等于"每个未结算名额的尾款"时才显示百分比
  const unresolvedSeats = campaign.joinedCount - campaign.seatsResolved;
  const showsRemainder = "active" in campaign.status && tier !== "trust" && unresolvedSeats > 0;
  const expectedRemainder = remainderOf(campaign.price).muln(unresolvedSeats).toNumber();
  const remainderPercent =
    showsRemainder && buyerFunds === expectedRemainder
      ? Math.round((buyerFunds * 1000) / (campaign.price.toNumber() * unresolvedSeats)) / 10
      : null;
  const formatDate = (seconds: number) => new Date(seconds * 1000).toLocaleString(dateLocale(lang));

  const organizerStats = organizerStatsPda(organizer);
  // 确认、报告、延长都要带上 CampaignExt 和这个名额的发货记录地址,合约用它们判断新旧规则
  const seatAccounts = (buyer: PublicKey) => ({
    campaign: campaignKey,
    campaignExt: campaignExtPda(campaignKey),
    contribution: contributionPda(campaignKey, buyer),
    shipment: shipmentPda(campaignKey, buyer),
  });
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
      program.methods.confirmDelivery().accountsPartial({ ...seatAccounts(publicKey!), buyer: publicKey! }).rpc()
    );
  const reportAccounts = () => ({
    ...seatAccounts(publicKey!),
    buyer: publicKey!,
    organizerStatsExt: organizerStatsExtPda(organizer),
    systemProgram: SystemProgram.programId,
  });
  const report = () =>
    send(
      tier === "trust" ? say.reportTrust : say.report(formatSol(reportAmount(campaign))),
      d.done.reported,
      () => program.methods.reportNotReceived().accountsPartial(reportAccounts()).rpc(),
      true
    );
  const reportUnshipped = () =>
    send(
      tier === "trust" ? say.reportUnshippedTrust : say.reportUnshipped(formatSol(reportAmount(campaign))),
      d.done.reported,
      () => program.methods.reportUnshipped().accountsPartial(reportAccounts()).rpc(),
      true
    );
  const extend = () =>
    send(say.extend(formatDate(myWindow!.closes + appeal)), d.done.extended, () =>
      program.methods
        .extendWaiting()
        .accountsPartial({ ...seatAccounts(publicKey!), buyer: publicKey!, systemProgram: SystemProgram.programId })
        .rpc()
    );

  // 批量提交发货记录:确认一次,按每批 8 个名额依次签名。一批失败不影响已经保存的批次
  const shipBy = campaign.deliveryDeadline.toNumber();
  const unshippedSeats = hasRules ? seats.filter((seat) => !shipments[seat.account.buyer.toBase58()]) : [];
  const pickedSeats = unshippedSeats.filter((seat) => picked[seat.account.buyer.toBase58()]);
  const latestEta = now + (maxTransit ?? 0);
  // 没改过输入框时用默认 ETA:最长运输时间的一半(至少 30 秒),两头都给链上时间留余量
  const etaInput = eta || toLocalInput(Math.min(latestEta, now + Math.max(30, Math.floor((maxTransit ?? 0) / 2))));
  const etaSeconds = Math.floor(new Date(etaInput).getTime() / 1000);
  const etaValid = !Number.isNaN(etaSeconds) && etaSeconds >= now && etaSeconds <= latestEta;
  const canShip = isOrganizer && hasRules && ("funded" in campaign.status || "active" in campaign.status) && now < shipBy;
  const recordShipments = async () => {
    if (!etaValid || pickedSeats.length === 0) return;
    const ok = await confirm({ text: say.ship(pickedSeats.length), confirmLabel: t.os.confirm });
    if (!ok) return;
    setPending(true);
    const batches: Seat[][] = [];
    for (let i = 0; i < pickedSeats.length; i += SHIPMENT_BATCH) batches.push(pickedSeats.slice(i, i + SHIPMENT_BATCH));
    let saved = 0;
    let signature = "";
    try {
      for (const group of batches) {
        const entries = await Promise.all(group.map(async (seat) => ({ eta: new BN(etaSeconds), referenceHash: await referenceHash(reference, seat.publicKey) })));
        signature = await program.methods
          .recordShipmentBatch(entries)
          .accountsPartial({ organizer: publicKey!, campaign: campaignKey, campaignExt: campaignExtPda(campaignKey), systemProgram: SystemProgram.programId })
          .remainingAccounts(
            group.flatMap((seat) => [
              { pubkey: seat.publicKey, isSigner: false, isWritable: false },
              { pubkey: shipmentPda(campaignKey, seat.account.buyer), isSigner: false, isWritable: true },
            ])
          )
          .rpc();
        saved += 1;
      }
      setPicked({});
      clearChainCache();
      await refresh();
      void done(batches.length > 1 ? `${d.done.shipped} · ${d.shipProgress(saved, batches.length)}` : d.done.shipped, signature);
    } catch (e) {
      console.warn(e);
      clearChainCache();
      await refresh();
      const error = translateError(e);
      void fail(saved > 0 ? { zh: `${t.detail.shipProgress(saved, batches.length)}。${error.zh}`, en: `${d.shipProgress(saved, batches.length)}. ${error.en}` } : error);
    } finally {
      setPending(false);
    }
  };
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
          campaignExt: campaignExtPda(campaignKey),
          shipment: shipmentPda(campaignKey, seat.account.buyer),
          organizerStatsExt: organizerStatsExtPda(organizer),
          systemProgram: SystemProgram.programId,
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
    if (status === "open" && !mySeat && !isOrganizer)
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
    if ("active" in campaign.status && mySeatPaid && myWindow && now < myWindow.closes)
      buttons.push(
        <button key="confirm" type="button" onClick={confirmDelivery} disabled={pending} className="btn-primary w-full">
          {label(d.confirm)}
        </button>
      );
    if (canReport && myWindow!.shipped === false)
      buttons.push(
        <button key="report-unshipped" type="button" onClick={reportUnshipped} disabled={pending} className="btn-danger w-full">
          {label(tier === "trust" ? d.reportUnshippedTrust : d.reportUnshipped(formatSol(reportAmount(campaign))))}
        </button>
      );
    if (canReport && myWindow!.shipped !== false)
      buttons.push(
        <button key="report" type="button" onClick={report} disabled={pending} className="btn-danger w-full">
          {label(tier === "trust" ? d.reportTrust : d.report(formatSol(reportAmount(campaign))))}
        </button>
      );
    if (canReport && hasRules && !myWindow!.extended)
      buttons.push(
        <button key="extend" type="button" onClick={extend} disabled={pending} className="btn w-full">
          {label(d.extend)}
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
    // 有自己的名额时,按这个名额的窗口说明下一步
    if (mySeat && !mySeatPaid && "active" in campaign.status) return d.wait.seatDecided;
    if (mySeatPaid && myWindow && "active" in campaign.status) {
      if (now >= myWindow.closes) return d.wait.seatClosed;
      if (now < myWindow.opens) return d.wait.seatWaiting(formatDate(myWindow.opens));
    }
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
  // 每个名额按自己的截止时间结算,和合约一致
  const canSettle = (seat: Seat) => "active" in campaign.status && status !== "closed" && (!("paid" in seat.account.status) || now >= windowOf(seat).closes);
  const seatShipLine = (seat: Seat) => {
    if (!hasRules) return null;
    const w = windowOf(seat);
    const ship = shipments[seat.account.buyer.toBase58()];
    const head = ship?.shipped ? d.seatShipped(formatDate(ship.eta.toNumber())) : now >= shipBy ? d.seatOverdue : d.seatNotShipped;
    const tail = "paid" in seat.account.status ? ` · ${d.seatReportBy(formatDate(w.closes))}${w.extended ? ` · ${d.seatExtended}` : ""}` : "";
    return head + tail;
  };
  const settleLabel = (seat: Seat) => {
    const amount = settleAmount(campaign);
    if (amount.isZero()) return d.settleNoMoney;
    return d.settle(formatSol(amount), "reported" in seat.account.status ? d.toBuyer : d.toOrganizer);
  };

  const deadlines: { label: string; at: number; note?: string }[] = [
    { label: d.joinBy, at: campaign.deadline.toNumber() },
    { label: d.shipBy, at: campaign.deliveryDeadline.toNumber() },
    ...(hasRules && !(myWindow && mySeatPaid)
      ? []
      : [{ label: d.reportBy, at: myWindow && mySeatPaid ? myWindow.closes : campaign.appealEnd.toNumber(), note: CLUSTER === "devnet" ? d.appealNote : undefined }]),
  ];

  return (
    <div className="space-y-4">
      {canReport && (
        <div role="status" className="border-2 border-ink bg-sun p-3">
          <p className="pixel-title">{d.appealBanner}</p>
          <p className="pixel-num text-2xl">{formatCountdown(Math.max(0, myWindow!.closes - now))}</p>
          <p className="text-[13px]">
            {d.appealCloses(formatDate(myWindow!.closes))} {CLUSTER === "devnet" && d.appealNote}
          </p>
        </div>
      )}
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
          <p className="text-[13px]">{tier === "trust" ? d.lockedUnsecured : d.lockedUntil(formatDate(latestLock))}</p>
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
        <Timeline status={status} tier={tier} />
        <dl className="mt-2 space-y-0.5 text-[13px]">
          {deadlines.map((step) => (
            <div key={step.label} className="flex flex-wrap justify-between gap-x-4">
              <dt className={now >= step.at ? "" : "font-semibold"}>
                {step.label}
                {step.note && <span className="ml-1 font-normal">{step.note}</span>}
              </dt>
              <dd>{formatDate(step.at)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {("active" in campaign.status || "funded" in campaign.status || "closed" in campaign.status) && (
        <section>
          <h3 className="pixel-title mb-1">{d.shipTitle}</h3>
          <p className="text-[13px] leading-relaxed">{hasRules ? d.shipNote : d.legacyNote}</p>
          {hasRules && mySeat && <p className="mt-1 text-[13px] font-semibold">{seatShipLine(mySeat)}</p>}
          {hasRules && <p className="mt-1 text-[13px] leading-relaxed">{d.defaultNote}</p>}
          {canShip && (
            <div className="panel mt-2 space-y-2 text-[13px]">
              <p className="pixel-title">{d.shipPanelTitle}</p>
              <p>{d.shipPanelNote}</p>
              {unshippedSeats.length === 0 ? (
                <p>{d.shipNone}</p>
              ) : (
                <>
                  <label className="flex items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="accent-ink"
                      checked={pickedSeats.length === unshippedSeats.length}
                      onChange={(e) => setPicked(e.target.checked ? Object.fromEntries(unshippedSeats.map((seat) => [seat.account.buyer.toBase58(), true])) : {})}
                    />
                    {d.shipSelectAll} ({pickedSeats.length}/{unshippedSeats.length})
                  </label>
                  <ul className="max-h-40 overflow-auto border-2 border-ink">
                    {unshippedSeats.map((seat) => {
                      const key = seat.account.buyer.toBase58();
                      return (
                        <li key={key} className="border-b-2 border-line px-2 py-1 last:border-b-0">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" className="accent-ink" checked={!!picked[key]} onChange={(e) => setPicked((prev) => ({ ...prev, [key]: e.target.checked }))} />
                            {shortAddress(key)}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <div>
                    <label htmlFor={`eta-${address}`} className="font-semibold">
                      {d.etaLabel}
                    </label>
                    <input
                      id={`eta-${address}`}
                      type="datetime-local"
                      step={1}
                      className="field mt-1"
                      value={etaInput}
                      onChange={(e) => setEta(e.target.value)}
                    />
                    <p className="mt-1">{!etaValid ? d.etaError(formatDate(latestEta)) : d.etaHint(formatDate(latestEta))}</p>
                  </div>
                  <div>
                    <label htmlFor={`ref-${address}`} className="font-semibold">
                      {d.refLabel}
                    </label>
                    <input id={`ref-${address}`} className="field mt-1" value={reference} onChange={(e) => setReference(e.target.value)} />
                    <p className="mt-1">{d.refHint}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={pending || pickedSeats.length === 0 || !etaValid}
                    onClick={() => void recordShipments()}
                  >
                    {label(d.shipSubmit(pickedSeats.length))}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h3 className="pixel-title">{d.fundsTitle}</h3>
        <p className="mt-1 text-[13px] leading-relaxed">{d.fundsNote}</p>
        <dl className="mt-2 space-y-2 text-[13px]">
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt>{d.fundsLocked}</dt>
            <dd className="font-semibold">{formatSol(escrowLamports)} SOL</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt>{showsRemainder ? d.fundsRemainder : d.fundsBuyers}</dt>
            <dd>
              {formatSol(buyerFunds)} SOL{showsRemainder && remainderPercent !== null ? ` (${remainderPercent}%)` : ""}
            </dd>
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
                  {seatShipLine(seat) && <p className="mt-0.5">{seatShipLine(seat)}</p>}
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

      <div className="os-sticky-bar space-y-2">
        {!publicKey ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{d.connect}</span>
            <button type="button" className="btn-primary" onClick={() => setVisible(true)}>
              {t.os.connectWallet}
            </button>
          </div>
        ) : buttons.length > 0 ? (
          <>
            {status === "open" && isOrganizer && <p className="text-[13px]">{d.organizerCantJoin}</p>}
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

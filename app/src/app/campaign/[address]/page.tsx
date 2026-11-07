"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  displayStatus,
  formatCountdown,
  formatSol,
  holdbackPerBuyer,
  nextDeadline,
  shortAddress,
  upfrontTotal,
  type Campaign,
  type DisplayStatus,
} from "@/lib/campaign";
import { explorerAddress } from "@/lib/config";
import { translateError, type FriendlyError } from "@/lib/errors";
import { contributionPda, escrowPda, useDropsafe } from "@/lib/program";
import { ErrorNotice, SuccessNotice, WalletHint } from "@/components/Notice";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge, STATUS_TONE } from "@/components/StatusBadge";
import { useNow } from "@/components/useNow";
import { WalletButton } from "@/components/WalletButton";

// 一笔交易放不下太多结算指令,一次最多领取这么多位买家的尾款
const MAX_CLAIMS_PER_TX = 4;

const STATUS_EXPLAINER: Record<DisplayStatus, string> = {
  open: "Funds are locked in escrow. If the target isn't reached by the deadline, every buyer can take their SOL back.",
  funded: "The target was reached. The organizer can now withdraw 70% to place the order. The last 30% stays in escrow.",
  failed: "The target wasn't reached by the deadline. Every buyer can take their SOL back.",
  abandoned: "The organizer didn't withdraw before the shipping deadline. Every buyer can take their full payment back.",
  delivering: "The organizer has withdrawn 70%. The last 30% stays in escrow until buyers confirm delivery or the dispute window closes.",
  dispute: "The shipping deadline has passed. Buyers who didn't receive their goods can report it now and take back their 30%.",
  claimable: "The dispute window has closed. The organizer can claim the 30% from buyers who didn't report a problem.",
  completed: "Every buyer's share has been settled. This campaign is complete.",
};

const STATUS_TIME_LABEL: Partial<Record<DisplayStatus, string>> = {
  open: "Time left to join",
  funded: "Time left to withdraw",
  delivering: "Time left to ship",
  dispute: "Time left to report",
};

function parseAddress(raw: string): PublicKey | null {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
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

  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [escrowLamports, setEscrowLamports] = useState(0);
  const [joined, setJoined] = useState(false);
  const [unconfirmedBuyers, setUnconfirmedBuyers] = useState<PublicKey[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<{ title: string; signature?: string } | null>(
    created ? { title: "Campaign created", signature: created } : null
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
      const [account, escrowInfo, contribution, contributions] = await Promise.all([
        program.account.campaign.fetchNullable(campaignKey),
        connection.getAccountInfo(escrowKey),
        publicKey ? connection.getAccountInfo(contributionPda(campaignKey, publicKey)) : Promise.resolve(null),
        // 凭证还在,说明这位买家的份额还没结算。campaign 字段紧跟在 8 字节的账户标识后面
        program.account.contribution.all([{ memcmp: { offset: 8, bytes: campaignKey.toBase58() } }]),
      ]);
      setCampaign(account);
      setJoined(contribution !== null);
      setUnconfirmedBuyers(contributions.map((row) => row.account.buyer));
      if (escrowInfo) {
        // 账户余额里有一部分是租金,不属于买家托管的钱,要扣掉再显示
        const rent = await connection.getMinimumBalanceForRentExemption(escrowInfo.data.length);
        setEscrowLamports(escrowInfo.lamports - rent);
      }
      setLoadFailed(false);
    } catch (e) {
      console.warn(e);
      setLoadFailed(true);
    }
  }, [campaignKey, escrowKey, program, publicKey]);

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
      await refresh();
    } catch (e) {
      console.warn(e);
      setError(translateError(e));
    } finally {
      setPending(false);
    }
  };

  if (campaign === undefined && !loadFailed) return <p className="py-12 text-center text-muted">Loading campaign…</p>;
  if (loadFailed && !campaign) {
    return (
      <div className="py-12 text-center">
        <p className="text-rose">读取链上数据失败。 Couldn&apos;t load this campaign.</p>
        <button onClick={refresh} className="mt-2 underline underline-offset-4">
          Try again
        </button>
      </div>
    );
  }
  if (!campaign || !campaignKey || !escrowKey) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">This campaign doesn&apos;t exist.</p>
        <Link href="/" className="mt-2 inline-block text-mint underline underline-offset-4">
          Back to all campaigns
        </Link>
      </div>
    );
  }

  const status = displayStatus(campaign, now);
  const isOrganizer = publicKey?.equals(campaign.organizer) ?? false;
  const next = nextDeadline(campaign, status);
  const price = formatSol(campaign.pricePerPersonLamports);
  const holdback = formatSol(holdbackPerBuyer(campaign));
  const buyerAccounts = () => ({
    buyer: publicKey!,
    campaign: campaignKey,
    escrow: escrowKey,
    contribution: contributionPda(campaignKey, publicKey!),
  });

  const contribute = () =>
    send("You joined the campaign", () =>
      program.methods
        .contribute()
        .accountsPartial({ ...buyerAccounts(), systemProgram: SystemProgram.programId })
        .rpc()
    );

  const refund = () =>
    send("Your SOL is back in your wallet", () =>
      program.methods.refund().accountsPartial(buyerAccounts()).rpc()
    );

  const release = () =>
    send("70% withdrawn to your wallet", () =>
      program.methods
        .release()
        .accountsPartial({ organizer: publicKey!, campaign: campaignKey, escrow: escrowKey })
        .rpc()
    );

  const confirmDelivery = () =>
    send("Delivery confirmed. The organizer received your final 30%", () =>
      program.methods
        .confirmDelivery()
        .accountsPartial({ ...buyerAccounts(), organizer: campaign.organizer })
        .rpc()
    );

  const claimUndelivered = () =>
    send("Your SOL is back in your wallet", () =>
      program.methods.claimUndelivered().accountsPartial(buyerAccounts()).rpc()
    );

  const claimUnconfirmed = () =>
    send("Unconfirmed shares claimed", async () => {
      // 第一位买家作为主指令,其余的放进同一笔交易,团长只需签一次
      const [first, ...rest] = unconfirmedBuyers.slice(0, MAX_CLAIMS_PER_TX);
      const accountsFor = (buyer: PublicKey) => ({
        organizer: publicKey!,
        buyer,
        campaign: campaignKey,
        escrow: escrowKey,
        contribution: contributionPda(campaignKey, buyer),
      });
      const others = await Promise.all(
        rest.map((buyer) => program.methods.claimUnconfirmed().accountsPartial(accountsFor(buyer)).instruction())
      );
      return program.methods.claimUnconfirmed().accountsPartial(accountsFor(first)).postInstructions(others).rpc();
    });

  const primaryButton =
    "w-full rounded-lg bg-mint py-3 font-medium text-[#06241a] transition-opacity hover:opacity-90 disabled:opacity-50";
  const secondaryButton =
    "w-full rounded-lg border border-rose/50 py-3 font-medium text-rose transition-colors hover:bg-rose/10 disabled:opacity-50";

  const renderAction = () => {
    if (!publicKey) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted">Connect a wallet to take part.</span>
          <WalletButton />
        </div>
      );
    }

    const label = (text: string) => (pending ? "Confirm in your wallet…" : text);
    const buttons = [];

    if (status === "open" && !joined) {
      buttons.push(
        <button key="join" onClick={contribute} disabled={pending} className={primaryButton}>
          {label(`Join for ${price} SOL`)}
        </button>
      );
    }
    if (status === "failed" && joined) {
      buttons.push(
        <button key="refund" onClick={refund} disabled={pending} className={primaryButton}>
          {label(`Get my ${price} SOL back`)}
        </button>
      );
    }
    if (status === "abandoned" && joined) {
      buttons.push(
        <button key="full-refund" onClick={claimUndelivered} disabled={pending} className={primaryButton}>
          {label(`Get my ${price} SOL back`)}
        </button>
      );
    }
    if (status === "funded" && isOrganizer) {
      buttons.push(
        <button key="release" onClick={release} disabled={pending} className={primaryButton}>
          {label(`Withdraw 70% (${formatSol(upfrontTotal(campaign))} SOL)`)}
        </button>
      );
    }
    if ((status === "delivering" || status === "dispute" || status === "claimable") && joined) {
      buttons.push(
        <button key="confirm" onClick={confirmDelivery} disabled={pending} className={primaryButton}>
          {label(`I received my goods (release ${holdback} SOL to organizer)`)}
        </button>
      );
    }
    if (status === "dispute" && joined) {
      buttons.push(
        <button key="dispute" onClick={claimUndelivered} disabled={pending} className={secondaryButton}>
          {label(`I didn't receive my goods (get ${holdback} SOL back)`)}
        </button>
      );
    }
    if (status === "claimable" && isOrganizer && unconfirmedBuyers.length > 0) {
      const count = Math.min(unconfirmedBuyers.length, MAX_CLAIMS_PER_TX);
      buttons.push(
        <button key="claim" onClick={claimUnconfirmed} disabled={pending} className={primaryButton}>
          {label(`Claim ${count} unconfirmed ${count === 1 ? "share" : "shares"}`)}
        </button>
      );
    }

    if (buttons.length > 0) {
      return (
        <div className="space-y-3">
          {buttons}
          {pending && <WalletHint />}
        </div>
      );
    }

    return <p className="text-sm text-muted">{waitingMessage()}</p>;
  };

  const waitingMessage = () => {
    switch (status) {
      case "open":
        return "You've joined. Your SOL is safe in escrow.";
      case "funded":
        return joined ? "You've joined and the target was reached. Waiting for the organizer to withdraw." : "This campaign is full.";
      case "failed":
      case "abandoned":
        return "You have no SOL to claim in this campaign.";
      case "delivering":
        return isOrganizer ? "Ship the goods before the shipping deadline. Buyers can confirm delivery at any time." : "This campaign is awaiting delivery.";
      case "dispute":
        return isOrganizer ? "You can claim unconfirmed shares after the dispute window closes." : "You have no share to settle in this campaign.";
      case "claimable":
        return "Nothing left for you to do here.";
      default:
        return "Nothing left to do here.";
    }
  };

  const timeline = [
    { label: "Join by", at: campaign.deadlineUnixTs.toNumber() },
    { label: "Ship by", at: campaign.deliveryDeadlineUnixTs.toNumber() },
    { label: "Report problems by", at: campaign.disputeDeadlineUnixTs.toNumber() },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm text-muted transition-colors hover:text-ink">
        ← All campaigns
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight">{campaign.title || "Untitled"}</h1>
        <StatusBadge status={status} />
      </div>
      <p className="mt-2 text-muted">{STATUS_EXPLAINER[status]}</p>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <div className="mb-2 flex justify-between font-mono text-sm">
          <span>
            {campaign.contributorCount} / {campaign.targetCount} joined
          </span>
          <span className="text-muted">{price} SOL / person</span>
        </div>
        <ProgressBar current={campaign.contributorCount} target={campaign.targetCount} tone={STATUS_TONE[status].bar} />

        <dl className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted">In escrow</dt>
            <dd className="mt-1 font-mono text-2xl">{formatSol(escrowLamports)} SOL</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{STATUS_TIME_LABEL[status] ?? "Timeline"}</dt>
            <dd className="mt-1 font-mono text-2xl">{next === null ? "Ended" : formatCountdown(next - now)}</dd>
          </div>
        </dl>

        <ol className="mt-6 space-y-1.5 border-t border-line pt-4 text-sm">
          {timeline.map((step) => (
            <li key={step.label} className="flex justify-between gap-4">
              <span className={now >= step.at ? "text-muted line-through" : ""}>{step.label}</span>
              <span className="font-mono text-muted">{new Date(step.at * 1000).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 space-y-3">
        {success && <SuccessNotice title={success.title} signature={success.signature} />}
        {error && <ErrorNotice error={error} />}
        <div className="rounded-xl border border-line bg-surface p-5">{renderAction()}</div>
      </div>

      <dl className="mt-6 space-y-2 text-sm">
        {[
          { label: isOrganizer ? "Organizer (you)" : "Organizer", value: campaign.organizer.toBase58() },
          { label: "Escrow account", value: escrowKey.toBase58() },
          { label: "Campaign account", value: campaignKey.toBase58() },
        ].map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted">{row.label}</dt>
            <dd>
              <a href={explorerAddress(row.value)} target="_blank" rel="noreferrer" className="font-mono underline underline-offset-4">
                {shortAddress(row.value)} ↗
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { displayStatus, formatCountdown, formatSol, shortAddress, type Campaign, type DisplayStatus } from "@/lib/campaign";
import { explorerAddress } from "@/lib/config";
import { translateError, type FriendlyError } from "@/lib/errors";
import { contributionPda, escrowPda, useDropsafe } from "@/lib/program";
import { ErrorNotice, SuccessNotice } from "@/components/Notice";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge, STATUS_TONE } from "@/components/StatusBadge";
import { useNow } from "@/components/useNow";
import { WalletButton } from "@/components/WalletButton";

const STATUS_EXPLAINER: Record<DisplayStatus, string> = {
  open: "Funds are locked in escrow. If the target isn't reached by the deadline, every buyer can take their SOL back.",
  funded: "The target was reached. The organizer can now withdraw the escrowed SOL.",
  failed: "The target wasn't reached by the deadline. Every buyer can take their SOL back.",
  released: "The organizer has withdrawn the escrowed SOL. This campaign is complete.",
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
      const [account, escrowInfo, contribution] = await Promise.all([
        program.account.campaign.fetchNullable(campaignKey),
        connection.getAccountInfo(escrowKey),
        publicKey ? connection.getAccountInfo(contributionPda(campaignKey, publicKey)) : Promise.resolve(null),
      ]);
      setCampaign(account);
      setJoined(contribution !== null);
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
  const deadline = campaign.deadlineUnixTs.toNumber();

  const contribute = () =>
    send("You joined the campaign", () =>
      program.methods
        .contribute()
        .accountsPartial({
          buyer: publicKey!,
          campaign: campaignKey,
          escrow: escrowKey,
          contribution: contributionPda(campaignKey, publicKey!),
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );

  const refund = () =>
    send("Your SOL is back in your wallet", () =>
      program.methods
        .refund()
        .accountsPartial({
          buyer: publicKey!,
          campaign: campaignKey,
          escrow: escrowKey,
          contribution: contributionPda(campaignKey, publicKey!),
        })
        .rpc()
    );

  const release = () =>
    send("Funds withdrawn to your wallet", () =>
      program.methods
        .release()
        .accountsPartial({ organizer: publicKey!, campaign: campaignKey, escrow: escrowKey })
        .rpc()
    );

  const primaryButton =
    "w-full rounded-lg bg-mint py-3 font-medium text-[#06241a] transition-opacity hover:opacity-90 disabled:opacity-50";

  const renderAction = () => {
    if (!publicKey) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted">Connect a wallet to take part.</span>
          <WalletButton />
        </div>
      );
    }
    const buttons = [];
    if (status === "open" && !joined) {
      buttons.push(
        <button key="join" onClick={contribute} disabled={pending} className={primaryButton}>
          {pending ? "Confirm in your wallet…" : `Join for ${formatSol(campaign.pricePerPersonLamports)} SOL`}
        </button>
      );
    }
    if (status === "failed" && joined) {
      buttons.push(
        <button key="refund" onClick={refund} disabled={pending} className={primaryButton}>
          {pending ? "Confirm in your wallet…" : `Get my ${formatSol(campaign.pricePerPersonLamports)} SOL back`}
        </button>
      );
    }
    if (status === "funded" && isOrganizer) {
      buttons.push(
        <button key="release" onClick={release} disabled={pending} className={primaryButton}>
          {pending ? "Confirm in your wallet…" : `Withdraw ${formatSol(escrowLamports)} SOL`}
        </button>
      );
    }
    if (buttons.length > 0) return <div className="space-y-3">{buttons}</div>;

    const message =
      status === "open"
        ? "You've joined. Your SOL is safe in escrow."
        : status === "funded"
          ? joined
            ? "You've joined and the target was reached. The organizer can withdraw now."
            : "This campaign is full."
          : status === "failed"
            ? "You have no SOL to claim in this campaign."
            : "Nothing left to do here.";
    return <p className="text-sm text-muted">{message}</p>;
  };

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
          <span className="text-muted">{formatSol(campaign.pricePerPersonLamports)} SOL / person</span>
        </div>
        <ProgressBar current={campaign.contributorCount} target={campaign.targetCount} tone={STATUS_TONE[status].bar} />

        <dl className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted">In escrow</dt>
            <dd className="mt-1 font-mono text-2xl">{formatSol(escrowLamports)} SOL</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Time left</dt>
            <dd className="mt-1 font-mono text-2xl">{status === "released" ? "Completed" : formatCountdown(deadline - now)}</dd>
            <dd className="mt-0.5 text-xs text-muted">{new Date(deadline * 1000).toLocaleString()}</dd>
          </div>
        </dl>
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

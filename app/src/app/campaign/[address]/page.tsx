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
import { dateLocale, useI18n } from "@/lib/i18n";
import { loadMeta, type CampaignMeta } from "@/lib/meta";
import { contributionPda, escrowPda, useDropsafe } from "@/lib/program";
import { ProductImage } from "@/components/CampaignCard";
import { CalendarIcon, CoinIcon, JarIcon, PeopleIcon } from "@/components/icons";
import { Lockie, type LockieMood } from "@/components/Lockie";
import { ErrorNotice, SuccessNotice, WalletHint } from "@/components/Notice";
import { SeatBuddies } from "@/components/SeatBuddies";
import { StatusBadge } from "@/components/StatusBadge";
import { useNow } from "@/components/useNow";
import { WalletButton } from "@/components/WalletButton";

// 一笔交易放不下太多结算指令,一次最多领取这么多位买家的尾款
const MAX_CLAIMS_PER_TX = 4;

const MOOD: Record<DisplayStatus, LockieMood> = {
  open: "waiting",
  funded: "celebrating",
  failed: "refunding",
  abandoned: "refunding",
  delivering: "guarding",
  dispute: "guarding",
  claimable: "paying",
  completed: "paying",
};

function parseAddress(raw: string): PublicKey | null {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

function Timeline({ status }: { status: DisplayStatus }) {
  const { t } = useI18n();
  const failedPath = status === "failed" || status === "abandoned";
  const steps = failedPath
    ? [t.detail.stepRaising, t.detail.stepNotFilled, t.detail.stepRefund]
    : [t.detail.stepRaising, t.detail.stepFunded, t.detail.stepReleased, t.detail.stepDone];
  const current = failedPath
    ? 2
    : status === "open"
      ? 0
      : status === "funded"
        ? 1
        : status === "completed"
          ? 3
          : 2;
  // 团长一直没提取的情况属于已成团,不是没凑满
  const labels = status === "abandoned" ? [t.detail.stepRaising, t.detail.stepFunded, t.detail.stepRefund] : steps;

  return (
    <ol className="space-y-2">
      {labels.map((label, i) => {
        const done = i < current || (i === current && status === "completed");
        const active = i === current && status !== "completed";
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={`h-4 w-4 shrink-0 rounded-full border-[1.5px] ${
                done
                  ? "border-safe bg-safe"
                  : active
                    ? failedPath
                      ? "border-danger bg-danger"
                      : "border-ink bg-sun"
                    : "border-line bg-surface"
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

  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [escrowLamports, setEscrowLamports] = useState(0);
  const [joined, setJoined] = useState(false);
  const [unconfirmedBuyers, setUnconfirmedBuyers] = useState<PublicKey[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [meta, setMeta] = useState<CampaignMeta>({});
  const [success, setSuccess] = useState<{ title: string; signature?: string } | null>(
    created ? { title: "created", signature: created } : null
  );
  const [error, setError] = useState<FriendlyError | null>(null);

  const escrowKey = useMemo(() => (campaignKey ? escrowPda(campaignKey) : null), [campaignKey]);

  useEffect(() => setMeta(loadMeta(address, lang)), [address, lang]);

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

  if (campaign === undefined && !loadFailed) return <p className="py-12 text-center text-muted">{t.detail.loading}</p>;
  if (loadFailed && !campaign) {
    return (
      <div className="py-12 text-center">
        <p className="text-danger-ink">{t.detail.loadFailed}</p>
        <button onClick={refresh} className="mt-2 font-semibold underline underline-offset-4">
          {t.detail.retry}
        </button>
      </div>
    );
  }
  if (!campaign || !campaignKey || !escrowKey) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Lockie mood="sleeping" size={140} decorative />
        <p className="mt-2 text-muted">{t.detail.notFound}</p>
        <Link href="/" className="mt-2 font-semibold underline underline-offset-4">
          {t.detail.backHome}
        </Link>
      </div>
    );
  }

  const status = displayStatus(campaign, now);
  const isOrganizer = publicKey?.equals(campaign.organizer) ?? false;
  const next = nextDeadline(campaign, status);
  const price = formatSol(campaign.pricePerPersonLamports);
  const holdback = formatSol(holdbackPerBuyer(campaign));
  const timeLabel = (t.detail.timeTo as Partial<Record<DisplayStatus, string>>)[status] ?? t.detail.timeNone;
  const claimCount = Math.min(unconfirmedBuyers.length, MAX_CLAIMS_PER_TX);
  const buyerAccounts = () => ({
    buyer: publicKey!,
    campaign: campaignKey,
    escrow: escrowKey,
    contribution: contributionPda(campaignKey, publicKey!),
  });

  const contribute = () =>
    send(t.detail.done.joined, () =>
      program.methods
        .contribute()
        .accountsPartial({ ...buyerAccounts(), systemProgram: SystemProgram.programId })
        .rpc()
    );

  const refund = () =>
    send(t.detail.done.refunded, () =>
      program.methods.refund().accountsPartial(buyerAccounts()).rpc()
    );

  const release = () =>
    send(t.detail.done.withdrawn, () =>
      program.methods
        .release()
        .accountsPartial({ organizer: publicKey!, campaign: campaignKey, escrow: escrowKey })
        .rpc()
    );

  const confirmDelivery = () =>
    send(t.detail.done.confirmed, () =>
      program.methods
        .confirmDelivery()
        .accountsPartial({ ...buyerAccounts(), organizer: campaign.organizer })
        .rpc()
    );

  const claimUndelivered = () =>
    send(t.detail.done.refunded, () =>
      program.methods.claimUndelivered().accountsPartial(buyerAccounts()).rpc()
    );

  const claimUnconfirmed = () =>
    send(t.detail.done.claimed, async () => {
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

  const buttonClass = "btn-primary w-full px-3 py-3 text-base";
  const secondaryClass = "btn-secondary w-full px-3 py-3 text-base";

  const actionButtons = () => {
    const label = (text: string) => (pending ? t.detail.pending : text);
    const buttons = [];
    if (status === "open" && !joined) {
      buttons.push(
        <button key="join" onClick={contribute} disabled={pending} className={buttonClass}>
          {label(t.detail.join(price))}
        </button>
      );
    }
    if (status === "failed" && joined) {
      buttons.push(
        <button key="refund" onClick={refund} disabled={pending} className={buttonClass}>
          {label(t.detail.refund(price))}
        </button>
      );
    }
    if (status === "abandoned" && joined) {
      buttons.push(
        <button key="full-refund" onClick={claimUndelivered} disabled={pending} className={buttonClass}>
          {label(t.detail.refund(price))}
        </button>
      );
    }
    if (status === "funded" && isOrganizer) {
      buttons.push(
        <button key="release" onClick={release} disabled={pending} className={buttonClass}>
          {label(t.detail.withdraw(formatSol(upfrontTotal(campaign))))}
        </button>
      );
    }
    if ((status === "delivering" || status === "dispute" || status === "claimable") && joined) {
      buttons.push(
        <button key="confirm" onClick={confirmDelivery} disabled={pending} className={buttonClass}>
          {label(t.detail.confirm(holdback))}
        </button>
      );
    }
    if (status === "dispute" && joined) {
      buttons.push(
        <button key="dispute" onClick={claimUndelivered} disabled={pending} className={secondaryClass}>
          {label(t.detail.dispute(holdback))}
        </button>
      );
    }
    if (status === "claimable" && isOrganizer && claimCount > 0) {
      buttons.push(
        <button key="claim" onClick={claimUnconfirmed} disabled={pending} className={buttonClass}>
          {label(t.detail.claim(formatSol(holdbackPerBuyer(campaign).muln(claimCount)), claimCount))}
        </button>
      );
    }
    return buttons;
  };

  const waitingMessage = () => {
    switch (status) {
      case "open":
        return t.detail.wait.open;
      case "funded":
        return joined ? t.detail.wait.fundedJoined : t.detail.wait.fundedOther;
      case "failed":
      case "abandoned":
        return t.detail.wait.noClaim;
      case "delivering":
        return isOrganizer ? t.detail.wait.deliveringOrganizer : t.detail.wait.deliveringOther;
      case "dispute":
        return isOrganizer ? t.detail.wait.disputeOrganizer : t.detail.wait.disputeOther;
      default:
        return t.detail.wait.nothing;
    }
  };

  const buttons = publicKey ? actionButtons() : [];

  const deadlines = [
    { label: t.detail.joinBy, at: campaign.deadlineUnixTs.toNumber() },
    { label: t.detail.shipBy, at: campaign.deliveryDeadlineUnixTs.toNumber() },
    { label: t.detail.reportBy, at: campaign.disputeDeadlineUnixTs.toNumber() },
  ];

  return (
    <div className="pb-44 md:pb-0">
      <Link href="/" className="text-sm font-medium underline-offset-4 hover:underline">
        ← {t.detail.back}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words font-display text-3xl font-semibold leading-tight md:text-4xl">{campaign.title}</h1>
        <StatusBadge status={status} />
      </div>

      <div className="mt-6 grid items-start gap-6 md:grid-cols-[1fr_400px]">
        {/* 手机上购买卡片排在商品图下面,说明和资金面板往后放 */}
        <div className="contents md:block md:space-y-6">
          <div className="order-1">
            <ProductImage meta={meta} title={campaign.title} large />
            <p className="mt-4 leading-relaxed">{meta.description ?? t.detail.noDescription}</p>
          </div>

          <section className="card order-3 p-5">
            <h2 className="font-display text-xl font-semibold">{t.detail.timeline}</h2>
            <div className="mt-4">
              <Timeline status={status} />
            </div>
            <dl className="mt-4 space-y-1.5 border-t-[1.5px] border-line pt-4 text-sm">
              {deadlines.map((step) => (
                <div key={step.label} className="flex flex-wrap justify-between gap-x-4">
                  <dt className={now >= step.at ? "text-muted" : "font-medium"}>{step.label}</dt>
                  <dd className="font-mono text-muted">{new Date(step.at * 1000).toLocaleString(dateLocale(lang))}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card order-4 p-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <JarIcon size={28} />
              {t.detail.fundsTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{t.detail.fundsNote}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted">{t.detail.fundsLocked}</dt>
                <dd className="mt-0.5 font-mono text-xl font-medium">{formatSol(escrowLamports)} SOL</dd>
              </div>
              <div>
                <dt className="text-muted">{t.detail.fundsAddress}</dt>
                <dd className="mt-1 flex items-center justify-between gap-3">
                  <code className="min-w-0 break-all font-mono text-sm">{escrowKey.toBase58()}</code>
                  <CopyAddress value={escrowKey.toBase58()} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">{isOrganizer ? t.detail.organizerYou : t.detail.organizer}</dt>
                <dd className="mt-0.5 font-mono">{shortAddress(campaign.organizer.toBase58())}</dd>
              </div>
            </dl>
            <a href={explorerAddress(escrowKey.toBase58())} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
              {t.detail.explorer}
            </a>
          </section>
        </div>

        <aside className="order-2 space-y-3 md:sticky md:top-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <Lockie mood={MOOD[status]} size={88} className="shrink-0" />
              <p className="text-sm leading-relaxed">{t.detail.explain[status]}</p>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="flex items-center gap-1.5 text-sm text-muted">
                  <CoinIcon size={20} />
                  {t.detail.price}
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

            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-sm text-muted">
                <PeopleIcon size={20} />
                {t.detail.seats}: {t.home.joinedCount(campaign.contributorCount, campaign.targetCount)}
              </p>
              <SeatBuddies
                campaign={address}
                target={campaign.targetCount}
                joined={campaign.contributorCount}
                buyers={unconfirmedBuyers.map((buyer) => buyer.toBase58())}
                size="lg"
                hop={status === "funded"}
                label={t.home.joinedCount(campaign.contributorCount, campaign.targetCount)}
              />
            </div>
          </div>

          {success && (
            <SuccessNotice
              title={success.title === "created" ? t.detail.done.created : success.title}
              signature={success.signature}
            />
          )}
          {error && <ErrorNotice error={error} />}

          {/* 主按钮:手机上固定在屏幕底部,桌面上跟在卡片下面 */}
          <div className="fixed inset-x-0 bottom-0 z-20 space-y-3 border-t-[1.5px] border-line bg-surface p-4 md:static md:rounded-[20px] md:border-[1.5px]">
            {!publicKey ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm">{t.detail.connect}</span>
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

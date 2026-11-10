"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import {
  displayStatus,
  formatCountdown,
  formatSol,
  nextDeadline,
  TIERS,
  tierOf,
  type Campaign,
  type DisplayStatus,
  type TierName,
} from "@/lib/campaign";
import { chainRead } from "@/lib/chain";
import { useI18n } from "@/lib/i18n";
import { seatsByCampaign, useDropsafe } from "@/lib/program";
import { DitheredImage } from "@/components/os/DitheredImage";
import { TierShield } from "@/components/os/icons";
import { Lockie } from "@/components/os/Lockie";
import { useOS } from "@/components/os/OS";
import { SeatBuddies } from "@/components/os/SeatBuddies";
import { useNow } from "@/components/useNow";

type Row = { publicKey: PublicKey; account: Campaign };
type View = "list" | "icons";

// 列表分三组:募集中 → 等待收货 → 已结束。组内保持新的在前
const GROUP_OF: Record<DisplayStatus, 0 | 1 | 2> = {
  open: 0,
  funded: 1,
  delivering: 1,
  appeal: 1,
  settling: 1,
  failed: 2,
  abandoned: 2,
  cancelled: 2,
  closed: 2,
};

// 开发时留下的测试活动删不掉:标题以 test 开头(不分大小写)的不显示,用网址仍可直接打开
const isTestListing = (title: string) => /^\s*test/i.test(title);

export function GroupBuysWindow() {
  const program = useDropsafe();
  const now = useNow();
  const { t } = useI18n();
  const { open, filter, setFilter } = useOS();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [buyers, setBuyers] = useState<Record<string, string[]>>({});
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("list");
  const [showEnded, setShowEnded] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [campaigns, seats] = await Promise.all([
        chainRead("campaigns", () => program.account.campaign.all()),
        chainRead("seats", () => program.account.contribution.all()),
      ]);
      const visible = campaigns.filter((row) => !isTestListing(row.account.title));
      setRows(visible.sort((a, b) => b.account.campaignId.cmp(a.account.campaignId)));
      const grouped = seatsByCampaign(campaigns.map((row) => row.publicKey), seats);
      setBuyers(Object.fromEntries(Object.entries(grouped).map(([k, list]) => [k, list.map((seat) => seat.account.buyer.toBase58())])));
    } catch (e) {
      console.warn(e);
      setFailed(true);
    }
  }, [program]);

  useEffect(() => {
    load();
  }, [load]);

  const groupOf = (row: Row) => GROUP_OF[displayStatus(row.account, now)];
  const inTier = rows?.filter((row) => filter === "all" || tierOf(row.account) === filter);
  const endedCount = inTier?.filter((row) => groupOf(row) === 2).length ?? 0;
  // sort 是稳定的,同一组里保持原来"新的在前"的顺序
  const shown = inTier?.filter((row) => showEnded || groupOf(row) !== 2).sort((a, b) => groupOf(a) - groupOf(b));
  const activate = (address: string, opener: HTMLElement) => open("campaign", address, opener);

  const handlers = (address: string) => ({
    onDoubleClick: (e: React.MouseEvent<HTMLElement>) => activate(address, e.currentTarget),
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      // 手机上单击直接打开
      if (window.matchMedia("(max-width: 767px)").matches) activate(address, e.currentTarget);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        activate(address, e.currentTarget);
      }
    },
  });

  const tag = (active: boolean) => `border-2 border-ink px-2 py-1 text-[13px] ${active ? "bg-ink text-paper" : "bg-paper"}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={t.home.filterLabel} className="flex flex-wrap gap-1">
          {(["all", ...TIERS] as (TierName | "all")[]).map((option) => (
            <button key={option} type="button" aria-pressed={filter === option} className={tag(filter === option)} onClick={() => setFilter(option)}>
              {option === "all" ? t.home.filterAll : t.tier[option]}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t.os.groupBuys.viewLabel} className="flex gap-1">
          {(["list", "icons"] as View[]).map((option) => (
            <button key={option} type="button" aria-pressed={view === option} className={tag(view === option)} onClick={() => setView(option)}>
              {t.os.groupBuys[option]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <p>{t.home.listNote}</p>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} className="accent-ink" />
          {t.os.groupBuys.showEnded}
        </label>
      </div>

      {failed && (
        <div className="panel mt-3 border-red">
          <p>{t.home.loadFailed}</p>
          <button type="button" className="btn mt-2" onClick={load}>
            {t.home.retry}
          </button>
        </div>
      )}
      {!failed && rows === null && <p className="py-8 text-center">{t.home.loading}</p>}
      {rows?.length === 0 && !failed && (
        <div className="flex flex-col items-center py-6 text-center">
          <Lockie mood="sleeping" size={96} decorative />
          <p className="mt-2">{t.home.empty}</p>
        </div>
      )}
      {rows && rows.length > 0 && shown?.length === 0 && <p className="py-6 text-center">{t.home.filterEmpty}</p>}
      {!showEnded && endedCount > 0 && <p className="mt-2 text-[13px]">{t.os.groupBuys.hiddenEnded(endedCount)}</p>}

      {view === "list" ? (
        <ul className="mt-3 border-2 border-ink">
          {shown?.map(({ publicKey, account }) => {
            const address = publicKey.toBase58();
            const status = displayStatus(account, now);
            const next = nextDeadline(account, status);
            return (
              <li key={address} className="border-b-2 border-line last:border-b-0">
                <div role="button" tabIndex={0} {...handlers(address)} className="grid cursor-default grid-cols-[48px_1fr] gap-3 p-2 hover:bg-line focus:bg-line">
                  <DitheredImage url={account.imageUrl} alt={account.title} width={48} placeholderSize={32} className="h-12 w-12" />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                        <TierShield tier={tierOf(account)} size={16} />
                        <span className="truncate">{account.title}</span>
                      </span>
                      <span className="whitespace-nowrap text-[13px]">{t.status[status]}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
                      <span>
                        {formatSol(account.price)} SOL {t.home.perPerson}
                      </span>
                      <span>{next === null || next <= now ? t.ended : formatCountdown(next - now)}</span>
                    </div>
                    <div className="mt-1">
                      <SeatBuddies campaign={address} target={account.targetCount} joined={account.joinedCount} buyers={buyers[address] ?? []} hop={false} label={t.home.joinedCount(account.joinedCount, account.targetCount)} />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown?.map(({ publicKey, account }) => {
            const address = publicKey.toBase58();
            return (
              <div key={address} role="button" tabIndex={0} {...handlers(address)} className="flex cursor-default flex-col items-center gap-1 p-2 text-center hover:bg-line focus:bg-line">
                <DitheredImage url={account.imageUrl} alt={account.title} width={64} placeholderSize={64} className="h-16 w-16" />
                <span className="flex items-center gap-1 text-[13px] font-semibold">
                  <TierShield tier={tierOf(account)} size={16} />
                  {formatSol(account.price)} SOL
                </span>
                <span className="line-clamp-2 text-[13px]">{account.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

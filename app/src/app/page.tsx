"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { formatSol, type Campaign } from "@/lib/campaign";
import { useI18n } from "@/lib/i18n";
import { escrowPda, useDropsafe } from "@/lib/program";
import { CampaignCard } from "@/components/CampaignCard";
import { LiveStats, type Stats } from "@/components/LiveStats";
import { Lockie } from "@/components/Lockie";
import { StoryLine } from "@/components/StoryLine";
import { useNow } from "@/components/useNow";

type Row = { publicKey: PublicKey; account: Campaign };

const CHUNK = 100;

export default function HomePage() {
  const program = useDropsafe();
  const now = useNow();
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [buyersByCampaign, setBuyersByCampaign] = useState<Record<string, string[]>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const connection = program.provider.connection;
      const [campaigns, contributions] = await Promise.all([
        program.account.campaign.all(),
        program.account.contribution.all(),
      ]);

      const buyers: Record<string, string[]> = {};
      for (const row of contributions) {
        (buyers[row.account.campaign.toBase58()] ??= []).push(row.account.buyer.toBase58());
      }
      setBuyersByCampaign(buyers);

      // 实时数据全部算自链上账户,不写死任何数字
      const escrowKeys = campaigns.map((row) => escrowPda(row.publicKey));
      let lockedLamports = 0;
      for (let i = 0; i < escrowKeys.length; i += CHUNK) {
        const infos = await connection.getMultipleAccountsInfo(escrowKeys.slice(i, i + CHUNK));
        for (const info of infos) {
          if (!info) continue;
          lockedLamports += info.lamports - (await connection.getMinimumBalanceForRentExemption(info.data.length));
        }
      }

      let funded = 0;
      let refunds = 0;
      for (const { publicKey, account } of campaigns) {
        if (account.contributorCount >= account.targetCount) funded += 1;
        // 还没放款的活动里,凭证被关闭就意味着买家退款了
        if ("failed" in account.status || "fundraising" in account.status) {
          refunds += account.contributorCount - (buyers[publicKey.toBase58()]?.length ?? 0);
        }
      }
      setStats({ lockedSol: formatSol(lockedLamports), funded, refunds });

      // 开发时留下的测试活动删不掉(合约没有删除功能),只在首页隐藏,详情页仍可直接打开
      const visible = campaigns.filter((row) => !row.account.title.startsWith("Test:"));
      setRows(visible.sort((a, b) => b.account.campaignId.cmp(a.account.campaignId)));
    } catch (e) {
      console.warn(e);
      setFailed(true);
    }
  }, [program]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <section className="grid items-center gap-6 md:grid-cols-[1.6fr_1fr]">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] [text-wrap:balance] md:text-6xl">{t.home.title}</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed">{t.home.subtitle}</p>
          <Link href="/create" className="btn-primary mt-6 inline-block px-6 py-3 text-lg">
            {t.home.newCampaign}
          </Link>
        </div>
        <div className="flex justify-center">
          <Lockie mood="guarding" size={420} label={t.home.mascotAlt} className="w-64 md:w-[22rem]" />
        </div>
      </section>

      <StoryLine />
      <LiveStats stats={stats} failed={failed} />

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">{t.home.listTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.home.listNote}</p>

        {failed && (
          <div className="mt-6 rounded-2xl border-[1.5px] border-danger bg-danger-tint p-4 text-sm text-danger-ink">
            <p>{t.home.loadFailed}</p>
            <button onClick={load} className="mt-2 font-semibold underline underline-offset-4">
              {t.home.retry}
            </button>
          </div>
        )}
        {!failed && rows === null && <p className="py-12 text-center text-muted">{t.home.loading}</p>}
        {rows?.length === 0 && !failed && (
          <div className="flex flex-col items-center py-10 text-center">
            <Lockie mood="sleeping" size={180} decorative />
            <p className="mt-2 text-muted">{t.home.empty}</p>
            <Link href="/create" className="mt-2 font-semibold underline underline-offset-4">
              {t.home.emptyCta}
            </Link>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows?.map(({ publicKey, account }) => (
            <CampaignCard
              key={publicKey.toBase58()}
              address={publicKey.toBase58()}
              campaign={account}
              buyers={buyersByCampaign[publicKey.toBase58()] ?? []}
              now={now}
            />
          ))}
        </div>
      </section>
    </>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { displayStatus, formatCountdown, formatSol, type Campaign } from "@/lib/campaign";
import { useDropsafe } from "@/lib/program";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge, STATUS_TONE } from "@/components/StatusBadge";
import { useNow } from "@/components/useNow";

type Row = { publicKey: PublicKey; account: Campaign };

export default function HomePage() {
  const program = useDropsafe();
  const now = useNow();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const all = await program.account.campaign.all();
      setRows(all.sort((a, b) => b.account.campaignId.cmp(a.account.campaignId)));
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
      <section className="mb-12 max-w-2xl">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Group buys the organizer can&apos;t run away with.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Your SOL waits in an on-chain escrow, not in someone&apos;s wallet. Miss the target and every buyer takes their
          money back. Hit it, and only then can the organizer withdraw.
        </p>
      </section>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Campaigns</h2>
        <Link href="/create" className="rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:border-mint hover:text-mint">
          + New campaign
        </Link>
      </div>

      {failed && (
        <div className="rounded-lg border border-rose/40 bg-rose/10 p-4 text-sm">
          <p className="text-rose">读取链上数据失败。 Couldn&apos;t load campaigns from the chain.</p>
          <button onClick={load} className="mt-2 underline underline-offset-4">
            Try again
          </button>
        </div>
      )}
      {!failed && rows === null && <p className="py-12 text-center text-muted">Loading campaigns…</p>}
      {rows?.length === 0 && !failed && (
        <div className="rounded-xl border border-dashed border-line py-14 text-center">
          <p className="text-muted">No campaigns yet.</p>
          <Link href="/create" className="mt-2 inline-block text-mint underline underline-offset-4">
            Create the first one
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows?.map(({ publicKey, account }) => {
          const status = displayStatus(account, now);
          return (
            <Link
              key={publicKey.toBase58()}
              href={`/campaign/${publicKey.toBase58()}`}
              className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-mint/60"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 break-words font-medium">{account.title || "Untitled"}</h3>
                <StatusBadge status={status} />
              </div>
              <p className="mt-1 font-mono text-sm text-muted">{formatSol(account.pricePerPersonLamports)} SOL / person</p>
              <div className="mt-4">
                <ProgressBar current={account.contributorCount} target={account.targetCount} tone={STATUS_TONE[status].bar} />
              </div>
              <div className="mt-2 flex justify-between font-mono text-sm text-muted">
                <span>
                  {account.contributorCount} / {account.targetCount} joined
                </span>
                <span>{status === "released" ? "Completed" : formatCountdown(account.deadlineUnixTs.toNumber() - now)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

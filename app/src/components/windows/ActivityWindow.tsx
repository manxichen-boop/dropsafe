"use client";

import { useEffect, useState } from "react";
import { formatSol, shortAddress } from "@/lib/campaign";
import { chainRead } from "@/lib/chain";
import { explorerTx, PROGRAM_ID } from "@/lib/config";
import { dateLocale, useI18n } from "@/lib/i18n";
import { useDropsafe } from "@/lib/program";

interface Entry {
  signature: string;
  actor: string;
  action: string;
  lamports: number;
  time: number | null;
}

const LIMIT = 15;
const camel = (name: string) => name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function ActivityWindow() {
  const program = useDropsafe();
  const { lang, t } = useI18n();
  const a = t.os.activity;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const connection = program.provider.connection;
        const signatures = await chainRead("activity", () => connection.getSignaturesForAddress(PROGRAM_ID, { limit: LIMIT }, "confirmed"));
        // 创建活动时,托管账户的余额变化里包含了它自己的租金,要扣掉才是保证金
        const escrowRent = await connection.getMinimumBalanceForRentExemption(9);
        const list: Entry[] = [];
        // 排队一条条读,避免触发公共 RPC 限流
        for (const { signature, err, blockTime } of signatures) {
          if (err) continue;
          const tx = await chainRead(`tx-${signature}`, () => connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }));
          if (!alive) return;
          if (!tx?.meta) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const message = tx.transaction.message as any;
          const keys: { toBase58(): string; equals(k: unknown): boolean }[] = message.staticAccountKeys ?? message.accountKeys;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const instructions: any[] = message.compiledInstructions ?? message.instructions;
          const ours = [...instructions].reverse().find((ix) => keys[ix.programIdIndex]?.equals(PROGRAM_ID));
          if (!ours) continue;
          let action = "other";
          let lamports = 0;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const coder = program.coder.instruction as any;
            const decoded = typeof ours.data === "string" ? coder.decode(ours.data, "base58") : coder.decode(Buffer.from(ours.data));
            if (decoded) {
              action = camel(decoded.name);
              // 金额取托管账户余额的变化,完全来自链上
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const spec = (program.idl.instructions as any[]).find((i) => camel(i.name) === action);
              const position = spec?.accounts.findIndex((acc: { name: string }) => acc.name === "escrow") ?? -1;
              const indexes: number[] = ours.accountKeyIndexes ?? ours.accounts;
              if (position >= 0) {
                const index = indexes[position];
                lamports = Math.abs(tx.meta.postBalances[index] - tx.meta.preBalances[index]);
                if (action === "createCampaign") lamports = Math.max(0, lamports - escrowRent);
              }
            }
          } catch {
            action = "other";
          }
          list.push({ signature, actor: keys[0].toBase58(), action, lamports, time: blockTime ?? null });
          setEntries([...list]);
        }
        if (alive) setState("ready");
      } catch (e) {
        console.warn(e);
        if (alive) setState("failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, [program]);

  return (
    <div>
      <p className="text-[13px]">{a.intro}</p>
      {state === "failed" && <p className="panel mt-3 border-red">{a.failed}</p>}
      {state === "ready" && entries.length === 0 && <p className="mt-3">{a.empty}</p>}
      <ul className="mt-3 border-2 border-ink">
        {entries.map((entry) => (
          <li key={entry.signature} className="border-b-2 border-line p-2 text-[13px] last:border-b-0">
            <div className="flex flex-wrap justify-between gap-x-3">
              <span>
                <span className="font-semibold">{shortAddress(entry.actor)}</span> {a.actions[entry.action] ?? a.other}
              </span>
              {entry.lamports > 0 && <span>{formatSol(entry.lamports)} SOL</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap justify-between gap-x-3">
              <span>{entry.time ? new Date(entry.time * 1000).toLocaleString(dateLocale(lang)) : ""}</span>
              <a href={explorerTx(entry.signature)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {t.detail.explorer}
              </a>
            </div>
          </li>
        ))}
      </ul>
      {state === "loading" && <p className="mt-3">{a.loading}</p>}
    </div>
  );
}

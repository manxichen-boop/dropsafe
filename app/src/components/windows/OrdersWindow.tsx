"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PublicKey } from "@solana/web3.js";
import {
  displayStatus,
  formatSol,
  reportOpen,
  seatWindow,
  tierOf,
  type Campaign,
  type Contribution,
  type SeatWindow,
  type Shipment,
} from "@/lib/campaign";
import { chainRead } from "@/lib/chain";
import { explorerTx, PROGRAM_ID } from "@/lib/config";
import { dateLocale, useI18n } from "@/lib/i18n";
import { campaignExtPda, contributionPda, shipmentPda, useDropsafe } from "@/lib/program";
import { TierShield } from "@/components/os/icons";
import { useOS } from "@/components/os/OS";
import { useNow } from "@/components/useNow";

type OpenOrder = { address: string; campaign: Campaign; seat: Contribution; window: SeatWindow; shipment: Shipment | null };
type Money = { lamports: number; to: "escrow" | "you" | "organizer" } | null;
type HistoryEntry = { signature: string; campaign: string | null; action: string; money: Money; time: number | null };

// 和买家有关的指令。合约里买家账户都叫 buyer
const BUYER_ACTIONS = new Set([
  "contribute",
  "withdrawBeforeFill",
  "refund",
  "confirmDelivery",
  "reportNotReceived",
  "reportUnshipped",
  "extendWaiting",
  "settleSeat",
]);
const PAGE = 25;
const camel = (name: string) => name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function OrdersWindow() {
  const program = useDropsafe();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { open } = useOS();
  const now = useNow();
  const { lang, t } = useI18n();
  const o = t.os.orders;
  const formatDate = (seconds: number) => new Date(seconds * 1000).toLocaleString(dateLocale(lang));

  const [titles, setTitles] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<OpenOrder[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [historyState, setHistoryState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [failed, setFailed] = useState(false);

  // 进行中:还没结算的名额,按每个名额自己的窗口说明状态
  const loadOpen = useCallback(
    async (owner: PublicKey) => {
      try {
        const address = owner.toBase58();
        const [campaigns, mine] = await Promise.all([
          chainRead("campaigns", () => program.account.campaign.all()),
          chainRead(`seats-of-${address}`, () => program.account.contribution.all([{ memcmp: { offset: 8, bytes: address } }])),
        ]);
        setTitles(Object.fromEntries(campaigns.map((row) => [row.publicKey.toBase58(), row.account.title])));
        const seatByKey = new Map(mine.map((seat) => [seat.publicKey.toBase58(), seat.account]));
        const matched = campaigns
          .map((row) => ({ row, seat: seatByKey.get(contributionPda(row.publicKey, owner).toBase58()) }))
          .filter((x): x is { row: (typeof campaigns)[number]; seat: Contribution } => !!x.seat);
        const keys = matched.map((x) => x.row.publicKey);
        const [exts, ships] = keys.length
          ? await Promise.all([
              program.account.campaignExt.fetchMultiple(keys.map(campaignExtPda)),
              program.account.shipment.fetchMultiple(keys.map((k) => shipmentPda(k, owner))),
            ])
          : [[], []];
        setOrders(
          matched
            .map(({ row, seat }, i) => {
              const shipment = (ships[i] as Shipment | null) ?? null;
              return { address: row.publicKey.toBase58(), campaign: row.account, seat, shipment, window: seatWindow(row.account, !!exts[i], shipment) };
            })
            .sort((a, b) => b.campaign.campaignId.cmp(a.campaign.campaignId))
        );
        setFailed(false);
      } catch (e) {
        console.warn(e);
        setFailed(true);
      }
    },
    [program]
  );

  // 历史:这个钱包最近的 DropSafe 交易,一次读一页,排队读避免公共 RPC 限流
  const loadHistory = useCallback(
    async (owner: PublicKey, before?: string) => {
      setHistoryState("loading");
      try {
        const connection = program.provider.connection;
        const signatures = await connection.getSignaturesForAddress(owner, { limit: PAGE, before }, "confirmed");
        const found: HistoryEntry[] = [];
        for (const { signature, err, blockTime } of signatures) {
          if (err) continue;
          const tx = await chainRead(`tx-${signature}`, () => connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }));
          if (!tx?.meta) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const message = tx.transaction.message as any;
          const keys: { toBase58(): string; equals(k: unknown): boolean }[] = message.staticAccountKeys ?? message.accountKeys;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const instructions: any[] = message.compiledInstructions ?? message.instructions;
          for (const ix of instructions) {
            if (!keys[ix.programIdIndex]?.equals(PROGRAM_ID)) continue;
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const coder = program.coder.instruction as any;
              const decoded = typeof ix.data === "string" ? coder.decode(ix.data, "base58") : coder.decode(Buffer.from(ix.data));
              const action = decoded ? camel(decoded.name) : "";
              if (!BUYER_ACTIONS.has(action)) continue;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const spec = (program.idl.instructions as any[]).find((i) => camel(i.name) === action);
              const indexes: number[] = ix.accountKeyIndexes ?? ix.accounts;
              const at = (name: string) => {
                const position = spec?.accounts.findIndex((acc: { name: string }) => acc.name === name) ?? -1;
                return position >= 0 ? indexes[position] : -1;
              };
              // 只算这个钱包作为买家的操作(比如别人帮你结算你的名额也算)
              if (!keys[at("buyer")]?.equals(owner)) continue;
              const campaignIndex = at("campaign");
              const escrowIndex = at("escrow");
              let money: Money = null;
              if (escrowIndex >= 0) {
                const delta = tx.meta.postBalances[escrowIndex] - tx.meta.preBalances[escrowIndex];
                const lamports = Math.abs(delta);
                if (lamports > 0) {
                  if (delta > 0) money = { lamports, to: "escrow" };
                  else {
                    // 钱从托管转出:看你的钱包有没有收到大部分
                    const me = keys.findIndex((k) => k.equals(owner));
                    const fee = me === 0 ? tx.meta.fee : 0;
                    const mine = tx.meta.postBalances[me] - tx.meta.preBalances[me] + fee;
                    money = { lamports, to: mine >= lamports / 2 ? "you" : "organizer" };
                  }
                }
              }
              found.push({ signature, campaign: campaignIndex >= 0 ? keys[campaignIndex].toBase58() : null, action, money, time: blockTime ?? null });
            } catch {
              // 解不出来的指令跳过
            }
          }
        }
        setHistory((prev) => [...prev, ...found]);
        setCursor(signatures.length === PAGE ? signatures[signatures.length - 1].signature : undefined);
        setHistoryState(signatures.length === PAGE ? "idle" : "done");
      } catch (e) {
        console.warn(e);
        setHistoryState("failed");
      }
    },
    [program]
  );

  useEffect(() => {
    if (!publicKey) return;
    setOrders(null);
    setHistory([]);
    setCursor(undefined);
    void loadOpen(publicKey);
    void loadHistory(publicKey);
  }, [publicKey, loadOpen, loadHistory]);

  if (!publicKey) {
    return (
      <div className="py-6 text-center">
        <p>{t.os.wallet.notConnected}</p>
        <button type="button" className="btn-primary mt-3" onClick={() => setVisible(true)}>
          {t.os.connectWallet}
        </button>
      </div>
    );
  }

  const stateOf = (order: OpenOrder): { text: string; urgent: boolean } => {
    const { campaign, seat, window: w, shipment } = order;
    const status = displayStatus(campaign, now);
    if (status === "open") return { text: o.state.open, urgent: false };
    if (status === "funded") return { text: o.state.funded, urgent: false };
    if (status === "failed" || status === "abandoned" || status === "cancelled") return { text: o.state.refund, urgent: true };
    if ("confirmed" in seat.status) return { text: o.state.confirmed, urgent: false };
    if ("reported" in seat.status) return { text: o.state.reported, urgent: false };
    if (reportOpen(w, now)) return { text: o.state.canReport(formatDate(w.closes)), urgent: true };
    if (now < w.opens) {
      if (shipment?.shipped) return { text: o.state.shipped(formatDate(shipment.eta.toNumber())), urgent: false };
      return { text: o.state.awaitingShipment(formatDate(campaign.deliveryDeadline.toNumber())), urgent: false };
    }
    return { text: o.state.settle, urgent: false };
  };

  // 历史按团购分组,新的在前
  const groups: { campaign: string | null; entries: HistoryEntry[] }[] = [];
  for (const entry of history) {
    const group = groups.find((g) => g.campaign === entry.campaign);
    if (group) group.entries.push(entry);
    else groups.push({ campaign: entry.campaign, entries: [entry] });
  }
  const moneyText = (money: Money) =>
    !money ? "" : money.to === "escrow" ? o.money.paid(formatSol(money.lamports)) : money.to === "you" ? o.money.back(formatSol(money.lamports)) : o.money.organizer(formatSol(money.lamports));

  return (
    <div className="space-y-4">
      <section>
        <h3 className="pixel-title mb-1">{o.openTitle}</h3>
        {failed && <p className="panel border-red">{t.detail.loadFailed}</p>}
        {!failed && orders === null && <p>{t.detail.loading}</p>}
        {orders?.length === 0 && <p className="text-[13px]">{o.noOpen}</p>}
        {orders && orders.length > 0 && (
          <ul className="border-2 border-ink">
            {orders.map((order) => {
              const state = stateOf(order);
              return (
                <li key={order.address} className="border-b-2 border-line last:border-b-0">
                  <button
                    type="button"
                    className="w-full p-2 text-left text-[13px] hover:bg-line focus:bg-line"
                    onClick={(e) => open("campaign", order.address, e.currentTarget)}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                        <TierShield tier={tierOf(order.campaign)} size={16} />
                        <span className="truncate">{order.campaign.title}</span>
                      </span>
                      <span className="whitespace-nowrap">{formatSol(order.seat.amount)} SOL</span>
                    </span>
                    <span className={`mt-1 inline-block ${state.urgent ? "bg-sun px-1 font-semibold" : ""}`}>{state.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="pixel-title mb-1">{o.historyTitle}</h3>
        <p className="mb-2 text-[13px]">{o.historyNote}</p>
        {historyState === "failed" && <p className="panel border-red">{o.historyFailed}</p>}
        {groups.length === 0 && historyState === "done" && <p className="text-[13px]">{o.noHistory}</p>}
        <div className="space-y-2">
          {groups.map((group) => (
            <div key={group.campaign ?? "unknown"} className="border-2 border-ink">
              <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-line px-2 py-1 text-[13px] font-semibold">
                <span className="truncate">{(group.campaign && titles[group.campaign]) || o.unknownGroup}</span>
                {group.campaign && (
                  <button type="button" className="shrink-0 underline underline-offset-4" onClick={(e) => open("campaign", group.campaign!, e.currentTarget)}>
                    {t.os.groupBuys.open}
                  </button>
                )}
              </div>
              <ul>
                {group.entries.map((entry) => (
                  <li key={`${entry.signature}-${entry.action}`} className="border-b-2 border-line px-2 py-1 text-[13px] last:border-b-0">
                    <div className="flex flex-wrap justify-between gap-x-3">
                      <span>{o.actions[entry.action] ?? entry.action}</span>
                      <span>{moneyText(entry.money)}</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3">
                      <span>{entry.time ? formatDate(entry.time) : ""}</span>
                      <a href={explorerTx(entry.signature)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        {t.detail.explorer}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {historyState === "loading" && <p className="mt-2 text-[13px]">{o.historyLoading}</p>}
        {historyState === "idle" && cursor && (
          <button type="button" className="btn mt-2 w-full" onClick={() => void loadHistory(publicKey, cursor)}>
            {o.more}
          </button>
        )}
      </section>
    </div>
  );
}

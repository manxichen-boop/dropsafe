"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PublicKey } from "@solana/web3.js";
import { displayStatus, formatSol, reportOpen, seatWindow, type Campaign, type Contribution, type SeatWindow, type Shipment } from "@/lib/campaign";
import { chainRead } from "@/lib/chain";
import { dateLocale, useI18n } from "@/lib/i18n";
import { campaignExtPda, contributionPda, shipmentPda, useDropsafe } from "@/lib/program";
import { useNow } from "@/components/useNow";
import { DesktopIcon } from "@/components/os/icons";
import { useOS } from "@/components/os/OS";

type Todo = "confirm" | "report" | "refund";
type SeatRow = { address: string; campaign: Campaign; seat: Contribution; window: SeatWindow };

// 按这个名额自己的窗口分类:报告窗口开着可报告,还没开可确认,失败、被放弃或取消后可退款
function todoOf(row: SeatRow, now: number): Todo | null {
  const status = displayStatus(row.campaign, now);
  const paid = "paid" in row.seat.status;
  if (status === "failed" || status === "abandoned" || status === "cancelled") return "refund";
  if (!("active" in row.campaign.status) || !paid) return null;
  if (reportOpen(row.window, now)) return "report";
  if (now < row.window.opens) return "confirm";
  return null;
}

function PendingSeats({ owner }: { owner: PublicKey }) {
  const program = useDropsafe();
  const now = useNow();
  const { open } = useOS();
  const { lang, t } = useI18n();
  const w = t.os.wallet;
  const [rows, setRows] = useState<SeatRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const address = owner.toBase58();
      const [campaigns, mine] = await Promise.all([
        chainRead("campaigns", () => program.account.campaign.all()),
        // buyer 字段紧跟在 8 字节的账户标识后面
        chainRead(`seats-of-${address}`, () => program.account.contribution.all([{ memcmp: { offset: 8, bytes: address } }])),
      ]);
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
      setRows(
        matched.map(({ row, seat }, i) => ({
          address: row.publicKey.toBase58(),
          campaign: row.account,
          seat,
          window: seatWindow(row.account, !!exts[i], (ships[i] as Shipment | null) ?? null),
        }))
      );
      setFailed(false);
    } catch (e) {
      console.warn(e);
      setFailed(true);
    }
  }, [owner, program]);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) return <p className="panel mt-4 border-red text-left">{w.todoFailed}</p>;
  if (rows === null) return <p className="mt-4">{w.todoLoading}</p>;

  const formatDate = (seconds: number) => new Date(seconds * 1000).toLocaleString(dateLocale(lang));
  const groups: { key: Todo; label: string }[] = [
    { key: "report", label: w.todoReport },
    { key: "confirm", label: w.todoConfirm },
    { key: "refund", label: w.todoRefund },
  ];
  const sorted = groups.map((group) => ({ ...group, items: rows.filter((row) => todoOf(row, now) === group.key) }));
  const total = sorted.reduce((n, group) => n + group.items.length, 0);

  return (
    <section className="mt-4 text-left">
      <h3 className="pixel-title">{w.todoTitle}</h3>
      {total === 0 ? (
        <p className="mt-1 text-[13px]">{w.todoNone}</p>
      ) : (
        sorted
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.key} className="mt-2">
              <h4 className={`inline-block border-2 border-ink px-1.5 text-[13px] font-semibold ${group.key === "report" ? "bg-sun" : group.key === "refund" ? "bg-safe" : "bg-paper"}`}>
                {group.label} · {group.items.length}
              </h4>
              <ul className="mt-1 border-2 border-ink">
                {group.items.map((row) => (
                  <li key={row.address} className="border-b-2 border-line last:border-b-0">
                    <button
                      type="button"
                      className="flex w-full flex-wrap justify-between gap-x-3 p-2 text-left text-[13px] hover:bg-line focus:bg-line"
                      onClick={(e) => open("campaign", row.address, e.currentTarget)}
                    >
                      <span className="font-semibold">{row.campaign.title}</span>
                      {group.key !== "refund" && <span>{w.todoBy(formatDate(row.window.closes))}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
    </section>
  );
}

export function WalletWindow() {
  const program = useDropsafe();
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { open } = useOS();
  const { t } = useI18n();
  const w = t.os.wallet;
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) return setBalance(null);
    program.provider.connection.getBalance(publicKey).then(setBalance, () => setBalance(null));
  }, [program, publicKey]);

  return (
    <div className="text-center">
      <div className="flex justify-center">
        <DesktopIcon name="wallet" size={64} />
      </div>
      {publicKey ? (
        <>
          <dl className="mt-4 space-y-3 border-y-2 border-ink py-3 text-left">
            <div>
              <dt className="text-[13px]">{w.address}</dt>
              <dd className="break-all">{publicKey.toBase58()}</dd>
            </div>
            <div>
              <dt className="text-[13px]">{w.balance}</dt>
              <dd className="pixel-num text-2xl">{balance === null ? "…" : `${formatSol(balance)} SOL`}</dd>
            </div>
          </dl>
          <PendingSeats owner={publicKey} />
          <div className="mt-4 grid gap-3">
            <button type="button" className="btn" onClick={() => open("organizer", publicKey.toBase58())}>
              {w.organizer}
            </button>
            <button type="button" className="btn" onClick={() => open("buyer", publicKey.toBase58())}>
              {w.buyer}
            </button>
            <button type="button" className="btn" onClick={() => void disconnect()}>
              {t.wallet.disconnect}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4">{w.notConnected}</p>
          <button type="button" className="btn-primary mt-3" onClick={() => setVisible(true)}>
            {t.os.connectWallet}
          </button>
        </>
      )}
    </div>
  );
}

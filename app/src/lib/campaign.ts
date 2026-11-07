import BN from "bn.js";
import type { IdlAccounts } from "@anchor-lang/core";
import type { Dropsafe } from "./idl/dropsafe";

export type Campaign = IdlAccounts<Dropsafe>["campaign"];
export type Contribution = IdlAccounts<Dropsafe>["contribution"];
export type OrganizerStats = IdlAccounts<Dropsafe>["organizerStats"];
export type BuyerStats = IdlAccounts<Dropsafe>["buyerStats"];
export type CampaignExt = IdlAccounts<Dropsafe>["campaignExt"];
export type Shipment = IdlAccounts<Dropsafe>["shipment"];
export type OrganizerStatsExt = IdlAccounts<Dropsafe>["organizerStatsExt"];

export type TierName = "shielded" | "standard" | "trust";
export const TIERS: TierName[] = ["shielded", "standard", "trust"];

export type DisplayStatus =
  | "open"
  | "funded"
  | "failed"
  | "abandoned"
  | "cancelled"
  | "delivering"
  | "appeal"
  | "settling"
  | "closed";

const LAMPORTS_PER_SOL = 1_000_000_000;

export const tierOf = (c: Pick<Campaign, "tier">): TierName => Object.keys(c.tier)[0] as TierName;

// 和合约一致:upfront = price * 7 / 10,remainder = price - upfront
export const upfrontOf = (price: BN) => price.muln(7).divn(10);
export const remainderOf = (price: BN) => price.sub(upfrontOf(price));

// 如果团长不发货,买家能拿回的比例(需要在申诉期内报告)
export const RECOVERY_PERCENT: Record<TierName, number> = { shielded: 100, standard: 30, trust: 0 };

// 团长提取时转出多少
export function releaseAmount(c: Campaign): BN {
  const perSeat = tierOf(c) === "trust" ? c.price : upfrontOf(c.price);
  return perSeat.muln(c.joinedCount);
}

// 买家报告未收到后能拿回多少
export function reportAmount(c: Campaign): BN {
  switch (tierOf(c)) {
    case "shielded":
      return c.price;
    case "standard":
      return remainderOf(c.price);
    default:
      return new BN(0);
  }
}

// 一个名额结算时转给团长或买家多少
export function settleAmount(c: Campaign): BN {
  return reportAmount(c);
}

// 托管里还算作保证金的金额
export function bondHeld(c: Campaign): BN {
  if (c.bondTotal.isZero() || c.bondReclaimed) return new BN(0);
  if ("active" in c.status || "closed" in c.status) {
    return upfrontOf(c.price).muln(c.joinedCount - c.seatsResolved);
  }
  return c.bondTotal;
}

// 链上状态结合时间,推算出用户看到的“实际情况”
export function displayStatus(c: Campaign, now: number): DisplayStatus {
  if ("closed" in c.status) return "closed";
  if ("cancelled" in c.status) return "cancelled";
  if ("abandoned" in c.status) return "abandoned";
  if ("failed" in c.status) return "failed";
  if ("active" in c.status) {
    if (c.seatsResolved >= c.joinedCount) return "closed";
    if (now < c.deliveryDeadline.toNumber()) return "delivering";
    if (now < c.appealEnd.toNumber()) return "appeal";
    return "settling";
  }
  if ("funded" in c.status) return now >= c.deliveryDeadline.toNumber() ? "abandoned" : "funded";
  return now >= c.deadline.toNumber() ? "failed" : "open";
}

// 这个状态下,倒计时应该指向哪个时间点
export function nextDeadline(c: Campaign, status: DisplayStatus): number | null {
  switch (status) {
    case "open":
      return c.deadline.toNumber();
    case "funded":
    case "delivering":
      return c.deliveryDeadline.toNumber();
    case "appeal":
      return c.appealEnd.toNumber();
    default:
      return null;
  }
}

export function formatSol(lamports: number | BN): string {
  const value = (typeof lamports === "number" ? lamports : lamports.toNumber()) / LAMPORTS_PER_SOL;
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

// 用字符串换算,避免 0.1 + 0.2 这类浮点误差。无效输入返回 null。
export function solToLamports(input: string): BN | null {
  const match = input.trim().match(/^(\d+)(?:\.(\d{1,9}))?$/);
  if (!match) return null;
  const lamports = new BN(match[1])
    .mul(new BN(LAMPORTS_PER_SOL))
    .add(new BN((match[2] ?? "").padEnd(9, "0")));
  return lamports.bitLength() <= 64 ? lamports : null;
}

export function formatCountdown(secondsLeft: number): string {
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
export const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

// 一笔创建交易最多能放的文本字节数(v2.2 测试里实测:1232 - 433 = 799,留一点余量)
export const MAX_CREATE_TEXT_BYTES = 790;
export const utf8Length = (value: string) => new TextEncoder().encode(value).length;

// 和合约的 seat_window 一致:报告窗口从 opens(含)到 closes(不含)。
// 申诉期长度取自合约创建时存下的 appeal_end - delivery_deadline,所以 Devnet 和正式版不用分开写
export type SeatWindow = { opens: number; closes: number; shipped: boolean | null; extended: boolean };

export function seatWindow(c: Campaign, hasRules: boolean, shipment: Shipment | null): SeatWindow {
  const shipBy = c.deliveryDeadline.toNumber();
  const appeal = c.appealEnd.toNumber() - shipBy;
  if (!hasRules) return { opens: shipBy, closes: c.appealEnd.toNumber(), shipped: null, extended: false };
  const shipped = !!shipment?.shipped;
  const opens = shipped ? shipment!.eta.toNumber() : shipBy;
  const extended = !!shipment?.extensionUsed;
  return { opens, closes: opens + appeal + (extended ? appeal : 0), shipped, extended };
}

export const reportOpen = (w: SeatWindow, now: number) => now >= w.opens && now < w.closes;
export const appealSeconds = (c: Campaign) => c.appealEnd.toNumber() - c.deliveryDeadline.toNumber();

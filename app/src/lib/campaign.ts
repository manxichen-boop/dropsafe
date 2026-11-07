import BN from "bn.js";
import type { IdlAccounts } from "@anchor-lang/core";
import type { Dropsafe } from "./idl/dropsafe";

export type Campaign = IdlAccounts<Dropsafe>["campaign"];

export type DisplayStatus =
  | "open"
  | "funded"
  | "failed"
  | "abandoned"
  | "delivering"
  | "dispute"
  | "claimable"
  | "completed";

const LAMPORTS_PER_SOL = 1_000_000_000;

// 和合约里的 UPFRONT_BPS 保持一致:达标后团长先拿 70%
const UPFRONT_BPS = 7000;
const BPS_DENOMINATOR = 10_000;

// 链上状态很少,但用户需要看到"实际情况",这里结合时间推算出来。
export function displayStatus(c: Campaign, nowSeconds: number): DisplayStatus {
  if ("completed" in c.status) return "completed";
  if ("delivering" in c.status) {
    if (nowSeconds < c.deliveryDeadlineUnixTs.toNumber()) return "delivering";
    if (nowSeconds < c.disputeDeadlineUnixTs.toNumber()) return "dispute";
    return "claimable";
  }
  if (c.contributorCount >= c.targetCount) {
    return nowSeconds >= c.deliveryDeadlineUnixTs.toNumber() ? "abandoned" : "funded";
  }
  if ("failed" in c.status || nowSeconds >= c.deadlineUnixTs.toNumber()) return "failed";
  return "open";
}

// 这个状态下,倒计时应该指向哪个时间点。没有下一个时间点时返回 null
export function nextDeadline(c: Campaign, status: DisplayStatus): number | null {
  switch (status) {
    case "open":
      return c.deadlineUnixTs.toNumber();
    case "funded":
    case "delivering":
      return c.deliveryDeadlineUnixTs.toNumber();
    case "dispute":
      return c.disputeDeadlineUnixTs.toNumber();
    default:
      return null;
  }
}

export function upfrontTotal(c: Campaign): BN {
  return c.pricePerPersonLamports
    .mul(new BN(UPFRONT_BPS))
    .div(new BN(BPS_DENOMINATOR))
    .mul(new BN(c.contributorCount));
}

export function holdbackPerBuyer(c: Campaign): BN {
  return c.pricePerPersonLamports.sub(c.pricePerPersonLamports.mul(new BN(UPFRONT_BPS)).div(new BN(BPS_DENOMINATOR)));
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

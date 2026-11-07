import BN from "bn.js";
import type { IdlAccounts } from "@anchor-lang/core";
import type { Dropsafe } from "./idl/dropsafe";

export type Campaign = IdlAccounts<Dropsafe>["campaign"];

export type DisplayStatus = "open" | "funded" | "failed" | "released";

const LAMPORTS_PER_SOL = 1_000_000_000;

// 链上只有三种状态,但用户需要看到"实际情况":
// 满员但未提取 = funded;已过截止但还没人退款 = failed(链上要等第一笔退款才写入 Failed)。
export function displayStatus(c: Campaign, nowSeconds: number): DisplayStatus {
  if ("released" in c.status) return "released";
  if (c.contributorCount >= c.targetCount) return "funded";
  if ("failed" in c.status || nowSeconds >= c.deadlineUnixTs.toNumber()) return "failed";
  return "open";
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  open: "Fundraising",
  funded: "Target reached",
  failed: "Failed · refunds open",
  released: "Released",
};

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
  if (secondsLeft <= 0) return "Ended";
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

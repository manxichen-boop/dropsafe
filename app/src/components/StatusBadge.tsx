"use client";

import type { DisplayStatus, TierName } from "@/lib/campaign";
import { useI18n } from "@/lib/i18n";

const TONE: Record<DisplayStatus, string> = {
  open: "bg-sun-tint text-ink",
  funded: "bg-sun text-ink",
  failed: "bg-danger-tint text-danger-ink",
  abandoned: "bg-danger-tint text-danger-ink",
  cancelled: "bg-danger-tint text-danger-ink",
  delivering: "bg-sun-tint text-ink",
  appeal: "bg-danger-tint text-danger-ink",
  settling: "bg-sun-tint text-ink",
  closed: "bg-line text-ink",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useI18n();
  return (
    <span className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold ${TONE[status]}`}>
      {t.status[status]}
    </span>
  );
}

// 全额保障 = 绿,部分保障 = 黄,信任团 = 灰
const TIER_TONE: Record<TierName, string> = {
  shielded: "bg-safe text-ink",
  standard: "bg-sun text-ink",
  trust: "bg-[#6b655b] text-white",
};

export function TierBadge({ tier }: { tier: TierName }) {
  const { t } = useI18n();
  return (
    <span className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold ${TIER_TONE[tier]}`}>
      {t.tier[tier]}
    </span>
  );
}

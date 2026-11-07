"use client";

import type { DisplayStatus } from "@/lib/campaign";
import { useI18n } from "@/lib/i18n";

const TONE: Record<DisplayStatus, string> = {
  open: "bg-sun text-ink",
  funded: "bg-safe text-ink",
  failed: "bg-danger-tint text-danger-ink",
  abandoned: "bg-danger-tint text-danger-ink",
  delivering: "bg-sun-tint text-ink",
  dispute: "bg-danger-tint text-danger-ink",
  claimable: "bg-sun-tint text-ink",
  completed: "bg-safe-tint text-safe-ink",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useI18n();
  return (
    <span className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold ${TONE[status]}`}>
      {t.status[status]}
    </span>
  );
}

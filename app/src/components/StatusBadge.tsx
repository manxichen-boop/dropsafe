import { STATUS_LABEL, type DisplayStatus } from "@/lib/campaign";

export const STATUS_TONE: Record<DisplayStatus, { badge: string; bar: string }> = {
  open: { badge: "border-mint/40 bg-mint/10 text-mint", bar: "bg-mint" },
  funded: { badge: "border-amber/40 bg-amber/10 text-amber", bar: "bg-amber" },
  failed: { badge: "border-rose/40 bg-rose/10 text-rose", bar: "bg-rose" },
  released: { badge: "border-line bg-line/50 text-muted", bar: "bg-muted" },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status].badge}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

import { useMemo } from "react";
import { drawSeat, seatVariant } from "@/lib/pixels";
import { Pixel } from "./Pixel";

const COMPACT_ABOVE = 30;

function Buddy({ seed, size, hop, delay }: { seed: string | null; size: number; hop: boolean; delay: number }) {
  const grid = useMemo(() => drawSeat(seed ? seatVariant(seed) : null), [seed]);
  return (
    <span className={hop ? "seat-hop inline-block" : "inline-block"} style={hop ? { animationDelay: `${delay}ms` } : undefined}>
      <Pixel grid={grid} size={size} />
    </span>
  );
}

export function SeatBuddies({
  campaign,
  target,
  joined,
  buyers,
  size = "sm",
  hop = false,
  label,
}: {
  campaign: string;
  target: number;
  joined: number;
  /** 还有凭证的买家地址;已结算的买家凭证已关闭,用名额序号生成外观 */
  buyers: string[];
  size?: "sm" | "lg";
  hop?: boolean;
  label: string;
}) {
  // 12 格的整数倍,放大后才锐利
  const px = size === "lg" ? 36 : 24;
  if (target > COMPACT_ABOVE) {
    return (
      <div role="img" aria-label={label} className="flex items-center gap-2">
        <Buddy seed={joined > 0 ? (buyers[0] ?? `${campaign}:0`) : null} size={px} hop={hop} delay={0} />
        <span className="text-[13px]">
          {joined} / {target}
        </span>
      </div>
    );
  }
  return (
    <div role="img" aria-label={label} className="flex flex-wrap gap-0.5">
      {Array.from({ length: target }, (_, i) => (
        <Buddy key={i} seed={i < joined ? (buyers[i] ?? `${campaign}:${i}`) : null} size={px} hop={hop} delay={i * 80} />
      ))}
    </div>
  );
}

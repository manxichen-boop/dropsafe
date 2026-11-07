import { seatImage } from "@/lib/seats";

const COMPACT_ABOVE = 30;

function Buddy({ seed, size, hop, delay }: { seed: string | null; size: number; hop: boolean; delay: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={seatImage(seed)}
      width={size}
      height={size}
      alt=""
      className={hop ? "seat-hop" : undefined}
      style={hop ? { animationDelay: `${delay}ms` } : undefined}
    />
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
  const px = size === "lg" ? 40 : 28;

  if (target > COMPACT_ABOVE) {
    return (
      <div role="img" aria-label={label} className="flex items-center gap-2">
        <Buddy seed={joined > 0 ? buyers[0] ?? `${campaign}:0` : null} size={px} hop={hop} delay={0} />
        <span className="font-mono text-sm">
          {joined} / {target}
        </span>
      </div>
    );
  }

  return (
    <div role="img" aria-label={label} className="flex flex-wrap gap-1">
      {Array.from({ length: target }, (_, i) => (
        <Buddy
          key={i}
          seed={i < joined ? buyers[i] ?? `${campaign}:${i}` : null}
          size={px}
          hop={hop}
          delay={i * 40}
        />
      ))}
    </div>
  );
}

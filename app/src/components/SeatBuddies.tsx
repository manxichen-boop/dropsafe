import { buddyLook } from "@/lib/seats";

const COMPACT_ABOVE = 30;

function Buddy({ seed, size, hop, delay }: { seed: string | null; size: number; hop: boolean; delay: number }) {
  const look = seed ? buddyLook(seed) : null;
  const body = look?.color.body ?? "#DED7CA";
  const shade = look?.color.shade ?? "#C9C1B2";
  const ink = look ? "#1F1D1A" : "#857D70";

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      className={hop ? "seat-hop" : undefined}
      style={hop ? { animationDelay: `${delay}ms` } : undefined}
    >
      <ellipse cx={16} cy={18} rx={14} ry={13} fill={shade} />
      <ellipse cx={16} cy={16.5} rx={14} ry={12.5} fill={body} />
      <ellipse cx={11} cy={9} rx={4.5} ry={2} fill="#FFFDF9" opacity={0.55} />
      {look ? (
        <>
          <circle cx={11} cy={16} r={look.face === 2 ? 3.2 : 2.4} fill={ink} />
          <circle cx={21} cy={16} r={look.face === 2 ? 3.2 : 2.4} fill={ink} />
          <circle cx={11.8} cy={15} r={0.9} fill="#FFFDF9" />
          <circle cx={21.8} cy={15} r={0.9} fill="#FFFDF9" />
          {look.face === 0 && <path d="M13 21 Q16 24 19 21" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />}
          {look.face === 1 && <ellipse cx={16} cy={22} rx={2} ry={1.6} fill={ink} />}
          {look.face === 2 && <path d="M14 21.5 H18" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />}
        </>
      ) : (
        <>
          <path d="M8.5 16 Q11 18 13.5 16" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
          <path d="M18.5 16 Q21 18 23.5 16" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
        </>
      )}
    </svg>
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

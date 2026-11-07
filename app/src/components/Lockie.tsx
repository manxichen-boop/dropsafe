export type LockieMood = "guarding" | "waiting" | "celebrating" | "paying" | "refunding" | "sleeping";

export function Coin({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy + r * 0.12} r={r} fill="#D69A12" />
      <circle cx={cx} cy={cy} r={r} fill="#FFC93C" />
      <circle cx={cx} cy={cy} r={r * 0.68} fill="#FFD966" />
      <path
        d={`M${cx - r * 0.34} ${cy - r * 0.2} Q${cx} ${cy - r * 0.62} ${cx + r * 0.34} ${cy - r * 0.2}`}
        fill="none"
        stroke="#FFF0B8"
        strokeWidth={r * 0.14}
        strokeLinecap="round"
      />
    </g>
  );
}

const MOOD_LABEL: Record<LockieMood, string> = {
  guarding: "Lockie hugging a coin",
  waiting: "Lockie looking up at a coin",
  celebrating: "Lockie jumping for joy",
  paying: "Lockie handing over a coin",
  refunding: "Lockie sadly giving a coin back",
  sleeping: "Lockie asleep",
};

export function Lockie({
  mood = "guarding",
  size = 160,
  className = "",
  decorative = false,
  label,
}: {
  mood?: LockieMood;
  size?: number;
  className?: string;
  decorative?: boolean;
  label?: string;
}) {
  const motion = mood === "celebrating" ? "lockie-hop" : mood === "sleeping" ? "" : "lockie-bob";
  return (
    <span className={`relative inline-block ${className}`} style={{ width: /(^|\s)(md:)?w-/.test(className) ? undefined : size }}>
      {/* 生成的插画,放在 public/lockie;动作由 CSS 做,只有轻微起伏和成功时跳一下 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/lockie/${mood}.webp`}
        width={size}
        height={size}
        alt={decorative ? "" : (label ?? MOOD_LABEL[mood])}
        className={`block h-auto w-full ${motion}`}
      />
      {mood === "sleeping" && (
        <span aria-hidden className="absolute right-[6%] top-[4%] font-display font-semibold leading-none text-muted" style={{ fontSize: size * 0.11 }}>
          z<span className="relative -top-[0.5em] ml-[0.1em] text-[0.7em]">z</span>
        </span>
      )}
    </span>
  );
}

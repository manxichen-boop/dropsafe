import { useId } from "react";

export type LockieMood = "guarding" | "waiting" | "celebrating" | "paying" | "refunding" | "sleeping";

const BODY = "#FF6B3D";
const SHADE = "#E3552A";
const DEEP = "#C2431C";
const LIGHT = "#FF8F6B";
const SHINE = "#FFBCA6";
const DARK = "#3D1A0C";

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

function OpenEyes({ lookX = 0, lookY = 0 }: { lookX?: number; lookY?: number }) {
  return (
    <g className="lockie-eyes">
      {[72, 128].map((x) => (
        <g key={x}>
          <circle cx={x} cy={82} r={19} fill="#FFFDF9" />
          <circle cx={x + lookX} cy={83 + lookY} r={11} fill={DARK} />
          <circle cx={x + lookX + 4} cy={78 + lookY} r={3.6} fill="#FFFDF9" />
        </g>
      ))}
    </g>
  );
}

const eyeArc = (d: string) => (
  <path d={d} fill="none" stroke={DARK} strokeWidth={6.5} strokeLinecap="round" />
);

function HappyEyes() {
  return (
    <>
      {eyeArc("M56 88 Q72 67 88 88")}
      {eyeArc("M112 88 Q128 67 144 88")}
    </>
  );
}

function ClosedEyes() {
  return (
    <>
      {eyeArc("M56 80 Q72 94 88 80")}
      {eyeArc("M112 80 Q128 94 144 80")}
    </>
  );
}

function Arm({ cx, cy, rotate }: { cx: number; cy: number; rotate: number }) {
  return <ellipse cx={cx} cy={cy} rx={11} ry={20} fill={SHADE} transform={`rotate(${rotate} ${cx} ${cy})`} />;
}

function Slot() {
  return (
    <g>
      <ellipse cx={100} cy={140} rx={44} ry={30} fill={LIGHT} />
      <rect x={78} y={130} width={44} height={9} rx={4.5} fill={DARK} />
      <rect x={84} y={141} width={32} height={2.5} rx={1.25} fill={SHINE} />
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
  className,
  decorative = false,
  label,
}: {
  mood?: LockieMood;
  size?: number;
  className?: string;
  decorative?: boolean;
  label?: string;
}) {
  const clipId = `lockie-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const motion = mood === "celebrating" ? "lockie-hop" : mood === "sleeping" ? "" : "lockie-bob";

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label ?? MOOD_LABEL[mood]}
    >
      <defs>
        <clipPath id={clipId}>
          <ellipse cx={100} cy={112} rx={74} ry={68} />
        </clipPath>
      </defs>

      <ellipse cx={100} cy={188} rx={mood === "celebrating" ? 40 : 56} ry={7} fill="#E8E1D6" />

      <g className={motion}>
        {/* 脚 */}
        <ellipse cx={70} cy={178} rx={17} ry={10} fill={DEEP} />
        <ellipse cx={130} cy={178} rx={17} ry={10} fill={DEEP} />

        {mood === "celebrating" && (
          <>
            <Arm cx={24} cy={78} rotate={-28} />
            <Arm cx={176} cy={78} rotate={28} />
          </>
        )}

        {/* 身体:只用同色系明暗做体积 */}
        <ellipse cx={100} cy={112} rx={74} ry={68} fill={BODY} />
        <g clipPath={`url(#${clipId})`}>
          <ellipse cx={100} cy={198} rx={90} ry={36} fill={SHADE} />
          <ellipse cx={100} cy={56} rx={64} ry={26} fill={LIGHT} opacity={0.75} />
          <ellipse cx={66} cy={60} rx={20} ry={9} fill={SHINE} transform="rotate(-18 66 60)" />
        </g>

        <Slot />

        {/* 表情 */}
        {mood === "guarding" && (
          <>
            <OpenEyes />
            <path d="M90 106 Q100 114 110 106" fill="none" stroke={DARK} strokeWidth={5} strokeLinecap="round" />
            <Arm cx={66} cy={158} rotate={-60} />
            <Arm cx={134} cy={158} rotate={60} />
            <Coin cx={100} cy={160} r={20} />
          </>
        )}

        {mood === "waiting" && (
          <>
            <OpenEyes lookY={-5} />
            <ellipse cx={100} cy={109} rx={6} ry={7} fill={DARK} />
            <Coin cx={100} cy={24} r={15} />
            <Arm cx={30} cy={126} rotate={18} />
            <Arm cx={170} cy={126} rotate={-18} />
          </>
        )}

        {mood === "celebrating" && (
          <>
            <HappyEyes />
            <path d="M82 98 Q100 122 118 98 Z" fill={DARK} stroke={DARK} strokeWidth={5} strokeLinejoin="round" />
            <ellipse cx={100} cy={108} rx={8} ry={4.5} fill={LIGHT} />
            <Coin cx={36} cy={28} r={11} />
            <Coin cx={166} cy={22} r={13} />
          </>
        )}

        {mood === "paying" && (
          <>
            <OpenEyes lookX={5} />
            <path d="M88 104 Q100 116 112 104" fill="none" stroke={DARK} strokeWidth={5} strokeLinecap="round" />
            <Arm cx={30} cy={128} rotate={16} />
            <Arm cx={168} cy={120} rotate={-68} />
            <Coin cx={184} cy={106} r={15} />
          </>
        )}

        {mood === "refunding" && (
          <>
            <OpenEyes lookY={5} />
            <path d="M56 60 L84 52" stroke={DARK} strokeWidth={5.5} strokeLinecap="round" />
            <path d="M116 52 L144 60" stroke={DARK} strokeWidth={5.5} strokeLinecap="round" />
            <path d="M88 113 Q100 102 112 113" fill="none" stroke={DARK} strokeWidth={5} strokeLinecap="round" />
            <path d="M52 98 q-8 13 0 18 q8 -5 0 -18" fill="#FFFDF9" />
            <Arm cx={170} cy={128} rotate={-16} />
            <Arm cx={32} cy={132} rotate={66} />
            <Coin cx={16} cy={146} r={14} />
          </>
        )}

        {mood === "sleeping" && (
          <>
            <ClosedEyes />
            <ellipse cx={100} cy={104} rx={5} ry={4} fill={DARK} />
            <Arm cx={30} cy={132} rotate={14} />
            <Arm cx={170} cy={132} rotate={-14} />
            <text x={158} y={40} fontSize={26} fontWeight={700} fontFamily="var(--font-display)" fill="#625B50">
              z
            </text>
            <text x={176} y={22} fontSize={18} fontWeight={700} fontFamily="var(--font-display)" fill="#625B50">
              z
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

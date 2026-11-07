import { Coin } from "./Lockie";

type IconProps = { size?: number; className?: string };

const frame = (size: number, className?: string) => ({
  viewBox: "0 0 48 48",
  width: size,
  height: size,
  className,
  "aria-hidden": true as const,
});

export function JarIcon({ size = 24, className }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/lockie/logo.webp" width={size} height={size} alt="" aria-hidden className={className} />
  );
}

export function CoinIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...frame(size, className)}>
      <Coin cx={24} cy={23} r={19} />
    </svg>
  );
}

export function WalletIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...frame(size, className)}>
      <rect x={4} y={12} width={40} height={30} rx={9} fill="#12683F" />
      <rect x={4} y={9} width={40} height={29} rx={9} fill="#2BB673" />
      <rect x={9} y={13} width={22} height={4} rx={2} fill="#7BD6A8" />
      <rect x={29} y={20} width={15} height={12} rx={6} fill="#12683F" />
      <circle cx={36} cy={26} r={3} fill="#FFC93C" />
    </svg>
  );
}

export function CalendarIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...frame(size, className)}>
      <rect x={5} y={10} width={38} height={34} rx={9} fill="#E8E1D6" />
      <rect x={5} y={8} width={38} height={32} rx={9} fill="#FFFDF9" stroke="#E8E1D6" strokeWidth={1.5} />
      <path d="M5 17 a9 9 0 0 1 9 -9 h20 a9 9 0 0 1 9 9 v3 H5 Z" fill="#E5484D" />
      <rect x={14} y={4} width={5} height={10} rx={2.5} fill="#1F1D1A" />
      <rect x={29} y={4} width={5} height={10} rx={2.5} fill="#1F1D1A" />
      <circle cx={17} cy={29} r={3.5} fill="#FFC93C" />
      <circle cx={31} cy={29} r={3.5} fill="#E8E1D6" />
    </svg>
  );
}

export function PeopleIcon({ size = 24, className }: IconProps) {
  return (
    <span className={`relative inline-block shrink-0 ${className ?? ""}`} style={{ width: size, height: size }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lockie/seat-1.webp" width={size * 0.72} height={size * 0.72} alt="" className="absolute right-0 top-0" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lockie/seat-0.webp" width={size * 0.8} height={size * 0.8} alt="" className="absolute bottom-0 left-0" />
    </span>
  );
}

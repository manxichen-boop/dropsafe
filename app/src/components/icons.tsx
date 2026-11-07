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
    <svg {...frame(size, className)}>
      <ellipse cx={24} cy={26} rx={19} ry={18} fill="#FF6B3D" />
      <ellipse cx={24} cy={38} rx={17} ry={7} fill="#E3552A" />
      <ellipse cx={18} cy={15} rx={8} ry={4} fill="#FFBCA6" />
      <rect x={15} y={22} width={18} height={5} rx={2.5} fill="#3D1A0C" />
    </svg>
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
    <svg {...frame(size, className)}>
      <ellipse cx={33} cy={27} rx={11} ry={13} fill="#D69A12" />
      <ellipse cx={33} cy={25} rx={11} ry={13} fill="#FFC93C" />
      <ellipse cx={18} cy={30} rx={14} ry={15} fill="#E3552A" />
      <ellipse cx={18} cy={28} rx={14} ry={15} fill="#FF6B3D" />
      <circle cx={13} cy={25} r={2.4} fill="#1F1D1A" />
      <circle cx={23} cy={25} r={2.4} fill="#1F1D1A" />
      <path d="M14 32 Q18 36 22 32" fill="none" stroke="#1F1D1A" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

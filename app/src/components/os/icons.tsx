import { useMemo } from "react";
import type { TierName } from "@/lib/campaign";
import { drawIcon, drawShield, GRAY, SAFE, SUN, type IconName } from "@/lib/pixels";
import { Pixel } from "./Pixel";

export function DesktopIcon({ name, size = 48 }: { name: IconName; size?: number }) {
  const grid = useMemo(() => drawIcon(name), [name]);
  return <Pixel grid={grid} size={size} />;
}

const TIER_COLOR: Record<TierName, string> = { shielded: SAFE, standard: SUN, trust: GRAY };

export function TierShield({ tier, size = 16 }: { tier: TierName; size?: number }) {
  const grid = useMemo(() => drawShield(TIER_COLOR[tier]), [tier]);
  return <Pixel grid={grid} size={size} />;
}

import { useMemo } from "react";
import { drawLockie, type LockieMood } from "@/lib/pixels";
import { PixelGrid } from "./Pixel";

export type { LockieMood };

const MOOD_LABEL: Record<LockieMood, string> = {
  guarding: "Lockie hugging a coin",
  waiting: "Lockie looking up at a coin",
  celebrating: "Lockie jumping for joy",
  paying: "Lockie handing over a coin",
  refunding: "Lockie sadly giving a coin back",
  sleeping: "Lockie asleep",
};

// 两帧逐帧动画:用 steps 切换显示,尊重 prefers-reduced-motion
export function Lockie({ mood = "guarding", size = 64, decorative = false, className }: { mood?: LockieMood; size?: number; decorative?: boolean; className?: string }) {
  const n = size >= 64 ? 64 : 32;
  const frames = useMemo(() => [drawLockie(mood, n, 0), drawLockie(mood, n, 1)], [mood, n]);
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : MOOD_LABEL[mood]}
    >
      <PixelGrid grid={frames[0]} className="frame-a" />
      <PixelGrid grid={frames[1]} className="frame-b" />
    </svg>
  );
}

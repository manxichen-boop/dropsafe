"use client";

import { useEffect, useState } from "react";
import { explorerTx } from "@/lib/config";
import type { FriendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { Coin, Lockie } from "./Lockie";

const COINS = [
  { dx: "-44px", dy: "-40px", delay: 0 },
  { dx: "-12px", dy: "-56px", delay: 90 },
  { dx: "24px", dy: "-48px", delay: 40 },
  { dx: "48px", dy: "-28px", delay: 130 },
];

// 交易成功:Lockie 跳一下,带几枚硬币。动画只播一次
export function SuccessNotice({ title, signature }: { title: string; signature?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className="card flex items-center gap-3 p-4">
      <div className="relative shrink-0">
        <Lockie mood="celebrating" size={88} decorative />
        {COINS.map((coin, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            width={16}
            height={16}
            aria-hidden
            className="coin-burst absolute left-7 top-5"
            style={{ "--dx": coin.dx, "--dy": coin.dy, animationDelay: `${coin.delay}ms` } as React.CSSProperties}
          >
            <Coin cx={12} cy={11} r={10} />
          </svg>
        ))}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-display text-base font-semibold text-safe-ink">{title}</p>
        {signature && (
          <a href={explorerTx(signature)} target="_blank" rel="noreferrer" className="mt-1 inline-block underline underline-offset-4">
            {t.detail.viewTx}
          </a>
        )}
      </div>
    </div>
  );
}

export function ErrorNotice({ error }: { error: FriendlyError }) {
  const { lang } = useI18n();
  return (
    <div role="alert" className="rounded-2xl border-[1.5px] border-danger bg-danger-tint p-4 text-sm font-medium text-danger-ink">
      {error[lang]}
    </div>
  );
}

// 钱包弹窗偶尔不出现,页面又会一直等待。等久了就告诉用户怎么办
export function WalletHint() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 20_000);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return <p className="text-sm text-muted">{t.walletHint}</p>;
}

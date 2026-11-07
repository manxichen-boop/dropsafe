"use client";

import { useEffect, useState } from "react";
import { explorerTx } from "@/lib/config";
import type { FriendlyError } from "@/lib/errors";

export function SuccessNotice({ title, signature }: { title: string; signature?: string }) {
  return (
    <div role="status" className="rounded-lg border border-mint/40 bg-mint/10 p-4 text-sm">
      <p className="font-medium text-mint">{title}</p>
      {signature && (
        <a href={explorerTx(signature)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-ink underline underline-offset-4">
          View transaction on Solana Explorer ↗
        </a>
      )}
    </div>
  );
}

export function ErrorNotice({ error }: { error: FriendlyError }) {
  return (
    <div role="alert" className="rounded-lg border border-rose/40 bg-rose/10 p-4 text-sm">
      <p className="font-medium text-rose">{error.zh}</p>
      <p className="mt-1 text-ink/80">{error.en}</p>
    </div>
  );
}

// 钱包弹窗偶尔不出现,页面又会一直等待。等久了就告诉用户怎么办
export function WalletHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 20_000);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <p className="text-sm text-muted">
      没看到钱包弹窗?点一下浏览器工具栏的钱包图标,或者刷新页面重试。 Don&apos;t see the wallet popup? Click your wallet
      icon in the toolbar, or refresh and try again.
    </p>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n";

// 钱包按钮依赖浏览器环境,只在客户端渲染
const BaseButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).BaseWalletMultiButton,
  { ssr: false }
);

export function WalletButton() {
  const { t } = useI18n();
  return <BaseButton labels={t.wallet} />;
}

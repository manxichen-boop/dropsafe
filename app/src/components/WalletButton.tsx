"use client";

import dynamic from "next/dynamic";

// 钱包按钮依赖浏览器环境,只在客户端渲染
export const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

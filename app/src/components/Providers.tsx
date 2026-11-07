"use client";

import { Buffer } from "buffer";
import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { UnsafeBurnerWalletAdapter } from "@solana/wallet-adapter-unsafe-burner";
import { ENABLE_BURNER_WALLET, RPC_URL } from "@/lib/config";

// Solana 的库在浏览器里需要全局 Buffer
if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;

export function Providers({ children }: { children: ReactNode }) {
  // Phantom 通过 Wallet Standard 自动被识别,不需要手动注册
  const wallets = useMemo(() => (ENABLE_BURNER_WALLET ? [new UnsafeBurnerWalletAdapter()] : []), []);

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

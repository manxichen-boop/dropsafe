"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { formatSol } from "@/lib/campaign";
import { useI18n } from "@/lib/i18n";
import { useDropsafe } from "@/lib/program";
import { DesktopIcon } from "@/components/os/icons";
import { useOS } from "@/components/os/OS";

export function WalletWindow() {
  const program = useDropsafe();
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { open } = useOS();
  const { t } = useI18n();
  const w = t.os.wallet;
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) return setBalance(null);
    program.provider.connection.getBalance(publicKey).then(setBalance, () => setBalance(null));
  }, [program, publicKey]);

  return (
    <div className="text-center">
      <div className="flex justify-center">
        <DesktopIcon name="wallet" size={64} />
      </div>
      {publicKey ? (
        <>
          <dl className="mt-4 space-y-3 border-y-2 border-ink py-3 text-left">
            <div>
              <dt className="text-[13px]">{w.address}</dt>
              <dd className="break-all">{publicKey.toBase58()}</dd>
            </div>
            <div>
              <dt className="text-[13px]">{w.balance}</dt>
              <dd className="pixel-num text-2xl">{balance === null ? "…" : `${formatSol(balance)} SOL`}</dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-3">
            <button type="button" className="btn" onClick={() => open("organizer", publicKey.toBase58())}>
              {w.organizer}
            </button>
            <button type="button" className="btn" onClick={() => open("buyer", publicKey.toBase58())}>
              {w.buyer}
            </button>
            <button type="button" className="btn" onClick={() => void disconnect()}>
              {t.wallet.disconnect}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4">{w.notConnected}</p>
          <button type="button" className="btn-primary mt-3" onClick={() => setVisible(true)}>
            {t.os.connectWallet}
          </button>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { WalletButton } from "./WalletButton";

export function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-mint">
            <path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6l-8-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m8.5 12 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          DropSafe
        </Link>
        <span className="rounded-full border border-amber/40 bg-amber/10 px-2.5 py-0.5 text-xs font-medium text-amber">
          Devnet
        </span>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/create" className="text-sm text-muted transition-colors hover:text-ink">
            Create campaign
          </Link>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

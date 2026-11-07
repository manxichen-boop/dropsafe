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

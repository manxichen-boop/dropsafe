"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import BN from "bn.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram } from "@solana/web3.js";
import { solToLamports } from "@/lib/campaign";
import { translateError, type FriendlyError } from "@/lib/errors";
import { campaignPda, escrowPda, useDropsafe } from "@/lib/program";
import { ErrorNotice } from "@/components/Notice";
import { WalletButton } from "@/components/WalletButton";

const MAX_U32 = 4_294_967_295;
const PRESETS = [
  { label: "2 min", seconds: 120 },
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "1 week", seconds: 604800 },
];

// 转成 datetime-local 输入框要求的本地时间格式
function toLocalInput(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 outline-none transition-colors placeholder:text-muted/60 focus:border-mint";

export default function CreatePage() {
  const program = useDropsafe();
  const router = useRouter();
  const { publicKey } = useWallet();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0.1");
  const [target, setTarget] = useState("3");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    setDeadline(toLocalInput(Math.floor(Date.now() / 1000) + 3600));
  }, []);

  const validate = (): FriendlyError | null => {
    if (!title.trim()) return { zh: "请填写活动名称。", en: "Please enter a title." };
    if ([...title].length > 50) return { zh: "活动名称不能超过 50 个字符。", en: "The title must be 50 characters or fewer." };
    const lamports = solToLamports(price);
    if (!lamports || lamports.isZero()) return { zh: "请输入大于 0 的金额(最多 9 位小数)。", en: "Enter a price above 0, with at most 9 decimals." };
    const count = Number(target);
    if (!Number.isInteger(count) || count < 1 || count > MAX_U32) return { zh: "目标人数必须是正整数。", en: "The target must be a positive whole number." };
    const when = new Date(deadline).getTime();
    if (Number.isNaN(when) || when <= Date.now()) return { zh: "截止时间必须在未来。", en: "The deadline must be in the future." };
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!publicKey) return;
    const problem = validate();
    setError(problem);
    if (problem) return;

    setSubmitting(true);
    try {
      // 用当前时间戳(毫秒)作为活动编号,同一团长基本不会重复
      const campaignId = new BN(Date.now());
      const campaign = campaignPda(publicKey, campaignId);
      const signature = await program.methods
        .createCampaign(
          campaignId,
          title.trim(),
          solToLamports(price)!,
          Number(target),
          new BN(Math.floor(new Date(deadline).getTime() / 1000))
        )
        .accountsPartial({
          organizer: publicKey,
          campaign,
          escrow: escrowPda(campaign),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      router.push(`/campaign/${campaign.toBase58()}?created=${signature}`);
    } catch (e) {
      console.warn(e);
      setError(translateError(e));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-3xl font-semibold tracking-tight">Create a campaign</h1>
      <p className="mt-2 text-muted">Buyers pay into an escrow. You can only withdraw once the target is reached.</p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. K-pop album group order"
            required
          />
          <span className="mt-1 block text-right font-mono text-xs text-muted">{[...title].length} / 50</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Price per person (SOL)</span>
            <input className={`${inputClass} font-mono`} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Target buyers</span>
            <input className={`${inputClass} font-mono`} value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" required />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="text-sm font-medium">Deadline</span>
            <input type="datetime-local" className={`${inputClass} font-mono`} value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDeadline(toLocalInput(Math.floor(Date.now() / 1000) + preset.seconds))}
                className="rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-mint hover:text-mint"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorNotice error={error} />}

        {publicKey ? (
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-mint py-3 font-medium text-[#06241a] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Confirm in your wallet…" : "Create campaign"}
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-line p-4">
            <span className="text-sm text-muted">Connect a wallet to create a campaign.</span>
            <WalletButton />
          </div>
        )}
      </form>
    </div>
  );
}

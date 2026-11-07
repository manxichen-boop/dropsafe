"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import BN from "bn.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram } from "@solana/web3.js";
import { solToLamports } from "@/lib/campaign";
import { translateError, type FriendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { isHttpUrl, saveMeta } from "@/lib/meta";
import { campaignPda, escrowPda, useDropsafe } from "@/lib/program";
import { CalendarIcon, CoinIcon, PeopleIcon } from "@/components/icons";
import { ErrorNotice, WalletHint } from "@/components/Notice";
import { WalletButton } from "@/components/WalletButton";

const MAX_U32 = 4_294_967_295;
const DAY = 86400;

// 合约必须有发货期限和申诉期,表单不让用户填,用固定默认值
const SHIP_SECONDS = 7 * DAY;
const DISPUTE_SECONDS = 3 * DAY;
// 录演示视频用:/create?demo=1 把这两段时间缩短到 2 分钟
const DEMO_SECONDS = 120;

const PRESETS = [
  { key: "2min", seconds: 120 },
  { key: "1h", seconds: 3600 },
  { key: "1d", seconds: DAY },
  { key: "1w", seconds: 7 * DAY },
] as const;

function toLocalInput(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({
  id,
  label,
  error,
  hint,
  icon,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export default function CreatePage() {
  const program = useDropsafe();
  const router = useRouter();
  const { publicKey } = useWallet();
  const { t } = useI18n();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0.01");
  const [target, setTarget] = useState("3");
  const [deadline, setDeadline] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDeadline(toLocalInput(Math.floor(Date.now() / 1000) + 3600));
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1");
  }, []);

  const errors = {
    title: !title.trim() ? t.create.errName : [...title.trim()].length > 50 ? t.create.errNameLong : null,
    price: !solToLamports(price) || solToLamports(price)!.isZero() ? t.create.errPrice : null,
    target:
      !/^\d+$/.test(target.trim()) || Number(target) < 1 || Number(target) > MAX_U32 ? t.create.errTarget : null,
    deadline: Number.isNaN(new Date(deadline).getTime()) || new Date(deadline).getTime() <= Date.now() ? t.create.errDeadline : null,
    image: image.trim() && !isHttpUrl(image) ? t.create.errImage : null,
  };
  const visibleError = (name: keyof typeof errors) => (touched[name] ? errors[name] : null);
  const touch = (name: string) => setTouched((prev) => ({ ...prev, [name]: true }));
  const aria = (id: keyof typeof errors, withHint = false) => ({
    "aria-invalid": !!visibleError(id),
    "aria-describedby": visibleError(id) ? `${id}-error` : withHint ? `${id}-hint` : undefined,
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ title: true, price: true, target: true, deadline: true, image: true });
    if (!publicKey || Object.values(errors).some(Boolean)) return;

    setError(null);
    setSubmitting(true);
    try {
      // 用当前时间戳(毫秒)作为活动编号,同一团长基本不会重复
      const campaignId = new BN(Date.now());
      const campaign = campaignPda(publicKey, campaignId);
      const deadlineSeconds = Math.floor(new Date(deadline).getTime() / 1000);
      const ship = demo ? DEMO_SECONDS : SHIP_SECONDS;
      const dispute = demo ? DEMO_SECONDS : DISPUTE_SECONDS;
      const signature = await program.methods
        .createCampaign(
          campaignId,
          title.trim(),
          solToLamports(price)!,
          Number(target),
          new BN(deadlineSeconds),
          new BN(deadlineSeconds + ship),
          new BN(deadlineSeconds + ship + dispute)
        )
        .accountsPartial({
          organizer: publicKey,
          campaign,
          escrow: escrowPda(campaign),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      if (image.trim() || description.trim()) {
        saveMeta(campaign.toBase58(), { image: image.trim() || undefined, description: description.trim() || undefined });
      }
      router.push(`/campaign/${campaign.toBase58()}?created=${signature}`);
    } catch (e) {
      console.warn(e);
      setError(translateError(e));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-4xl font-semibold">{t.create.title}</h1>
      <p className="mt-2 leading-relaxed">{t.create.intro}</p>

      <form onSubmit={submit} noValidate className="card mt-6 space-y-5 p-5">
        <Field id="title" label={t.create.name} error={visibleError("title")}>
          <input
            id="title"
            className="field"
            value={title}
            placeholder={t.create.namePlaceholder}
            onChange={(e) => {
              setTitle(e.target.value);
              touch("title");
            }}
            onBlur={() => touch("title")}
            {...aria("title")}
          />
          <p className="mt-1 text-right font-mono text-xs text-muted">{[...title.trim()].length} / 50</p>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field id="price" label={t.create.price} error={visibleError("price")} icon={<CoinIcon size={20} />}>
            <input
              id="price"
              inputMode="decimal"
              className="field font-mono"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                touch("price");
              }}
              onBlur={() => touch("price")}
              {...aria("price")}
            />
          </Field>
          <Field id="target" label={t.create.target} error={visibleError("target")} icon={<PeopleIcon size={20} />}>
            <input
              id="target"
              inputMode="numeric"
              className="field font-mono"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                touch("target");
              }}
              onBlur={() => touch("target")}
              {...aria("target")}
            />
          </Field>
        </div>

        <Field
          id="deadline"
          label={t.create.deadline}
          error={visibleError("deadline")}
          hint={demo ? t.create.demoNote : t.create.defaultsNote}
          icon={<CalendarIcon size={20} />}
        >
          <input
            id="deadline"
            type="datetime-local"
            className="field font-mono"
            value={deadline}
            onChange={(e) => {
              setDeadline(e.target.value);
              touch("deadline");
            }}
            onBlur={() => touch("deadline")}
            {...aria("deadline", true)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setDeadline(toLocalInput(Math.floor(Date.now() / 1000) + preset.seconds));
                  touch("deadline");
                }}
                className="min-h-9 rounded-xl border-[1.5px] border-line bg-bg px-3 text-sm font-medium hover:border-ink"
              >
                {t.create.presets[preset.key]}
              </button>
            ))}
          </div>
        </Field>

        <Field id="image" label={t.create.image} error={visibleError("image")} hint={t.create.imageHint}>
          <input
            id="image"
            type="url"
            className="field"
            value={image}
            onChange={(e) => {
              setImage(e.target.value);
              touch("image");
            }}
            onBlur={() => touch("image")}
            {...aria("image", true)}
          />
        </Field>

        <Field id="description" label={t.create.description} hint={t.create.descriptionHint}>
          <textarea
            id="description"
            rows={3}
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-describedby="description-hint"
          />
        </Field>

        {error && <ErrorNotice error={error} />}

        {publicKey ? (
          <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-lg">
            {submitting ? t.create.pending : t.create.submit}
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg p-4">
            <span className="text-sm">{t.create.connect}</span>
            <WalletButton />
          </div>
        )}
        {submitting && <WalletHint />}
      </form>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import BN from "bn.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram } from "@solana/web3.js";
import {
  formatSol,
  isHttpUrl,
  MAX_CREATE_TEXT_BYTES,
  solToLamports,
  TIERS,
  upfrontOf,
  utf8Length,
  type TierName,
} from "@/lib/campaign";
import { translateError, type FriendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { campaignPda, escrowPda, organizerStatsPda, useDropsafe } from "@/lib/program";
import { CalendarIcon, CoinIcon, PeopleIcon } from "@/components/icons";
import { ErrorNotice, WalletHint } from "@/components/Notice";
import { WalletButton } from "@/components/WalletButton";

const MAX_U32 = 4_294_967_295;
const DAY = 86400;
const MAX_FUNDRAISING = 90 * DAY;
const MAX_DELIVERY = 365 * DAY;

const DEADLINE_PRESETS = [
  { key: "2min", seconds: 120 },
  { key: "1h", seconds: 3600 },
  { key: "1d", seconds: DAY },
  { key: "1w", seconds: 7 * DAY },
] as const;

// 按商品类型建议发货期,不强制
const PRODUCT_TYPES = [
  { key: "album", seconds: 42 * DAY },
  { key: "merch", seconds: 90 * DAY },
  { key: "figure", seconds: 360 * DAY },
  { key: "demo", seconds: 120 },
] as const;

function toLocalInput(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const toSeconds = (value: string) => Math.floor(new Date(value).getTime() / 1000);

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

const presetClass = "min-h-9 rounded-xl border-[1.5px] border-line bg-bg px-3 text-sm font-medium hover:border-ink";

export default function CreatePage() {
  const program = useDropsafe();
  const router = useRouter();
  const { publicKey } = useWallet();
  const { t } = useI18n();

  const [tier, setTier] = useState<TierName>("shielded");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.01");
  const [target, setTarget] = useState("3");
  const [deadline, setDeadline] = useState("");
  const [delivery, setDelivery] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setDeadline(toLocalInput(now + 7 * DAY));
    setDelivery(toLocalInput(now + 7 * DAY + 42 * DAY));
  }, []);

  const lamports = solToLamports(price);
  const count = /^\d+$/.test(target.trim()) ? Number(target) : 0;
  const validCount = count >= 1 && count <= MAX_U32;
  const upfront = lamports ? upfrontOf(lamports) : null;

  // 实时显示三档的金额。金额没填好时显示比例
  const amount = (perSeat: BN | null, seats: number) =>
    perSeat && validCount ? `${formatSol(perSeat.muln(seats))} SOL` : null;
  const bond = tier === "shielded" && upfront && validCount ? upfront.muln(count) : new BN(0);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const deadlineSeconds = toSeconds(deadline);
  const deliverySeconds = toSeconds(delivery);
  const textBytes = utf8Length(title.trim()) + utf8Length(description.trim()) + utf8Length(image.trim());

  const errors = {
    title: !title.trim() ? t.create.errName : [...title.trim()].length > 50 ? t.create.errNameLong : null,
    description:
      [...description.trim()].length > 280
        ? t.create.errDescription
        : textBytes > MAX_CREATE_TEXT_BYTES
          ? t.create.errTextTotal
          : null,
    price: !lamports || lamports.isZero() ? t.create.errPrice : null,
    target: !validCount ? t.create.errTarget : null,
    deadline:
      Number.isNaN(deadlineSeconds) || deadlineSeconds <= nowSeconds
        ? t.create.errDeadline
        : deadlineSeconds > nowSeconds + MAX_FUNDRAISING
          ? t.create.errDeadlineFar
          : null,
    delivery:
      Number.isNaN(deliverySeconds) || deliverySeconds <= deadlineSeconds
        ? t.create.errDelivery
        : deliverySeconds > deadlineSeconds + MAX_DELIVERY
          ? t.create.errDeliveryFar
          : null,
    image: image.trim() && (!isHttpUrl(image) || utf8Length(image.trim()) > 200) ? t.create.errImage : null,
  };
  const show = (name: keyof typeof errors) => (touched[name] ? errors[name] : null);
  const touch = (name: string) => setTouched((prev) => ({ ...prev, [name]: true }));
  const aria = (id: keyof typeof errors, withHint = false) => ({
    "aria-invalid": !!show(id),
    "aria-describedby": show(id) ? `${id}-error` : withHint ? `${id}-hint` : undefined,
  });
  const bind = (id: string, set: (value: string) => void) => ({
    onChange: (e: { target: { value: string } }) => {
      set(e.target.value);
      touch(id);
    },
    onBlur: () => touch(id),
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(Object.fromEntries(Object.keys(errors).map((key) => [key, true])));
    if (!publicKey || Object.values(errors).some(Boolean)) return;

    setError(null);
    setSubmitting(true);
    try {
      // 用当前时间戳(毫秒)作为活动编号,同一团长基本不会重复
      const campaignId = new BN(Date.now());
      const campaign = campaignPda(publicKey, campaignId);
      const signature = await program.methods
        .createCampaign(
          campaignId,
          title.trim(),
          description.trim(),
          image.trim(),
          lamports!,
          count,
          new BN(deadlineSeconds),
          new BN(deliverySeconds),
          { [tier]: {} } as never
        )
        .accountsPartial({
          organizer: publicKey,
          campaign,
          escrow: escrowPda(campaign),
          organizerStats: organizerStatsPda(publicKey),
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

  const tierFacts: Record<TierName, { deposit: string; receive: string; loss: string }> = {
    shielded: {
      deposit: amount(upfront, count) ?? t.create.perPrice(70),
      receive: amount(upfront, count) ?? t.create.perPrice(70),
      loss: "0%",
    },
    standard: {
      deposit: "0 SOL",
      receive: amount(upfront, count) ?? t.create.perPrice(70),
      loss: "70%",
    },
    trust: {
      deposit: "0 SOL",
      receive: amount(lamports, count) ?? t.create.perPrice(100),
      loss: "100%",
    },
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold">{t.create.title}</h1>

      <form onSubmit={submit} noValidate className="mt-6 space-y-6">
        <fieldset>
          <legend className="font-display text-xl font-semibold">{t.create.tierTitle}</legend>
          <p className="mt-1 text-sm text-muted">{t.create.tierHint}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {TIERS.map((option) => (
              <label
                key={option}
                className={`card block cursor-pointer p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                  tier === option ? "!border-ink" : ""
                }`}
              >
                <span className="flex items-center gap-2 font-display text-lg font-semibold">
                  <input type="radio" name="tier" value={option} checked={tier === option} onChange={() => setTier(option)} className="accent-ink" />
                  {t.tier[option]}
                </span>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-muted">{t.create.tierDeposit}</dt>
                    <dd className="font-mono font-medium">{tierFacts[option].deposit}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t.create.tierReceive}</dt>
                    <dd className="font-mono font-medium">{tierFacts[option].receive}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t.create.tierLoss}</dt>
                    <dd className="font-mono font-medium">{tierFacts[option].loss}</dd>
                  </div>
                </dl>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="card space-y-5 p-5">
          <Field id="title" label={t.create.name} error={show("title")}>
            <input id="title" className="field" value={title} placeholder={t.create.namePlaceholder} {...bind("title", setTitle)} {...aria("title")} />
            <p className="mt-1 text-right font-mono text-xs text-muted">{[...title.trim()].length} / 50</p>
          </Field>

          <Field id="image" label={t.create.image} error={show("image")} hint={t.create.imageHint}>
            <input id="image" type="url" className="field" value={image} {...bind("image", setImage)} {...aria("image", true)} />
          </Field>

          <Field id="description" label={t.create.description} error={show("description")} hint={t.create.descriptionHint}>
            <textarea id="description" rows={3} className="field" value={description} {...bind("description", setDescription)} {...aria("description", true)} />
            <p className="mt-1 text-right font-mono text-xs text-muted">{[...description.trim()].length} / 280</p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field id="price" label={t.create.price} error={show("price")} icon={<CoinIcon size={20} />}>
              <input id="price" inputMode="decimal" className="field font-mono" value={price} {...bind("price", setPrice)} {...aria("price")} />
            </Field>
            <Field id="target" label={t.create.target} error={show("target")} icon={<PeopleIcon size={20} />}>
              <input id="target" inputMode="numeric" className="field font-mono" value={target} {...bind("target", setTarget)} {...aria("target")} />
            </Field>
          </div>

          <Field id="deadline" label={t.create.deadline} error={show("deadline")} hint={t.create.deadlineHint} icon={<CalendarIcon size={20} />}>
            <input id="deadline" type="datetime-local" className="field font-mono" value={deadline} {...bind("deadline", setDeadline)} {...aria("deadline", true)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {DEADLINE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={presetClass}
                  onClick={() => {
                    setDeadline(toLocalInput(Math.floor(Date.now() / 1000) + preset.seconds));
                    touch("deadline");
                  }}
                >
                  {t.create.presets[preset.key]}
                </button>
              ))}
            </div>
          </Field>

          <Field id="delivery" label={t.create.delivery} error={show("delivery")} hint={t.create.deliveryHint} icon={<CalendarIcon size={20} />}>
            <input id="delivery" type="datetime-local" className="field font-mono" value={delivery} {...bind("delivery", setDelivery)} {...aria("delivery", true)} />
            <p className="mt-2 text-xs font-semibold">{t.create.deliveryChoices}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRODUCT_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  className={presetClass}
                  onClick={() => {
                    const base = Number.isNaN(deadlineSeconds) ? Math.floor(Date.now() / 1000) : deadlineSeconds;
                    setDelivery(toLocalInput(base + type.seconds));
                    touch("delivery");
                  }}
                >
                  {t.create.productTypes[type.key]}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg p-4 text-sm">
            <span className="font-semibold">{t.create.bondLabel}</span>
            <span className="font-mono text-base font-medium">{tier === "shielded" ? `${formatSol(bond)} SOL` : t.create.bondNone}</span>
          </div>

          {error && <ErrorNotice error={error} />}

          {publicKey ? (
            <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-lg">
              {submitting ? t.create.pending : t.create.submit(formatSol(bond))}
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg p-4">
              <span className="text-sm">{t.create.connect}</span>
              <WalletButton />
            </div>
          )}
          {submitting && <WalletHint />}
        </div>
      </form>
    </div>
  );
}

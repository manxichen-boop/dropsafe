"use client";

import { useEffect, useState, type FormEvent } from "react";
import BN from "bn.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SystemProgram } from "@solana/web3.js";
import { formatSol, isHttpUrl, MAX_CREATE_TEXT_BYTES, solToLamports, TIERS, upfrontOf, utf8Length, type TierName } from "@/lib/campaign";
import { clearChainCache } from "@/lib/chain";
import { translateError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { campaignExtPda, campaignPda, escrowPda, organizerStatsExtPda, organizerStatsPda, useDropsafe } from "@/lib/program";
import { TierShield } from "@/components/os/icons";
import { useOS, type OSWindow } from "@/components/os/OS";

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

// 最长运输时间:团长发货时填的 ETA 不能超过发货时间加这个值。合约上限 60 天
const TRANSIT_CHOICES = [
  { key: "demo", seconds: 60 },
  { key: "domestic", seconds: 7 * DAY },
  { key: "international", seconds: 21 * DAY },
  { key: "freight", seconds: 45 * DAY },
] as const;

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

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="pixel-title mb-1 block">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[13px]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 border-l-4 border-red pl-2 text-[13px] font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

const chip = "border-2 border-ink bg-paper px-2 py-1 text-[13px] hover:bg-line";

export function NewGroupBuyWindow({ win }: { win: OSWindow }) {
  const program = useDropsafe();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { t } = useI18n();
  const { confirm, done, fail, open, close } = useOS();

  const [tier, setTier] = useState<TierName>("shielded");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.01");
  const [target, setTarget] = useState("3");
  const [deadline, setDeadline] = useState("");
  const [delivery, setDelivery] = useState("");
  const [transit, setTransit] = useState<number>(7 * DAY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setDeadline(toLocalInput(now + 7 * DAY));
    setDelivery(toLocalInput(now + 7 * DAY + 42 * DAY));
  }, []);

  const lamports = solToLamports(price);
  const count = /^\d+$/.test(target.trim()) ? Number(target) : 0;
  const validCount = count >= 1 && count <= MAX_U32;
  const upfront = lamports ? upfrontOf(lamports) : null;
  const amount = (perSeat: BN | null) => (perSeat && validCount ? `${formatSol(perSeat.muln(count))} SOL` : null);
  const bond = tier === "shielded" && upfront && validCount ? upfront.muln(count) : new BN(0);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const deadlineSeconds = toSeconds(deadline);
  const deliverySeconds = toSeconds(delivery);
  const textBytes = utf8Length(title.trim()) + utf8Length(description.trim()) + utf8Length(image.trim());

  const errors = {
    title: !title.trim() ? t.create.errName : [...title.trim()].length > 50 ? t.create.errNameLong : null,
    description: [...description.trim()].length > 280 ? t.create.errDescription : textBytes > MAX_CREATE_TEXT_BYTES ? t.create.errTextTotal : null,
    price: !lamports || lamports.isZero() ? t.create.errPrice : null,
    target: !validCount ? t.create.errTarget : null,
    deadline: Number.isNaN(deadlineSeconds) || deadlineSeconds <= nowSeconds ? t.create.errDeadline : deadlineSeconds > nowSeconds + MAX_FUNDRAISING ? t.create.errDeadlineFar : null,
    delivery: Number.isNaN(deliverySeconds) || deliverySeconds <= deadlineSeconds ? t.create.errDelivery : deliverySeconds > deadlineSeconds + MAX_DELIVERY ? t.create.errDeliveryFar : null,
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

    const ok = await confirm({
      text: bond.isZero() ? t.os.say.createNoBond : t.os.say.create(formatSol(bond)),
      confirmLabel: t.os.confirm,
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const campaignId = new BN(Date.now());
      const campaign = campaignPda(publicKey, campaignId);
      const signature = await program.methods
        .createCampaign(campaignId, title.trim(), description.trim(), image.trim(), lamports!, count, new BN(deadlineSeconds), new BN(deliverySeconds), { [tier]: {} } as never, new BN(transit))
        .accountsPartial({
          organizer: publicKey,
          campaign,
          escrow: escrowPda(campaign),
          organizerStats: organizerStatsPda(publicKey),
          campaignExt: campaignExtPda(campaign),
          organizerStatsExt: organizerStatsExtPda(publicKey),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      clearChainCache();
      close(win.id);
      open("campaign", campaign.toBase58());
      void done(t.detail.done.created, signature);
    } catch (e) {
      console.warn(e);
      setSubmitting(false);
      void fail(translateError(e));
    }
  };

  const facts: Record<TierName, { deposit: string; receive: string; loss: string }> = {
    shielded: { deposit: amount(upfront) ?? t.create.perPrice(70), receive: amount(upfront) ?? t.create.perPrice(70), loss: "0%" },
    standard: { deposit: "0 SOL", receive: amount(upfront) ?? t.create.perPrice(70), loss: "70%" },
    trust: { deposit: "0 SOL", receive: amount(lamports) ?? t.create.perPrice(100), loss: "100%" },
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className="pixel-title text-lg">{t.create.tierTitle}</legend>
        <p className="text-[13px]">{t.create.tierHint}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {TIERS.map((option) => (
            <label key={option} className={`block cursor-pointer border-2 border-ink p-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tomato has-[:focus-visible]:outline-dashed ${tier === option ? "bg-line" : ""}`}>
              <span className="pixel-title flex items-center gap-2">
                <input type="radio" name="tier" value={option} checked={tier === option} onChange={() => setTier(option)} className="accent-ink" />
                <TierShield tier={option} size={24} />
                {t.tier[option]}
              </span>
              <dl className="mt-2 space-y-1 text-[13px]">
                <div>
                  <dt>{t.create.tierDeposit}</dt>
                  <dd className="font-semibold">{facts[option].deposit}</dd>
                </div>
                <div>
                  <dt>{t.create.tierReceive}</dt>
                  <dd className="font-semibold">{facts[option].receive}</dd>
                </div>
                <div>
                  <dt>{t.create.tierLoss}</dt>
                  <dd className="font-semibold">{facts[option].loss}</dd>
                </div>
              </dl>
            </label>
          ))}
        </div>
      </fieldset>

      <Field id="title" label={t.create.name} error={show("title")}>
        <input id="title" className="field" value={title} {...bind("title", setTitle)} {...aria("title")} />
      </Field>
      <Field id="image" label={t.create.image} error={show("image")} hint={t.create.imageHint}>
        <input id="image" type="url" className="field" value={image} {...bind("image", setImage)} {...aria("image", true)} />
      </Field>
      <Field id="description" label={t.create.description} error={show("description")} hint={t.create.descriptionHint}>
        <textarea id="description" rows={3} className="field" value={description} {...bind("description", setDescription)} {...aria("description", true)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="price" label={t.create.price} error={show("price")}>
          <input id="price" inputMode="decimal" className="field" value={price} {...bind("price", setPrice)} {...aria("price")} />
        </Field>
        <Field id="target" label={t.create.target} error={show("target")}>
          <input id="target" inputMode="numeric" className="field" value={target} {...bind("target", setTarget)} {...aria("target")} />
        </Field>
      </div>

      <Field id="deadline" label={t.create.deadline} error={show("deadline")} hint={t.create.deadlineHint}>
        <input id="deadline" type="datetime-local" className="field" value={deadline} {...bind("deadline", setDeadline)} {...aria("deadline", true)} />
        <div className="mt-2 flex flex-wrap gap-1">
          {DEADLINE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={chip}
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

      <Field id="delivery" label={t.create.delivery} error={show("delivery")} hint={t.create.deliveryHint}>
        <input id="delivery" type="datetime-local" className="field" value={delivery} {...bind("delivery", setDelivery)} {...aria("delivery", true)} />
        <p className="mt-2 text-[13px] font-semibold">{t.create.deliveryChoices}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {PRODUCT_TYPES.map((type) => (
            <button
              key={type.key}
              type="button"
              className={chip}
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

      <fieldset>
        <legend className="pixel-title mb-1">{t.create.transit}</legend>
        <div role="radiogroup" className="flex flex-wrap gap-1">
          {TRANSIT_CHOICES.map((choice) => (
            <button
              key={choice.key}
              type="button"
              role="radio"
              aria-checked={transit === choice.seconds}
              className={`${chip} ${transit === choice.seconds ? "!bg-ink text-paper" : ""}`}
              onClick={() => setTransit(choice.seconds)}
            >
              {t.create.transitChoices[choice.key]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[13px]">{t.create.transitHint}</p>
      </fieldset>

      <div className="panel flex flex-wrap items-center justify-between gap-2">
        <span className="pixel-title">{t.create.bondLabel}</span>
        <span className="font-semibold">{tier === "shielded" ? `${formatSol(bond)} SOL` : t.create.bondNone}</span>
      </div>

      <div className="os-sticky-bar">
        {publicKey ? (
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t.create.pending : t.create.submit(formatSol(bond))}
          </button>
        ) : (
          <button type="button" className="btn-primary w-full" onClick={() => setVisible(true)}>
            {t.os.connectWallet}
          </button>
        )}
      </div>
    </form>
  );
}

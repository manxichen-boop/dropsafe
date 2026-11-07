"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { displayStatus, formatCountdown, formatSol, nextDeadline, type Campaign } from "@/lib/campaign";
import { useI18n } from "@/lib/i18n";
import { isHttpUrl, loadMeta, type CampaignMeta } from "@/lib/meta";
import { Lockie } from "./Lockie";
import { SeatBuddies } from "./SeatBuddies";
import { StatusBadge } from "./StatusBadge";

export function ProductImage({ meta, title, large = false }: { meta: CampaignMeta; title: string; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = meta.image && isHttpUrl(meta.image) && !broken ? meta.image : null;
  return (
    <div className={`flex w-full items-center justify-center overflow-hidden bg-tomato ${large ? "h-56 rounded-[20px] md:h-80" : "h-32"}`}>
      {src ? (
        // 图片链接由用户任意填写,所以用普通 img,不走 next/image 的域名白名单
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-sun-tint">
          <Lockie mood="guarding" size={large ? 180 : 104} decorative />
        </div>
      )}
    </div>
  );
}

export function CampaignCard({
  address,
  campaign,
  buyers,
  now,
}: {
  address: string;
  campaign: Campaign;
  buyers: string[];
  now: number;
}) {
  const { lang, t } = useI18n();
  const [meta, setMeta] = useState<CampaignMeta>({});
  useEffect(() => setMeta(loadMeta(address, lang)), [address, lang]);

  const status = displayStatus(campaign, now);
  const next = nextDeadline(campaign, status);
  const seatsLeft = campaign.targetCount - campaign.contributorCount;

  return (
    <Link href={`/campaign/${address}`} className="card block overflow-hidden transition-transform hover:-translate-y-0.5">
      <ProductImage meta={meta} title={campaign.title} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words font-display text-lg font-semibold leading-snug">{campaign.title}</h3>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 font-mono text-sm">
          {formatSol(campaign.pricePerPersonLamports)} SOL <span className="text-muted">{t.home.perPerson}</span>
        </p>
        <div className="mt-3">
          <SeatBuddies
            campaign={address}
            target={campaign.targetCount}
            joined={campaign.contributorCount}
            buyers={buyers}
            hop={status === "funded"}
            label={t.home.joinedCount(campaign.contributorCount, campaign.targetCount)}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold">
            {status === "open" && seatsLeft > 0
              ? t.home.seatsLeft(seatsLeft)
              : t.home.joinedCount(campaign.contributorCount, campaign.targetCount)}
          </span>
          <span className="font-mono text-muted">{next === null || next <= now ? t.ended : formatCountdown(next - now)}</span>
        </div>
      </div>
    </Link>
  );
}

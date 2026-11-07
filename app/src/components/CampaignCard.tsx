"use client";

import Link from "next/link";
import { useState } from "react";
import { displayStatus, formatCountdown, formatSol, isHttpUrl, nextDeadline, tierOf, type Campaign } from "@/lib/campaign";
import { useI18n } from "@/lib/i18n";
import { Lockie } from "./Lockie";
import { SeatBuddies } from "./SeatBuddies";
import { StatusBadge, TierBadge } from "./StatusBadge";

export function ProductImage({ url, title, large = false }: { url: string; title: string; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = url && isHttpUrl(url) && !broken ? url : null;
  return (
    <div className={`flex w-full items-center justify-center overflow-hidden bg-sun-tint ${large ? "h-56 rounded-[20px] md:h-80" : "h-32"}`}>
      {src ? (
        // 图片链接由团长任意填写,所以用普通 img,不走 next/image 的域名白名单
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <Lockie mood="guarding" size={large ? 200 : 120} decorative />
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
  const { t } = useI18n();
  const status = displayStatus(campaign, now);
  const next = nextDeadline(campaign, status);
  const seatsLeft = campaign.targetCount - campaign.joinedCount;

  return (
    <Link href={`/campaign/${address}`} className="card block overflow-hidden transition-transform hover:-translate-y-0.5">
      <ProductImage url={campaign.imageUrl} title={campaign.title} />
      <div className="p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <TierBadge tier={tierOf(campaign)} />
          <StatusBadge status={status} />
        </div>
        <h3 className="break-words font-display text-lg font-semibold leading-snug">{campaign.title}</h3>
        <p className="mt-1 font-mono text-sm">
          {formatSol(campaign.price)} SOL <span className="text-muted">{t.home.perPerson}</span>
        </p>
        <div className="mt-3">
          <SeatBuddies
            campaign={address}
            target={campaign.targetCount}
            joined={campaign.joinedCount}
            buyers={buyers}
            hop={status === "funded"}
            label={t.home.joinedCount(campaign.joinedCount, campaign.targetCount)}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold">
            {status === "open" && seatsLeft > 0 ? t.home.seatsLeft(seatsLeft) : t.home.joinedCount(campaign.joinedCount, campaign.targetCount)}
          </span>
          <span className="font-mono text-muted">{next === null || next <= now ? t.ended : formatCountdown(next - now)}</span>
        </div>
      </div>
    </Link>
  );
}

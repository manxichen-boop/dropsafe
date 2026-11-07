"use client";

import { useI18n } from "@/lib/i18n";
import { Lockie } from "./Lockie";
import { SeatBuddies } from "./SeatBuddies";

function Arrow() {
  return (
    <svg viewBox="0 0 40 16" className="mt-10 w-5 shrink-0 sm:w-10" aria-hidden>
      <path d="M2 8 H32" stroke="#1F1D1A" strokeWidth={2.5} strokeDasharray="4 5" strokeLinecap="round" />
      <path d="M30 2 L38 8 L30 14" fill="none" stroke="#1F1D1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const stepText = "mt-2 text-center text-xs font-medium leading-snug sm:text-sm";

export function StoryLine() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="story-title" className="mt-12">
      <h2 id="story-title" className="font-display text-2xl font-semibold">
        {t.home.storyTitle}
      </h2>

      <div className="mt-6 flex items-start justify-between gap-1 sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <Lockie mood="waiting" size={96} decorative />
          <p className={stepText}>{t.home.story1}</p>
        </div>
        <Arrow />
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex h-24 items-center">
            <div className="w-[88px] sm:w-[112px]">
              <SeatBuddies campaign="story" target={6} joined={6} buyers={[]} label={t.home.story2} />
            </div>
          </div>
          <p className={stepText}>{t.home.story2}</p>
        </div>
        <Arrow />
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <Lockie mood="paying" size={96} decorative />
          <p className={stepText}>{t.home.story3}</p>
        </div>
      </div>

      {/* 分支:从“凑名额”这一步往下走 */}
      <div className="mx-auto flex max-w-md flex-col items-center">
        <svg viewBox="0 0 16 40" className="h-10 w-4" aria-hidden>
          <path d="M8 2 V30" stroke="#AD1F26" strokeWidth={2.5} strokeDasharray="4 5" strokeLinecap="round" />
          <path d="M2 28 L8 37 L14 28" fill="none" stroke="#AD1F26" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-center text-sm font-semibold text-danger-ink">{t.home.storyBranch}</p>
        <div className="mt-2 flex items-center gap-3">
          <Lockie mood="refunding" size={96} decorative />
          <p className="max-w-48 text-sm font-medium">{t.home.storyRefund}</p>
        </div>
      </div>
    </section>
  );
}

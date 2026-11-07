import type { Lang } from "./i18n";

// 商品图片和描述不上链:只存在用户自己的浏览器里。
// 示例活动的描述写在这里,这样所有访客都能看到。
export interface CampaignMeta {
  image?: string;
  description?: string;
}

const SAMPLES: Record<string, Record<Lang, string>> = {
  CuVaydAbfEovAgzNvt2k5aZDC5WggFFkWP22QMbLvG8s: {
    en: "Sample listing. One copy of the new album per buyer, with pickup in Kuala Lumpur.",
    zh: "示例活动。每位买家一张新专辑,在吉隆坡自取。",
  },
  EGDf13J7hh7HfJdk15UCsTAb5Fnc9u7hbGQDCdwbm86f: {
    en: "Sample listing. A full photocard set per buyer. The group filled and the organizer has withdrawn 70%.",
    zh: "示例活动。每位买家一套完整小卡。已经成团,团长已提取 70%。",
  },
  "5BPcgRzoBhgcJZjn164n4ArMfMRo49HjFFvF5XgMxCFz": {
    en: "Sample listing. A shared order on a limited sneaker release.",
    zh: "示例活动。一起拼单限量球鞋。",
  },
  G1BCs1n9ug32dWHyZY1ze1kwH2pSbmRhFHLJgnvJ2Ezy: {
    en: "Sample listing. This group didn't fill by the deadline, so buyers can take their SOL back.",
    zh: "示例活动。截止时没有凑满,买家可以取回自己的 SOL。",
  },
};

const key = (campaign: string) => `dropsafe.meta.${campaign}`;

export function loadMeta(campaign: string, lang: Lang): CampaignMeta {
  const sample = SAMPLES[campaign];
  const base: CampaignMeta = sample ? { description: sample[lang] } : {};
  try {
    const saved = window.localStorage.getItem(key(campaign));
    if (saved) return { ...base, ...(JSON.parse(saved) as CampaignMeta) };
  } catch {
    // 存储不可用或内容损坏时,当作没有本地数据
  }
  return base;
}

export function saveMeta(campaign: string, meta: CampaignMeta) {
  try {
    window.localStorage.setItem(key(campaign), JSON.stringify(meta));
  } catch {
    // 存不下只是少了图片和描述,不影响链上的活动
  }
}

export const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

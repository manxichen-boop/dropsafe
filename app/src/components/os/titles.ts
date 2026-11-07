import { shortAddress } from "@/lib/campaign";
import type { useI18n } from "@/lib/i18n";
import type { IconName } from "@/lib/pixels";
import type { OSWindow, WindowKind } from "./OS";

type T = ReturnType<typeof useI18n>["t"];

export const ICON_OF: Record<WindowKind, IconName> = {
  readme: "readme",
  groupbuys: "groupbuys",
  new: "new",
  wallet: "wallet",
  escrow: "escrow",
  activity: "activity",
  orders: "orders",
  rules: "rules",
  privacy: "privacy",
  campaign: "groupbuys",
  organizer: "organizer",
  buyer: "buyer",
};

export function titleFor(win: OSWindow, t: T, campaignTitles: Record<string, string> = {}): string {
  const campaignTitle = win.param ? campaignTitles[win.param] : undefined;
  switch (win.kind) {
    case "readme":
      return t.os.icons.readme;
    case "groupbuys":
      return t.os.icons.groupbuys;
    case "new":
      return t.os.icons.new;
    case "wallet":
      return t.os.icons.wallet;
    case "escrow":
      return t.os.icons.escrow;
    case "activity":
      return t.os.icons.activity;
    case "orders":
      return t.os.icons.orders;
    case "rules":
      return t.os.icons.rules;
    case "privacy":
      return t.os.icons.privacy;
    case "campaign":
      return campaignTitle ?? `${t.os.groupBuy} ${shortAddress(win.param ?? "")}`;
    case "organizer":
      return `${t.os.icons.organizer} ${shortAddress(win.param ?? "")}`;
    case "buyer":
      return `${t.os.icons.buyer} ${shortAddress(win.param ?? "")}`;
  }
}

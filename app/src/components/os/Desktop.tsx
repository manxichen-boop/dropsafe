"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useI18n } from "@/lib/i18n";
import { drawLockie, FRAME_PATTERN, type IconName } from "@/lib/pixels";
import { CampaignWindow } from "@/components/windows/CampaignWindow";
import { ActivityWindow } from "@/components/windows/ActivityWindow";
import { EscrowMonitorWindow } from "@/components/windows/EscrowMonitorWindow";
import { GroupBuysWindow } from "@/components/windows/GroupBuysWindow";
import { NewGroupBuyWindow } from "@/components/windows/NewGroupBuyWindow";
import { BuyerWindow, OrganizerWindow } from "@/components/windows/RecordWindows";
import { PrivacyWindow, ReadMeWindow, RulesWindow } from "@/components/windows/TextWindows";
import { WalletWindow } from "@/components/windows/WalletWindow";
import { DesktopIcon } from "./icons";
import { MenuBar } from "./MenuBar";
import { useOS, type OSWindow, type WindowKind } from "./OS";
import { PixelGrid } from "./Pixel";
import { SystemDialog } from "./SystemDialog";
import { ICON_OF, titleFor } from "./titles";
import { Window } from "./Window";

const WIDTHS: Partial<Record<WindowKind, number>> = {
  readme: 460,
  groupbuys: 640,
  new: 560,
  campaign: 720,
  escrow: 460,
  activity: 560,
  rules: 620,
  organizer: 560,
  buyer: 480,
  wallet: 420,
  privacy: 480,
};

const FIRST_VISIT_KEY = "dropsafe.firstVisit";

const LEFT_ICONS: { icon: IconName; kind: WindowKind }[] = [
  { icon: "readme", kind: "readme" },
  { icon: "groupbuys", kind: "groupbuys" },
  { icon: "new", kind: "new" },
  { icon: "wallet", kind: "wallet" },
  { icon: "organizer", kind: "organizer" },
  { icon: "buyer", kind: "buyer" },
  { icon: "escrow", kind: "escrow" },
  { icon: "activity", kind: "activity" },
];
const CORNER_ICONS: { icon: IconName; kind: WindowKind }[] = [
  { icon: "rules", kind: "rules" },
  { icon: "privacy", kind: "privacy" },
];

// 桌面壁纸:超大的抖动像素 Lockie,6% 透明度
function Wallpaper() {
  const grid = useMemo(() => {
    const g = drawLockie("guarding", 64, 0);
    return g.map((row, y) => row.map((c, x) => ((x + y) % 2 === 0 ? c : null)));
  }, []);
  return (
    <svg viewBox="0 0 64 64" shapeRendering="crispEdges" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[90%] max-h-[720px] -translate-x-1/2 -translate-y-1/2 opacity-[0.06]">
      <PixelGrid grid={grid} />
    </svg>
  );
}

function IconButton({ icon, kind, selected, onSelect }: { icon: IconName; kind: WindowKind; selected: boolean; onSelect: () => void }) {
  const { t } = useI18n();
  const openIcon = useOpenIcon();
  return (
    <button
      type="button"
      className="desk-icon"
      aria-pressed={selected}
      onClick={(e) => {
        onSelect();
        // 手机上单击直接打开
        if (window.matchMedia("(max-width: 767px)").matches) openIcon(kind, e.currentTarget);
      }}
      onDoubleClick={(e) => openIcon(kind, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          openIcon(kind, e.currentTarget);
        }
      }}
    >
      <DesktopIcon name={icon} size={48} />
      <span className="desk-label">{t.os.icons[icon]}</span>
    </button>
  );
}

// 团长记录和买家记录默认打开自己的钱包;没连接时先连接
function useOpenIcon() {
  const { open } = useOS();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  return (kind: WindowKind, opener: HTMLElement) => {
    if (kind === "organizer" || kind === "buyer") {
      if (!publicKey) {
        setVisible(true);
        return;
      }
      open(kind, publicKey.toBase58(), opener);
      return;
    }
    open(kind, undefined, opener);
  };
}

function WindowContent({ win }: { win: OSWindow }) {
  switch (win.kind) {
    case "readme":
      return <ReadMeWindow />;
    case "groupbuys":
      return <GroupBuysWindow />;
    case "new":
      return <NewGroupBuyWindow win={win} />;
    case "wallet":
      return <WalletWindow />;
    case "escrow":
      return <EscrowMonitorWindow />;
    case "activity":
      return <ActivityWindow />;
    case "rules":
      return <RulesWindow />;
    case "privacy":
      return <PrivacyWindow />;
    case "campaign":
      return <CampaignWindow address={win.param!} />;
    case "organizer":
      return <OrganizerWindow address={win.param!} />;
    case "buyer":
      return <BuyerWindow address={win.param!} />;
  }
}

export function Desktop({ children }: { children: ReactNode }) {
  const { windows, close, open, dialog } = useOS();
  const { t } = useI18n();
  const [selected, setSelected] = useState<WindowKind | null>(null);
  const checkedFirstVisit = useRef(false);

  // 首次访问自动打开"团购活动"和"说明",说明在最上面。写入标记后刷新不再重复打开
  useEffect(() => {
    if (checkedFirstVisit.current) return;
    checkedFirstVisit.current = true;
    try {
      if (window.location.pathname === "/" && !window.localStorage.getItem(FIRST_VISIT_KEY)) {
        window.localStorage.setItem(FIRST_VISIT_KEY, "1");
        open("groupbuys");
        open("readme");
      }
    } catch {
      // 浏览器禁用存储时不自动打开
    }
  }, [open]);

  // Esc 关闭当前窗口
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || dialog) return;
      const top = windows[windows.length - 1];
      if (top) close(top.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [windows, close, dialog]);

  const frameUrl = useMemo(() => `url("data:image/svg+xml,${FRAME_PATTERN.replace(/</g, "%3C").replace(/>/g, "%3E")}")`, []);

  return (
    <>
      <div className="fixed inset-0" style={{ backgroundImage: frameUrl }} aria-hidden />
      <div className="os-screen">
        <MenuBar />
        <main className="os-desktop" onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <Wallpaper />
          <div className="relative grid h-full grid-cols-3 content-start justify-items-center gap-1 overflow-auto p-2 md:flex md:w-fit md:flex-col md:flex-nowrap md:items-start md:gap-0">
            {LEFT_ICONS.map(({ icon, kind }) => (
              <IconButton key={kind} icon={icon} kind={kind} selected={selected === kind} onSelect={() => setSelected(kind)} />
            ))}
            {/* 手机上这两个图标排进网格 */}
            {CORNER_ICONS.map(({ icon, kind }) => (
              <div key={kind} className="contents md:hidden">
                <IconButton icon={icon} kind={kind} selected={selected === kind} onSelect={() => setSelected(kind)} />
              </div>
            ))}
          </div>
          {/* 桌面上固定在右下角 */}
          <div className="absolute bottom-2 right-2 hidden flex-col md:flex">
            {CORNER_ICONS.map(({ icon, kind }) => (
              <IconButton key={kind} icon={icon} kind={kind} selected={selected === kind} onSelect={() => setSelected(kind)} />
            ))}
          </div>
          {windows.map((win, i) => (
            <WindowFrame key={win.id} win={win} z={100 + i} active={i === windows.length - 1} />
          ))}
          <SystemDialog />
          <span className="sr-only">{t.footer.note}</span>
          {children}
        </main>
      </div>
    </>
  );
}

function WindowFrame({ win, z, active }: { win: OSWindow; z: number; active: boolean }) {
  const { t } = useI18n();
  const { campaignTitles } = useOS();
  return (
    <Window win={win} z={z} active={active} title={titleFor(win, t, campaignTitles)} icon={ICON_OF[win.kind]} width={WIDTHS[win.kind]}>
      <WindowContent win={win} />
    </Window>
  );
}

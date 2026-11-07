"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddress, TIERS } from "@/lib/campaign";
import { dateLocale, useI18n } from "@/lib/i18n";
import { useOS } from "./OS";
import { titleFor } from "./titles";

type Item = { label: string; run: () => void };
type Menu = { key: string; label: string; items: Item[]; align?: "right"; className?: string };

function useClock(lang: string) {
  const [text, setText] = useState("");
  useEffect(() => {
    const update = () =>
      setText(
        new Date().toLocaleString(lang === "zh" ? "zh-CN" : "en-GB", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [lang]);
  return text;
}

export function MenuBar() {
  const { windows, open, close, focus, setFilter } = useOS();
  const { lang, setLang, t } = useI18n();
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const clock = useClock(dateLocale(lang) === "zh-CN" ? "zh" : "en");

  const top = windows[windows.length - 1];
  const fileItems: Item[] = [
    { label: t.os.menu.newGroupBuy, run: () => open("new") },
    ...(top ? [{ label: t.os.menu.closeWindow, run: () => close(top.id) }] : []),
  ];
  const viewItems: Item[] = [
    { label: t.home.filterAll, run: () => (setFilter("all"), open("groupbuys")) },
    ...TIERS.map((tier) => ({ label: t.tier[tier], run: () => (setFilter(tier), open("groupbuys")) })),
    { label: lang === "en" ? "中文" : "English", run: () => setLang(lang === "en" ? "zh" : "en") },
  ];
  const windowItems: Item[] = windows.length
    ? windows.map((win) => ({ label: titleFor(win, t), run: () => focus(win.id) }))
    : [{ label: t.os.menu.noWindows, run: () => {} }];
  const helpItems: Item[] = [
    { label: t.os.icons.readme, run: () => open("readme") },
    { label: t.os.icons.rules, run: () => open("rules") },
    { label: t.os.icons.privacy, run: () => open("privacy") },
  ];
  const walletItems: Item[] = publicKey
    ? [
        { label: t.os.icons.wallet, run: () => open("wallet") },
        { label: t.wallet["copy-address"], run: () => void navigator.clipboard?.writeText(publicKey.toBase58()) },
        { label: t.wallet["change-wallet"], run: () => setVisible(true) },
        { label: t.wallet.disconnect, run: () => void disconnect() },
      ]
    : [];

  const left: Menu[] = useMemo(
    () => [
      { key: "file", label: t.os.menu.file, items: fileItems, className: "max-md:hidden" },
      { key: "view", label: t.os.menu.view, items: viewItems, className: "max-md:hidden" },
      { key: "window", label: t.os.menu.window, items: windowItems, className: "max-md:hidden" },
      { key: "help", label: t.os.menu.help, items: helpItems, className: "max-md:hidden" },
    ],
    // 菜单内容随窗口、语言和钱包变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, windows, lang, top?.id]
  );
  // 手机上把所有菜单合成一个汉堡菜单
  const burger: Menu = { key: "burger", label: "≡", items: [...fileItems, ...viewItems, ...windowItems, ...helpItems], className: "md:hidden" };
  const walletMenu: Menu | null = publicKey ? { key: "wallet", label: shortAddress(publicKey.toBase58()), items: walletItems, align: "right" } : null;

  useEffect(() => {
    if (!openKey) return;
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpenKey(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [openKey]);

  const triggers = () => [...(bar.current?.querySelectorAll<HTMLElement>("[data-menu-trigger]") ?? [])].filter((el) => el.offsetParent !== null);
  const focusFirstItem = (key: string) =>
    requestAnimationFrame(() => bar.current?.querySelector<HTMLElement>(`[data-menu="${key}"] [role=menuitem]`)?.focus());

  const onTriggerKey = (e: React.KeyboardEvent, key: string) => {
    const list = triggers();
    const index = list.indexOf(e.currentTarget as HTMLElement);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = list[(index + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length];
      next.focus();
      if (openKey) {
        const nextKey = next.dataset.menuTrigger!;
        setOpenKey(nextKey);
        focusFirstItem(nextKey);
      }
    } else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpenKey(key);
      focusFirstItem(key);
    } else if (e.key === "Escape" && openKey) {
      e.stopPropagation();
      setOpenKey(null);
    }
  };

  const onItemKey = (e: React.KeyboardEvent, key: string) => {
    const items = [...(bar.current?.querySelectorAll<HTMLElement>(`[data-menu="${key}"] [role=menuitem]`) ?? [])];
    const index = items.indexOf(e.currentTarget as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(index + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpenKey(null);
      bar.current?.querySelector<HTMLElement>(`[data-menu-trigger="${key}"]`)?.focus();
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const list = triggers();
      const current = list.findIndex((el) => el.dataset.menuTrigger === key);
      const next = list[(current + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length];
      const nextKey = next.dataset.menuTrigger!;
      setOpenKey(nextKey);
      focusFirstItem(nextKey);
    }
  };

  const renderMenu = (menu: Menu) => (
    <div key={menu.key} className={`relative flex ${menu.className ?? ""}`}>
      <button
        type="button"
        data-menu-trigger={menu.key}
        aria-haspopup="menu"
        aria-expanded={openKey === menu.key}
        aria-label={menu.key === "burger" ? t.os.menu.all : undefined}
        className="menu-trigger"
        onClick={() => setOpenKey(openKey === menu.key ? null : menu.key)}
        onKeyDown={(e) => onTriggerKey(e, menu.key)}
      >
        {menu.label}
      </button>
      {openKey === menu.key && (
        <div role="menu" data-menu={menu.key} aria-label={menu.label} className={`menu-list ${menu.align === "right" || menu.key === "burger" ? "right-0" : "left-0"}`}>
          {menu.items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="menu-item"
              onClick={() => {
                setOpenKey(null);
                item.run();
              }}
              onKeyDown={(e) => onItemKey(e, menu.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={bar} className="os-menubar">
      <span className="flex items-center px-3 font-bold">DropSafe OS</span>
      {left.map(renderMenu)}
      <div className="ml-auto flex items-stretch">
        <span className="flex items-center bg-sun px-2 max-md:hidden">{t.nav.devnet}</span>
        {walletMenu ? (
          renderMenu(walletMenu)
        ) : (
          <button type="button" className="menu-trigger" onClick={() => setVisible(true)}>
            {t.os.connectWallet}
          </button>
        )}
        <span className="flex items-center px-2 max-md:hidden" suppressHydrationWarning>
          {clock}
        </span>
        {renderMenu(burger)}
      </div>
    </div>
  );
}

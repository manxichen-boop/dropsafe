"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TierName } from "@/lib/campaign";
import type { FriendlyError } from "@/lib/errors";
import type { LockieMood } from "./Lockie";

export type WindowKind =
  | "readme"
  | "groupbuys"
  | "new"
  | "wallet"
  | "escrow"
  | "activity"
  | "rules"
  | "privacy"
  | "campaign"
  | "organizer"
  | "buyer";

export interface OSWindow {
  id: string;
  kind: WindowKind;
  param?: string;
  x: number;
  y: number;
  opener: HTMLElement | null;
}

export type DialogState =
  | { type: "confirm"; mood: LockieMood; text: string; confirmLabel: string; danger?: boolean; resolve: (ok: boolean) => void }
  | { type: "done"; text: string; signature?: string; resolve: (ok: boolean) => void }
  | { type: "fail"; error: FriendlyError; resolve: (ok: boolean) => void };

type ConfirmOptions = { mood?: LockieMood; text: string; confirmLabel: string; danger?: boolean };

interface OSValue {
  windows: OSWindow[];
  open: (kind: WindowKind, param?: string, opener?: HTMLElement | null) => void;
  close: (id: string) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  commitPosition: (id: string) => void;
  filter: TierName | "all";
  setFilter: (filter: TierName | "all") => void;
  dialog: DialogState | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  done: (text: string, signature?: string) => Promise<boolean>;
  fail: (error: FriendlyError) => Promise<boolean>;
  closeDialog: (result: boolean) => void;
  /** 团购窗口读到商品名后登记在这里,窗口标题和菜单用它代替地址 */
  campaignTitles: Record<string, string>;
  setCampaignTitle: (address: string, title: string) => void;
}

const OSContext = createContext<OSValue | null>(null);

export const useOS = () => {
  const value = useContext(OSContext);
  if (!value) throw new Error("useOS must be used inside OSProvider");
  return value;
};

const STORAGE_PREFIX = "dropsafe.win.";

function savedPosition(id: string): { x: number; y: number } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePosition(id: string, x: number, y: number) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify({ x, y }));
  } catch {
    // 存不下只是下次打开回到默认位置
  }
}

// 只有这些窗口有自己的网址,方便分享
function urlOf(win: OSWindow | undefined): string {
  if (!win) return "/";
  switch (win.kind) {
    case "campaign":
      return `/campaign/${win.param}`;
    case "organizer":
      return `/organizer/${win.param}`;
    case "buyer":
      return `/buyer/${win.param}`;
    case "new":
      return "/create";
    case "privacy":
      return "/privacy";
    default:
      return "/";
  }
}

const idOf = (kind: WindowKind, param?: string) => (param ? `${kind}:${param}` : kind);

export function OSProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<OSWindow[]>([]);
  const [filter, setFilter] = useState<TierName | "all">("all");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [campaignTitles, setCampaignTitles] = useState<Record<string, string>>({});
  const setCampaignTitle = useCallback((address: string, title: string) => {
    setCampaignTitles((prev) => (prev[address] === title ? prev : { ...prev, [address]: title }));
  }, []);
  const windowsRef = useRef(windows);
  // 同步更新引用:连着调用 close 和 open 时,第二步要看到第一步的结果
  const commit = useCallback((next: OSWindow[]) => {
    windowsRef.current = next;
    setWindows(next);
  }, []);

  const syncUrl = useCallback((list: OSWindow[], push = false) => {
    const url = urlOf(list[list.length - 1]);
    if (window.location.pathname === url) return;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  const focus = useCallback(
    (id: string) => {
      const list = windowsRef.current;
      const win = list.find((w) => w.id === id);
      if (!win || list[list.length - 1].id === id) return;
      const next = [...list.filter((w) => w.id !== id), win];
      commit(next);
      syncUrl(next);
    },
    [commit, syncUrl]
  );

  const open = useCallback(
    (kind: WindowKind, param?: string, opener: HTMLElement | null = null) => {
      const id = idOf(kind, param);
      const list = windowsRef.current;
      if (list.some((w) => w.id === id)) {
        focus(id);
        return;
      }
      // 新窗口在上一个窗口的位置向右下偏移 24px
      const last = list[list.length - 1];
      // 第一个窗口放在左边那列图标的右边
      const start = last ? { x: last.x + 24, y: last.y + 24 } : { x: 124, y: 16 };
      const pos = savedPosition(id) ?? start;
      const next = [...list, { id, kind, param, x: pos.x, y: pos.y, opener }];
      commit(next);
      syncUrl(next, true);
    },
    [commit, focus, syncUrl]
  );

  const close = useCallback(
    (id: string) => {
      const list = windowsRef.current;
      const win = list.find((w) => w.id === id);
      const next = list.filter((w) => w.id !== id);
      commit(next);
      syncUrl(next);
      // 关闭后焦点回到打开它的图标
      if (win?.opener?.isConnected) win.opener.focus();
    },
    [commit, syncUrl]
  );

  const move = useCallback((id: string, x: number, y: number) => {
    commit(windowsRef.current.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, [commit]);

  const commitPosition = useCallback((id: string) => {
    const win = windowsRef.current.find((w) => w.id === id);
    if (win) savePosition(id, win.x, win.y);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setDialog({ type: "confirm", mood: "waiting", ...options, resolve })),
    []
  );
  const done = useCallback(
    (text: string, signature?: string) => new Promise<boolean>((resolve) => setDialog({ type: "done", text, signature, resolve })),
    []
  );
  const fail = useCallback(
    (error: FriendlyError) => new Promise<boolean>((resolve) => setDialog({ type: "fail", error, resolve })),
    []
  );
  const closeDialog = useCallback(
    (result: boolean) => {
      dialog?.resolve(result);
      setDialog(null);
    },
    [dialog]
  );

  const value = useMemo(
    () => ({ windows, open, close, focus, move, commitPosition, filter, setFilter, dialog, confirm, done, fail, closeDialog, campaignTitles, setCampaignTitle }),
    [windows, open, close, focus, move, commitPosition, filter, dialog, confirm, done, fail, closeDialog, campaignTitles, setCampaignTitle]
  );
  return <OSContext.Provider value={value}>{children}</OSContext.Provider>;
}

// 路由页面用它:直接打开网址时,在桌面上显示对应的窗口
export function OpenOnLoad({ kind, param }: { kind: WindowKind; param?: string }) {
  const { open } = useOS();
  useEffect(() => {
    open(kind, param);
    // 只在进入页面时打开一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

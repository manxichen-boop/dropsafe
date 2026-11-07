"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

const en = {
  nav: { create: "Create a group buy", languageLabel: "Language", devnet: "Devnet" },
  wallet: {
    "change-wallet": "Change wallet",
    connecting: "Connecting",
    "copy-address": "Copy address",
    copied: "Copied",
    disconnect: "Disconnect",
    "has-wallet": "Connect",
    "no-wallet": "Connect wallet",
  },
  home: {
    title: "Group buys with the money held on\u2060-\u2060chain until it's earned.",
    subtitle:
      "Your SOL goes into an escrow account with no private key. If the group doesn't fill by the deadline, every buyer takes their full share back. If it fills, the organizer receives 70% to place the order, and the last 30% stays in escrow until buyers confirm delivery or the dispute window closes.",
    mascotAlt: "Lockie, a round orange coin jar, hugging a coin",
    storyTitle: "How your coins travel",
    story1: "Buyers drop their SOL into Lockie",
    story2: "All seats fill up",
    story3: "Organizer withdraws 70%. The last 30% follows delivery",
    storyBranch: "Seats not filled by the deadline",
    storyRefund: "Lockie hands every buyer their coins back",
    statsLabel: "Live from Solana Devnet",
    statLocked: "SOL in escrow",
    statFunded: "Group buys filled",
    statRefunds: "Refunds claimed",
    statsFailed: "Couldn't read Devnet right now.",
    listTitle: "Group buys",
    listNote: "Sample listings on Devnet. They use test SOL and are not real orders.",
    newCampaign: "Create a group buy",
    loading: "Loading group buys",
    loadFailed: "Couldn't load group buys from the chain.",
    retry: "Try again",
    empty: "No group buys yet. Lockie is taking a nap.",
    emptyCta: "Create the first one",
    perPerson: "per person",
    seatsLeft: (n: number) => `${n} more to go`,
    joinedCount: (a: number, b: number) => `${a} of ${b} joined`,
  },
  status: {
    open: "Fundraising",
    funded: "Target reached",
    failed: "Not filled",
    abandoned: "Refunds open",
    delivering: "Awaiting delivery",
    dispute: "Dispute window",
    claimable: "Disputes closed",
    completed: "Completed",
  },
  ended: "Ended",
  detail: {
    back: "All group buys",
    loading: "Loading group buy",
    loadFailed: "Couldn't load this group buy.",
    retry: "Try again",
    notFound: "We couldn't find that page or group buy.",
    backHome: "Back to all group buys",
    noDescription: "The organizer hasn't added a description in this browser.",
    price: "Price per person",
    seats: "Seats",
    timeTo: {
      open: "Time left to join",
      funded: "Time left to withdraw",
      delivering: "Time left to ship",
      dispute: "Time left to report",
    },
    timeNone: "Deadlines",
    explain: {
      open: "Your SOL stays in escrow until the group fills. If it doesn't fill by the deadline, you can take it back.",
      funded: "The group filled. The organizer can now withdraw 70% to place the order. The last 30% stays locked.",
      failed: "The group didn't fill by the deadline. Every buyer can take their SOL back.",
      abandoned: "The organizer didn't withdraw before the shipping deadline. Every buyer can take their full payment back.",
      delivering: "The organizer has withdrawn 70%. The last 30% stays locked until buyers confirm delivery or the dispute window closes.",
      dispute: "The shipping deadline has passed. If your goods didn't arrive, report it now and take back your 30%.",
      claimable: "The dispute window has closed. The organizer can claim the 30% from buyers who didn't report a problem.",
      completed: "Every buyer's share has been settled. This group buy is complete.",
    },
    timeline: "Progress",
    stepRaising: "Fundraising",
    stepFunded: "Group filled",
    stepReleased: "70% released",
    stepDone: "Completed",
    stepNotFilled: "Not filled",
    stepRefund: "Refunds open",
    joinBy: "Join by",
    shipBy: "Ship by",
    reportBy: "Report problems by",
    fundsTitle: "Where the money is",
    fundsNote: "This account has no private key. It can only pay out or refund by the rules.",
    fundsLocked: "Locked right now",
    fundsAddress: "Escrow account",
    copy: "Copy",
    copied: "Copied",
    explorer: "View on Solana Explorer",
    organizer: "Organizer",
    organizerYou: "Organizer (you)",
    connect: "Connect a wallet to take part.",
    pending: "Confirm in your wallet",
    join: (sol: string) => `Join for ${sol} SOL`,
    refund: (sol: string) => `Get my ${sol} SOL back`,
    withdraw: (sol: string) => `Withdraw ${sol} SOL (70%)`,
    confirm: (sol: string) => `I got my goods. Release ${sol} SOL`,
    dispute: (sol: string) => `I didn't get my goods. Get ${sol} SOL back`,
    claim: (sol: string, n: number) => `Claim ${sol} SOL from ${n} ${n === 1 ? "buyer" : "buyers"}`,
    wait: {
      open: "You've joined. Your SOL is in escrow.",
      fundedJoined: "You've joined and the group filled. Waiting for the organizer to withdraw.",
      fundedOther: "This group is full.",
      noClaim: "You have no SOL to claim here.",
      deliveringOrganizer: "Ship the goods before the shipping deadline. Buyers can confirm delivery at any time.",
      deliveringOther: "This group is waiting for delivery.",
      disputeOrganizer: "You can claim undisputed shares after the dispute window closes.",
      disputeOther: "You have no share to settle here.",
      nothing: "Nothing left to do here.",
    },
    done: {
      created: "Group buy created",
      joined: "You're in. Your SOL is in escrow",
      refunded: "Your SOL is back in your wallet",
      withdrawn: "70% withdrawn to your wallet",
      confirmed: "Delivery confirmed. The organizer got your final 30%",
      claimed: "Undisputed shares claimed",
    },
    viewTx: "View transaction on Solana Explorer",
  },
  create: {
    title: "Create a group buy",
    intro:
      "Buyers pay into an escrow. Once the group fills, you can withdraw 70% to place the order. The last 30% stays locked until buyers confirm delivery or the dispute window closes.",
    name: "Product name",
    namePlaceholder: "SEVENTEEN album group buy · Kuala Lumpur",
    price: "Price per person (SOL)",
    target: "Target buyers",
    deadline: "Deadline",
    image: "Product image URL (optional)",
    imageHint: "Saved in this browser only, not on the chain.",
    description: "Description (optional)",
    descriptionHint: "Saved in this browser only, not on the chain.",
    presets: { "2min": "2 min", "1h": "1 hour", "1d": "1 day", "1w": "1 week" },
    demoNote: "Demo timing is on: shipping and dispute windows are 2 minutes each.",
    defaultsNote: "Organizers get 7 days after the deadline to ship. Buyers then get 3 days to report a problem.",
    submit: "Create group buy",
    pending: "Confirm in your wallet",
    connect: "Connect a wallet to create a group buy.",
    errName: "Enter a product name.",
    errNameLong: "Use 50 characters or fewer.",
    errPrice: "Enter a price above 0, with at most 9 decimals.",
    errTarget: "Enter a whole number of 1 or more.",
    errDeadline: "Pick a time in the future.",
    errImage: "Enter a link starting with http:// or https://.",
  },
  walletHint: "Don't see the wallet popup? Click your wallet icon in the toolbar, or refresh and try again.",
  footer: {
    note: "A Solana Devnet hackathon prototype. No real funds. Not audited.",
    privacy: "Privacy",
    terms: "Terms",
    source: "Source code",
  },
  privacy: {
    title: "Privacy",
    items: [
      "DropSafe is a hackathon prototype on Solana Devnet. It handles test SOL only, never real money.",
      "We don't ask for your name or email, and we don't run accounts or analytics.",
      "Your wallet address and transactions are public on Solana Devnet, as on any blockchain.",
      "Product image links, descriptions and your language choice stay in your browser's local storage. Clearing site data removes them.",
      "The site is hosted on Vercel, which may keep standard server logs such as IP addresses.",
    ],
  },
  terms: {
    title: "Terms",
    items: [
      "DropSafe is a hackathon prototype and has not been audited. Use it for trying things out only.",
      "It runs on Solana Devnet with test SOL, which has no value. Do not send real funds.",
      "Campaigns on this site are samples or tests, not real offers to sell anything.",
      "Devnet can reset or go down, and data on it can disappear.",
      "The software is provided as is, with no warranty.",
    ],
  },
};

type Messages = typeof en;

const zh: Messages = {
  nav: { create: "创建团购", languageLabel: "语言", devnet: "Devnet" },
  wallet: {
    "change-wallet": "更换钱包",
    connecting: "连接中",
    "copy-address": "复制地址",
    copied: "已复制",
    disconnect: "断开连接",
    "has-wallet": "连接",
    "no-wallet": "连接钱包",
  },
  home: {
    title: "团购的钱留在链上,赚到了才放出。",
    subtitle: "你的 SOL 存进一个没有私钥的托管账户。截止时没凑满,每位买家都能全额取回。凑满后,团长收到 70% 去下单,剩下 30% 留在托管里,直到买家确认收货或申诉期结束。",
    mascotAlt: "Lockie,一个圆滚滚的橙色存钱罐,抱着一枚硬币",
    storyTitle: "你的硬币怎么走",
    story1: "买家把 SOL 投进 Lockie",
    story2: "名额全部凑满",
    story3: "团长提取 70%,收货后再结算 30%",
    storyBranch: "截止时没凑满",
    storyRefund: "Lockie 把硬币还给每位买家",
    statsLabel: "实时读取自 Solana Devnet",
    statLocked: "托管中的 SOL",
    statFunded: "成功成团",
    statRefunds: "已退款",
    statsFailed: "暂时读取不到 Devnet 数据。",
    listTitle: "团购活动",
    listNote: "这些是 Devnet 上的示例,使用测试币,不是真实订单。",
    newCampaign: "创建团购",
    loading: "正在加载团购",
    loadFailed: "读取链上数据失败。",
    retry: "重试",
    empty: "还没有团购,Lockie 在打盹。",
    emptyCta: "创建第一个团购",
    perPerson: "每人",
    seatsLeft: (n) => `还差 ${n} 人`,
    joinedCount: (a, b) => `已参与 ${a} / ${b}`,
  },
  status: {
    open: "募集中",
    funded: "已成团",
    failed: "未成团",
    abandoned: "可退款",
    delivering: "等待收货",
    dispute: "申诉期",
    claimable: "申诉已结束",
    completed: "已完成",
  },
  ended: "已结束",
  detail: {
    back: "全部团购",
    loading: "正在加载团购",
    loadFailed: "读取这个团购失败。",
    retry: "重试",
    notFound: "没有找到这个页面或团购。",
    backHome: "返回全部团购",
    noDescription: "团长没有在这个浏览器里添加描述。",
    price: "每人单价",
    seats: "名额",
    timeTo: {
      open: "距离报名截止",
      funded: "距离提取截止",
      delivering: "距离发货期限",
      dispute: "距离申诉截止",
    },
    timeNone: "各项期限",
    explain: {
      open: "成团之前,你的 SOL 一直留在托管里。截止时没凑满,你可以取回。",
      funded: "已经成团。团长现在可以提取 70% 去下单,剩下 30% 继续锁定。",
      failed: "截止时没有凑满,每位买家都可以取回自己的 SOL。",
      abandoned: "团长没有在发货期限前提取,每位买家都可以全额取回。",
      delivering: "团长已提取 70%。剩下 30% 会锁定到买家确认收货,或申诉期结束。",
      dispute: "发货期限已过。如果没收到货,现在就可以报告并取回 30%。",
      claimable: "申诉期已结束。团长可以领取没有异议的买家的 30%。",
      completed: "每位买家的份额都已结算,这个团购已完成。",
    },
    timeline: "进度",
    stepRaising: "募集中",
    stepFunded: "已成团",
    stepReleased: "已放款 70%",
    stepDone: "已完成",
    stepNotFilled: "未成团",
    stepRefund: "可退款",
    joinBy: "报名截止",
    shipBy: "发货期限",
    reportBy: "申诉截止",
    fundsTitle: "资金在哪里",
    fundsNote: "这个账户没有私钥,只能按规则付款或退款。",
    fundsLocked: "当前锁定",
    fundsAddress: "托管账户",
    copy: "复制",
    copied: "已复制",
    explorer: "在 Solana Explorer 查看",
    organizer: "团长",
    organizerYou: "团长(你)",
    connect: "连接钱包后即可参与。",
    pending: "请在钱包中确认",
    join: (sol) => `花 ${sol} SOL 参团`,
    refund: (sol) => `取回我的 ${sol} SOL`,
    withdraw: (sol) => `提取 ${sol} SOL(70%)`,
    confirm: (sol) => `我收到货了,放出 ${sol} SOL`,
    dispute: (sol) => `我没收到货,取回 ${sol} SOL`,
    claim: (sol, n) => `领取 ${n} 位买家的 ${sol} SOL`,
    wait: {
      open: "你已参团,你的 SOL 已存进托管。",
      fundedJoined: "你已参团,并且已经成团。正在等团长提取。",
      fundedOther: "这个团已经满员了。",
      noClaim: "你在这个团购里没有可取回的 SOL。",
      deliveringOrganizer: "请在发货期限前发货。买家随时可以确认收货。",
      deliveringOther: "这个团购正在等待收货。",
      disputeOrganizer: "申诉期结束后,你可以领取没有异议的份额。",
      disputeOther: "你在这个团购里没有需要结算的份额。",
      nothing: "这里没有需要你操作的事了。",
    },
    done: {
      created: "团购已创建",
      joined: "参团成功,你的 SOL 已进入托管",
      refunded: "你的 SOL 已回到钱包",
      withdrawn: "70% 已提取到你的钱包",
      confirmed: "已确认收货,团长收到了你的 30% 尾款",
      claimed: "没有异议的份额已领取",
    },
    viewTx: "在 Solana Explorer 查看交易",
  },
  create: {
    title: "创建团购",
    intro: "买家把钱付进托管。成团后,你可以先提取 70% 去下单,剩下 30% 会锁定到买家确认收货,或申诉期结束。",
    name: "商品名称",
    namePlaceholder: "SEVENTEEN album group buy · Kuala Lumpur",
    price: "单价(SOL)",
    target: "目标人数",
    deadline: "截止时间",
    image: "商品图片链接(可选)",
    imageHint: "只保存在这个浏览器里,不上链。",
    description: "描述(可选)",
    descriptionHint: "只保存在这个浏览器里,不上链。",
    presets: { "2min": "2 分钟", "1h": "1 小时", "1d": "1 天", "1w": "1 周" },
    demoNote: "已开启演示时间:发货期和申诉期各 2 分钟。",
    defaultsNote: "团长在截止后有 7 天发货时间,之后买家有 3 天可以报告问题。",
    submit: "创建团购",
    pending: "请在钱包中确认",
    connect: "连接钱包后即可创建团购。",
    errName: "请填写商品名称。",
    errNameLong: "最多 50 个字符。",
    errPrice: "请输入大于 0 的金额,最多 9 位小数。",
    errTarget: "请输入 1 或更大的整数。",
    errDeadline: "请选择未来的时间。",
    errImage: "请输入以 http:// 或 https:// 开头的链接。",
  },
  walletHint: "没看到钱包弹窗?点一下浏览器工具栏的钱包图标,或者刷新页面重试。",
  footer: {
    note: "Solana Devnet 黑客松原型,不涉及真实资金,未经审计。",
    privacy: "隐私",
    terms: "条款",
    source: "源代码",
  },
  privacy: {
    title: "隐私",
    items: [
      "DropSafe 是 Solana Devnet 上的黑客松原型,只使用测试币,不涉及真实资金。",
      "我们不要求填写姓名或邮箱,也没有账户系统和统计分析。",
      "和所有区块链一样,你的钱包地址和交易在 Solana Devnet 上是公开的。",
      "商品图片链接、描述和语言选择只保存在你浏览器的本地存储里,清除网站数据后就会消失。",
      "网站托管在 Vercel,它可能保留 IP 地址等标准服务器日志。",
    ],
  },
  terms: {
    title: "条款",
    items: [
      "DropSafe 是黑客松原型,未经审计,仅供试用。",
      "它运行在 Solana Devnet 上,使用没有价值的测试币。请不要发送真实资金。",
      "这个网站上的活动都是示例或测试,不是真实的销售要约。",
      "Devnet 可能重置或中断,上面的数据可能消失。",
      "软件按现状提供,不作任何保证。",
    ],
  },
};

const MESSAGES: Record<Lang, Messages> = { en, zh };
const STORAGE_KEY = "dropsafe.lang";

const I18nContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void; t: Messages }>({
  lang: "en",
  setLang: () => {},
  t: en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // 服务端固定渲染英文,挂载后再读取用户的选择,避免水合不一致
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "zh") setLangState("zh");
    } catch {
      // 浏览器禁用存储时,直接用默认语言
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 存不下也不影响当前页面切换
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: MESSAGES[lang] }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const dateLocale = (lang: Lang) => (lang === "zh" ? "zh-CN" : "en-GB");

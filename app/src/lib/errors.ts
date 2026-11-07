export interface FriendlyError {
  zh: string;
  en: string;
}

// 合约自定义错误码 → 中英文提示
const PROGRAM_ERRORS: Record<string, FriendlyError> = {
  TitleTooLong: { zh: "活动名称不能超过 50 个字符。", en: "The title must be 50 characters or fewer." },
  InvalidPrice: { zh: "每人金额必须大于 0。", en: "The price per person must be greater than 0." },
  InvalidTargetCount: { zh: "目标人数必须大于 0。", en: "The target count must be greater than 0." },
  DeadlineNotInFuture: { zh: "截止时间必须在未来。", en: "The deadline must be in the future." },
  NotFundraising: { zh: "这个活动已不再接受参与。", en: "This campaign is no longer accepting contributions." },
  DeadlinePassed: { zh: "活动已过截止时间,无法参与。", en: "The deadline has passed, so you can no longer join." },
  CampaignFull: { zh: "活动已满员。", en: "This campaign is already full." },
  CampaignStillActive: {
    zh: "活动还没到截止时间,暂时不能退款。",
    en: "The campaign is still running. Refunds open after the deadline.",
  },
  TargetAlreadyReached: { zh: "活动已达标,不能退款。", en: "The campaign reached its target, so refunds are not available." },
  NotOrganizer: { zh: "只有团长才能提取资金。", en: "Only the organizer can withdraw the funds." },
  TargetNotReached: { zh: "活动还没达标,团长不能提取。", en: "The target has not been reached, so funds cannot be withdrawn." },
  AlreadyReleased: { zh: "资金已经提取过了。", en: "The funds have already been withdrawn." },
  MathOverflow: { zh: "金额计算溢出。", en: "The amount calculation overflowed." },
  // Anchor 框架错误:参与凭证不存在,说明没参与过或已退款
  AccountNotInitialized: {
    zh: "没有找到你的参与记录:你可能没参与过,或者已经退款了。",
    en: "No contribution found. You may not have joined, or you were already refunded.",
  },
};

const IDL_ERROR_NAMES = Object.keys(PROGRAM_ERRORS);

export function translateError(error: unknown): FriendlyError {
  const e = error as { name?: string; message?: string; logs?: string[]; error?: { errorCode?: { code?: string } } };
  const code = e?.error?.errorCode?.code;
  if (code && PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];

  const text = [e?.name, e?.message, ...(e?.logs ?? [])].filter(Boolean).join("\n");

  const named = IDL_ERROR_NAMES.find((name) => text.includes(name));
  if (named) return PROGRAM_ERRORS[named];

  if (/already in use/.test(text)) {
    return { zh: "你已经参与过这个活动了,每个钱包只能参与一次。", en: "You already joined this campaign. Each wallet can join once." };
  }
  if (/User rejected|rejected the request|WalletSignTransactionError/i.test(text)) {
    return { zh: "你在钱包里取消了这笔交易。", en: "You cancelled the transaction in your wallet." };
  }
  if (/insufficient (funds|lamports)|no record of a prior credit/i.test(text)) {
    return {
      zh: "钱包里的 Devnet SOL 不够,请先到 faucet.solana.com 领取。",
      en: "Not enough Devnet SOL. Get some at faucet.solana.com first.",
    };
  }
  if (/already been processed/i.test(text)) {
    return { zh: "这笔交易已经提交过了,请刷新页面查看。", en: "This transaction was already submitted. Refresh to check the result." };
  }
  // 交易的 blockhash 只有约 60–90 秒有效,在钱包里停留太久就会过期
  if (/blockhash|expired|timeout/i.test(text)) {
    return {
      zh: "交易已过期,没有扣款。请重试,并在钱包弹窗出现后尽快确认。",
      en: "The transaction expired and nothing was charged. Please try again and approve it promptly in your wallet.",
    };
  }
  if (/WalletNotConnected|Wallet not connected/i.test(text)) {
    return { zh: "请先连接钱包。", en: "Please connect your wallet first." };
  }
  return { zh: "交易失败,请重试。", en: `The transaction failed: ${e?.message ?? "unknown error"}` };
}

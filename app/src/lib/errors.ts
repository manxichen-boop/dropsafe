export interface FriendlyError {
  zh: string;
  en: string;
}

// 合约自定义错误码 → 中英文提示
const PROGRAM_ERRORS: Record<string, FriendlyError> = {
  TitleTooLong: { zh: "商品名称不能超过 50 个字符。", en: "The product name must be 50 characters or fewer." },
  DescriptionTooLong: { zh: "描述不能超过 280 个字符。", en: "The description must be 280 characters or fewer." },
  ImageUrlTooLong: { zh: "图片链接太长了。", en: "The image link is too long." },
  InvalidPrice: { zh: "单价必须大于 0。", en: "The price must be greater than 0." },
  InvalidTargetCount: { zh: "目标人数必须大于 0。", en: "The target must be greater than 0." },
  DeadlineNotInFuture: { zh: "截止时间必须在未来。", en: "The deadline must be in the future." },
  FundraisingTooLong: { zh: "募集期最长 90 天。", en: "Fundraising can last at most 90 days." },
  InvalidDeliveryDeadline: { zh: "发货期限必须晚于截止时间。", en: "The shipping deadline must be after the campaign deadline." },
  DeliveryTooLong: { zh: "发货期最长 365 天。", en: "The shipping period can last at most 365 days." },
  NotFundraising: { zh: "这个团购现在不接受参与或退出。", en: "This group buy is not open for joining or leaving right now." },
  DeadlinePassed: { zh: "已过截止时间。", en: "The deadline has passed." },
  CampaignFull: { zh: "名额已满。", en: "This group is already full." },
  NotOrganizer: { zh: "只有团长才能这样做。", en: "Only the organizer can do this." },
  CampaignStillActive: { zh: "还没到截止时间,暂时不能退款。", en: "Refunds open after the deadline." },
  DeliveryDeadlineNotReached: { zh: "还没到发货期限,暂时不能退款。", en: "Refunds open after the shipping deadline if the organizer has not withdrawn." },
  RefundNotAvailable: { zh: "这个团购现在不能退款。", en: "This group buy cannot be refunded right now." },
  CannotCancel: { zh: "只有募集中、且没过截止时间的团购才能取消。", en: "Only a fundraising group buy can be cancelled, before its deadline." },
  NoBond: { zh: "这个团购没有保证金。", en: "This group buy has no bond." },
  BondNotReclaimable: { zh: "活动失败、放弃或取消后才能取回保证金。", en: "The bond can be reclaimed only after the group buy failed, was abandoned or was cancelled." },
  BondAlreadyReclaimed: { zh: "保证金已经取回了。", en: "The bond has already been reclaimed." },
  TargetNotReached: { zh: "还没成团,不能提取。", en: "The group hasn't filled, so funds cannot be withdrawn." },
  AlreadyReleased: { zh: "预付款已经提取过了。", en: "The upfront payment has already been withdrawn." },
  DeliveryDeadlinePassed: { zh: "发货期限已过,团长不能再提取。", en: "The shipping deadline has passed, so the organizer can no longer withdraw." },
  NotActive: { zh: "团长还没有提取预付款。", en: "The organizer has not withdrawn the upfront payment yet." },
  SeatAlreadyDecided: { zh: "这个名额已经确认或报告过了。", en: "This seat has already been confirmed or reported." },
  AppealWindowClosed: { zh: "申诉期已结束。", en: "The appeal window has closed." },
  TooEarlyToReport: { zh: "发货期限之后才能报告未收到。", en: "You can report non-delivery only after the shipping deadline." },
  SeatNotSettleable: { zh: "买家确认或申诉期结束后才能结算这个名额。", en: "This seat can be settled once the buyer confirms or the appeal window closes." },
  NotFinalizable: { zh: "这个团购的结果还没确定。", en: "This group buy's outcome is not decided yet." },
  AlreadyFinalized: { zh: "这个团购已经结束了。", en: "This group buy has already been finalized." },
  InsufficientEscrow: { zh: "托管余额不足。", en: "The escrow does not hold enough for this payment." },
  WrongBuyer: { zh: "这个名额不属于这位买家。", en: "This seat does not belong to this buyer." },
  MathOverflow: { zh: "金额计算溢出。", en: "The amount calculation overflowed." },
  // Anchor 框架错误:名额凭证不存在,说明没参与过或已结算
  AccountNotInitialized: {
    zh: "没有找到这个名额:可能没参与过,或者已经结算了。",
    en: "This seat wasn't found. It may never have been joined, or it was already settled.",
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

  if (/too large|encoding overruns|exceeded maximum/i.test(text)) {
    return { zh: "文字太多,一笔交易放不下,请缩短名称或描述。", en: "The text is too long to fit in one transaction. Please shorten the name or description." };
  }
  if (/already in use/.test(text)) {
    return { zh: "你已经参与过这个团购了,每个钱包只能参与一次。", en: "You already joined this group buy. Each wallet can join once." };
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
  // 交易的 blockhash 只有约 60 到 90 秒有效,在钱包里停留太久就会过期
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

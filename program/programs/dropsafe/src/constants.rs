use anchor_lang::prelude::*;

/// Campaign PDA 的种子前缀
#[constant]
pub const CAMPAIGN_SEED: &[u8] = b"campaign";

/// Escrow(托管金库)PDA 的种子前缀
#[constant]
pub const ESCROW_SEED: &[u8] = b"escrow";

/// Contribution(买家参与凭证)PDA 的种子前缀
#[constant]
pub const CONTRIBUTION_SEED: &[u8] = b"contribution";

/// 活动名称最多 50 个字符(中文、英文都算 1 个字符)
pub const MAX_TITLE_CHARS: usize = 50;

/// 活动名称在账户里最多占用的字节数:UTF-8 一个字符最多 4 字节,50 × 4 = 200
pub const MAX_TITLE_BYTES: usize = MAX_TITLE_CHARS * 4;

/// 达标后团长可以先提取的比例(基点,7000 = 70%),用来下单采购
pub const UPFRONT_BPS: u64 = 7000;

/// 基点的分母
pub const BPS_DENOMINATOR: u64 = 10_000;

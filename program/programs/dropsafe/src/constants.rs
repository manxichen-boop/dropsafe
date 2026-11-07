use anchor_lang::prelude::*;

#[constant]
pub const CAMPAIGN_SEED: &[u8] = b"campaign";
#[constant]
pub const ESCROW_SEED: &[u8] = b"escrow";
#[constant]
pub const CONTRIBUTION_SEED: &[u8] = b"contribution";
#[constant]
pub const ORGANIZER_SEED: &[u8] = b"organizer";
#[constant]
pub const BUYER_SEED: &[u8] = b"buyer";

/// 文本长度上限。字符数限制给用户看,字节数限制决定账户占多大空间
pub const MAX_TITLE_CHARS: usize = 50;
pub const MAX_TITLE_BYTES: usize = 200;
pub const MAX_DESCRIPTION_CHARS: usize = 280;
pub const MAX_DESCRIPTION_BYTES: usize = 840;
pub const MAX_IMAGE_URL_BYTES: usize = 200;

/// 预付款比例:upfront = price * 7 / 10
pub const UPFRONT_NUMERATOR: u64 = 7;
pub const UPFRONT_DENOMINATOR: u64 = 10;

const DAY: i64 = 86_400;

/// 募集期最长 90 天,防止团长把买家的钱锁到很久以后
pub const MAX_FUNDRAISING_SECONDS: i64 = 90 * DAY;
/// 发货期最长 365 天
pub const MAX_DELIVERY_SECONDS: i64 = 365 * DAY;

/// 申诉期由合约固定,团长无法缩短。正式版 7 天
#[cfg(not(feature = "devnet-demo"))]
pub const APPEAL_WINDOW_SECONDS: i64 = 7 * DAY;
/// devnet-demo 构建下只有 60 秒,方便录视频和跑测试
#[cfg(feature = "devnet-demo")]
pub const APPEAL_WINDOW_SECONDS: i64 = 60;

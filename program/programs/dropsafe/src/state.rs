use anchor_lang::prelude::*;

use crate::constants::MAX_TITLE_BYTES;

/// 活动状态
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    /// 募集中(也包括"已满员、等待团长提取"的阶段)
    Fundraising,
    /// 未达标且已有人发起退款
    Failed,
    /// 团长已提取资金
    Released,
}

/// 一次团购活动。任何人都能读取,只有本程序能修改。
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    /// 团长的钱包地址
    pub organizer: Pubkey,
    /// 团长自选的活动编号,用来区分同一团长的多个活动
    pub campaign_id: u64,
    /// 活动名称
    #[max_len(MAX_TITLE_BYTES)]
    pub title: String,
    /// 每人需要支付的金额(单位 lamports,1 SOL = 10 亿 lamports)
    pub price_per_person_lamports: u64,
    /// 目标人数,达到后团长才能提取
    pub target_count: u32,
    /// 当前参与人数。退款时不减少,这样已失败的活动不可能"变回"达标
    pub contributor_count: u32,
    /// 截止时间(Unix 时间戳,单位秒)
    pub deadline_unix_ts: i64,
    /// 活动状态
    pub status: CampaignStatus,
    /// Campaign PDA 的 bump,之后校验地址时不用重新计算
    pub bump: u8,
    /// Escrow PDA 的 bump
    pub escrow_bump: u8,
}

/// 托管金库:买家的 SOL 存放在这个账户的余额里。
/// 它归本程序所有,没有私钥,团长也无法直接转走,只有程序按规则才能动用。
#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub bump: u8,
}

/// 买家的参与凭证。每个买家在每个活动里只有一个,既防止重复参与,也记录可退金额。
#[account]
#[derive(InitSpace)]
pub struct Contribution {
    /// 所属活动
    pub campaign: Pubkey,
    /// 买家钱包地址
    pub buyer: Pubkey,
    /// 实际支付的金额,退款时按此金额退回
    pub amount: u64,
    pub bump: u8,
}

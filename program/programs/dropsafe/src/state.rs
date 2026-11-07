use anchor_lang::prelude::*;

use crate::{
    constants::{BPS_DENOMINATOR, MAX_TITLE_BYTES, UPFRONT_BPS},
    error::ErrorCode,
};

/// 活动状态
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    /// 募集中(也包括"已满员、等待团长提取首款"的阶段)
    Fundraising,
    /// 未达标且已有人发起退款
    Failed,
    /// 团长已提取 70% 首款,剩下 30% 尾款留在托管里,等待买家收货
    Delivering,
    /// 所有买家的尾款都已结算
    Completed,
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
    /// 发货期限:团长必须在此之前提取首款并发货。
    /// 过了这个时间,买家可以报告"未收到"取回尾款
    pub delivery_deadline_unix_ts: i64,
    /// 申诉截止时间:过了这个时间,没有异议的尾款才能由团长领取
    pub dispute_deadline_unix_ts: i64,
    /// 已结算尾款的买家人数,全部结算后活动变为 Completed
    pub settled_count: u32,
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

impl Contribution {
    /// 这份出资里留作尾款的金额。
    /// 用总额减去首款,保证不会因为整数除法的取整少算一个 lamport
    pub fn holdback(&self) -> Result<u64> {
        Ok(self
            .amount
            .checked_sub(upfront_share(self.amount)?)
            .ok_or(ErrorCode::MathOverflow)?)
    }
}

/// 一份出资里可以先给团长的首款金额。
/// 用 u128 做中间计算,防止相乘时溢出
pub fn upfront_share(amount: u64) -> Result<u64> {
    let share = (amount as u128)
        .checked_mul(UPFRONT_BPS as u128)
        .ok_or(ErrorCode::MathOverflow)?
        / BPS_DENOMINATOR as u128;
    Ok(share as u64)
}

impl Campaign {
    /// 记录一位买家的尾款已结算;全部结算后活动变为 Completed
    pub fn record_settlement(&mut self) -> Result<()> {
        self.settled_count = self
            .settled_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        if self.settled_count >= self.contributor_count {
            self.status = CampaignStatus::Completed;
        }
        Ok(())
    }
}

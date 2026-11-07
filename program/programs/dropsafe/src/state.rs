use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
};

/// 保障档位,创建后不可修改
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Tier {
    /// 全额保障:团长先存保证金,买家报告未收到时拿回全额
    Shielded,
    /// 部分保障:没有保证金,买家报告未收到时拿回 30%
    Standard,
    /// 信任团:成团后团长拿走 100%,买家报告只留下记录
    Trust,
}

/// 活动状态
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    /// 募集中
    Fundraising,
    /// 已满员,等团长提取预付款
    Funded,
    /// 团长已提取预付款,等待交付
    Active,
    /// 截止时没凑满
    Failed,
    /// 成团后团长在发货期限前没有提取
    Abandoned,
    /// 团长在成团前取消
    Cancelled,
    /// 所有名额已结算
    Closed,
}

/// 名额状态
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContributionStatus {
    Paid,
    Confirmed,
    Reported,
}

/// 一次团购活动
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub organizer: Pubkey,
    pub campaign_id: u64,
    #[max_len(MAX_TITLE_BYTES)]
    pub title: String,
    #[max_len(MAX_DESCRIPTION_BYTES)]
    pub description: String,
    #[max_len(MAX_IMAGE_URL_BYTES)]
    pub image_url: String,
    /// 每人金额(lamports)
    pub price: u64,
    pub target_count: u32,
    pub joined_count: u32,
    /// 募集截止时间
    pub deadline: i64,
    /// 发货期限
    pub delivery_deadline: i64,
    /// 申诉截止时间 = delivery_deadline + APPEAL_WINDOW,创建时算好存下来
    pub appeal_end: i64,
    pub tier: Tier,
    pub status: CampaignStatus,
    pub upfront_released: bool,
    /// 创建时存入的保证金总额
    pub bond_total: u64,
    pub bond_reclaimed: bool,
    /// 已结算的名额数
    pub seats_resolved: u32,
    pub finalized: bool,
    pub bump: u8,
}

impl Campaign {
    /// 预付款 = price * 7 / 10
    pub fn upfront(&self) -> Result<u64> {
        upfront_of(self.price)
    }

    /// 尾款 = price - upfront,两者相加严格等于 price
    pub fn remainder(&self) -> Result<u64> {
        Ok(self
            .price
            .checked_sub(self.upfront()?)
            .ok_or(ErrorCode::MathOverflow)?)
    }
}

pub fn upfront_of(price: u64) -> Result<u64> {
    let value = (price as u128)
        .checked_mul(UPFRONT_NUMERATOR as u128)
        .ok_or(ErrorCode::MathOverflow)?
        / UPFRONT_DENOMINATOR as u128;
    Ok(u64::try_from(value).map_err(|_| ErrorCode::MathOverflow)?)
}

/// 托管金库:存放买家付款和团长保证金。它归本程序所有,没有私钥。
#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub bump: u8,
}

/// 买家的名额凭证,结算、退款、退出时关闭,租金退还给买家
#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub buyer: Pubkey,
    pub amount: u64,
    pub status: ContributionStatus,
    pub bump: u8,
}

/// 团长在某一档位下的记录
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct TierStats {
    pub funded: u64,
    /// 买家主动确认的名额
    pub seats_confirmed: u64,
    /// 申诉期结束仍无回应的名额
    pub seats_unconfirmed: u64,
    /// 买家报告未收到的名额
    pub seats_reported: u64,
}

/// 团长的链上记录
#[account]
#[derive(InitSpace)]
pub struct OrganizerStats {
    pub organizer: Pubkey,
    pub campaigns_created: u64,
    pub campaigns_failed: u64,
    pub campaigns_abandoned: u64,
    pub campaigns_cancelled: u64,
    pub shielded: TierStats,
    pub standard: TierStats,
    pub trust: TierStats,
    /// 实际付给团长的金额,不含退还的保证金
    pub total_paid_to_organizer_lamports: u64,
    pub bump: u8,
}

impl OrganizerStats {
    pub fn tier_mut(&mut self, tier: Tier) -> &mut TierStats {
        match tier {
            Tier::Shielded => &mut self.shielded,
            Tier::Standard => &mut self.standard,
            Tier::Trust => &mut self.trust,
        }
    }

    pub fn add_paid(&mut self, amount: u64) -> Result<()> {
        self.total_paid_to_organizer_lamports = self
            .total_paid_to_organizer_lamports
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }
}

/// 买家的链上记录
#[account]
#[derive(InitSpace)]
pub struct BuyerStats {
    pub buyer: Pubkey,
    pub campaigns_joined: u64,
    pub seats_confirmed: u64,
    pub seats_reported: u64,
    pub seats_refunded: u64,
    pub bump: u8,
}

/// 计数加 1,溢出时报错
pub fn increment(value: &mut u64) -> Result<()> {
    *value = value.checked_add(1).ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

/// 从托管金库转出。每次转出前都检查:扣掉租金后的余额够不够
pub fn pay_from_escrow<'info>(
    escrow: &Account<'info, Escrow>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let info = escrow.to_account_info();
    let rent = Rent::get()?.minimum_balance(info.data_len());
    let available = info
        .lamports()
        .checked_sub(rent)
        .ok_or(ErrorCode::InsufficientEscrow)?;
    require!(available >= amount, ErrorCode::InsufficientEscrow);
    escrow.sub_lamports(amount)?;
    to.add_lamports(amount)?;
    Ok(())
}

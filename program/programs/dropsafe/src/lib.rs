//! DropSafe:Solana 链上团购托管协议。
//!
//! 买家的钱存进程序控制的托管账户(PDA),团长不能直接拿走:
//! - 截止时没达标 → 买家自己取回(refund)
//! - 达标后 → 团长先提取 70% 首款去下单(release),30% 尾款留在托管里
//! - 买家确认收货 → 他那份尾款给团长(confirm_delivery)
//! - 过了发货期限买家报告未收到 → 他那份尾款退回(claim_undelivered)
//! - 申诉期过后没有异议 → 团长领取尾款(claim_unconfirmed)

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("6Sno3DHv8uPp9aER9hhdToEnKFLHZwzJZjMNX5GnDj8u");

#[program]
pub mod dropsafe {
    use super::*;

    /// 团长创建一个团购活动和它的托管金库
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: u64,
        title: String,
        price_per_person_lamports: u64,
        target_count: u32,
        deadline_unix_ts: i64,
        delivery_deadline_unix_ts: i64,
        dispute_deadline_unix_ts: i64,
    ) -> Result<()> {
        crate::instructions::create_campaign::handle_create_campaign(
            ctx,
            campaign_id,
            title,
            price_per_person_lamports,
            target_count,
            deadline_unix_ts,
            delivery_deadline_unix_ts,
            dispute_deadline_unix_ts,
        )
    }

    /// 买家参与:把每人金额转入托管金库
    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        crate::instructions::contribute::handle_contribute(ctx)
    }

    /// 未达标且已过截止时间:买家取回自己的钱
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        crate::instructions::refund::handle_refund(ctx)
    }

    /// 达标后:团长提取 70% 首款
    pub fn release(ctx: Context<Release>) -> Result<()> {
        crate::instructions::release::handle_release(ctx)
    }

    /// 买家确认收货:他那份尾款转给团长
    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
        crate::instructions::confirm_delivery::handle_confirm_delivery(ctx)
    }

    /// 过了发货期限,买家报告未收到:取回尾款;如果团长从未提取,取回全款
    pub fn claim_undelivered(ctx: Context<ClaimUndelivered>) -> Result<()> {
        crate::instructions::claim_undelivered::handle_claim_undelivered(ctx)
    }

    /// 申诉期结束后,团长领取某位买家没有异议的尾款
    pub fn claim_unconfirmed(ctx: Context<ClaimUnconfirmed>) -> Result<()> {
        crate::instructions::claim_unconfirmed::handle_claim_unconfirmed(ctx)
    }
}

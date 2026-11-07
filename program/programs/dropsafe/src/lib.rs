//! DropSafe:Solana 链上团购托管协议。
//!
//! 买家的钱存进程序控制的托管账户(PDA),团长不能直接拿走:
//! - 截止时没达标 → 买家自己取回(refund)
//! - 达标后 → 团长才能提取(release)

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("6KcTuoAX6u5SRdX563VhbrXWiBrMwAfGxST5ud9RaQgX");

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
    ) -> Result<()> {
        crate::instructions::create_campaign::handle_create_campaign(
            ctx,
            campaign_id,
            title,
            price_per_person_lamports,
            target_count,
            deadline_unix_ts,
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

    /// 达标后:团长提取托管金库里的 SOL
    pub fn release(ctx: Context<Release>) -> Result<()> {
        crate::instructions::release::handle_release(ctx)
    }
}

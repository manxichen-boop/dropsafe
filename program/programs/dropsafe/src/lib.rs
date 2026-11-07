//! DropSafe v2:Solana 链上团购托管协议。
//!
//! 买家的钱和团长的保证金都存进没有私钥的托管账户,按三档规则结算:
//! - 全额保障(Shielded):团长先存保证金,团长不发货时买家拿回全额
//! - 部分保障(Standard):团长先拿 70%,不发货时买家拿回 30%
//! - 信任团(Trust):成团后团长拿 100%,买家的报告只留下记录

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("HPuN91VgkVKQ5kNRS79Q6kci1XJYBV9ux9fhQsQubxV2");

#[program]
pub mod dropsafe {
    use super::*;

    /// 团长创建活动;全额保障档同时存入保证金
    #[allow(clippy::too_many_arguments)]
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: u64,
        title: String,
        description: String,
        image_url: String,
        price: u64,
        target_count: u32,
        deadline: i64,
        delivery_deadline: i64,
        tier: Tier,
    ) -> Result<()> {
        crate::instructions::create_campaign::handle_create_campaign(
            ctx,
            campaign_id,
            title,
            description,
            image_url,
            price,
            target_count,
            deadline,
            delivery_deadline,
            tier,
        )
    }

    /// 买家付款参与
    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        crate::instructions::contribute::handle_contribute(ctx)
    }

    /// 成团前买家退出,全额退回
    pub fn withdraw_before_fill(ctx: Context<WithdrawBeforeFill>) -> Result<()> {
        crate::instructions::withdraw_before_fill::handle_withdraw_before_fill(ctx)
    }

    /// 成团前团长取消
    pub fn cancel_campaign(ctx: Context<CancelCampaign>) -> Result<()> {
        crate::instructions::cancel_campaign::handle_cancel_campaign(ctx)
    }

    /// 买家全额取回:未成团、团长放弃、活动已取消
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        crate::instructions::refund::handle_refund(ctx)
    }

    /// 团长取回保证金:活动失败、放弃或取消后
    pub fn reclaim_bond(ctx: Context<ReclaimBond>) -> Result<()> {
        crate::instructions::reclaim_bond::handle_reclaim_bond(ctx)
    }

    /// 团长提取预付款,按档位转出
    pub fn release_upfront(ctx: Context<ReleaseUpfront>) -> Result<()> {
        crate::instructions::release_upfront::handle_release_upfront(ctx)
    }

    /// 买家确认收货
    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
        crate::instructions::confirm_delivery::handle_confirm_delivery(ctx)
    }

    /// 买家在申诉期内报告未收到
    pub fn report_not_received(ctx: Context<ReportNotReceived>) -> Result<()> {
        crate::instructions::report_not_received::handle_report_not_received(ctx)
    }

    /// 结算一个名额,任何人都可以调用
    pub fn settle_seat(ctx: Context<SettleSeat>) -> Result<()> {
        crate::instructions::settle_seat::handle_settle_seat(ctx)
    }

    /// 记录活动的最终结果,任何人都可以调用,只能一次
    pub fn finalize_campaign(ctx: Context<FinalizeCampaign>) -> Result<()> {
        crate::instructions::finalize_campaign::handle_finalize_campaign(ctx)
    }
}

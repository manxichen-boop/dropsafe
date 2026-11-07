//! DropSafe v2:Solana 链上团购托管协议。
//!
//! 买家的钱和团长的保证金都存进没有私钥的托管账户,按三档规则结算:
//! - 全额保障(Shielded):团长先存保证金,团长不发货时买家拿回全额
//! - 部分保障(Standard):团长先拿 70%,不发货时买家拿回 30%
//! - 无资金保障(Unsecured,程序里叫 Trust):成团后团长拿 100%,买家的报告只留下记录
//!
//! v2.2 起每个名额有自己的履约记录:团长在发货期限前提交发货声明和 ETA,
//! 没有声明的名额从发货期限起可以报告"未按期发货",有声明的从 ETA 起可以报告"未收到"。
//! 合约只记录双方的声明和期限,不判断现实中的包裹有没有送达。

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
        max_transit_seconds: i64,
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
            max_transit_seconds,
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

    /// 买家报告未收到:新规则下需要有发货声明且 ETA 已过;旧团购按原来的申诉期
    pub fn report_not_received(ctx: Context<ReportNotReceived>) -> Result<()> {
        crate::instructions::report_not_received::handle_report_not_received(ctx)
    }

    /// 新规则:发货期限已过且没有发货声明时,买家报告未按期发货
    pub fn report_unshipped(ctx: Context<ReportNotReceived>) -> Result<()> {
        crate::instructions::report_not_received::handle_report_unshipped(ctx)
    }

    /// 结算一个名额,任何人都可以调用
    pub fn settle_seat(ctx: Context<SettleSeat>) -> Result<()> {
        crate::instructions::settle_seat::handle_settle_seat(ctx)
    }

    /// 团长批量提交发货声明:每个名额一条记录,ETA 由团长填写,发货时间用链上时间
    pub fn record_shipment_batch<'info>(
        ctx: Context<'info, RecordShipmentBatch<'info>>,
        entries: Vec<ShipmentEntry>,
    ) -> Result<()> {
        crate::instructions::record_shipment_batch::handle_record_shipment_batch(ctx, entries)
    }

    /// 买家把自己名额的申诉截止时间延长一次
    pub fn extend_waiting(ctx: Context<ExtendWaiting>) -> Result<()> {
        crate::instructions::extend_waiting::handle_extend_waiting(ctx)
    }

    /// 记录活动的最终结果,任何人都可以调用,只能一次
    pub fn finalize_campaign(ctx: Context<FinalizeCampaign>) -> Result<()> {
        crate::instructions::finalize_campaign::handle_finalize_campaign(ctx)
    }
}

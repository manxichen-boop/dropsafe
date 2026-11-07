use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

/// 两种报告共用的账户。报告只改名额状态,资金在结算时按档位处理
#[derive(Accounts)]
pub struct ReportNotReceived<'info> {
    /// 只有买家本人能报告;第一次给团长记扩展统计时由买家付租金
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    /// CHECK: 地址由 seeds 校验;不存在表示旧团购,用旧的时间规则
    #[account(seeds = [CAMPAIGN_EXT_SEED, campaign.key().as_ref()], bump)]
    pub campaign_ext: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,

    /// CHECK: 地址由 seeds 校验;不存在表示没有发货声明
    #[account(seeds = [SHIPMENT_SEED, contribution.key().as_ref()], bump)]
    pub shipment: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + OrganizerStatsExt::INIT_SPACE,
        seeds = [ORGANIZER_EXT_SEED, campaign.organizer.as_ref()],
        bump
    )]
    pub organizer_stats_ext: Box<Account<'info, OrganizerStatsExt>>,

    pub system_program: Program<'info, System>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ReportKind {
    /// 发货期限已过,链上没有发货声明
    Unshipped,
    /// 有发货声明,ETA 已过仍未收到;旧团购的报告也走这里
    NotReceived,
}

pub fn handle_report(ctx: Context<ReportNotReceived>, kind: ReportKind) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    let now = Clock::get()?.unix_timestamp;
    require!(campaign.status == CampaignStatus::Active, ErrorCode::NotActive);
    require!(
        ctx.accounts.contribution.status == ContributionStatus::Paid,
        ErrorCode::SeatAlreadyDecided
    );

    let has_rules = load_optional::<CampaignExt>(&ctx.accounts.campaign_ext.to_account_info())?.is_some();
    let shipment = load_optional::<Shipment>(&ctx.accounts.shipment.to_account_info())?;
    let window = seat_window(campaign, has_rules, shipment.as_ref())?;

    match (kind, window.shipped) {
        // 未按期发货只适用于新规则下没有发货声明的名额
        (ReportKind::Unshipped, None) => return err!(ErrorCode::NoShippingRules),
        (ReportKind::Unshipped, Some(true)) => return err!(ErrorCode::SeatWasShipped),
        (ReportKind::NotReceived, Some(false)) => return err!(ErrorCode::SeatNotShipped),
        _ => {}
    }
    require!(now >= window.opens, ErrorCode::TooEarlyToReport);
    require!(window.before_close(now), ErrorCode::AppealWindowClosed);

    ctx.accounts.contribution.status = ContributionStatus::Reported;

    // 每个名额只会从 Paid 变成 Reported 一次,所以这里不会重复计数
    let ext = &mut ctx.accounts.organizer_stats_ext;
    ext.organizer = campaign.organizer;
    ext.bump = ctx.bumps.organizer_stats_ext;
    increment(&mut ext.unverified_reports)
}

pub fn handle_report_not_received(ctx: Context<ReportNotReceived>) -> Result<()> {
    handle_report(ctx, ReportKind::NotReceived)
}

pub fn handle_report_unshipped(ctx: Context<ReportNotReceived>) -> Result<()> {
    handle_report(ctx, ReportKind::Unshipped)
}

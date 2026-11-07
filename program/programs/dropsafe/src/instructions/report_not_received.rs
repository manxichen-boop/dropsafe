use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct ReportNotReceived<'info> {
    /// 只有买家本人能报告
    pub buyer: Signer<'info>,

    #[account(
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
        mut,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,
}

pub fn handle_report_not_received(ctx: Context<ReportNotReceived>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    let now = Clock::get()?.unix_timestamp;

    require!(
        campaign.status == CampaignStatus::Active,
        ErrorCode::NotActive
    );
    require!(
        ctx.accounts.contribution.status == ContributionStatus::Paid,
        ErrorCode::SeatAlreadyDecided
    );
    // 校验:发货期限之前不能报告,给团长留足发货时间
    require!(now >= campaign.delivery_deadline, ErrorCode::TooEarlyToReport);
    require!(now < campaign.appeal_end, ErrorCode::AppealWindowClosed);

    ctx.accounts.contribution.status = ContributionStatus::Reported;
    Ok(())
}

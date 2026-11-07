use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    /// 只有买家本人能确认
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

pub fn handle_confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
    require!(
        ctx.accounts.campaign.status == CampaignStatus::Active,
        ErrorCode::NotActive
    );
    require!(
        ctx.accounts.contribution.status == ContributionStatus::Paid,
        ErrorCode::SeatAlreadyDecided
    );
    require!(
        Clock::get()?.unix_timestamp < ctx.accounts.campaign.appeal_end,
        ErrorCode::AppealWindowClosed
    );
    ctx.accounts.contribution.status = ContributionStatus::Confirmed;
    Ok(())
}

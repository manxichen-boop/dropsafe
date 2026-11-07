use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct ReclaimBond<'info> {
    /// 只有团长能取回,收款地址就是团长自己
    #[account(mut, address = campaign.organizer @ ErrorCode::NotOrganizer)]
    pub organizer: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(mut, seeds = [ESCROW_SEED, campaign.key().as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
}

pub fn handle_reclaim_bond(ctx: Context<ReclaimBond>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    require!(campaign.bond_total > 0, ErrorCode::NoBond);
    require!(!campaign.bond_reclaimed, ErrorCode::BondAlreadyReclaimed);
    // 校验:只有活动没走到交付阶段才能取回。交付阶段的保证金按名额结算
    require!(
        matches!(
            campaign.status,
            CampaignStatus::Failed | CampaignStatus::Abandoned | CampaignStatus::Cancelled
        ),
        ErrorCode::BondNotReclaimable
    );

    let amount = campaign.bond_total;
    pay_from_escrow(
        &ctx.accounts.escrow,
        &ctx.accounts.organizer.to_account_info(),
        amount,
    )?;
    ctx.accounts.campaign.bond_reclaimed = true;
    Ok(())
}

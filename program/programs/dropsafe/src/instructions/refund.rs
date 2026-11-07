use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct Refund<'info> {
    /// 买家本人
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(mut, seeds = [ESCROW_SEED, campaign.key().as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,

    /// 名额凭证:退款后关闭,所以不能重复退款
    #[account(
        mut,
        close = buyer,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,

    #[account(mut, seeds = [ORGANIZER_SEED, campaign.organizer.as_ref()], bump = organizer_stats.bump)]
    pub organizer_stats: Box<Account<'info, OrganizerStats>>,

    #[account(mut, seeds = [BUYER_SEED, buyer.key().as_ref()], bump = buyer_stats.bump)]
    pub buyer_stats: Account<'info, BuyerStats>,
}

pub fn handle_refund(ctx: Context<Refund>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let status = ctx.accounts.campaign.status;

    match status {
        // A) 过了截止时间还没满:第一个退款的人把活动标记为 Failed
        CampaignStatus::Fundraising => {
            require!(
                now >= ctx.accounts.campaign.deadline,
                ErrorCode::CampaignStillActive
            );
            ctx.accounts.campaign.status = CampaignStatus::Failed;
            increment(&mut ctx.accounts.organizer_stats.campaigns_failed)?;
        }
        // B) 成团了但团长一直没提取:第一个退款的人把活动标记为 Abandoned
        CampaignStatus::Funded => {
            require!(
                now >= ctx.accounts.campaign.delivery_deadline,
                ErrorCode::DeliveryDeadlineNotReached
            );
            ctx.accounts.campaign.status = CampaignStatus::Abandoned;
            increment(&mut ctx.accounts.organizer_stats.campaigns_abandoned)?;
        }
        // C) 已取消,以及前两种情况的后续退款
        CampaignStatus::Cancelled | CampaignStatus::Failed | CampaignStatus::Abandoned => {}
        CampaignStatus::Active | CampaignStatus::Closed => {
            return err!(ErrorCode::RefundNotAvailable)
        }
    }

    pay_from_escrow(
        &ctx.accounts.escrow,
        &ctx.accounts.buyer.to_account_info(),
        ctx.accounts.contribution.amount,
    )?;
    increment(&mut ctx.accounts.buyer_stats.seats_refunded)
}

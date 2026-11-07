use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct WithdrawBeforeFill<'info> {
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

    /// 名额凭证:种子里有买家地址,不能退别人的。退出时关闭,租金还给买家
    #[account(
        mut,
        close = buyer,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,

    #[account(mut, seeds = [BUYER_SEED, buyer.key().as_ref()], bump = buyer_stats.bump)]
    pub buyer_stats: Account<'info, BuyerStats>,
}

pub fn handle_withdraw_before_fill(ctx: Context<WithdrawBeforeFill>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    // 校验:只有募集中才能退出,成团后不行
    require!(
        campaign.status == CampaignStatus::Fundraising,
        ErrorCode::NotFundraising
    );
    require!(
        Clock::get()?.unix_timestamp < campaign.deadline,
        ErrorCode::DeadlinePassed
    );

    pay_from_escrow(
        &ctx.accounts.escrow,
        &ctx.accounts.buyer.to_account_info(),
        ctx.accounts.contribution.amount,
    )?;

    let campaign = &mut ctx.accounts.campaign;
    campaign.joined_count = campaign
        .joined_count
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;

    // 退出后这次参与不算数
    let stats = &mut ctx.accounts.buyer_stats;
    stats.campaigns_joined = stats
        .campaigns_joined
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

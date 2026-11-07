use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct Contribute<'info> {
    /// 买家:必须签名,支付团购金额和租金
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    /// 托管金库:用种子确认它属于这个活动
    #[account(mut, seeds = [ESCROW_SEED, campaign.key().as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,

    /// 名额凭证:init 只能成功一次,同一钱包不能参与两次
    #[account(
        init,
        payer = buyer,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub contribution: Account<'info, Contribution>,

    /// 团长记录:满员时给对应档位的成团数加 1
    #[account(mut, seeds = [ORGANIZER_SEED, campaign.organizer.as_ref()], bump = organizer_stats.bump)]
    pub organizer_stats: Box<Account<'info, OrganizerStats>>,

    /// 买家记录:第一次参与时初始化
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + BuyerStats::INIT_SPACE,
        seeds = [BUYER_SEED, buyer.key().as_ref()],
        bump
    )]
    pub buyer_stats: Account<'info, BuyerStats>,

    pub system_program: Program<'info, System>,
}

pub fn handle_contribute(ctx: Context<Contribute>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    let amount = campaign.price;

    require!(
        campaign.status == CampaignStatus::Fundraising,
        ErrorCode::NotFundraising
    );
    require!(
        Clock::get()?.unix_timestamp < campaign.deadline,
        ErrorCode::DeadlinePassed
    );
    require!(
        campaign.joined_count < campaign.target_count,
        ErrorCode::CampaignFull
    );

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        ),
        amount,
    )?;

    ctx.accounts.contribution.set_inner(Contribution {
        buyer: ctx.accounts.buyer.key(),
        amount,
        status: ContributionStatus::Paid,
        bump: ctx.bumps.contribution,
    });

    let campaign = &mut ctx.accounts.campaign;
    campaign.joined_count = campaign
        .joined_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    // 满员:活动变为 Funded,记一次成团
    if campaign.joined_count == campaign.target_count {
        campaign.status = CampaignStatus::Funded;
        let tier = campaign.tier;
        increment(&mut ctx.accounts.organizer_stats.tier_mut(tier).funded)?;
    }

    let buyer_stats = &mut ctx.accounts.buyer_stats;
    buyer_stats.buyer = ctx.accounts.buyer.key();
    buyer_stats.bump = ctx.bumps.buyer_stats;
    increment(&mut buyer_stats.campaigns_joined)
}

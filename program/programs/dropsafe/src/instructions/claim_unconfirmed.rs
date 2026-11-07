use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Campaign, CampaignStatus, Contribution, Escrow},
};

#[derive(Accounts)]
pub struct ClaimUnconfirmed<'info> {
    /// 调用者:必须是这个活动的团长
    #[account(mut, address = campaign.organizer @ ErrorCode::NotOrganizer)]
    pub organizer: Signer<'info>,

    /// 买家的钱包:凭证关闭后,租金还给买家,不归团长
    /// CHECK: 地址必须等于凭证记录的买家,只用来收回租金
    #[account(mut, address = contribution.buyer @ ErrorCode::WrongBuyer)]
    pub buyer: UncheckedAccount<'info>,

    /// 所属活动
    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// 这个活动的托管金库
    #[account(
        mut,
        seeds = [ESCROW_SEED, campaign.key().as_ref()],
        bump = campaign.escrow_bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// 要结算的参与凭证:结算后关闭,防止重复领取
    #[account(
        mut,
        close = buyer,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,
}

pub fn handle_claim_unconfirmed(ctx: Context<ClaimUnconfirmed>) -> Result<()> {
    // 校验:团长已经提取首款
    require!(
        ctx.accounts.campaign.status == CampaignStatus::Delivering,
        ErrorCode::NotDelivering
    );
    // 校验:申诉期必须已结束,买家有足够时间提出异议
    require!(
        Clock::get()?.unix_timestamp >= ctx.accounts.campaign.dispute_deadline_unix_ts,
        ErrorCode::DisputeWindowOpen
    );

    // 没有异议的尾款转给团长
    let amount = ctx.accounts.contribution.holdback()?;
    ctx.accounts.escrow.sub_lamports(amount)?;
    ctx.accounts.organizer.add_lamports(amount)?;

    ctx.accounts.campaign.record_settlement()
}

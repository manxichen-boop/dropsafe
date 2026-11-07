use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Campaign, CampaignStatus, Contribution, Escrow},
};

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    /// 买家:只能本人确认自己收到了货
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// 团长的钱包:尾款转到这里。用地址校验,防止转给别人
    /// CHECK: 地址必须等于活动记录的团长,只用来收款
    #[account(mut, address = campaign.organizer)]
    pub organizer: UncheckedAccount<'info>,

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

    /// 买家的参与凭证:结算后关闭,租金还给买家,防止重复结算
    #[account(
        mut,
        close = buyer,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,
}

pub fn handle_confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
    // 校验:团长已经提取首款,才有"收货"可言
    require!(
        ctx.accounts.campaign.status == CampaignStatus::Delivering,
        ErrorCode::NotDelivering
    );

    // 把这位买家的尾款转给团长
    let amount = ctx.accounts.contribution.holdback()?;
    ctx.accounts.escrow.sub_lamports(amount)?;
    ctx.accounts.organizer.add_lamports(amount)?;

    ctx.accounts.campaign.record_settlement()
}

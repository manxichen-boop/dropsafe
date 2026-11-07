use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Campaign, CampaignStatus, Contribution, Escrow},
};

#[derive(Accounts)]
pub struct Refund<'info> {
    /// 买家:只能本人签名取回自己的钱
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// 要退款的活动
    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// 这个活动的托管金库,退款从这里扣
    #[account(
        mut,
        seeds = [ESCROW_SEED, campaign.key().as_ref()],
        bump = campaign.escrow_bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// 买家的参与凭证:种子里有买家地址,所以不能拿别人的凭证来退款。
    /// `close = buyer` 表示退款后关闭账户、租金还给买家;
    /// 账户没了,第二次退款就会失败,防止重复退款
    #[account(
        mut,
        close = buyer,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,
}

pub fn handle_refund(ctx: Context<Refund>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;

    // 校验:必须已过截止时间,否则活动还在进行中
    require!(
        Clock::get()?.unix_timestamp >= campaign.deadline_unix_ts,
        ErrorCode::CampaignStillActive
    );
    // 校验:人数没有达标才能退款
    require!(
        campaign.contributor_count < campaign.target_count,
        ErrorCode::TargetAlreadyReached
    );

    // 按凭证记录的金额,从金库退回给买家。
    // 金库归本程序所有,所以程序可以直接修改它的余额
    let amount = ctx.accounts.contribution.amount;
    ctx.accounts.escrow.sub_lamports(amount)?;
    ctx.accounts.buyer.add_lamports(amount)?;

    // 第一个退款的人会把活动状态改为 Failed
    let campaign = &mut ctx.accounts.campaign;
    if campaign.status == CampaignStatus::Fundraising {
        campaign.status = CampaignStatus::Failed;
    }

    Ok(())
}

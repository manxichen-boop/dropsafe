use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Campaign, CampaignStatus, Contribution, Escrow},
};

#[derive(Accounts)]
pub struct ClaimUndelivered<'info> {
    /// 买家:只能本人报告未收到
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// 所属活动
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

    /// 买家的参与凭证:退款后关闭,租金还给买家,防止重复退款
    #[account(
        mut,
        close = buyer,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,
}

pub fn handle_claim_undelivered(ctx: Context<ClaimUndelivered>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    let now = Clock::get()?.unix_timestamp;

    // 校验:必须已过发货期限,否则团长还有时间发货
    require!(
        now >= campaign.delivery_deadline_unix_ts,
        ErrorCode::DeliveryDeadlineNotReached
    );

    let amount = match campaign.status {
        // 团长提取过首款:买家在申诉期内可以取回 30% 尾款
        CampaignStatus::Delivering => {
            require!(
                now < campaign.dispute_deadline_unix_ts,
                ErrorCode::DisputeWindowClosed
            );
            ctx.accounts.contribution.holdback()?
        }
        // 人数达标但团长一直没来提取:钱不能卡死,买家全额取回
        CampaignStatus::Fundraising => {
            require!(
                campaign.contributor_count >= campaign.target_count,
                ErrorCode::TargetNotReached
            );
            ctx.accounts.contribution.amount
        }
        _ => return err!(ErrorCode::NotDelivering),
    };

    ctx.accounts.escrow.sub_lamports(amount)?;
    ctx.accounts.buyer.add_lamports(amount)?;

    // 只有 Delivering 阶段才计入结算;团长没提取的活动不会变成 Completed
    if ctx.accounts.campaign.status == CampaignStatus::Delivering {
        ctx.accounts.campaign.record_settlement()?;
    }

    Ok(())
}

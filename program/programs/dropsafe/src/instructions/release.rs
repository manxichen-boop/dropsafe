use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{upfront_share, Campaign, CampaignStatus, Escrow},
};

#[derive(Accounts)]
pub struct Release<'info> {
    /// 调用者:必须签名,并且必须是这个活动的团长,否则返回 NotOrganizer
    #[account(mut, address = campaign.organizer @ ErrorCode::NotOrganizer)]
    pub organizer: Signer<'info>,

    /// 要提取资金的活动
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
}

pub fn handle_release(ctx: Context<Release>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;

    // 校验:人数必须达标
    require!(
        campaign.contributor_count >= campaign.target_count,
        ErrorCode::TargetNotReached
    );
    // 校验:首款只能提取一次
    require!(
        campaign.status == CampaignStatus::Fundraising,
        ErrorCode::AlreadyReleased
    );
    // 校验:必须在发货期限之前提取。过了期限,买家可以全额取回,团长不能再和买家抢钱
    require!(
        Clock::get()?.unix_timestamp < campaign.delivery_deadline_unix_ts,
        ErrorCode::DeliveryDeadlinePassed
    );

    // 只转出每份出资的 70%,剩下 30% 留在托管里,按买家逐个结算
    let amount = upfront_share(campaign.price_per_person_lamports)?
        .checked_mul(campaign.contributor_count as u64)
        .ok_or(ErrorCode::MathOverflow)?;

    ctx.accounts.escrow.sub_lamports(amount)?;
    ctx.accounts.organizer.add_lamports(amount)?;

    // 状态改为等待收货
    ctx.accounts.campaign.status = CampaignStatus::Delivering;

    Ok(())
}

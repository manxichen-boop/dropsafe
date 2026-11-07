use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct ReleaseUpfront<'info> {
    /// 只有团长能提取,收款地址就是团长自己
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

    #[account(mut, seeds = [ORGANIZER_SEED, campaign.organizer.as_ref()], bump = organizer_stats.bump)]
    pub organizer_stats: Box<Account<'info, OrganizerStats>>,
}

pub fn handle_release_upfront(ctx: Context<ReleaseUpfront>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;

    // 校验:只能提取一次
    require!(!campaign.upfront_released, ErrorCode::AlreadyReleased);
    // 校验:已被标记为放弃的活动不能再提取
    require!(
        campaign.status != CampaignStatus::Abandoned,
        ErrorCode::DeliveryDeadlinePassed
    );
    // 校验:必须已满员。失败、取消的活动都不能提取
    require!(
        campaign.status == CampaignStatus::Funded,
        ErrorCode::TargetNotReached
    );
    // 校验:必须在发货期限之前,过了期限买家可以全额退款
    require!(
        Clock::get()?.unix_timestamp < campaign.delivery_deadline,
        ErrorCode::DeliveryDeadlinePassed
    );

    // 按档位决定每个名额转出多少:信任团 100%,其他档 70%
    let per_seat = match campaign.tier {
        Tier::Trust => campaign.price,
        _ => campaign.upfront()?,
    };
    let amount = per_seat
        .checked_mul(campaign.joined_count as u64)
        .ok_or(ErrorCode::MathOverflow)?;

    pay_from_escrow(
        &ctx.accounts.escrow,
        &ctx.accounts.organizer.to_account_info(),
        amount,
    )?;

    let campaign = &mut ctx.accounts.campaign;
    campaign.upfront_released = true;
    campaign.status = CampaignStatus::Active;
    ctx.accounts.organizer_stats.add_paid(amount)
}

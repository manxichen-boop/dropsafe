use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct CancelCampaign<'info> {
    /// 只有团长能取消
    #[account(address = campaign.organizer @ ErrorCode::NotOrganizer)]
    pub organizer: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(mut, seeds = [ORGANIZER_SEED, campaign.organizer.as_ref()], bump = organizer_stats.bump)]
    pub organizer_stats: Box<Account<'info, OrganizerStats>>,
}

pub fn handle_cancel_campaign(ctx: Context<CancelCampaign>) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    // 校验:只有募集中、且没过截止时间才能取消。
    // 过了截止时间还没凑满的是失败,不能用取消来躲掉失败记录
    require!(
        campaign.status == CampaignStatus::Fundraising
            && Clock::get()?.unix_timestamp < campaign.deadline,
        ErrorCode::CannotCancel
    );
    campaign.status = CampaignStatus::Cancelled;
    increment(&mut ctx.accounts.organizer_stats.campaigns_cancelled)
}

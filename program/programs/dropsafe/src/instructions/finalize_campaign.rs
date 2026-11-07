use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct FinalizeCampaign<'info> {
    /// 任何人都可以调用
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(mut, seeds = [ORGANIZER_SEED, campaign.organizer.as_ref()], bump = organizer_stats.bump)]
    pub organizer_stats: Box<Account<'info, OrganizerStats>>,
}

pub fn handle_finalize_campaign(ctx: Context<FinalizeCampaign>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &mut ctx.accounts.campaign;
    let stats = &mut ctx.accounts.organizer_stats;

    require!(!campaign.finalized, ErrorCode::AlreadyFinalized);

    // 失败和放弃在状态第一次变化时计数:由退款触发,或者在这里补上。
    // 这样即使没人退款也不会漏算,也不会算两次
    match campaign.status {
        CampaignStatus::Fundraising => {
            require!(now >= campaign.deadline, ErrorCode::NotFinalizable);
            campaign.status = CampaignStatus::Failed;
            increment(&mut stats.campaigns_failed)?;
        }
        CampaignStatus::Funded => {
            require!(now >= campaign.delivery_deadline, ErrorCode::NotFinalizable);
            campaign.status = CampaignStatus::Abandoned;
            increment(&mut stats.campaigns_abandoned)?;
        }
        CampaignStatus::Active => {
            require!(
                campaign.seats_resolved >= campaign.joined_count,
                ErrorCode::NotFinalizable
            );
            campaign.status = CampaignStatus::Closed;
        }
        CampaignStatus::Failed | CampaignStatus::Abandoned | CampaignStatus::Cancelled => {}
        CampaignStatus::Closed => return err!(ErrorCode::AlreadyFinalized),
    }

    campaign.finalized = true;
    Ok(())
}

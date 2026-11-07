use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    /// 只有买家本人能确认
    pub buyer: Signer<'info>,

    #[account(
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    /// CHECK: 地址由 seeds 校验;不存在表示旧团购
    #[account(seeds = [CAMPAIGN_EXT_SEED, campaign.key().as_ref()], bump)]
    pub campaign_ext: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,

    /// CHECK: 地址由 seeds 校验;不存在表示没有发货声明
    #[account(seeds = [SHIPMENT_SEED, contribution.key().as_ref()], bump)]
    pub shipment: UncheckedAccount<'info>,
}

pub fn handle_confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    require!(campaign.status == CampaignStatus::Active, ErrorCode::NotActive);
    require!(
        ctx.accounts.contribution.status == ContributionStatus::Paid,
        ErrorCode::SeatAlreadyDecided
    );
    let has_rules = load_optional::<CampaignExt>(&ctx.accounts.campaign_ext.to_account_info())?.is_some();
    let shipment = load_optional::<Shipment>(&ctx.accounts.shipment.to_account_info())?;
    let window = seat_window(campaign, has_rules, shipment.as_ref())?;
    // 截止前随时可以确认,包括还没发货或还没到 ETA 的时候
    require!(window.before_close(Clock::get()?.unix_timestamp), ErrorCode::AppealWindowClosed);
    ctx.accounts.contribution.status = ContributionStatus::Confirmed;
    Ok(())
}

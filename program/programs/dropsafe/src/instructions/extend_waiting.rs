use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

/// 买家把自己名额的申诉截止时间延长一个申诉期,只能一次。
/// 只改这个名额自己的截止时间,不改团长的发货期限,也不影响其他名额
#[derive(Accounts)]
pub struct ExtendWaiting<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    /// CHECK: 地址由 seeds 校验;旧团购没有这个账户
    #[account(seeds = [CAMPAIGN_EXT_SEED, campaign.key().as_ref()], bump)]
    pub campaign_ext: UncheckedAccount<'info>,

    #[account(
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,

    /// 没有发货声明时由买家创建一条 shipped = false 的记录来存延长标记
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + Shipment::INIT_SPACE,
        seeds = [SHIPMENT_SEED, contribution.key().as_ref()],
        bump
    )]
    pub shipment: Box<Account<'info, Shipment>>,

    pub system_program: Program<'info, System>,
}

pub fn handle_extend_waiting(ctx: Context<ExtendWaiting>) -> Result<()> {
    require!(
        load_optional::<CampaignExt>(&ctx.accounts.campaign_ext.to_account_info())?.is_some(),
        ErrorCode::NoShippingRules
    );
    let campaign = &ctx.accounts.campaign;
    let now = Clock::get()?.unix_timestamp;
    require!(campaign.status == CampaignStatus::Active, ErrorCode::NotActive);
    require!(
        ctx.accounts.contribution.status == ContributionStatus::Paid,
        ErrorCode::SeatAlreadyDecided
    );

    let shipment = &mut ctx.accounts.shipment;
    let is_new = shipment.campaign == Pubkey::default();
    if is_new {
        // 没有发货声明:只能在发货期限之后延长。
        // 这样买家建的记录不会挡住团长在期限前提交发货声明
        require!(now >= campaign.delivery_deadline, ErrorCode::ExtensionNotAvailable);
        shipment.campaign = campaign.key();
        shipment.buyer = ctx.accounts.buyer.key();
        shipment.shipped = false;
        shipment.bump = ctx.bumps.shipment;
    }
    require!(!shipment.extension_used, ErrorCode::ExtensionUsed);
    let window = seat_window(campaign, true, Some(shipment))?;
    require!(window.report_open(now), ErrorCode::ExtensionNotAvailable);
    shipment.extension_used = true;
    Ok(())
}

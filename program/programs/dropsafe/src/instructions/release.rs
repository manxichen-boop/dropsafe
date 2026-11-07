use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Campaign, CampaignStatus, Escrow},
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

    // 校验:不能重复提取
    require!(
        campaign.status != CampaignStatus::Released,
        ErrorCode::AlreadyReleased
    );
    // 校验:人数必须达标
    require!(
        campaign.contributor_count >= campaign.target_count,
        ErrorCode::TargetNotReached
    );

    // 只转出"余额减去租金豁免最低余额"的部分。
    // 保留这部分,金库账户才能继续存在,重复提取时才能明确返回 AlreadyReleased
    let escrow_info = ctx.accounts.escrow.to_account_info();
    let rent_exempt_minimum = Rent::get()?.minimum_balance(escrow_info.data_len());
    let amount = escrow_info
        .lamports()
        .checked_sub(rent_exempt_minimum)
        .ok_or(ErrorCode::MathOverflow)?;

    ctx.accounts.escrow.sub_lamports(amount)?;
    ctx.accounts.organizer.add_lamports(amount)?;

    // 状态改为已提取
    ctx.accounts.campaign.status = CampaignStatus::Released;

    Ok(())
}

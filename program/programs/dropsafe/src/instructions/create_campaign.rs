use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Campaign, CampaignStatus, Escrow},
};

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct CreateCampaign<'info> {
    /// 团长:必须签名,并支付两个新账户的租金
    #[account(mut)]
    pub organizer: Signer<'info>,

    /// 活动账户:地址由 "campaign" + 团长地址 + 活动编号推导,
    /// 所以同一团长不能用同一编号创建两次
    #[account(
        init,
        payer = organizer,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [CAMPAIGN_SEED, organizer.key().as_ref(), &campaign_id.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// 托管金库:地址由 "escrow" + 活动地址推导,一个活动对应一个金库
    #[account(
        init,
        payer = organizer,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [ESCROW_SEED, campaign.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// Solana 系统程序:创建账户时需要
    pub system_program: Program<'info, System>,
}

pub fn handle_create_campaign(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    title: String,
    price_per_person_lamports: u64,
    target_count: u32,
    deadline_unix_ts: i64,
) -> Result<()> {
    // 校验:名称不超过 50 个字符(按字符数,不是字节数,中文也能写满 50 个字)
    require!(
        title.chars().count() <= MAX_TITLE_CHARS,
        ErrorCode::TitleTooLong
    );
    // 校验:每人金额必须大于 0
    require!(price_per_person_lamports > 0, ErrorCode::InvalidPrice);
    // 校验:目标人数必须大于 0
    require!(target_count > 0, ErrorCode::InvalidTargetCount);
    // 校验:截止时间必须在未来(以链上时钟为准,不能信任用户的电脑时间)
    require!(
        deadline_unix_ts > Clock::get()?.unix_timestamp,
        ErrorCode::DeadlineNotInFuture
    );

    ctx.accounts.campaign.set_inner(Campaign {
        organizer: ctx.accounts.organizer.key(),
        campaign_id,
        title,
        price_per_person_lamports,
        target_count,
        contributor_count: 0,
        deadline_unix_ts,
        status: CampaignStatus::Fundraising,
        bump: ctx.bumps.campaign,
        escrow_bump: ctx.bumps.escrow,
    });
    ctx.accounts.escrow.bump = ctx.bumps.escrow;

    Ok(())
}

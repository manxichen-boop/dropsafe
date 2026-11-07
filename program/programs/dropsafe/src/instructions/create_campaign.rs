use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    constants::*,
    error::ErrorCode,
    state::*,
};

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct CreateCampaign<'info> {
    /// 团长:必须签名,支付租金;全额保障档还要存入保证金
    #[account(mut)]
    pub organizer: Signer<'info>,

    /// 活动账户:地址由团长和活动编号推导,同一编号不能创建两次
    #[account(
        init,
        payer = organizer,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [CAMPAIGN_SEED, organizer.key().as_ref(), &campaign_id.to_le_bytes()],
        bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    /// 托管金库,一个活动对应一个
    #[account(
        init,
        payer = organizer,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [ESCROW_SEED, campaign.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// 团长记录:第一次创建活动时初始化
    #[account(
        init_if_needed,
        payer = organizer,
        space = 8 + OrganizerStats::INIT_SPACE,
        seeds = [ORGANIZER_SEED, organizer.key().as_ref()],
        bump
    )]
    pub organizer_stats: Box<Account<'info, OrganizerStats>>,

    /// 新规则账户:存最长运输时间。有它的团购按发货记录和 ETA 计算申诉期
    #[account(
        init,
        payer = organizer,
        space = 8 + CampaignExt::INIT_SPACE,
        seeds = [CAMPAIGN_EXT_SEED, campaign.key().as_ref()],
        bump
    )]
    pub campaign_ext: Box<Account<'info, CampaignExt>>,

    /// 团长扩展记录:和团长记录一样由团长在第一次创建活动时初始化
    #[account(
        init_if_needed,
        payer = organizer,
        space = 8 + OrganizerStatsExt::INIT_SPACE,
        seeds = [ORGANIZER_EXT_SEED, organizer.key().as_ref()],
        bump
    )]
    pub organizer_stats_ext: Box<Account<'info, OrganizerStatsExt>>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_create_campaign(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    title: String,
    description: String,
    image_url: String,
    price: u64,
    target_count: u32,
    deadline: i64,
    delivery_deadline: i64,
    tier: Tier,
    max_transit_seconds: i64,
) -> Result<()> {
    require!(
        max_transit_seconds > 0 && max_transit_seconds <= MAX_TRANSIT_LIMIT_SECONDS,
        ErrorCode::InvalidMaxTransit
    );
    let now = Clock::get()?.unix_timestamp;

    // 校验:文本长度。同时限制字符数和字节数,防止超过账户空间
    require!(
        title.chars().count() <= MAX_TITLE_CHARS && title.len() <= MAX_TITLE_BYTES,
        ErrorCode::TitleTooLong
    );
    require!(
        description.chars().count() <= MAX_DESCRIPTION_CHARS
            && description.len() <= MAX_DESCRIPTION_BYTES,
        ErrorCode::DescriptionTooLong
    );
    require!(
        image_url.len() <= MAX_IMAGE_URL_BYTES,
        ErrorCode::ImageUrlTooLong
    );
    require!(price > 0, ErrorCode::InvalidPrice);
    require!(target_count > 0, ErrorCode::InvalidTargetCount);

    // 校验:募集期在未来,且不超过 90 天
    require!(deadline > now, ErrorCode::DeadlineNotInFuture);
    let longest_deadline = now
        .checked_add(MAX_FUNDRAISING_SECONDS)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(deadline <= longest_deadline, ErrorCode::FundraisingTooLong);

    // 校验:发货期限在募集截止之后,且不超过 365 天
    require!(
        delivery_deadline > deadline,
        ErrorCode::InvalidDeliveryDeadline
    );
    let longest_delivery = deadline
        .checked_add(MAX_DELIVERY_SECONDS)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        delivery_deadline <= longest_delivery,
        ErrorCode::DeliveryTooLong
    );
    let appeal_end = delivery_deadline
        .checked_add(APPEAL_WINDOW_SECONDS)
        .ok_or(ErrorCode::MathOverflow)?;

    // 全额保障档:保证金 = 预付款 * 目标人数,每个名额对应自己的预付款
    let bond_total = match tier {
        Tier::Shielded => upfront_of(price)?
            .checked_mul(target_count as u64)
            .ok_or(ErrorCode::MathOverflow)?,
        _ => 0,
    };
    if bond_total > 0 {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.organizer.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            bond_total,
        )?;
    }

    ctx.accounts.campaign.set_inner(Campaign {
        organizer: ctx.accounts.organizer.key(),
        campaign_id,
        title,
        description,
        image_url,
        price,
        target_count,
        joined_count: 0,
        deadline,
        delivery_deadline,
        appeal_end,
        tier,
        status: CampaignStatus::Fundraising,
        upfront_released: false,
        bond_total,
        bond_reclaimed: false,
        seats_resolved: 0,
        finalized: false,
        bump: ctx.bumps.campaign,
    });
    ctx.accounts.escrow.bump = ctx.bumps.escrow;
    ctx.accounts.campaign_ext.set_inner(CampaignExt {
        campaign: ctx.accounts.campaign.key(),
        max_transit_seconds,
        bump: ctx.bumps.campaign_ext,
    });

    let ext = &mut ctx.accounts.organizer_stats_ext;
    ext.organizer = ctx.accounts.organizer.key();
    ext.bump = ctx.bumps.organizer_stats_ext;

    let stats = &mut ctx.accounts.organizer_stats;
    stats.organizer = ctx.accounts.organizer.key();
    stats.bump = ctx.bumps.organizer_stats;
    increment(&mut stats.campaigns_created)
}

use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(Accounts)]
pub struct SettleSeat<'info> {
    /// 任何人都可以调用,钱只会转给合约固定的地址;第一次给团长记扩展统计时付租金
    #[account(mut)]
    pub caller: Signer<'info>,

    /// 团长:收款地址由合约固定
    /// CHECK: 地址必须等于活动记录的团长,只用来收款
    #[account(mut, address = campaign.organizer @ ErrorCode::NotOrganizer)]
    pub organizer: UncheckedAccount<'info>,

    /// 买家:收款和收回租金的地址由合约固定
    /// CHECK: 地址必须等于凭证记录的买家,只用来收款
    #[account(mut, address = contribution.buyer @ ErrorCode::WrongBuyer)]
    pub buyer: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(mut, seeds = [ESCROW_SEED, campaign.key().as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,

    /// 名额凭证:结算后关闭,所以不能重复结算
    #[account(
        mut,
        close = buyer,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump = contribution.bump
    )]
    pub contribution: Account<'info, Contribution>,

    #[account(mut, seeds = [ORGANIZER_SEED, campaign.organizer.as_ref()], bump = organizer_stats.bump)]
    pub organizer_stats: Box<Account<'info, OrganizerStats>>,

    /// CHECK: 地址由 seeds 校验;不存在表示旧团购
    #[account(seeds = [CAMPAIGN_EXT_SEED, campaign.key().as_ref()], bump)]
    pub campaign_ext: UncheckedAccount<'info>,

    /// CHECK: 地址由 seeds 校验;不存在表示没有发货声明。结算后保留,作为公开记录
    #[account(seeds = [SHIPMENT_SEED, contribution.key().as_ref()], bump)]
    pub shipment: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = caller,
        space = 8 + OrganizerStatsExt::INIT_SPACE,
        seeds = [ORGANIZER_EXT_SEED, campaign.organizer.as_ref()],
        bump
    )]
    pub organizer_stats_ext: Box<Account<'info, OrganizerStatsExt>>,

    pub system_program: Program<'info, System>,

    #[account(mut, seeds = [BUYER_SEED, buyer.key().as_ref()], bump = buyer_stats.bump)]
    pub buyer_stats: Account<'info, BuyerStats>,
}

pub fn handle_settle_seat(ctx: Context<SettleSeat>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    require!(
        campaign.status == CampaignStatus::Active,
        ErrorCode::NotActive
    );

    let now = Clock::get()?.unix_timestamp;
    let tier = campaign.tier;
    let upfront = campaign.upfront()?;
    let remainder = campaign.remainder()?;
    let seat = ctx.accounts.contribution.status;
    let has_rules = load_optional::<CampaignExt>(&ctx.accounts.campaign_ext.to_account_info())?.is_some();
    let shipment = load_optional::<Shipment>(&ctx.accounts.shipment.to_account_info())?;
    let window = seat_window(campaign, has_rules, shipment.as_ref())?;

    // 尾款只有在买家确认或申诉期结束后才能给团长
    let pays_organizer = match seat {
        ContributionStatus::Confirmed => true,
        ContributionStatus::Paid => {
            // 这个名额自己的截止时间过了才能默认结算;别的名额延长不影响这里
            require!(!window.before_close(now), ErrorCode::SeatNotSettleable);
            true
        }
        ContributionStatus::Reported => false,
    };

    // 全额保障档还要处理这个名额的保证金(金额等于预付款)
    let total = match tier {
        Tier::Shielded => remainder.checked_add(upfront).ok_or(ErrorCode::MathOverflow)?,
        Tier::Standard => remainder,
        Tier::Trust => 0,
    };

    if total > 0 {
        let to = if pays_organizer {
            ctx.accounts.organizer.to_account_info()
        } else {
            ctx.accounts.buyer.to_account_info()
        };
        pay_from_escrow(&ctx.accounts.escrow, &to, total)?;
    }

    // 记录:付给团长的金额只算尾款,退回的保证金不算收入
    let stats = &mut ctx.accounts.organizer_stats;
    if pays_organizer && tier != Tier::Trust {
        stats.add_paid(remainder)?;
    }
    let tier_stats = stats.tier_mut(tier);
    let buyer_stats = &mut ctx.accounts.buyer_stats;
    match seat {
        ContributionStatus::Confirmed => {
            increment(&mut tier_stats.seats_confirmed)?;
            increment(&mut buyer_stats.seats_confirmed)?;
        }
        ContributionStatus::Paid => increment(&mut tier_stats.seats_unconfirmed)?,
        ContributionStatus::Reported => {
            increment(&mut tier_stats.seats_reported)?;
            increment(&mut buyer_stats.seats_reported)?;
        }
    }

    // 发货期限过后结算时仍没有发货声明,记一次"缺失发货记录"。
    // 名额凭证结算后关闭,所以每个名额只会计一次
    let ext = &mut ctx.accounts.organizer_stats_ext;
    ext.organizer = campaign.organizer;
    ext.bump = ctx.bumps.organizer_stats_ext;
    if window.shipped == Some(false) && now >= campaign.delivery_deadline {
        increment(&mut ext.missing_shipment_record_seats)?;
    }

    let campaign = &mut ctx.accounts.campaign;
    campaign.seats_resolved = campaign
        .seats_resolved
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

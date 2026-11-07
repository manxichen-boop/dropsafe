use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Campaign, CampaignStatus, Contribution, Escrow},
};

#[derive(Accounts)]
pub struct Contribute<'info> {
    /// 买家:必须签名,支付团购金额和参与凭证的租金
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// 要参与的活动:用种子校验它确实是本程序创建的活动
    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// 托管金库:用种子校验它确实属于这个活动,钱不会被转到别处
    #[account(
        mut,
        seeds = [ESCROW_SEED, campaign.key().as_ref()],
        bump = campaign.escrow_bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// 参与凭证:由 "contribution" + 活动地址 + 买家地址推导。
    /// `init` 只能成功一次,所以同一买家第二次参与时交易会直接失败,天然防止重复参与
    #[account(
        init,
        payer = buyer,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub contribution: Account<'info, Contribution>,

    /// Solana 系统程序:转账和创建账户时需要
    pub system_program: Program<'info, System>,
}

pub fn handle_contribute(ctx: Context<Contribute>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    let amount = campaign.price_per_person_lamports;

    // 校验:活动必须处于募集中
    require!(
        campaign.status == CampaignStatus::Fundraising,
        ErrorCode::NotFundraising
    );
    // 校验:必须在截止时间之前
    require!(
        Clock::get()?.unix_timestamp < campaign.deadline_unix_ts,
        ErrorCode::DeadlinePassed
    );
    // 校验:人数未满
    require!(
        campaign.contributor_count < campaign.target_count,
        ErrorCode::CampaignFull
    );

    // 把买家的 SOL 转入托管金库(由买家签名授权)
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        ),
        amount,
    )?;

    // 记录凭证,退款时凭它退钱
    ctx.accounts.contribution.set_inner(Contribution {
        campaign: ctx.accounts.campaign.key(),
        buyer: ctx.accounts.buyer.key(),
        amount,
        bump: ctx.bumps.contribution,
    });

    // 参与人数加 1
    let campaign = &mut ctx.accounts.campaign;
    campaign.contributor_count = campaign
        .contributor_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}

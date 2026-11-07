use anchor_lang::{
    prelude::*,
    system_program::{allocate, assign, transfer, Allocate, Assign, Transfer},
};

use crate::{constants::*, error::ErrorCode, state::*};

/// 一个名额的发货声明:ETA 和物流参考信息的哈希
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ShipmentEntry {
    pub eta: i64,
    pub reference_hash: [u8; 32],
}

/// 批量提交发货声明。remaining_accounts 依次是每个名额的 [名额凭证, 发货记录],
/// 每一对都在合约里重新推导校验,不信任前端传来的账户。
/// 整笔交易是原子的:任何一个名额不合格,整批都不会写入
#[derive(Accounts)]
pub struct RecordShipmentBatch<'info> {
    /// 只有团长能提交,并支付发货记录的租金
    #[account(mut)]
    pub organizer: Signer<'info>,

    #[account(
        seeds = [CAMPAIGN_SEED, campaign.organizer.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = organizer @ ErrorCode::NotOrganizer
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    /// CHECK: 地址由 seeds 校验;旧团购没有这个账户,会报 NoShippingRules
    #[account(seeds = [CAMPAIGN_EXT_SEED, campaign.key().as_ref()], bump)]
    pub campaign_ext: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_record_shipment_batch<'info>(
    ctx: Context<'info, RecordShipmentBatch<'info>>,
    entries: Vec<ShipmentEntry>,
) -> Result<()> {
    let ext = load_optional::<CampaignExt>(&ctx.accounts.campaign_ext.to_account_info())?
        .ok_or(ErrorCode::NoShippingRules)?;
    let campaign = &ctx.accounts.campaign;
    let now = Clock::get()?.unix_timestamp;

    // 成团后、发货期限前才能提交;期限过后不能补记录,逾期状态不会被抹掉
    require!(
        matches!(campaign.status, CampaignStatus::Funded | CampaignStatus::Active)
            && now < campaign.delivery_deadline,
        ErrorCode::ShippingClosed
    );
    let count = entries.len();
    require!(
        count >= 1 && count <= MAX_SHIPMENT_BATCH && ctx.remaining_accounts.len() == count * 2,
        ErrorCode::InvalidShipmentBatch
    );

    let latest_eta = now
        .checked_add(ext.max_transit_seconds)
        .ok_or(ErrorCode::MathOverflow)?;
    let campaign_key = campaign.key();
    let space = 8 + Shipment::INIT_SPACE;
    let rent = Rent::get()?.minimum_balance(space);
    let system_program = ctx.accounts.system_program.key();
    let organizer = ctx.accounts.organizer.to_account_info();

    for (i, entry) in entries.iter().enumerate() {
        require!(entry.eta >= now && entry.eta <= latest_eta, ErrorCode::InvalidEta);
        let seat_info = &ctx.remaining_accounts[2 * i];
        let shipment_info = &ctx.remaining_accounts[2 * i + 1];

        // 名额凭证必须是本程序的账户,并且就是这个团、这个买家的那个 PDA
        require_keys_eq!(*seat_info.owner, crate::ID, ErrorCode::InvalidShipmentAccount);
        let seat = {
            let data = seat_info.try_borrow_data()?;
            let mut slice: &[u8] = &data;
            Contribution::try_deserialize(&mut slice)?
        };
        let (expected_seat, _) = Pubkey::find_program_address(
            &[CONTRIBUTION_SEED, campaign_key.as_ref(), seat.buyer.as_ref()],
            &crate::ID,
        );
        require_keys_eq!(seat_info.key(), expected_seat, ErrorCode::InvalidShipmentAccount);

        let seat_key = seat_info.key();
        let (expected_shipment, bump) =
            Pubkey::find_program_address(&[SHIPMENT_SEED, seat_key.as_ref()], &crate::ID);
        require_keys_eq!(shipment_info.key(), expected_shipment, ErrorCode::InvalidShipmentAccount);
        // 已经有记录(包括同一批里重复出现)就整批回滚
        require!(
            shipment_info.data_is_empty() && shipment_info.owner == &anchor_lang::system_program::ID,
            ErrorCode::ShipmentAlreadyRecorded
        );

        // 分三步创建:补足租金、分配空间、交给本程序。
        // 有人提前往这个地址转钱也挡不住团长提交
        let signer_seeds: &[&[u8]] = &[SHIPMENT_SEED, seat_key.as_ref(), &[bump]];
        let missing = rent.saturating_sub(shipment_info.lamports());
        if missing > 0 {
            transfer(
                CpiContext::new(system_program, Transfer { from: organizer.clone(), to: shipment_info.clone() }),
                missing,
            )?;
        }
        allocate(
            CpiContext::new_with_signer(system_program, Allocate { account_to_allocate: shipment_info.clone() }, &[signer_seeds]),
            space as u64,
        )?;
        assign(
            CpiContext::new_with_signer(system_program, Assign { account_to_assign: shipment_info.clone() }, &[signer_seeds]),
            &crate::ID,
        )?;

        let record = Shipment {
            campaign: campaign_key,
            buyer: seat.buyer,
            shipped: true,
            shipped_at: now,
            eta: entry.eta,
            reference_hash: entry.reference_hash,
            extension_used: false,
            bump,
        };
        let mut data = shipment_info.try_borrow_mut_data()?;
        let mut cursor: &mut [u8] = &mut data;
        record.try_serialize(&mut cursor)?;
    }
    Ok(())
}

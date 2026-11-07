use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
};

/// 保障档位,创建后不可修改
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Tier {
    /// 全额保障:团长先存保证金,买家报告未收到时拿回全额
    Shielded,
    /// 部分保障:没有保证金,买家报告未收到时拿回 30%
    Standard,
    /// 信任团:成团后团长拿走 100%,买家报告只留下记录
    Trust,
}

/// 活动状态
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    /// 募集中
    Fundraising,
    /// 已满员,等团长提取预付款
    Funded,
    /// 团长已提取预付款,等待交付
    Active,
    /// 截止时没凑满
    Failed,
    /// 成团后团长在发货期限前没有提取
    Abandoned,
    /// 团长在成团前取消
    Cancelled,
    /// 所有名额已结算
    Closed,
}

/// 名额状态
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContributionStatus {
    Paid,
    Confirmed,
    Reported,
}

/// 一次团购活动
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub organizer: Pubkey,
    pub campaign_id: u64,
    #[max_len(MAX_TITLE_BYTES)]
    pub title: String,
    #[max_len(MAX_DESCRIPTION_BYTES)]
    pub description: String,
    #[max_len(MAX_IMAGE_URL_BYTES)]
    pub image_url: String,
    /// 每人金额(lamports)
    pub price: u64,
    pub target_count: u32,
    pub joined_count: u32,
    /// 募集截止时间
    pub deadline: i64,
    /// 发货期限
    pub delivery_deadline: i64,
    /// 申诉截止时间 = delivery_deadline + APPEAL_WINDOW,创建时算好存下来
    pub appeal_end: i64,
    pub tier: Tier,
    pub status: CampaignStatus,
    pub upfront_released: bool,
    /// 创建时存入的保证金总额
    pub bond_total: u64,
    pub bond_reclaimed: bool,
    /// 已结算的名额数
    pub seats_resolved: u32,
    pub finalized: bool,
    pub bump: u8,
}

impl Campaign {
    /// 预付款 = price * 7 / 10
    pub fn upfront(&self) -> Result<u64> {
        upfront_of(self.price)
    }

    /// 尾款 = price - upfront,两者相加严格等于 price
    pub fn remainder(&self) -> Result<u64> {
        Ok(self
            .price
            .checked_sub(self.upfront()?)
            .ok_or(ErrorCode::MathOverflow)?)
    }
}

pub fn upfront_of(price: u64) -> Result<u64> {
    let value = (price as u128)
        .checked_mul(UPFRONT_NUMERATOR as u128)
        .ok_or(ErrorCode::MathOverflow)?
        / UPFRONT_DENOMINATOR as u128;
    Ok(u64::try_from(value).map_err(|_| ErrorCode::MathOverflow)?)
}

/// 托管金库:存放买家付款和团长保证金。它归本程序所有,没有私钥。
#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub bump: u8,
}

/// 买家的名额凭证,结算、退款、退出时关闭,租金退还给买家
#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub buyer: Pubkey,
    pub amount: u64,
    pub status: ContributionStatus,
    pub bump: u8,
}

/// 团长在某一档位下的记录
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct TierStats {
    pub funded: u64,
    /// 买家主动确认的名额
    pub seats_confirmed: u64,
    /// 申诉期结束仍无回应的名额
    pub seats_unconfirmed: u64,
    /// 买家报告未收到的名额
    pub seats_reported: u64,
}

/// 团长的链上记录
#[account]
#[derive(InitSpace)]
pub struct OrganizerStats {
    pub organizer: Pubkey,
    pub campaigns_created: u64,
    pub campaigns_failed: u64,
    pub campaigns_abandoned: u64,
    pub campaigns_cancelled: u64,
    pub shielded: TierStats,
    pub standard: TierStats,
    pub trust: TierStats,
    /// 实际付给团长的金额,不含退还的保证金
    pub total_paid_to_organizer_lamports: u64,
    pub bump: u8,
}

impl OrganizerStats {
    pub fn tier_mut(&mut self, tier: Tier) -> &mut TierStats {
        match tier {
            Tier::Shielded => &mut self.shielded,
            Tier::Standard => &mut self.standard,
            Tier::Trust => &mut self.trust,
        }
    }

    pub fn add_paid(&mut self, amount: u64) -> Result<()> {
        self.total_paid_to_organizer_lamports = self
            .total_paid_to_organizer_lamports
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }
}

/// 买家的链上记录
#[account]
#[derive(InitSpace)]
pub struct BuyerStats {
    pub buyer: Pubkey,
    pub campaigns_joined: u64,
    pub seats_confirmed: u64,
    pub seats_reported: u64,
    pub seats_refunded: u64,
    pub bump: u8,
}

/// 新规则的开关:新建的团购都有这个账户,存团长声明的最长运输时间。
/// 没有这个账户的旧团购继续用 v2.1 的时间规则
#[account]
#[derive(InitSpace)]
pub struct CampaignExt {
    pub campaign: Pubkey,
    pub max_transit_seconds: i64,
    pub bump: u8,
}

/// 一个名额的履约记录,种子是 ["shipment", 名额凭证]。结算后保留,作为公开记录。
/// shipped = true 表示团长在发货期限前提交了发货声明。
/// 这只是团长的声明,合约无法验证包裹真的寄出。
/// shipped = false 的记录只会在买家延长等待期时创建(那时发货期限已过且没有发货声明)
#[account]
#[derive(InitSpace)]
pub struct Shipment {
    pub campaign: Pubkey,
    pub buyer: Pubkey,
    pub shipped: bool,
    /// 链上时间,不由团长填写
    pub shipped_at: i64,
    pub eta: i64,
    /// 物流参考信息的哈希,不存单号、姓名或地址
    pub reference_hash: [u8; 32],
    pub extension_used: bool,
    pub bump: u8,
}

/// 团长的扩展记录,和 OrganizerStats 分开存,旧账户不用迁移
#[account]
#[derive(InitSpace)]
pub struct OrganizerStatsExt {
    pub organizer: Pubkey,
    /// 结算时没有链上发货记录的名额(只说明没有声明,不证明现实中没发货)
    pub missing_shipment_record_seats: u64,
    /// 买家提交的报告,两种都算,都没有经过仲裁
    pub unverified_reports: u64,
    pub bump: u8,
}

/// 一个名额的报告窗口:从 opens(含)到 closes(不含)。
/// 所有指令和前端都用这一个函数,保证边界一致
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SeatWindow {
    pub opens: i64,
    pub closes: i64,
    /// 新规则下是否有发货声明;旧团购为 None
    pub shipped: Option<bool>,
}

impl SeatWindow {
    pub fn report_open(&self, now: i64) -> bool {
        now >= self.opens && now < self.closes
    }
    /// 确认收货和延长都要在截止前
    pub fn before_close(&self, now: i64) -> bool {
        now < self.closes
    }
}

/// 计算名额的报告窗口。
/// - 旧团购:发货期限 → appeal_end
/// - 新规则、有发货声明:ETA → ETA + 申诉期(延长后再加一个申诉期)
/// - 新规则、没有发货声明:发货期限 → 发货期限 + 申诉期(延长后再加一个申诉期)
pub fn seat_window(campaign: &Campaign, has_rules: bool, shipment: Option<&Shipment>) -> Result<SeatWindow> {
    if !has_rules {
        return Ok(SeatWindow { opens: campaign.delivery_deadline, closes: campaign.appeal_end, shipped: None });
    }
    let shipped = shipment.map(|s| s.shipped).unwrap_or(false);
    let opens = match shipment {
        Some(s) if s.shipped => s.eta,
        _ => campaign.delivery_deadline,
    };
    let extra = if shipment.map(|s| s.extension_used).unwrap_or(false) { EXTENSION_SECONDS } else { 0 };
    let closes = opens
        .checked_add(APPEAL_WINDOW_SECONDS)
        .and_then(|v| v.checked_add(extra))
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(SeatWindow { opens, closes, shipped: Some(shipped) })
}

/// 读取一个可能不存在的程序账户:地址已经由 seeds 约束校验过。
/// 不存在(系统账户、没有数据)返回 None;存在就必须是本程序的、类型正确的账户
pub fn load_optional<T: AccountDeserialize + Owner>(info: &AccountInfo) -> Result<Option<T>> {
    if info.data_is_empty() && info.owner == &anchor_lang::system_program::ID {
        return Ok(None);
    }
    require_keys_eq!(*info.owner, T::owner(), ErrorCode::InvalidShipmentAccount);
    let data = info.try_borrow_data()?;
    let mut slice: &[u8] = &data;
    Ok(Some(T::try_deserialize(&mut slice)?))
}

/// 计数加 1,溢出时报错
pub fn increment(value: &mut u64) -> Result<()> {
    *value = value.checked_add(1).ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

/// 从托管金库转出。每次转出前都检查:扣掉租金后的余额够不够
pub fn pay_from_escrow<'info>(
    escrow: &Account<'info, Escrow>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let info = escrow.to_account_info();
    let rent = Rent::get()?.minimum_balance(info.data_len());
    let available = info
        .lamports()
        .checked_sub(rent)
        .ok_or(ErrorCode::InsufficientEscrow)?;
    require!(available >= amount, ErrorCode::InsufficientEscrow);
    escrow.sub_lamports(amount)?;
    to.add_lamports(amount)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn campaign(delivery_deadline: i64, appeal_end: i64) -> Campaign {
        Campaign {
            organizer: Pubkey::default(),
            campaign_id: 0,
            title: String::new(),
            description: String::new(),
            image_url: String::new(),
            price: 1_000,
            target_count: 1,
            joined_count: 1,
            deadline: 0,
            delivery_deadline,
            appeal_end,
            tier: Tier::Shielded,
            status: CampaignStatus::Active,
            upfront_released: true,
            bond_total: 0,
            bond_reclaimed: false,
            seats_resolved: 0,
            finalized: false,
            bump: 0,
        }
    }

    #[test]
    fn appeal_window_length_is_fixed_per_build() {
        #[cfg(not(feature = "devnet-demo"))]
        assert_eq!(APPEAL_WINDOW_SECONDS, 7 * 86_400);
        #[cfg(feature = "devnet-demo")]
        assert_eq!(APPEAL_WINDOW_SECONDS, 60);
    }

    fn shipment(shipped: bool, eta: i64, extension_used: bool) -> Shipment {
        Shipment {
            campaign: Pubkey::default(),
            buyer: Pubkey::default(),
            shipped,
            shipped_at: 0,
            eta,
            reference_hash: [0; 32],
            extension_used,
            bump: 0,
        }
    }

    // 检查一个窗口在开始前 1 秒、开始、截止前 1 秒、截止、截止后 1 秒的表现
    fn assert_edges(w: SeatWindow, opens: i64, closes: i64) {
        assert_eq!((w.opens, w.closes), (opens, closes));
        assert!(!w.report_open(opens - 1), "before opening");
        assert!(w.report_open(opens), "at opening");
        assert!(w.report_open(closes - 1), "one second before closing");
        assert!(!w.report_open(closes), "exactly at closing");
        assert!(!w.report_open(closes + 1), "one second after closing");
        assert!(w.before_close(closes - 1));
        assert!(!w.before_close(closes));
    }

    #[test]
    fn legacy_campaigns_keep_the_old_window() {
        let c = campaign(1_000, 1_000 + APPEAL_WINDOW_SECONDS);
        let w = seat_window(&c, false, None).unwrap();
        assert_eq!(w.shipped, None);
        assert_edges(w, 1_000, 1_000 + APPEAL_WINDOW_SECONDS);
    }

    #[test]
    fn unshipped_seats_open_at_the_shipping_deadline() {
        let c = campaign(1_000, 0);
        let w = seat_window(&c, true, None).unwrap();
        assert_eq!(w.shipped, Some(false));
        assert_edges(w, 1_000, 1_000 + APPEAL_WINDOW_SECONDS);
    }

    #[test]
    fn shipped_seats_open_at_their_own_eta() {
        let c = campaign(1_000, 0);
        let w = seat_window(&c, true, Some(&shipment(true, 5_000, false))).unwrap();
        assert_eq!(w.shipped, Some(true));
        assert_edges(w, 5_000, 5_000 + APPEAL_WINDOW_SECONDS);
        // ETA 早于发货期限也按 ETA 算
        let early = seat_window(&c, true, Some(&shipment(true, 500, false))).unwrap();
        assert_edges(early, 500, 500 + APPEAL_WINDOW_SECONDS);
    }

    #[test]
    fn an_extension_adds_one_window_to_that_seat_only() {
        let c = campaign(1_000, 0);
        let extended = seat_window(&c, true, Some(&shipment(true, 5_000, true))).unwrap();
        assert_edges(extended, 5_000, 5_000 + APPEAL_WINDOW_SECONDS + EXTENSION_SECONDS);
        let other = seat_window(&c, true, Some(&shipment(true, 5_000, false))).unwrap();
        assert_eq!(other.closes, 5_000 + APPEAL_WINDOW_SECONDS);
        // 没有发货声明、买家延长过:从发货期限算起,多一个申诉期
        let unshipped = seat_window(&c, true, Some(&shipment(false, 0, true))).unwrap();
        assert_eq!(unshipped.shipped, Some(false));
        assert_edges(unshipped, 1_000, 1_000 + APPEAL_WINDOW_SECONDS + EXTENSION_SECONDS);
    }

    #[test]
    fn remainder_plus_upfront_is_the_price() {
        for price in [1u64, 7, 10, 1_000_000_001, 10_000_000] {
            let mut c = campaign(0, 0);
            c.price = price;
            assert_eq!(c.upfront().unwrap() + c.remainder().unwrap(), price);
        }
    }
}

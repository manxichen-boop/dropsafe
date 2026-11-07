use anchor_lang::prelude::*;

/// 自定义错误码。前端会把这些错误翻译成易懂的中英文提示。
#[error_code]
pub enum ErrorCode {
    #[msg("Title must be 50 characters or fewer")]
    TitleTooLong,
    #[msg("Price per person must be greater than 0")]
    InvalidPrice,
    #[msg("Target count must be greater than 0")]
    InvalidTargetCount,
    #[msg("Deadline must be in the future")]
    DeadlineNotInFuture,
    #[msg("Campaign is not accepting contributions")]
    NotFundraising,
    #[msg("The campaign deadline has passed")]
    DeadlinePassed,
    #[msg("The campaign is already full")]
    CampaignFull,
    #[msg("The campaign is still active; refunds open after the deadline")]
    CampaignStillActive,
    #[msg("The campaign reached its target, so refunds are not available")]
    TargetAlreadyReached,
    #[msg("Only the organizer can do this")]
    NotOrganizer,
    #[msg("The campaign has not reached its target")]
    TargetNotReached,
    #[msg("Funds have already been released")]
    AlreadyReleased,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("The shipping deadline must be after the campaign deadline")]
    InvalidDeliveryDeadline,
    #[msg("The dispute deadline must be after the shipping deadline")]
    InvalidDisputeDeadline,
    #[msg("The shipping deadline has passed, so the organizer can no longer withdraw")]
    DeliveryDeadlinePassed,
    #[msg("The organizer has not withdrawn yet, so there is no delivery to confirm")]
    NotDelivering,
    #[msg("You can report non-delivery only after the shipping deadline")]
    DeliveryDeadlineNotReached,
    #[msg("The dispute window has closed")]
    DisputeWindowClosed,
    #[msg("The organizer can claim unconfirmed shares only after the dispute window closes")]
    DisputeWindowOpen,
    #[msg("This contribution does not belong to this buyer")]
    WrongBuyer,
}

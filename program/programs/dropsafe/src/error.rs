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
}

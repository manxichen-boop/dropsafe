use anchor_lang::prelude::*;

/// 自定义错误码。前端会把这些错误翻译成中英文提示。
#[error_code]
pub enum ErrorCode {
    #[msg("Title must be 50 characters or fewer")]
    TitleTooLong,
    #[msg("Description must be 280 characters or fewer")]
    DescriptionTooLong,
    #[msg("Image URL must be 200 bytes or fewer")]
    ImageUrlTooLong,
    #[msg("Price per person must be greater than 0")]
    InvalidPrice,
    #[msg("Target count must be greater than 0")]
    InvalidTargetCount,
    #[msg("Deadline must be in the future")]
    DeadlineNotInFuture,
    #[msg("Fundraising can last at most 90 days")]
    FundraisingTooLong,
    #[msg("The shipping deadline must be after the campaign deadline")]
    InvalidDeliveryDeadline,
    #[msg("The shipping period can last at most 365 days")]
    DeliveryTooLong,
    #[msg("Campaign is not accepting contributions")]
    NotFundraising,
    #[msg("The campaign deadline has passed")]
    DeadlinePassed,
    #[msg("The campaign is already full")]
    CampaignFull,
    #[msg("Only the organizer can do this")]
    NotOrganizer,
    #[msg("Refunds open after the campaign deadline")]
    CampaignStillActive,
    #[msg("Refunds open after the shipping deadline if the organizer has not withdrawn")]
    DeliveryDeadlineNotReached,
    #[msg("This campaign is not in a refundable state")]
    RefundNotAvailable,
    #[msg("Only a fundraising campaign can be cancelled, before its deadline")]
    CannotCancel,
    #[msg("This campaign has no organizer bond")]
    NoBond,
    #[msg("The bond can be reclaimed only after the campaign failed, was abandoned or was cancelled")]
    BondNotReclaimable,
    #[msg("The bond has already been reclaimed")]
    BondAlreadyReclaimed,
    #[msg("The campaign has not reached its target")]
    TargetNotReached,
    #[msg("The upfront payment has already been released")]
    AlreadyReleased,
    #[msg("The shipping deadline has passed, so the organizer can no longer withdraw")]
    DeliveryDeadlinePassed,
    #[msg("The organizer has not released the upfront payment yet")]
    NotActive,
    #[msg("This seat has already been confirmed or reported")]
    SeatAlreadyDecided,
    #[msg("The appeal window has closed")]
    AppealWindowClosed,
    #[msg("Non-delivery can be reported only after the shipping deadline")]
    TooEarlyToReport,
    #[msg("This seat cannot be settled until the buyer confirms or the appeal window closes")]
    SeatNotSettleable,
    #[msg("This campaign's outcome is not decided yet")]
    NotFinalizable,
    #[msg("This campaign has already been finalized")]
    AlreadyFinalized,
    #[msg("The escrow does not hold enough funds for this payment")]
    InsufficientEscrow,
    #[msg("This contribution does not belong to this buyer")]
    WrongBuyer,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    /// 新错误放在最后,保持已有错误码的编号不变
    #[msg("The organizer cannot join their own group buy")]
    OrganizerCannotJoin,
    #[msg("The longest transit time must be between 1 second and 60 days")]
    InvalidMaxTransit,
    #[msg("This group buy was created before shipment records existed")]
    NoShippingRules,
    #[msg("A shipment batch must list between 1 and 8 seats, with two accounts per seat")]
    InvalidShipmentBatch,
    #[msg("Shipments can be recorded only after the group fills and before the shipping deadline")]
    ShippingClosed,
    #[msg("The ETA must be between now and now plus the longest transit time")]
    InvalidEta,
    #[msg("This seat already has a shipment record")]
    ShipmentAlreadyRecorded,
    #[msg("This account is not the seat or shipment record it claims to be")]
    InvalidShipmentAccount,
    #[msg("This seat has a shipment record, so report that it didn't arrive instead")]
    SeatWasShipped,
    #[msg("This seat has no shipment record, so report that it wasn't shipped instead")]
    SeatNotShipped,
    #[msg("This seat's waiting period has already been extended once")]
    ExtensionUsed,
    #[msg("The waiting period can be extended only while this seat's report window is open")]
    ExtensionNotAvailable,
}

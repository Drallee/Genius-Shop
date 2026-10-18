package me.dralle.shop.economy;

import java.util.UUID;

public record TransactionResult(UUID id, Status status, FailureReason failureReason, String detail) {
    public enum Status { COMPLETED, REJECTED, COMPENSATED, COMPENSATION_FAILED, COMPLETED_WITH_ERRORS }
    public enum FailureReason { NONE, INVALID_REQUEST, WRONG_THREAD, BUSY, DELIVERY_FAILED, PAYMENT_FAILED, STOCK_UPDATE_FAILED }

    /** Financial settlement is final, even if a later stock update needs administrator attention. */
    public boolean completed() {
        return status == Status.COMPLETED || status == Status.COMPLETED_WITH_ERRORS;
    }
}

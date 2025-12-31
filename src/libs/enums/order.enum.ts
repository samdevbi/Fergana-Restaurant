export enum OrderStatus {
    PROCESS = "PROCESS",
    READY = "READY",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    FAILED = "FAILED",
}

export enum OrderType {
    QR_ORDER = "QR_ORDER",
}
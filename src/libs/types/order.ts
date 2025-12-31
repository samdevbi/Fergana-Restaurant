import { ObjectId } from "mongoose";
import { OrderStatus, PaymentStatus, OrderType } from "../enums/order.enum";
import { Product } from "./product";

export interface OrderItem {
    _id: ObjectId;
    itemQuantity: number;
    itemPrice: number;
    orderId: ObjectId;
    productId: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface Order {
    _id: ObjectId;
    orderNumber: string;
    restaurantId: ObjectId;
    tableId: ObjectId;
    tableNumber: number;
    memberId?: ObjectId;
    orderTotal: number;
    orderStatus: OrderStatus;
    orderType: OrderType;
    paymentStatus: PaymentStatus;
    paymentMethod?: string;
    verifiedBy?: ObjectId;
    verifiedAt?: Date;
    completedBy?: ObjectId;
    completedAt?: Date;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
    /* from aggregations */
    orderItems?: OrderItem[];
    productData?: Product[];
}

export interface OrderItemInput {
    itemQuantity: number;
    itemPrice: number;
    productId: ObjectId;
    orderId?: ObjectId;
}

export interface OrderCreateInput {
    tableId: string;
    items: OrderItemInput[];
    existingOrderId?: string;
    isAddingToExisting?: boolean;
    hasPermission?: boolean; // Permission to create order on non-ACTIVE table
    isCustomerOrder?: boolean; // true if customer confirms existing order is theirs, false if not
}

export interface OrderConfirmationResponse {
    needsConfirmation: boolean;
    existingOrder?: Order;
    needsPermission?: boolean;
    message?: string;
    isCustomerOrder?: boolean; // true if customer confirms it's their order, false if not
    needsStaffAction?: boolean; // true if customer says NO and needs staff to close order
}

export interface OrderInquiry {
    page: number;
    limit: number;
    orderStatus?: OrderStatus;
}

export interface OrderUpdateInput {
    orderId: string;
    action: "update-status" | "complete" | "cancel" | "modify-items";
    orderStatus?: OrderStatus; // For update-status action
    reason?: string; // For cancel action
    items?: OrderItemInput[]; // For modify-items action
}

export interface PaymentVerificationInput {
    orderId: string;
    paymentMethod: string;
    paymentProof?: string;
}

export interface OrderCompleteInput {
    orderId: string;
}

export interface OrderCancelInput {
    orderId: string;
    reason?: string;
}

export interface OrderModifyItemsInput {
    orderId: string;
    items: OrderItemInput[];
}
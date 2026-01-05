import { ObjectId } from "mongoose";
import { OrderStatus, OrderType } from "../enums/order.enum";
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
    orderTotal: number;
    orderStatus: OrderStatus;
    orderType: OrderType;
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

export interface OrderInquiry {
    page: number;
    limit: number;
    orderStatus?: OrderStatus;
}

export interface OrderAdminInquiry {
    page: number;
    limit: number;
    orderStatus?: OrderStatus;
    tableNumber?: number;
    startDate?: string; // ISO date string
    endDate?: string; // ISO date string
    search?: string; // Search by order number
}

export interface OrderCreateInput {
    tableId: string;
    items: OrderItemInput[];
    hasPermission?: boolean;
}

export interface OrderCompleteInput {
    orderId: string;
}

export interface OrderCancelInput {
    orderId: string;
    reason?: string;
}

export interface OrderUpdateItemsInput {
    items: OrderItemInput[];
}

export interface OrderConfirmationResponse {
    needsConfirmation?: boolean;
    hasExistingOrder?: boolean;
    needsStaffAction?: boolean;
    isCustomerOrder?: boolean;
    message?: string;
    existingOrder?: {
        orderId: ObjectId;
        orderNumber: string;
        orderStatus: OrderStatus;
        orderTotal: number;
        items: OrderItem[];
    };
}
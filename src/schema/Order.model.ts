import mongoose, { Schema } from "mongoose";
import { OrderStatus, OrderType } from "../libs/enums/order.enum";

const orderSchema = new Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            index: true,
        },

        restaurantId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Member",
        },

        tableId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Table",
        },

        tableNumber: {
            type: Number,
            required: true,
        },

        memberId: {
            type: Schema.Types.ObjectId,
            required: false,
            ref: "Member",
            default: null,
        },

        orderTotal: {
            type: Number,
            required: true,
        },

        orderStatus: {
            type: String,
            enum: OrderStatus,
            default: OrderStatus.PROCESS,
        },

        orderType: {
            type: String,
            enum: OrderType,
            default: OrderType.QR_ORDER,
        },

        completedBy: {
            type: Schema.Types.ObjectId,
            ref: "Member",
            required: false,
            default: null,
        },

        completedAt: {
            type: Date,
            required: false,
            default: null,
        },

        cancellationReason: {
            type: String,
            required: false,
        },
    },
    { timestamps: true }
);

// Indexes for efficient queries
orderSchema.index({ tableId: 1, orderStatus: 1 });
orderSchema.index({ restaurantId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
// Index for orderNumber (not unique - allows daily reset with same numbers)
orderSchema.index({ restaurantId: 1, orderNumber: 1 });

export default mongoose.model("Order", orderSchema);
import mongoose, { Schema } from "mongoose";
import { TableStatus } from "../libs/enums/table.enum";

const tableSchema = new Schema(
    {
        tableNumber: {
            type: Number,
            required: true,
            min: 1,
            max: 100,
        },

        restaurantId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Member",
        },

        qrCode: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        qrCodeUrl: {
            type: String,
            required: false,
        },

        status: {
            type: String,
            enum: TableStatus,
            default: TableStatus.AVAILABLE,
        },

        currentOrderId: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            required: false,
            default: null,
        },

        capacity: {
            type: Number,
            required: false,
            min: 1,
        },

        location: {
            type: String,
            required: false,
        },
    },
    { timestamps: true }   // CreatedAt and UpdatedAt
);

// Compound index: restaurantId + tableNumber must be unique
tableSchema.index(
    { restaurantId: 1, tableNumber: 1 },
    { unique: true }
);

// Index for quick status queries
tableSchema.index({ status: 1 });

export default mongoose.model("Table", tableSchema);


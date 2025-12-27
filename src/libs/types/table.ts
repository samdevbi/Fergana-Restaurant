import { ObjectId } from "mongoose";
import { TableStatus } from "../enums/table.enum";

export interface Table {
    _id: ObjectId;
    tableNumber: number;
    restaurantId: ObjectId;
    qrCode: string;
    qrCodeUrl?: string;
    status: TableStatus;
    currentOrderId?: ObjectId;
    capacity?: number;
    location?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TableInput {
    tableNumber: number;
    restaurantId: ObjectId;
    capacity?: number;
    location?: string;
}

export interface TableUpdateInput {
    capacity?: number;
    location?: string;
    status?: TableStatus;
}




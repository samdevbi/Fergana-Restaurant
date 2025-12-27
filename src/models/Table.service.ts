import TableModel from "../schema/Table.model";
import { Table, TableInput, TableUpdateInput } from "../libs/types/table";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { shapeIntoMongooseObjectId } from "../libs/config";
import { TableStatus } from "../libs/enums/table.enum";
import { ObjectId } from "mongoose";
import OrderService from "./Order.service";
import { generateQRCodeFile } from "../libs/utils/qrcode.generator";

class TableService {
    private readonly tableModel;
    private readonly orderService;

    constructor() {
        this.tableModel = TableModel;
        this.orderService = new OrderService();
    }

    public async createTable(input: TableInput): Promise<Table> {
        const restaurantId = shapeIntoMongooseObjectId(input.restaurantId);

        // Check if table number already exists for this restaurant
        const existingTable = await this.tableModel.findOne({
            restaurantId: restaurantId,
            tableNumber: input.tableNumber,
        }).exec();

        if (existingTable) {
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }

        // Generate QR code identifier
        const qrCode = `QR-${input.restaurantId}-${input.tableNumber}-${Date.now()}`;

        try {
            const result = await this.tableModel.create({
                tableNumber: input.tableNumber,
                restaurantId: restaurantId,
                qrCode: qrCode,
                capacity: input.capacity,
                location: input.location,
                status: TableStatus.ACTIVE,
            });

            // Generate QR code image file
            try {
                const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
                const qrCodeUrl = await generateQRCodeFile(
                    result._id.toString(),
                    restaurantId.toString(),
                    baseUrl,
                    "./uploads/qrcodes"
                );

                // Update table with QR code image URL
                const updatedTable = await this.tableModel.findByIdAndUpdate(
                    result._id,
                    { qrCodeUrl: qrCodeUrl },
                    { new: true }
                ).exec();

                return updatedTable || result;
            } catch (qrError) {
                console.error("Error generating QR code image:", qrError);
                // Return table even if QR code image generation fails
                return result;
            }
        } catch (err) {
            console.error("Error, model: createTable", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }
    }

    public async getAllTables(restaurantId: ObjectId | string): Promise<Table[]> {
        const id = shapeIntoMongooseObjectId(restaurantId);
        const result = await this.tableModel
            .find({ restaurantId: id })
            .sort({ tableNumber: 1 })
            .exec();

        if (!result || result.length === 0) {
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        }

        return result;
    }

    public async getTableById(tableId: ObjectId | string): Promise<Table> {
        const id = shapeIntoMongooseObjectId(tableId);
        const result = await this.tableModel.findById(id).exec();

        if (!result) {
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        }

        return result;
    }

    /**
     * Check if table is available for customer orders
     * Only ACTIVE status allows orders
     */
    public async checkTableAvailabilityForOrder(tableId: ObjectId | string): Promise<boolean> {
        const table = await this.getTableById(tableId);
        return table.status === TableStatus.ACTIVE;
    }

    public async getTableByQR(qrCode: string): Promise<Table> {
        const result = await this.tableModel.findOne({ qrCode: qrCode }).exec();

        if (!result) {
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        }

        return result;
    }

    public async checkTableAvailability(tableId: ObjectId | string): Promise<boolean> {
        const id = shapeIntoMongooseObjectId(tableId);
        const table = await this.tableModel.findById(id).exec();

        if (!table) {
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        }

        // Allow multiple orders - table is available if it exists
        return true;
    }

    public async occupyTable(tableId: ObjectId | string, orderId: ObjectId | string): Promise<Table> {
        const tableIdObj = shapeIntoMongooseObjectId(tableId);
        const orderIdObj = shapeIntoMongooseObjectId(orderId);

        // Update table to occupied (allow multiple orders, just mark as occupied)
        const result = await this.tableModel.findByIdAndUpdate(
            tableIdObj,
            {
                status: TableStatus.OCCUPIED,
                currentOrderId: orderIdObj, // Keep reference to first order
            },
            { new: true }
        ).exec();

        if (!result) {
            throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
        }

        return result;
    }

    public async freeTable(tableId: ObjectId | string): Promise<Table> {
        const id = shapeIntoMongooseObjectId(tableId);

        const result = await this.tableModel.findOneAndUpdate(
            { _id: id },
            {
                status: TableStatus.ACTIVE,
                currentOrderId: null,
            },
            { new: true }
        ).exec();

        if (!result) {
            throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
        }

        return result;
    }

    public async updateTable(tableId: ObjectId | string, input: TableUpdateInput): Promise<Table> {
        const id = shapeIntoMongooseObjectId(tableId);

        const updateData: any = {};
        if (input.capacity !== undefined) updateData.capacity = input.capacity;
        if (input.location !== undefined) updateData.location = input.location;
        if (input.status !== undefined) updateData.status = input.status;

        const result = await this.tableModel.findOneAndUpdate(
            { _id: id },
            updateData,
            { new: true }
        ).exec();

        if (!result) {
            throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
        }

        return result;
    }

    public async updateQRCodeUrl(tableId: ObjectId | string, qrCodeUrl: string): Promise<Table> {
        const id = shapeIntoMongooseObjectId(tableId);

        const result = await this.tableModel.findOneAndUpdate(
            { _id: id },
            { qrCodeUrl: qrCodeUrl },
            { new: true }
        ).exec();

        if (!result) {
            throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
        }

        return result;
    }

    public async getTableByTableNumber(restaurantId: ObjectId | string, tableNumber: number): Promise<Table> {
        const id = shapeIntoMongooseObjectId(restaurantId);

        const result = await this.tableModel.findOne({
            restaurantId: id,
            tableNumber: tableNumber,
        }).exec();

        if (!result) {
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        }

        return result;
    }

    /**
     * Get table with all its orders (order history)
     */
    public async getTableWithOrderHistory(tableId: ObjectId | string): Promise<Table & { orderHistory: any[]; activeOrders: any[] }> {
        const id = shapeIntoMongooseObjectId(tableId);
        const table = await this.tableModel.findById(id).exec();

        if (!table) {
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        }

        // Get all orders for this table
        const orderHistory = await this.orderService.getAllOrdersByTable(id);
        const activeOrders = await this.orderService.getActiveOrdersByTableWithDetails(id);

        return {
            ...table.toObject(),
            orderHistory: orderHistory,
            activeOrders: activeOrders,
        } as Table & { orderHistory: any[]; activeOrders: any[] };
    }
}

export default TableService;


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
    private _orderService: OrderService | null = null;

    constructor() {
        this.tableModel = TableModel;
    }

    private get orderService(): OrderService {
        if (!this._orderService) {
            this._orderService = new OrderService();
        }
        return this._orderService;
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
                status: TableStatus.AVAILABLE,
            });

            // Generate QR code image file (use CLIENT_URL for customer-facing QR codes)
            try {
                const baseUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:3000";
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

    public async deleteTable(tableId: ObjectId | string): Promise<Table> {
        const id = shapeIntoMongooseObjectId(tableId);

        // Check if table exists
        const table = await this.tableModel.findById(id).exec();
        if (!table) {
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        }

        // Delete table
        const result = await this.tableModel.findByIdAndDelete(id).exec();

        if (!result) {
            throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
        }

        return result;
    }
}

export default TableService;


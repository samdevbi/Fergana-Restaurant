import { ExtendedRequest } from "../libs/types/member";
import { T } from "../libs/types/common";
import { Response } from "express";
import Errors, { HttpCode } from "../libs/Errors";
import OrderService from "../models/Order.service";
import TableService from "../models/Table.service";
import MemberService from "../models/Member.service";
import {
    PaymentVerificationInput,
    OrderCompleteInput,
    OrderCancelInput,
} from "../libs/types/order";

const orderService = new OrderService();
const tableService = new TableService();
const memberService = new MemberService();

const serviceController: T = {};

/**
 * Get orders needing service staff attention
 * Requires: JWT authentication + SERVICE/OWNER role
 */
serviceController.getOrders = async (req: ExtendedRequest, res: Response) => {
    try {
        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        // Get orders grouped by table (all orders from same table shown together)
        const result = await orderService.getServiceOrders(restaurantId);

        res.status(HttpCode.OK).json({
            tables: result, // Grouped by table
            count: result.length, // Number of tables with orders
            message: "Orders are grouped by table. Each table entry contains all orders from that table.",
        });
    } catch (err) {
        console.log("Error, getServiceOrders:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};


/**
 * Get specific order details
 * Requires: JWT authentication + SERVICE/OWNER role
 */
serviceController.getOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await orderService.getOrderById(id);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getServiceOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get all tables with status
 * Requires: JWT authentication + SERVICE/OWNER role
 */
serviceController.getTables = async (req: ExtendedRequest, res: Response) => {
    try {
        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const result = await tableService.getAllTables(restaurantId);

        res.status(HttpCode.OK).json({
            tables: result,
            count: result.length,
        });
    } catch (err) {
        console.log("Error, getServiceTables:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get active order for a table
 * Requires: JWT authentication + SERVICE/OWNER role
 */
serviceController.getTableActiveOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        const { tableId } = req.params;

        const activeOrder = await orderService.getOrderByTable(tableId);

        if (!activeOrder) {
            return res.status(HttpCode.OK).json({
                activeOrder: null,
                message: "No active order found for this table",
            });
        }

        const fullOrder = await orderService.getOrderById(activeOrder._id.toString());

        res.status(HttpCode.OK).json({
            activeOrder: fullOrder,
        });
    } catch (err) {
        console.log("Error, getTableActiveOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get table with order history
 * Requires: JWT authentication + SERVICE/OWNER role
 * Query params: filter - "paid", "unpaid", "cancelled" (optional)
 */
serviceController.getTableWithHistory = async (req: ExtendedRequest, res: Response) => {
    try {
        const { tableId } = req.params;
        const { filter } = req.query; // Filter: "paid", "unpaid", "cancelled"

        const result = await tableService.getTableWithOrderHistory(tableId, filter as string);

        res.status(HttpCode.OK).json({
            table: {
                _id: result._id,
                tableNumber: result.tableNumber,
                status: result.status,
                capacity: result.capacity,
                location: result.location,
            },
            activeOrders: result.activeOrders,
            orderHistory: result.orderHistory,
            totalOrders: result.orderHistory.length,
            activeOrdersCount: result.activeOrders.length,
            filter: filter || "all", // Show applied filter
        });
    } catch (err) {
        console.log("Error, getTableWithHistory:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default serviceController;



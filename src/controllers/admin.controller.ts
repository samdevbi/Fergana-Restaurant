import { ExtendedRequest } from "../libs/types/member";
import { T } from "../libs/types/common";
import { Response } from "express";
import Errors, { HttpCode } from "../libs/Errors";
import TableService from "../models/Table.service";
import MemberService from "../models/Member.service";
import OrderService from "../models/Order.service";
import ProductService from "../models/Product.service";
import { TableInput, TableUpdateInput } from "../libs/types/table";
import { MemberInput, MemberUpdateInput } from "../libs/types/member";
import { MemberRole } from "../libs/enums/member.enum";

const tableService = new TableService();
const memberService = new MemberService();
const orderService = new OrderService();
const productService = new ProductService();

const adminController: T = {};

/**
 * Get dashboard analytics
 * Requires: JWT authentication + OWNER role
 */
adminController.getDashboard = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getDashboard");

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        // Get today's orders
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get orders count and revenue for today
        const todayOrders = await orderService.getKitchenOrders(restaurantId);
        const todayRevenue = todayOrders.reduce((sum, order) => {
            if (order.orderStatus !== "CANCELLED") {
                return sum + order.orderTotal;
            }
            return sum;
        }, 0);

        // Get all tables
        const tables = await tableService.getAllTables(restaurantId);
        const activeTables = tables.filter(t => t.status === "ACTIVE").length;
        const occupiedTables = tables.filter(t => t.status === "OCCUPIED").length;
        const pausedTables = tables.filter(t => t.status === "PAUSE").length;
        const blockedTables = tables.filter(t => t.status === "BLOCK").length;

        res.status(HttpCode.OK).json({
            today: {
                ordersCount: todayOrders.length,
                revenue: todayRevenue,
            },
            tables: {
                total: tables.length,
                active: activeTables,
                occupied: occupiedTables,
                paused: pausedTables,
                blocked: blockedTables,
            },
        });
    } catch (err) {
        console.log("Error, getDashboard:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get revenue statistics
 * Requires: JWT authentication + OWNER role
 */
adminController.getRevenue = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getRevenue");
        const { period } = req.query; // day, week, month

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        // For now, return basic revenue info
        // TODO: Implement period-based filtering
        const orders = await orderService.getKitchenOrders(restaurantId);
        const totalRevenue = orders.reduce((sum, order) => {
            if (order.orderStatus !== "CANCELLED") {
                return sum + order.orderTotal;
            }
            return sum;
        }, 0);

        res.status(HttpCode.OK).json({
            period: period || "all",
            totalRevenue: totalRevenue,
            ordersCount: orders.length,
        });
    } catch (err) {
        console.log("Error, getRevenue:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get popular items
 * Requires: JWT authentication + OWNER role
 */
adminController.getPopularItems = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getPopularItems");
        const limit = Number(req.query.limit) || 10;

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        // Get all products
        const products = await productService.getAllProduct();

        // For now, return all products
        // TODO: Implement popularity calculation based on order history
        res.status(HttpCode.OK).json({
            items: products.slice(0, limit),
            count: products.length,
        });
    } catch (err) {
        console.log("Error, getPopularItems:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get all tables
 * Requires: JWT authentication + OWNER role
 */
adminController.getTables = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getAdminTables");

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const result = await tableService.getAllTables(restaurantId);

        res.status(HttpCode.OK).json({
            tables: result,
            count: result.length,
        });
    } catch (err) {
        console.log("Error, getAdminTables:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Create new table
 * Requires: JWT authentication + OWNER role
 */
adminController.createTable = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("createTable");

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const input: TableInput = {
            tableNumber: req.body.tableNumber,
            restaurantId: restaurantId,
            capacity: req.body.capacity,
            location: req.body.location,
        };

        if (!input.tableNumber) {
            throw new Errors(HttpCode.BAD_REQUEST, Errors.standard.message);
        }

        const result = await tableService.createTable(input);

        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createTable:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Update table
 * Requires: JWT authentication + OWNER role
 */
adminController.updateTable = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("updateTable");
        const { id } = req.params;
        const input: TableUpdateInput = {
            capacity: req.body.capacity,
            location: req.body.location,
            status: req.body.status,
        };

        const result = await tableService.updateTable(id, input);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateTable:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get all staff members
 * Requires: JWT authentication + OWNER role
 */
adminController.getStaff = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getStaff");

        // Get all staff members (non-owner)
        const result = await memberService.getUsers();

        res.status(HttpCode.OK).json({
            staff: result,
            count: result.length,
        });
    } catch (err) {
        console.log("Error, getStaff:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Create staff member
 * Requires: JWT authentication + OWNER role
 */
adminController.createStaff = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("createStaff");

        const input: MemberInput = {
            memberName: req.body.memberName,
            memberPhone: req.body.memberPhone,
            memberPassword: req.body.memberPassword,
            memberRole: req.body.memberRole || MemberRole.STAFF,
        };

        if (!input.memberName || !input.memberPhone || !input.memberPassword) {
            throw new Errors(HttpCode.BAD_REQUEST, Errors.standard.message);
        }

        // Validate role (must be STAFF, CHEFF, or SERVICE)
        if (input.memberRole === MemberRole.OWNER || input.memberRole === MemberRole.SUPERADMIN) {
            throw new Errors(HttpCode.BAD_REQUEST, Errors.standard.message);
        }

        const result = await memberService.signup(input);

        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createStaff:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Update staff member
 * Requires: JWT authentication + OWNER role
 */
adminController.updateStaff = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("updateStaff");
        const { id } = req.params;
        const input: MemberUpdateInput = {
            _id: id as any,
            memberStatus: req.body.memberStatus,
            memberName: req.body.memberName,
            memberPhone: req.body.memberPhone,
        };

        const result = await memberService.updateChosenUser(input);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateStaff:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default adminController;


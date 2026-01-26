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
import { MemberRole, MemberStatus } from "../libs/enums/member.enum";
import { OrderAdminInquiry } from "../libs/types/order";
import { OrderStatus } from "../libs/enums/order.enum";
import { TableStatus } from "../libs/enums/table.enum";

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
            return sum + order.orderTotal;
        }, 0);

        // Get daily sales statistics
        const dailyStats = await orderService.getDailyStatistics(restaurantId);

        // Get all tables
        const tables = await tableService.getAllTables(restaurantId);
        const availableTables = tables.filter(t => t.status === TableStatus.AVAILABLE).length;
        const occupiedTables = tables.filter(t => t.status === TableStatus.OCCUPIED).length;
        const pausedTables = tables.filter(t => t.status === TableStatus.PAUSE).length;

        res.status(HttpCode.OK).json({
            today: {
                ordersCount: todayOrders.length,
                revenue: todayRevenue,
            },
            statistics: {
                dailyRevenue: dailyStats.dailyRevenue,
                totalProductsSold: dailyStats.totalProductsSold,
                dishItemsSold: dailyStats.dishItemsSold,
                saladItemsSold: dailyStats.saladItemsSold,
                dessertItemsSold: dailyStats.dessertItemsSold,
                drinkItemsSold: dailyStats.drinkItemsSold,
            },
            tables: {
                total: tables.length,
                available: availableTables,
                occupied: occupiedTables,
                paused: pausedTables,
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
            return sum + order.orderTotal;
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
 * Get weekly sales statistics
 * Requires: JWT authentication + OWNER role
 */
adminController.getWeeklyStatistics = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getWeeklyStatistics");

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const result = await orderService.getWeeklyStatistics(restaurantId);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getWeeklyStatistics:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get monthly sales statistics
 * Requires: JWT authentication + OWNER role
 */
adminController.getMonthlyStatistics = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getMonthlyStatistics");

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const result = await orderService.getMonthlyStatistics(restaurantId);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getMonthlyStatistics:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get weekly daily breakdown - products sold per day of the week
 * Requires: JWT authentication + OWNER role
 */
adminController.getWeeklyDailyBreakdown = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getWeeklyDailyBreakdown");

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const result = await orderService.getWeeklyDailyBreakdown(restaurantId);

        res.status(HttpCode.OK).json({
            breakdown: result,
        });
    } catch (err) {
        console.log("Error, getWeeklyDailyBreakdown:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get monthly daily breakdown - products sold per day of the month
 * Requires: JWT authentication + OWNER role
 */
adminController.getMonthlyDailyBreakdown = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getMonthlyDailyBreakdown");

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const result = await orderService.getMonthlyDailyBreakdown(restaurantId);

        res.status(HttpCode.OK).json({
            breakdown: result,
        });
    } catch (err) {
        console.log("Error, getMonthlyDailyBreakdown:", err);
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
 * Delete table
 * Requires: JWT authentication + OWNER role
 */
adminController.deleteTable = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("deleteTable");
        const { id } = req.params;

        const result = await tableService.deleteTable(id);

        res.status(HttpCode.OK).json({
            message: "Table deleted successfully",
            data: result
        });
    } catch (err) {
        console.log("Error, deleteTable:", err);
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
            memberPassword: req.body.memberPassword,
            memberRole: req.body.memberRole || MemberRole.STAFF,
            memberStatus: MemberStatus.ACTIVE,
            restaurantId: req.member._id, // Owner's _id is the restaurantId
        };

        if (!input.memberName || !input.memberPassword) {
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

        // Get the member first to pass to updateMember
        const member = await memberService.getMemberById(id);

        const input: MemberUpdateInput = {
            _id: id as any,
            memberStatus: req.body.memberStatus,
            memberName: req.body.memberName,
        };

        const result = await memberService.updateMember(member, input);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateStaff:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get all orders with filtering
 * Requires: JWT authentication + OWNER role
 * Query params: page, limit, orderStatus, tableNumber, startDate, endDate, search
 */
adminController.getAllOrders = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getAllOrders");

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        // Parse query parameters
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const inquiry: OrderAdminInquiry = {
            page: page > 0 ? page : 1,
            limit: limit > 0 && limit <= 100 ? limit : 20,
        };

        // Filter by order status
        if (req.query.orderStatus) {
            const status = req.query.orderStatus as string;
            if (Object.values(OrderStatus).includes(status as OrderStatus)) {
                inquiry.orderStatus = status as OrderStatus;
            }
        }

        // Filter by table number
        if (req.query.tableNumber) {
            inquiry.tableNumber = Number(req.query.tableNumber);
        }

        // Filter by date range
        if (req.query.startDate) {
            inquiry.startDate = req.query.startDate as string;
        }
        if (req.query.endDate) {
            inquiry.endDate = req.query.endDate as string;
        }

        // Search by order number
        if (req.query.search) {
            inquiry.search = req.query.search as string;
        }

        const result = await orderService.getAllOrdersByAdmin(restaurantId, inquiry);

        res.status(HttpCode.OK).json({
            orders: result.orders,
            total: result.total,
            page: inquiry.page,
            limit: inquiry.limit,
            totalPages: Math.ceil(result.total / inquiry.limit),
        });
    } catch (err) {
        console.log("Error, getAllOrders:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get order detail by ID
 * Requires: JWT authentication + OWNER role
 */
adminController.getOrderDetail = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getOrderDetail");
        const { id } = req.params;

        // Get restaurant owner (restaurantId)
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const result = await orderService.getOrderDetailByAdmin(restaurantId, id);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getOrderDetail:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default adminController;


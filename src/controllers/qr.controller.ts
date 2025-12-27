import { Request, Response } from "express";
import { T } from "../libs/types/common";
import Errors, { HttpCode } from "../libs/Errors";
import TableService from "../models/Table.service";
import ProductService from "../models/Product.service";
import OrderService from "../models/Order.service";
import { OrderCreateInput, Order } from "../libs/types/order";
import { ProductInquiry } from "../libs/types/product";

const tableService = new TableService();
const productService = new ProductService();
const orderService = new OrderService();

const qrController: T = {};

/**
 * Get menu for specific table's restaurant
 * Public endpoint - no authentication required
 */
qrController.getMenu = async (req: Request, res: Response) => {
    try {
        const { tableId } = req.params;

        // Get table info
        const table = await tableService.getTableById(tableId);

        // Check if table is available or has active order
        const activeOrder = await orderService.getOrderByTable(tableId);

        // Get menu products for restaurant
        const inquiry: ProductInquiry = {
            page: 1,
            limit: 1000, // Get all products
            order: "createdAt", // Sort by creation date (descending by default)
        };

        const products = await productService.getProducts(inquiry);

        // Return menu with table info
        res.status(HttpCode.OK).json({
            table: {
                tableId: table._id,
                tableNumber: table.tableNumber,
                status: table.status,
                hasActiveOrder: !!activeOrder,
                activeOrder: activeOrder ? {
                    orderId: activeOrder._id,
                    orderNumber: activeOrder.orderNumber,
                    orderStatus: activeOrder.orderStatus,
                } : null,
            },
            restaurant: {
                restaurantId: table.restaurantId,
            },
            menu: products,
        });
    } catch (err) {
        console.log("Error, getMenu:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Create order for table
 * Public endpoint - no authentication required
 */
qrController.createOrder = async (req: Request, res: Response) => {
    try {
        const { tableId } = req.params;
        const input: OrderCreateInput = {
            tableId: tableId,
            items: req.body.items || [],
            existingOrderId: req.body.existingOrderId,
            isAddingToExisting: req.body.isAddingToExisting || false,
        };

        // Validate items
        if (!input.items || input.items.length === 0) {
            throw new Errors(HttpCode.BAD_REQUEST, Errors.standard.message);
        }

        // If customer explicitly says "no" (not adding to existing when asked)
        if (input.existingOrderId && !input.isAddingToExisting) {
            return res.status(HttpCode.BAD_REQUEST).json({
                error: true,
                message: "Please ask staff to complete table order",
            });
        }

        const result = await orderService.createQROrder(input);

        // Check if confirmation is needed
        if (result && 'needsConfirmation' in result && result.needsConfirmation) {
            return res.status(HttpCode.OK).json({
                needsConfirmation: true,
                message: "Is this your order?",
                existingOrder: {
                    orderId: result.existingOrder._id,
                    orderNumber: result.existingOrder.orderNumber,
                    orderStatus: result.existingOrder.orderStatus,
                    orderTotal: result.existingOrder.orderTotal,
                    items: result.existingOrder.orderItems,
                },
            });
        }

        // Normal order creation or adding to existing
        const order = result as Order;
        res.status(HttpCode.CREATED).json({
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderTotal: order.orderTotal,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            tableNumber: order.tableNumber,
            items: order.orderItems,
        });
    } catch (err) {
        console.log("Error, createOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get order status
 * Public endpoint - no authentication required
 */
qrController.getOrderStatus = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        const result = await orderService.getOrderStatus(orderId);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getOrderStatus:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Get full order details (for tracking)
 * Public endpoint - no authentication required
 */
qrController.getOrderDetails = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        const result = await orderService.getOrderById(orderId);

        res.status(HttpCode.OK).json({
            orderId: result._id,
            orderNumber: result.orderNumber,
            orderStatus: result.orderStatus,
            paymentStatus: result.paymentStatus,
            orderTotal: result.orderTotal,
            tableNumber: result.tableNumber,
            items: result.orderItems,
            products: result.productData,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        });
    } catch (err) {
        console.log("Error, getOrderDetails:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default qrController;


import { Request, Response } from "express";
import { T } from "../libs/types/common";
import Errors, { HttpCode, Message } from "../libs/Errors";
import TableService from "../models/Table.service";
import ProductService from "../models/Product.service";
import OrderService from "../models/Order.service";
import AuthService from "../models/Auth.service";
import { OrderCreateInput, Order } from "../libs/types/order";
import { ProductInquiry } from "../libs/types/product";

const tableService = new TableService();
const productService = new ProductService();
const orderService = new OrderService();
const authService = new AuthService();

const qrController: T = {};

/**
 * Get menu for specific table's restaurant
 * Public endpoint - no authentication required
 * Query param: isCustomerOrder (true/false) - customer's response to confirmation
 */
qrController.getMenu = async (req: Request, res: Response) => {
    try {
        const { tableId } = req.params;
        const { isCustomerOrder } = req.query;

        // Checking token from headers or query
        let token = req.headers.authorization?.split(" ")[1] || req.query.orderToken as string;

        // If valid token exists for this table, allow access immediately
        if (token) {
            const tokenData = await authService.verifyOrderToken(token);
            if (tokenData && tokenData.tableId === tableId) {
                // Valid session - return menu directly
                const inquiry: ProductInquiry = {
                    page: 1,
                    limit: 1000,
                    order: "createdAt",
                };
                const products = await productService.getProducts(inquiry);
                return res.status(HttpCode.OK).json({ menu: products, accessToken: token });
            }
            // Invalid token? Continue to normal checks
        }

        // Get table info
        const table = await tableService.getTableById(tableId);

        // Check if there's an active order on this table
        const existingOrder = await orderService.getOrderByTable(tableId);

        // If active order exists
        if (existingOrder) {
            // Check if customer wants to skip confirmation (already confirmed before)
            const skipConfirmation = req.query.skipConfirmation === "true";

            // Check if order was created recently (within last 1 minute)
            // If yes, assume it's the same customer and skip confirmation
            const orderCreatedAt = new Date(existingOrder.createdAt);
            const now = new Date();
            const minutesSinceCreation = (now.getTime() - orderCreatedAt.getTime()) / (1000 * 60);
            const isRecentOrder = minutesSinceCreation < 1; // 1 minute threshold

            // If customer has already responded or wants to skip confirmation
            if (isCustomerOrder !== undefined || skipConfirmation) {
                // Customer said YES - it's their order, or skipConfirmation is true
                if (isCustomerOrder === "true" || skipConfirmation) {
                    // ISSUE NEW TOKEN
                    const newToken = await authService.createOrderToken(tableId);

                    // Get menu products for restaurant
                    const inquiry: ProductInquiry = {
                        page: 1,
                        limit: 1000,
                        order: "createdAt",
                    };

                    const products = await productService.getProducts(inquiry);

                    // Return menu with token
                    return res.status(HttpCode.OK).json({
                        menu: products,
                        accessToken: newToken
                    });
                } else {
                    // Customer said NO - it's not their order
                    // Return warning
                    const existingOrderDetails = await orderService.getOrderById(existingOrder._id.toString());
                    return res.status(HttpCode.OK).json({
                        needsStaffAction: true,
                        needsConfirmation: false,
                        message: "Bu stolda faol zakaz mavjud. Iltimos, xodimdan zakazni yopishni va stolni faollashtirishni so'rang.",
                        existingOrder: {
                            orderId: existingOrderDetails._id,
                            orderNumber: existingOrderDetails.orderNumber,
                            orderStatus: existingOrderDetails.orderStatus,
                            orderTotal: existingOrderDetails.orderTotal,
                            items: existingOrderDetails.orderItems,
                        },
                    });
                }
            }

            // If order was created recently (within 1 minute), skip confirmation
            // Assume it's the same customer continuing to order
            if (isRecentOrder) {
                // ISSUE NEW TOKEN
                const newToken = await authService.createOrderToken(tableId);

                // Get menu products for restaurant directly
                const inquiry: ProductInquiry = {
                    page: 1,
                    limit: 1000,
                    order: "createdAt",
                };

                const products = await productService.getProducts(inquiry);

                // Return menu without confirmation with token
                return res.status(HttpCode.OK).json({
                    menu: products,
                    accessToken: newToken
                });
            }

            // First time - ask customer for confirmation (order is older than 1 minute)
            const existingOrderDetails = await orderService.getOrderById(existingOrder._id.toString());
            return res.status(HttpCode.OK).json({
                needsConfirmation: true,
                hasExistingOrder: true,
                message: "Bu stolda faol zakaz mavjud. Bu zakaz siznikimi?",
                existingOrder: {
                    orderId: existingOrderDetails._id,
                    orderNumber: existingOrderDetails.orderNumber,
                    orderStatus: existingOrderDetails.orderStatus,
                    orderTotal: existingOrderDetails.orderTotal,
                    items: existingOrderDetails.orderItems,
                },
            });
        }

        // No active order exists - clean entry
        // ISSUE NEW TOKEN
        const newToken = await authService.createOrderToken(tableId);

        const inquiry: ProductInquiry = {
            page: 1,
            limit: 1000,
            order: "createdAt",
        };

        const products = await productService.getProducts(inquiry);

        // Return menu with token
        res.status(HttpCode.OK).json({
            menu: products,
            accessToken: newToken
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
 * Security: Rate limiting only
 */
qrController.createOrder = async (req: Request, res: Response) => {
    try {
        const { tableId } = req.params;

        // Optionally verify token if provided, but don't block for now to maintain backward compatibility
        // or enforce it if we want strict security.
        // For now, let's keep it open but we could log or check.
        const token = req.headers.authorization?.split(" ")[1];
        if (token) {
            const tokenData = await authService.verifyOrderToken(token);
            if (!tokenData || tokenData.tableId !== tableId) {
                // Token is invalid or doesn't match the table.
                // Depending on security requirements, this could be an error or just a warning.
                // For stricter security, uncomment the line below:
                // throw new Errors(HttpCode.UNAUTHORIZED, "Invalid or expired order token for this table.");
                console.warn(`Attempted order creation with invalid or mismatched token for table ${tableId}. Token data: ${JSON.stringify(tokenData)}`);
            }
        }

        const input: OrderCreateInput = {
            tableId: tableId,
            items: req.body.items || [],
        };

        // Basic validation - items required
        if (!input.items || input.items.length === 0) {
            throw new Errors(HttpCode.BAD_REQUEST, "Items are required");
        }

        await orderService.createQROrder(input);

        // Return 204 No Content - successful but no response body
        res.status(204).send();
    } catch (err) {
        console.log("Error, createOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default qrController;

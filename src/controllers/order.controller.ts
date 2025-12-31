import { ExtendedRequest } from "../libs/types/member";
import { T } from "../libs/types/common";
import { Response } from "express";
import Errors, { HttpCode } from "../libs/Errors";
import OrderService from "../models/Order.service";
import { OrderStatus } from "../libs/enums/order.enum";
import { OrderInquiry, OrderItemInput } from "../libs/types/order";
import MemberService from "../models/Member.service";

const orderService = new OrderService();
const memberService = new MemberService();

const orderController: T = {};
orderController.createOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        const result = await orderService.createOrder(req.member, req.body);

        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createOrder", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
}


// Kitchen Controllers

orderController.getOrdersByKitchen = async (req: ExtendedRequest, res: Response) => {
    try {
        const restaurant = await memberService.getRestaurant();
        const restaurantId = restaurant._id;

        const result = await orderService.getKitchenOrders(restaurantId);

        res.status(HttpCode.OK).json({
            orders: result,
            count: result.length,
        });
    } catch (err) {
        console.log("Error, getKitchenOrders:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

orderController.getOrderByKitchen = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await orderService.getOrderById(id);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getKitchenOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

orderController.markOrderReadyByKitchen = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await orderService.markOrderAsReady(id, req.member._id);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, markOrderReady:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

orderController.getOrderByStaff = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await orderService.getActiveOrdersByTableWithDetails(id);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getStaffOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

// Staff Order Management (RESTful)

/**
 * Upsert order item (Add or Update)
 * POST /orders/:id/items
 */
orderController.upsertOrderItem = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const item: OrderItemInput = {
            productId: req.body.productId,
            itemQuantity: req.body.itemQuantity,
            itemPrice: req.body.itemPrice,
        };

        if (!item.productId || !item.itemQuantity || !item.itemPrice) {
            throw new Errors(HttpCode.BAD_REQUEST, "productId, itemQuantity, and itemPrice are required");
        }

        const result = await orderService.upsertOrderItem(id, item);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, upsertOrderItem:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Delete order item
 * DELETE /orders/:id/items/:itemId
 */
orderController.deleteOrderItem = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id, itemId } = req.params;

        const result = await orderService.deleteOrderItem(id, itemId);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, deleteOrderItem:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Complete order
 * POST /orders/:id/complete
 */
orderController.completeOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await orderService.completeOrder(id, req.member._id);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, completeOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Cancel order
 * POST /orders/:id/cancel
 */
orderController.cancelOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const reason = req.body.reason;

        const result = await orderService.cancelOrder(id, req.member._id, reason);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, cancelOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default orderController;
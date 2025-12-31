import { ExtendedRequest } from "../libs/types/member";
import { T } from "../libs/types/common";
import { Response } from "express";
import Errors, { HttpCode } from "../libs/Errors";
import OrderService from "../models/Order.service";
import MemberService from "../models/Member.service";

const orderService = new OrderService();
const memberService = new MemberService();

const kitchenController: T = {};

/**
 * Get all active orders for kitchen
 * Requires: JWT authentication + KITCHEN role
 */
kitchenController.getOrders = async (req: ExtendedRequest, res: Response) => {
    try {
        // Get restaurant owner (restaurantId)
        // For now, get the restaurant owner member
        // TODO: Update when Member schema has restaurantId field for staff
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

/**
 * Get specific order details
 * Requires: JWT authentication + KITCHEN role
 */
kitchenController.getOrder = async (req: ExtendedRequest, res: Response) => {
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

/**
 * Mark order as READY
 * Requires: JWT authentication + KITCHEN role
 */
kitchenController.markOrderReady = async (req: ExtendedRequest, res: Response) => {
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

export default kitchenController;


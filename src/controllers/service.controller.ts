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
    OrderModifyItemsInput,
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

        const result = await orderService.getServiceOrders(restaurantId);

        res.status(HttpCode.OK).json({
            orders: result,
            count: result.length,
        });
    } catch (err) {
        console.log("Error, getServiceOrders:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Verify payment for order
 * Requires: JWT authentication + SERVICE/OWNER role
 */
serviceController.verifyPayment = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const input: PaymentVerificationInput = {
            orderId: id,
            paymentMethod: req.body.paymentMethod,
            paymentProof: req.body.paymentProof,
        };

        if (!input.paymentMethod) {
            throw new Errors(HttpCode.BAD_REQUEST, Errors.standard.message);
        }

        const result = await orderService.verifyPayment(
            id,
            req.member._id,
            input
        );

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, verifyPayment:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Complete order
 * Requires: JWT authentication + SERVICE/OWNER role
 */
serviceController.completeOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const input: OrderCompleteInput = {
            orderId: id,
        };

        const result = await orderService.completeOrder(
            id,
            req.member._id
        );

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, completeOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Cancel order
 * Requires: JWT authentication + SERVICE/OWNER role
 */
serviceController.cancelOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const input: OrderCancelInput = {
            orderId: id,
            reason: req.body.reason,
        };

        const result = await orderService.cancelOrder(
            id,
            req.member._id,
            input
        );

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, cancelOrder:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Modify order items
 * Requires: JWT authentication + SERVICE/OWNER role
 */
serviceController.modifyOrderItems = async (req: ExtendedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const input: OrderModifyItemsInput = {
            orderId: id,
            items: req.body.items || [],
        };

        if (!input.items || input.items.length === 0) {
            throw new Errors(HttpCode.BAD_REQUEST, Errors.standard.message);
        }

        const result = await orderService.modifyOrderItems(
            id,
            req.member._id,
            input
        );

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, modifyOrderItems:", err);
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

export default serviceController;



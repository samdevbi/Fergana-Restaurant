import { ExtendedRequest } from "../libs/types/member";
import { T } from "../libs/types/common";
import { Response } from "express";
import Errors, { HttpCode } from "../libs/Errors";
import OrderService from "../models/Order.service";
import { OrderStatus } from "../libs/enums/order.enum";
import { OrderInquiry, OrderUpdateInput } from "../libs/types/order";
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

orderController.updateOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        const input: OrderUpdateInput = req.body;

        const result = await orderService.updateOrder(req.member, input);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateOrder", err);
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

export default orderController;
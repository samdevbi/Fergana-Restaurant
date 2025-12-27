import {
  Order,
  OrderInquiry,
  OrderItemInput,
  OrderUpdateInput,
  OrderCreateInput,
  PaymentVerificationInput,
  OrderCompleteInput,
  OrderCancelInput,
  OrderModifyItemsInput,
  OrderConfirmationResponse,
} from "../libs/types/order";
import { Member } from "../libs/types/member";
import OrderModel from "../schema/Order.model";
import OrderItemModel from "../schema/OrderItem.model";
import { shapeIntoMongooseObjectId } from "../libs/config";
import Errors, { Message } from "../libs/Errors";
import { HttpCode } from "../libs/Errors";
import { ObjectId } from "mongoose";
import { OrderStatus, PaymentStatus, OrderType } from "../libs/enums/order.enum";
import MemberService from "./Member.service";
import TableService from "./Table.service";
import {
  emitOrderUpdate,
  notifyKitchen,
  notifyServiceStaff,
  notifyCustomer,
  emitTableUpdate,
  emitOrderStatusChange,
} from "../libs/websocket/socket.handler";
import { TableStatus } from "../libs/enums/table.enum";

class OrderService {
  private readonly orderModel;
  private readonly orderItemModel;
  private readonly memberService;
  private readonly tableService;

  constructor() {
    this.orderModel = OrderModel;
    this.orderItemModel = OrderItemModel;
    this.memberService = new MemberService();
    this.tableService = new TableService();
  }

  public async createOrder(
    member: Member,
    input: OrderItemInput[]
  ): Promise<Order> {
    const memberId = shapeIntoMongooseObjectId(member._id);
    const amount = input.reduce((accumlator: number, item: OrderItemInput) => {
      return accumlator + item.itemPrice * item.itemQuantity;
    }, 0);
    const delivery = amount < 100 ? 5 : 0;

    try {
      const newOrder: Order = await this.orderModel.create({
        orderTotal: amount + delivery,
        orderDelivery: delivery,
        memberId: memberId,
      });
      const orderId = newOrder._id;
      await this.recordOrderItem(orderId, input);

      return newOrder;
    } catch (err) {
      console.log("Error, model: createOrder");
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  }

  private async recordOrderItem(orderId: ObjectId, input: OrderItemInput[]): Promise<void> {
    const promisedlist = input.map(async (item: OrderItemInput) => {
      item.orderId = orderId;
      item.productId = shapeIntoMongooseObjectId(item.productId);
      await this.orderItemModel.create(item);
      return "INSERTED";
    });

    await Promise.all(promisedlist);
  }

  public async getMyOrders(
    member: Member,
    inquery: OrderInquiry
  ): Promise<Order[]> {
    const memberId = shapeIntoMongooseObjectId(member._id);
    const matches: any = { memberId: memberId };
    if (inquery.orderStatus) {
      matches.orderStatus = inquery.orderStatus;
    }

    const result = await this.orderModel
      .aggregate([
        { $match: matches },
        { $sort: { updatedAt: -1 } },
        { $skip: (inquery.page - 1) * inquery.limit },
        { $limit: inquery.limit },
        {
          $lookup: {
            from: "orderItems",
            localField: "_id",
            foreignField: "orderId",
            as: "orderItems",
          },
        },

        {
          $lookup: {
            from: "products",
            localField: "orderItems.productId",
            foreignField: "_id",
            as: "productData",
          },
        },
      ])
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return result;
  }

  public async updateOrder(
    member: Member,
    input: OrderUpdateInput
  ): Promise<Order> {
    const memberId = shapeIntoMongooseObjectId(member._id);
    const orderId = shapeIntoMongooseObjectId(input.orderId);
    const orderStatus = input.orderStatus;

    const result = await this.orderModel.findOneAndUpdate(
      {
        memberId: memberId,
        _id: orderId,
      },
      { orderStatus: orderStatus },
      { new: true }
    ).exec();

    if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);

    return result;
  }

  // QR Order Methods

  public async createQROrder(input: OrderCreateInput): Promise<Order | OrderConfirmationResponse> {
    const tableId = shapeIntoMongooseObjectId(input.tableId);

    // Get table info
    const table = await this.tableService.getTableById(tableId);
    const restaurantId = table.restaurantId;

    // Check if there's an existing active order on this table
    const existingOrder = await this.getOrderByTable(tableId);

    // If adding to existing order
    if (input.isAddingToExisting && input.existingOrderId) {
      const existingOrderId = shapeIntoMongooseObjectId(input.existingOrderId);
      const order = await this.orderModel.findById(existingOrderId).exec();
      
      if (!order || order.tableId.toString() !== tableId.toString()) {
        throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
      }

      // Add items to existing order
      await this.recordOrderItem(existingOrderId, input.items);

      // Recalculate total
      const existingItems = await this.orderItemModel.find({ orderId: existingOrderId }).exec();
      const newAmount = existingItems.reduce((sum, item) => sum + item.itemPrice * item.itemQuantity, 0);

      const updatedOrder = await this.orderModel.findByIdAndUpdate(
        existingOrderId,
        { orderTotal: newAmount },
        { new: true }
      ).exec();

      const fullOrder = await this.getOrderById(existingOrderId.toString());

      // Emit WebSocket events
      // Notify customer
      emitOrderUpdate(existingOrderId.toString(), "order:item-added", {
        orderId: existingOrderId.toString(),
        newItems: input.items,
      });

      // Notify kitchen if order is confirmed or preparing
      if (order.orderStatus === OrderStatus.CONFIRMED || order.orderStatus === OrderStatus.PREPARING) {
        notifyKitchen(order.restaurantId, {
          _id: existingOrderId.toString(),
          orderNumber: fullOrder.orderNumber,
          tableNumber: fullOrder.tableNumber,
          newItems: input.items,
          updatedOrder: fullOrder,
          event: "order:items-added",
        });
      }

      // Notify service staff
      notifyServiceStaff(order.restaurantId, "order:items-added", {
        orderId: existingOrderId.toString(),
        orderNumber: fullOrder.orderNumber,
        tableNumber: fullOrder.tableNumber,
        newItems: input.items,
        updatedTotal: fullOrder.orderTotal,
      });

      return fullOrder;
    }

    // If table has active order and customer didn't confirm, ask for confirmation
    if (existingOrder && !input.isAddingToExisting) {
      const existingOrderDetails = await this.getOrderById(existingOrder._id.toString());
      return {
        needsConfirmation: true,
        existingOrder: existingOrderDetails,
      };
    }

    // Calculate order total
    const amount = input.items.reduce((accumulator: number, item: OrderItemInput) => {
      return accumulator + item.itemPrice * item.itemQuantity;
    }, 0);
    const delivery = 0; // No delivery fee for dine-in QR orders

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      const newOrder: Order = await this.orderModel.create({
        orderNumber: orderNumber,
        restaurantId: restaurantId,
        tableId: tableId,
        tableNumber: table.tableNumber,
        orderTotal: amount + delivery,
        orderDelivery: delivery,
        orderStatus: OrderStatus.PENDING,
        orderType: OrderType.QR_ORDER,
        paymentStatus: PaymentStatus.PENDING,
        memberId: null, // Anonymous order
      });

      const orderId = newOrder._id;

      // Record order items
      await this.recordOrderItem(orderId, input.items);

      // Update table status (allow multiple orders, just mark as occupied if first order)
      if (!existingOrder) {
        await this.tableService.occupyTable(tableId, orderId);
      }

      // Get full order with items
      const fullOrder = await this.getOrderById(orderId.toString());

      // Emit WebSocket events
      notifyCustomer(orderId.toString(), "order:created", {
        orderId: orderId.toString(),
        orderNumber: fullOrder.orderNumber,
        orderStatus: fullOrder.orderStatus,
      });
      notifyServiceStaff(restaurantId.toString(), "payment:needs-verification", fullOrder);
      emitTableUpdate(tableId, TableStatus.OCCUPIED, orderId);

      return fullOrder;
    } catch (err) {
      console.log("Error, model: createQROrder", err);
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  }

  public async verifyPayment(
    orderId: string,
    staffId: ObjectId,
    input: PaymentVerificationInput
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);
    const staffIdObj = shapeIntoMongooseObjectId(staffId);

    // Check order exists and is pending payment
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }

    // Update payment status and order status
    const result = await this.orderModel.findByIdAndUpdate(
      id,
      {
        paymentStatus: PaymentStatus.VERIFIED,
        orderStatus: OrderStatus.CONFIRMED,
        paymentMethod: input.paymentMethod,
        verifiedBy: staffIdObj,
        verifiedAt: new Date(),
      },
      { new: true }
    ).exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
    }

    // Emit WebSocket events
    emitOrderStatusChange(
      id,
      OrderStatus.CONFIRMED,
      PaymentStatus.VERIFIED,
      order.restaurantId,
      order.tableId
    );
    notifyKitchen(order.restaurantId, result);

    return result;
  }

  public async completeOrder(
    orderId: string,
    staffId: ObjectId
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);
    const staffIdObj = shapeIntoMongooseObjectId(staffId);

    // Get order to find tableId
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    // Update order status
    const result = await this.orderModel.findByIdAndUpdate(
      id,
      {
        orderStatus: OrderStatus.COMPLETED,
        completedBy: staffIdObj,
        completedAt: new Date(),
      },
      { new: true }
    ).exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
    }

    // Free table
    await this.tableService.freeTable(order.tableId);

    // Emit WebSocket events
    notifyCustomer(id, "order:completed", {
      orderId: id,
      orderStatus: OrderStatus.COMPLETED,
    });
    emitTableUpdate(order.tableId, TableStatus.AVAILABLE);

    return result;
  }

  public async cancelOrder(
    orderId: string,
    staffId: ObjectId,
    input: OrderCancelInput
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);
    const staffIdObj = shapeIntoMongooseObjectId(staffId);

    // Get order to find tableId
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    // Check if order can be cancelled
    if (order.orderStatus === OrderStatus.COMPLETED) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }

    // Update order status
    const result = await this.orderModel.findByIdAndUpdate(
      id,
      {
        orderStatus: OrderStatus.CANCELLED,
        cancellationReason: input.reason || "Cancelled by staff",
      },
      { new: true }
    ).exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
    }

    // Free table
    await this.tableService.freeTable(order.tableId);

    // Emit WebSocket events
    notifyCustomer(id, "order:cancelled", {
      orderId: id,
      orderStatus: OrderStatus.CANCELLED,
      reason: input.reason,
    });
    emitTableUpdate(order.tableId, TableStatus.AVAILABLE);

    return result;
  }

  public async modifyOrderItems(
    orderId: string,
    staffId: ObjectId,
    input: OrderModifyItemsInput
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);

    // Check order exists and can be modified
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    // Can only modify if PENDING or CONFIRMED
    if (order.orderStatus !== OrderStatus.PENDING && order.orderStatus !== OrderStatus.CONFIRMED) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }

    // Delete existing order items
    await this.orderItemModel.deleteMany({ orderId: id }).exec();

    // Create new order items
    await this.recordOrderItem(id, input.items);

    // Recalculate total
    const amount = input.items.reduce((accumulator: number, item: OrderItemInput) => {
      return accumulator + item.itemPrice * item.itemQuantity;
    }, 0);

    // Update order total
    const result = await this.orderModel.findByIdAndUpdate(
      id,
      {
        orderTotal: amount + order.orderDelivery,
      },
      { new: true }
    ).exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
    }

    // Emit WebSocket event
    emitOrderUpdate(id, "order:item-modified", {
      orderId: id,
      items: input.items,
    });

    return result;
  }

  public async getKitchenOrders(restaurantId: ObjectId | string): Promise<Order[]> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    const result = await this.orderModel
      .aggregate([
        {
          $match: {
            restaurantId: id,
            orderStatus: {
              $in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING]
            }
          }
        },
        { $sort: { createdAt: 1 } }, // Oldest first
        {
          $lookup: {
            from: "orderItems",
            localField: "_id",
            foreignField: "orderId",
            as: "orderItems",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "orderItems.productId",
            foreignField: "_id",
            as: "productData",
          },
        },
      ])
      .exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    return result;
  }

  public async getServiceOrders(restaurantId: ObjectId | string): Promise<Order[]> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    const result = await this.orderModel
      .aggregate([
        {
          $match: {
            restaurantId: id,
            $or: [
              { orderStatus: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING },
              { orderStatus: OrderStatus.READY }
            ]
          }
        },
        { $sort: { createdAt: 1 } }, // Oldest first
        {
          $lookup: {
            from: "orderItems",
            localField: "_id",
            foreignField: "orderId",
            as: "orderItems",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "orderItems.productId",
            foreignField: "_id",
            as: "productData",
          },
        },
      ])
      .exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    return result;
  }

  public async getOrderByTable(tableId: ObjectId | string): Promise<Order | null> {
    const id = shapeIntoMongooseObjectId(tableId);

    const result = await this.orderModel
      .findOne({
        tableId: id,
        orderStatus: {
          $nin: [OrderStatus.COMPLETED, OrderStatus.CANCELLED]
        }
      })
      .sort({ createdAt: -1 }) // Get most recent order
      .exec();

    return result;
  }

  public async getActiveOrdersByTable(tableId: ObjectId | string): Promise<Order[]> {
    const id = shapeIntoMongooseObjectId(tableId);

    const result = await this.orderModel
      .find({
        tableId: id,
        orderStatus: {
          $nin: [OrderStatus.COMPLETED, OrderStatus.CANCELLED]
        }
      })
      .sort({ createdAt: -1 })
      .exec();

    return result;
  }

  public async getOrderById(orderId: string): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);

    const result = await this.orderModel
      .aggregate([
        { $match: { _id: id } },
        {
          $lookup: {
            from: "orderItems",
            localField: "_id",
            foreignField: "orderId",
            as: "orderItems",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "orderItems.productId",
            foreignField: "_id",
            as: "productData",
          },
        },
      ])
      .exec();

    if (!result || result.length === 0) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    return result[0];
  }

  public async getOrderStatus(orderId: string): Promise<{ orderStatus: OrderStatus; paymentStatus: PaymentStatus; orderNumber: string }> {
    const id = shapeIntoMongooseObjectId(orderId);

    const order = await this.orderModel.findById(id)
      .select("orderStatus paymentStatus orderNumber")
      .exec();

    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    return {
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      orderNumber: order.orderNumber,
    };
  }
}

export default OrderService;
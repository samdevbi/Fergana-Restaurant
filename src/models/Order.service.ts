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

  /**
   * Generate daily order number for restaurant
   * Format: ORD-{dailyCount}
   * Example: ORD-1, ORD-2, ORD-3, etc.
   * Resets to 1 each new day
   * Handles race conditions with retry mechanism
   */
  private async generateDailyOrderNumber(restaurantId: ObjectId | string, maxRetries: number = 5): Promise<string> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Count orders created today for this restaurant
      const todayOrdersCount = await this.orderModel.countDocuments({
        restaurantId: id,
        createdAt: {
          $gte: today,
          $lt: tomorrow,
        },
      }).exec();

      // Next order number is count + 1
      const dailyOrderNumber = todayOrdersCount + 1;

      // Format: ORD-{number}
      const orderNumber = `ORD-${dailyOrderNumber}`;

      // Check if this order number already exists for today (race condition check)
      const existingOrder = await this.orderModel.findOne({
        orderNumber,
        restaurantId: id,
        createdAt: {
          $gte: today,
          $lt: tomorrow,
        },
      }).exec();

      if (!existingOrder) {
        return orderNumber;
      }

      // If order number exists, wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
    }

    // If all retries failed, use timestamp as fallback
    return `ORD-${Date.now()}`;
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
    // But allow creating new order if customer wants separate order
    if (existingOrder && !input.isAddingToExisting && !input.existingOrderId) {
      const existingOrderDetails = await this.getOrderById(existingOrder._id.toString());
      return {
        needsConfirmation: true,
        existingOrder: existingOrderDetails,
      };
    }

    // If customer explicitly wants new order (not adding to existing), create it
    // Calculate order total
    const amount = input.items.reduce((accumulator: number, item: OrderItemInput) => {
      return accumulator + item.itemPrice * item.itemQuantity;
    }, 0);
    const delivery = 0; // No delivery fee for dine-in QR orders

    // Generate daily order number
    const orderNumber = await this.generateDailyOrderNumber(restaurantId);

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
      // Check if table is already occupied
      if (table.status !== TableStatus.OCCUPIED) {
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

      // Notify service staff and owner about new order
      notifyServiceStaff(restaurantId.toString(), "order:new", {
        orderId: orderId.toString(),
        orderNumber: fullOrder.orderNumber,
        tableNumber: fullOrder.tableNumber,
        orderStatus: fullOrder.orderStatus,
        paymentStatus: fullOrder.paymentStatus,
        orderTotal: fullOrder.orderTotal,
        items: fullOrder.orderItems,
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

    // Check if there are other active orders on this table
    const activeOrders = await this.getActiveOrdersByTable(order.tableId);

    // Only free table if no other active orders exist
    if (activeOrders.length === 0) {
      await this.tableService.freeTable(order.tableId);
      emitTableUpdate(order.tableId, TableStatus.ACTIVE);
    }

    // Emit WebSocket events
    notifyCustomer(id, "order:completed", {
      orderId: id,
      orderStatus: OrderStatus.COMPLETED,
    });

    // Notify staff and owner about order completion
    emitOrderStatusChange(
      id,
      OrderStatus.COMPLETED,
      order.paymentStatus,
      order.restaurantId,
      order.tableId
    );

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

    // Check if there are other active orders on this table
    const activeOrders = await this.getActiveOrdersByTable(order.tableId);

    // Only free table if no other active orders exist
    if (activeOrders.length === 0) {
      await this.tableService.freeTable(order.tableId);
      emitTableUpdate(order.tableId, TableStatus.ACTIVE);
    }

    // Emit WebSocket events
    notifyCustomer(id, "order:cancelled", {
      orderId: id,
      orderStatus: OrderStatus.CANCELLED,
      reason: input.reason,
    });

    // Notify staff and owner about order cancellation
    emitOrderStatusChange(
      id,
      OrderStatus.CANCELLED,
      order.paymentStatus,
      order.restaurantId,
      order.tableId
    );

    // Also send specific cancellation notification
    notifyServiceStaff(order.restaurantId, "order:cancelled", {
      orderId: id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      orderStatus: OrderStatus.CANCELLED,
      reason: input.reason,
    });

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
        orderTotal: amount + (order.orderDelivery || 0),
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

    // Notify staff and owner about order modification
    notifyServiceStaff(order.restaurantId, "order:modified", {
      orderId: id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      items: input.items,
      newTotal: result.orderTotal,
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

  public async getServiceOrders(restaurantId: ObjectId | string): Promise<any[]> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    // Get all individual orders
    const orders = await this.orderModel
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

    if (!orders || orders.length === 0) {
      return [];
    }

    // Group orders by tableId
    const groupedByTable: { [key: string]: any } = {};

    orders.forEach((order: any) => {
      const tableId = order.tableId.toString();

      if (!groupedByTable[tableId]) {
        // First order for this table - create grouped order
        groupedByTable[tableId] = {
          _id: order.tableId, // Use tableId as identifier
          tableId: order.tableId,
          tableNumber: order.tableNumber,
          restaurantId: order.restaurantId,
          // Combine all orders from this table
          orders: [order],
          // Combined totals
          totalOrders: 1,
          combinedTotal: order.orderTotal,
          // Status info
          hasPendingPayment: order.paymentStatus === PaymentStatus.PENDING,
          hasReadyOrders: order.orderStatus === OrderStatus.READY,
          // Timestamps
          firstOrderAt: order.createdAt,
          lastOrderAt: order.updatedAt,
        };
      } else {
        // Add this order to existing table group
        groupedByTable[tableId].orders.push(order);
        groupedByTable[tableId].totalOrders += 1;
        groupedByTable[tableId].combinedTotal += order.orderTotal;

        // Update flags
        if (order.paymentStatus === PaymentStatus.PENDING) {
          groupedByTable[tableId].hasPendingPayment = true;
        }
        if (order.orderStatus === OrderStatus.READY) {
          groupedByTable[tableId].hasReadyOrders = true;
        }

        // Update timestamps
        if (order.createdAt < groupedByTable[tableId].firstOrderAt) {
          groupedByTable[tableId].firstOrderAt = order.createdAt;
        }
        if (order.updatedAt > groupedByTable[tableId].lastOrderAt) {
          groupedByTable[tableId].lastOrderAt = order.updatedAt;
        }
      }
    });

    // Convert to array and sort by first order time
    const result = Object.values(groupedByTable).sort((a: any, b: any) => {
      return a.firstOrderAt - b.firstOrderAt;
    });

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

  /**
   * Get all orders for a table (order history - including completed/cancelled)
   */
  public async getAllOrdersByTable(tableId: ObjectId | string): Promise<Order[]> {
    const id = shapeIntoMongooseObjectId(tableId);

    const result = await this.orderModel
      .aggregate([
        { $match: { tableId: id } },
        { $sort: { createdAt: -1 } }, // Most recent first
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

    return result;
  }

  /**
   * Get active orders for a table with full details
   */
  public async getActiveOrdersByTableWithDetails(tableId: ObjectId | string): Promise<Order[]> {
    const id = shapeIntoMongooseObjectId(tableId);

    const result = await this.orderModel
      .aggregate([
        {
          $match: {
            tableId: id,
            orderStatus: {
              $nin: [OrderStatus.COMPLETED, OrderStatus.CANCELLED]
            }
          }
        },
        { $sort: { createdAt: -1 } },
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
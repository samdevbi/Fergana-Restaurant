import {
  Order,
  OrderInquiry,
  OrderItemInput,
  OrderUpdateInput,
  OrderCreateInput,
  PaymentVerificationInput,
  OrderCompleteInput,
  OrderCancelInput,
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
  notifyKitchen,
  notifyServiceStaff,
  emitTableUpdate,
  emitOrderStatusChange,
} from "../libs/websocket/socket.handler";
import { TableStatus } from "../libs/enums/table.enum";

class OrderService {
  private readonly orderModel;
  private readonly orderItemModel;
  private readonly memberService;
  private _tableService: TableService | null = null;

  constructor() {
    this.orderModel = OrderModel;
    this.orderItemModel = OrderItemModel;
    this.memberService = new MemberService();
  }

  private get tableService(): TableService {
    if (!this._tableService) {
      const TableServiceClass = require("./Table.service").default;
      this._tableService = new TableServiceClass();
    }
    return this._tableService as TableService;
  }

  public async createOrder(
    member: Member,
    input: OrderItemInput[]
  ): Promise<Order> {
    const memberId = shapeIntoMongooseObjectId(member._id);
    const amount = input.reduce((accumlator: number, item: OrderItemInput) => {
      return accumlator + item.itemPrice * item.itemQuantity;
    }, 0);

    try {
      const newOrder: Order = await this.orderModel.create({
        orderTotal: amount,
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

    if (!input.action) {
      throw new Errors(HttpCode.BAD_REQUEST, "Action is required (update-status, complete, cancel, modify-items)");
    }

    let result: Order;

    switch (input.action) {
      case "update-status":
        if (!input.orderStatus) {
          throw new Errors(HttpCode.BAD_REQUEST, "orderStatus is required for update-status action");
        }

        // For members, only allow updating their own orders
        result = await this.orderModel.findOneAndUpdate(
          {
            memberId: memberId,
            _id: orderId,
          },
          { orderStatus: input.orderStatus },
          { new: true }
        ).exec();

        if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);

        // Emit status change notification
        emitOrderStatusChange(
          orderId,
          input.orderStatus,
          result.paymentStatus,
          result.restaurantId,
          result.tableId
        );

        return result;

      case "complete":
        // Staff can complete any order
        result = await this.completeOrder(orderId.toString(), memberId);
        return result;

      case "cancel":
        // Staff can cancel any order
        const cancelInput: OrderCancelInput = {
          orderId: orderId.toString(),
          reason: input.reason,
        };
        result = await this.cancelOrder(orderId.toString(), memberId, cancelInput);
        return result;

      case "modify-items":
        if (!input.items || input.items.length === 0) {
          throw new Errors(HttpCode.BAD_REQUEST, "items are required for modify-items action");
        }

        // Check order exists and can be modified
        const modifyOrder = await this.orderModel.findById(orderId).exec();
        if (!modifyOrder) {
          throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        }

        // Can only modify if PROCESS
        if (modifyOrder.orderStatus !== OrderStatus.PROCESS) {
          throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
        }

        // Get existing order items to calculate current total
        const existingItems = await this.orderItemModel.find({ orderId: orderId }).exec();
        const existingTotal = existingItems.reduce((sum, item) => sum + item.itemPrice * item.itemQuantity, 0);

        // Add new items to existing order
        await this.recordOrderItem(orderId, input.items);

        // Calculate new items total
        const newItemsTotal = input.items.reduce((accumulator: number, item: OrderItemInput) => {
          return accumulator + item.itemPrice * item.itemQuantity;
        }, 0);

        // Calculate total: existing items + new items
        const newTotal = existingTotal + newItemsTotal;

        // Update order total
        result = await this.orderModel.findByIdAndUpdate(
          orderId,
          {
            orderTotal: newTotal,
          },
          { new: true }
        ).exec();

        if (!result) {
          throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
        }

        // Get full order with all items
        const fullOrder = await this.getOrderById(orderId.toString());

        // Notify kitchen if order is in process
        if (modifyOrder.orderStatus === OrderStatus.PROCESS) {
          notifyKitchen(modifyOrder.restaurantId, {
            _id: orderId.toString(),
            orderNumber: fullOrder.orderNumber,
            tableNumber: fullOrder.tableNumber,
            newItems: input.items,
            updatedOrder: fullOrder,
            event: "order:items-added",
          });
        }

        // Notify service staff and owner about order modification
        notifyServiceStaff(modifyOrder.restaurantId.toString(), "order:items-added", {
          orderId: orderId.toString(),
          orderNumber: modifyOrder.orderNumber,
          tableNumber: modifyOrder.tableNumber,
          newItems: input.items,
          updatedTotal: result.orderTotal,
        });

        return fullOrder;

      default:
        throw new Errors(HttpCode.BAD_REQUEST, `Invalid action: ${input.action}. Use: update-status, complete, cancel, modify-items`);
    }
  }

  // QR Order Methods

  public async createQROrder(input: OrderCreateInput): Promise<Order> {
    const tableId = shapeIntoMongooseObjectId(input.tableId);

    // Get table info
    const table = await this.tableService.getTableById(tableId);
    const restaurantId = table.restaurantId;

    // Check if there's an existing active order on this table
    const existingOrder = await this.getOrderByTable(tableId);

    // Calculate order total
    const amount = input.items.reduce((accumulator: number, item: OrderItemInput) => {
      return accumulator + item.itemPrice * item.itemQuantity;
    }, 0);

    // Generate daily order number
    const orderNumber = await this.generateDailyOrderNumber(restaurantId);

    try {
      // Create NEW order for kitchen (always create new order)
      const newOrder: Order = await this.orderModel.create({
        orderNumber: orderNumber,
        restaurantId: restaurantId,
        tableId: tableId,
        tableNumber: table.tableNumber,
        orderTotal: amount,
        orderStatus: OrderStatus.PROCESS,
        orderType: OrderType.QR_ORDER,
        paymentStatus: PaymentStatus.PENDING,
        memberId: null, // Anonymous order
      });

      const newOrderId = newOrder._id;

      // Record order items for new order (kitchen will see this)
      await this.recordOrderItem(newOrderId, input.items);

      // If there's an existing active order, add items to it for staff/owner
      if (existingOrder) {
        // Add items to existing order (for staff/owner view)
        await this.recordOrderItem(existingOrder._id, input.items);

        // Recalculate existing order total
        const existingItems = await this.orderItemModel.find({ orderId: existingOrder._id }).exec();
        const newTotal = existingItems.reduce((sum, item) => sum + item.itemPrice * item.itemQuantity, 0);

        // Update existing order total
        await this.orderModel.findByIdAndUpdate(
          existingOrder._id,
          { orderTotal: newTotal },
          { new: true }
        ).exec();

        // Get updated existing order
        const updatedExistingOrder = await this.getOrderById(existingOrder._id.toString());

        // Notify staff/owner that items were added to existing order
        notifyServiceStaff(restaurantId.toString(), "order:items-added", {
          orderId: existingOrder._id.toString(),
          orderNumber: updatedExistingOrder.orderNumber,
          tableNumber: updatedExistingOrder.tableNumber,
          newItems: input.items,
          updatedTotal: newTotal,
        });
      } else {
        // No existing order - notify staff/owner about new order
        notifyServiceStaff(restaurantId.toString(), "order:new", {
          orderId: newOrderId.toString(),
          orderNumber: newOrder.orderNumber,
          tableNumber: newOrder.tableNumber,
          orderStatus: newOrder.orderStatus,
          paymentStatus: newOrder.paymentStatus,
          orderTotal: newOrder.orderTotal,
          items: input.items,
        });

        // Notify about payment verification needed
        notifyServiceStaff(restaurantId.toString(), "payment:needs-verification", {
          orderId: newOrderId.toString(),
          orderNumber: newOrder.orderNumber,
          tableNumber: newOrder.tableNumber,
          orderTotal: newOrder.orderTotal,
          paymentStatus: newOrder.paymentStatus,
        });
      }

      // Update table status (allow multiple orders, just mark as occupied if first order)
      if (table.status !== TableStatus.OCCUPIED) {
        await this.tableService.occupyTable(tableId, newOrderId);
      }

      // Get full new order with items (for kitchen)
      const fullNewOrder = await this.getOrderById(newOrderId.toString());

      // Notify kitchen about new order (always send new order to kitchen)
      notifyKitchen(restaurantId, {
        _id: newOrderId.toString(),
        orderNumber: fullNewOrder.orderNumber,
        tableNumber: fullNewOrder.tableNumber,
        orderStatus: fullNewOrder.orderStatus,
        paymentStatus: fullNewOrder.paymentStatus,
        orderTotal: fullNewOrder.orderTotal,
        items: fullNewOrder.orderItems,
        event: "order:new",
      });

      emitTableUpdate(tableId, TableStatus.OCCUPIED, newOrderId);

      // Return new order (for kitchen)
      return fullNewOrder;
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
        orderStatus: OrderStatus.PROCESS,
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
      OrderStatus.PROCESS,
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


  public async getKitchenOrders(restaurantId: ObjectId | string): Promise<Order[]> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    const result = await this.orderModel
      .aggregate([
        {
          $match: {
            restaurantId: id,
            orderStatus: OrderStatus.PROCESS
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
              { orderStatus: OrderStatus.PROCESS, paymentStatus: PaymentStatus.PENDING },
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
  public async getAllOrdersByTable(tableId: ObjectId | string, filter?: string): Promise<Order[]> {
    const id = shapeIntoMongooseObjectId(tableId);

    // Build match condition based on filter
    const matchCondition: any = { tableId: id };

    if (filter) {
      switch (filter.toLowerCase()) {
        case "paid":
        case "verified":
          // Payment made (VERIFIED)
          matchCondition.paymentStatus = PaymentStatus.VERIFIED;
          matchCondition.orderStatus = { $ne: OrderStatus.CANCELLED };
          break;
        case "unpaid":
        case "pending":
          // Payment not made (PENDING)
          matchCondition.paymentStatus = PaymentStatus.PENDING;
          matchCondition.orderStatus = { $ne: OrderStatus.CANCELLED };
          break;
        case "cancelled":
        case "cancel":
          // Cancelled orders
          matchCondition.orderStatus = OrderStatus.CANCELLED;
          break;
        default:
          // No filter - return all orders
          break;
      }
    }

    const result = await this.orderModel
      .aggregate([
        { $match: matchCondition },
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

}

export default OrderService;
import {
  Order,
  OrderInquiry,
  OrderItemInput,
  OrderCreateInput,
  PaymentVerificationInput,
  OrderCompleteInput,
  OrderCancelInput,
  OrderConfirmationResponse,
  OrderUpdateItemsInput,
  OrderAdminInquiry,
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
        await this.tableService.updateTable(tableId, { status: TableStatus.OCCUPIED });
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
  /**
   * Mark order as READY (Kitchen staff only)
   * Can only mark PROCESS orders as READY
   */
  public async markOrderAsReady(
    orderId: string,
    kitchenStaffId: ObjectId
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);

    // Get order to check current status
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    // Can only mark PROCESS orders as READY
    if (order.orderStatus !== OrderStatus.PROCESS) {
      throw new Errors(
        HttpCode.BAD_REQUEST,
        "Order must be in PROCESS status to mark as READY"
      );
    }

    // Update order status to READY
    const result = await this.orderModel.findByIdAndUpdate(
      id,
      {
        orderStatus: OrderStatus.READY,
      },
      { new: true }
    ).exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
    }

    // Get full order with items for notification
    const fullOrder = await this.getOrderById(id.toString());

    // Notify service staff and owner that order is ready
      emitOrderStatusChange(
        id,
      OrderStatus.READY,
      order.paymentStatus,
        order.restaurantId,
        order.tableId
      );

    // Also notify via service staff channel
    notifyServiceStaff(order.restaurantId.toString(), "order:ready", {
      orderId: id.toString(),
      orderNumber: fullOrder.orderNumber,
      tableNumber: fullOrder.tableNumber,
      orderStatus: OrderStatus.READY,
      orderTotal: fullOrder.orderTotal,
    });

    return fullOrder;
  }


  public async getKitchenOrders(restaurantId: ObjectId | string): Promise<Order[]> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    const result = await this.orderModel
      .aggregate([
        {
          $match: {
            restaurantId: id,
            orderStatus: { $in: [OrderStatus.PROCESS, OrderStatus.READY] }
          }
        },
        {
          $addFields: {
            statusPriority: {
              $cond: [{ $eq: ["$orderStatus", OrderStatus.PROCESS] }, 1, 2]
            }
          }
        },
        { $sort: { statusPriority: 1, createdAt: 1 } }, // PROCESS first, then READY, oldest first
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

  /**
   * Get active order for a table (most recent)
   * Returns null if no active order exists
   */
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

  /**
   * Delete order item
   */
  public async deleteOrderItem(
    orderId: string,
    itemId: string
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);
    const itemIdObj = shapeIntoMongooseObjectId(itemId);

    // Get order to check if it exists and can be modified
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    // Can only modify READY or PROCESS orders
    if (order.orderStatus !== OrderStatus.READY && order.orderStatus !== OrderStatus.PROCESS) {
      throw new Errors(HttpCode.BAD_REQUEST, "Order must be in READY or PROCESS status to modify");
    }

    // Check if item exists and belongs to this order
    const item = await this.orderItemModel.findOne({
      _id: itemIdObj,
      orderId: id,
    }).exec();

    if (!item) {
      throw new Errors(HttpCode.NOT_FOUND, "Order item not found");
    }

    // Delete item
    await this.orderItemModel.findByIdAndDelete(itemIdObj).exec();

    // Recalculate order total
    const allItems = await this.orderItemModel.find({ orderId: id }).exec();
    const newTotal = allItems.reduce(
      (sum, item) => sum + item.itemPrice * item.itemQuantity,
      0
    );

    // Update order total
    await this.orderModel.findByIdAndUpdate(
      id,
      { orderTotal: newTotal },
      { new: true }
    ).exec();

    // Get full updated order
    const fullOrder = await this.getOrderById(orderId);

    // Notify kitchen
    notifyKitchen(order.restaurantId, {
      _id: orderId,
      orderNumber: fullOrder.orderNumber,
      tableNumber: fullOrder.tableNumber,
      updatedOrder: fullOrder,
      event: "order:items-modified",
    });

    // Notify service staff
    notifyServiceStaff(order.restaurantId.toString(), "order:items-modified", {
      orderId: orderId,
      orderNumber: fullOrder.orderNumber,
      tableNumber: fullOrder.tableNumber,
      updatedTotal: newTotal,
    });

    return fullOrder;
  }

  /**
   * Update order items (replace all items)
   */
  public async updateOrderItems(
    orderId: string,
    input: OrderUpdateItemsInput
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);

    // Get order to check if it exists and can be modified
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    // Can only modify READY or PROCESS orders
    if (order.orderStatus !== OrderStatus.READY && order.orderStatus !== OrderStatus.PROCESS) {
      throw new Errors(HttpCode.BAD_REQUEST, "Order must be in READY or PROCESS status to modify");
    }

    // Get existing items
    const existingItems = await this.orderItemModel.find({ orderId: id }).exec();

    // Create a map of existing items by productId for quick lookup
    const existingItemsMap = new Map();
    existingItems.forEach((item) => {
      existingItemsMap.set(item.productId.toString(), item);
    });

    // Process items from request
    const requestProductIds = new Set();

    if (input.items && input.items.length > 0) {
      for (const item of input.items) {
        const productId = shapeIntoMongooseObjectId(item.productId);
        const productIdStr = productId.toString();
        requestProductIds.add(productIdStr);

        const existingItem = existingItemsMap.get(productIdStr);

        if (existingItem) {
          // Item exists - update quantity and price if changed
          const needsUpdate =
            existingItem.itemQuantity !== item.itemQuantity ||
            existingItem.itemPrice !== item.itemPrice;

          if (needsUpdate) {
            existingItem.itemQuantity = item.itemQuantity;
            existingItem.itemPrice = item.itemPrice;
            await existingItem.save();
          }
          // If unchanged, do nothing - item remains as is
        } else {
          // Item doesn't exist - create new item
          await this.orderItemModel.create({
            orderId: id,
            productId: productId,
            itemQuantity: item.itemQuantity,
            itemPrice: item.itemPrice,
          });
        }
      }
    }

    // Items not in request remain unchanged (not deleted)

    // Recalculate order total
    const allItems = await this.orderItemModel.find({ orderId: id }).exec();
    const newTotal = allItems.reduce(
      (sum, item) => sum + item.itemPrice * item.itemQuantity,
      0
    );

    // Update order total (orderId, tableId, restaurantId remain unchanged)
    await this.orderModel.findByIdAndUpdate(
      id,
      { orderTotal: newTotal },
      { new: true }
    ).exec();

    // Get full updated order
    const fullOrder = await this.getOrderById(orderId);

    // Notify kitchen
    notifyKitchen(order.restaurantId, {
      _id: orderId,
      orderNumber: fullOrder.orderNumber,
      tableNumber: fullOrder.tableNumber,
      updatedOrder: fullOrder,
      event: "order:items-modified",
    });

    // Notify service staff
    notifyServiceStaff(order.restaurantId.toString(), "order:items-modified", {
      orderId: orderId,
      orderNumber: fullOrder.orderNumber,
      tableNumber: fullOrder.tableNumber,
      updatedTotal: newTotal,
    });

    return fullOrder;
  }

  /**
   * Complete order
   */
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
    const activeOrders = await this.getOrderByTable(order.tableId);

    // Only free table if no other active orders exist
    if (!activeOrders) {
      await this.tableService.updateTable(order.tableId, { status: TableStatus.ACTIVE });
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

    // Get full order
    const fullOrder = await this.getOrderById(orderId);

    return fullOrder;
  }

  /**
   * Cancel order
   */
  public async cancelOrder(
    orderId: string,
    staffId: ObjectId,
    reason?: string
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
      throw new Errors(HttpCode.BAD_REQUEST, "Cannot cancel completed order");
    }

    // Update order status
    const result = await this.orderModel.findByIdAndUpdate(
      id,
      {
        orderStatus: OrderStatus.CANCELLED,
        cancellationReason: reason || "Cancelled by staff",
      },
      { new: true }
    ).exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
    }

    // Check if there are other active orders on this table
    const activeOrders = await this.getOrderByTable(order.tableId);

    // Only free table if no other active orders exist
    if (!activeOrders) {
      await this.tableService.updateTable(order.tableId, { status: TableStatus.ACTIVE });
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
    notifyServiceStaff(order.restaurantId.toString(), "order:cancelled", {
      orderId: id.toString(),
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      orderStatus: OrderStatus.CANCELLED,
      reason: reason || "Cancelled by staff",
    });

    // Get full order
    const fullOrder = await this.getOrderById(orderId);

    return fullOrder;
  }

  /**
   * Get all orders for admin with filtering
   * Supports filtering by: table number, date range, order status, search by order number
   */
  public async getAllOrdersByAdmin(
    restaurantId: ObjectId | string,
    inquiry: OrderAdminInquiry
  ): Promise<{ orders: Order[]; total: number }> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    // Build match query
    const match: any = {
      restaurantId: id,
    };

    // Filter by order status
    if (inquiry.orderStatus) {
      match.orderStatus = inquiry.orderStatus;
    }

    // Filter by table number
    if (inquiry.tableNumber) {
      match.tableNumber = Number(inquiry.tableNumber);
    }

    // Filter by date range
    if (inquiry.startDate || inquiry.endDate) {
      match.createdAt = {};
      if (inquiry.startDate) {
        const startDate = new Date(inquiry.startDate);
        startDate.setHours(0, 0, 0, 0);
        match.createdAt.$gte = startDate;
      }
      if (inquiry.endDate) {
        const endDate = new Date(inquiry.endDate);
        endDate.setHours(23, 59, 59, 999);
        match.createdAt.$lte = endDate;
      }
    }

    // Search by order number
    if (inquiry.search) {
      match.orderNumber = { $regex: new RegExp(inquiry.search, "i") };
    }

    // Get total count
    const total = await this.orderModel.countDocuments(match).exec();

    // Get orders with pagination
    const orders = await this.orderModel
      .aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } }, // Newest first
        { $skip: (inquiry.page - 1) * inquiry.limit },
        { $limit: inquiry.limit },
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

    return {
      orders: orders || [],
      total: total,
    };
  }

  /**
   * Get order detail by ID for admin
   */
  public async getOrderDetailByAdmin(
    restaurantId: ObjectId | string,
    orderId: string
  ): Promise<Order> {
    const restId = shapeIntoMongooseObjectId(restaurantId);
    const order = await this.getOrderById(orderId);

    // Verify order belongs to this restaurant
    if (order.restaurantId.toString() !== restId.toString()) {
      throw new Errors(HttpCode.FORBIDDEN, "Order does not belong to this restaurant");
    }

    return order;
  }

}

export default OrderService;
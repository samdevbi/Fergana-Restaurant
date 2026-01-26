import {
  Order,
  OrderItemInput,
  OrderCreateInput,
  OrderAdminInquiry,
} from "../libs/types/order";
import { Member } from "../libs/types/member";
import OrderModel from "../schema/Order.model";
import OrderItemModel from "../schema/OrderItem.model";
import { shapeIntoMongooseObjectId } from "../libs/config";
import Errors, { Message } from "../libs/Errors";
import { HttpCode } from "../libs/Errors";
import { Types } from "mongoose";
type ObjectId = Types.ObjectId;
import { OrderStatus, OrderType } from "../libs/enums/order.enum";
import MemberService from "./Member.service";
import TableService from "./Table.service";
import {
  notifyKitchen,
  notifyServiceStaff,
  emitTableUpdate,
  emitOrderStatusChange,
} from "../libs/websocket/socket.handler";
import { TableStatus } from "../libs/enums/table.enum";
import { ProductCollection } from "../libs/enums/product.enum";

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
      const newOrder: Order = (await this.orderModel.create({
        orderTotal: amount,
        memberId: memberId,
      })) as unknown as Order;
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
      // Clone the item object to avoid mutating the original input reference
      // which might be used in multiple recordOrderItem calls (e.g., merging)
      const itemToSave = {
        ...item,
        orderId: orderId,
        productId: shapeIntoMongooseObjectId(item.productId)
      };
      await this.orderItemModel.create(itemToSave);
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

  /**
   * Calculate distance between two points in meters (Haversine formula)
   */
  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radius of the earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public async createQROrder(input: OrderCreateInput, memberId?: ObjectId): Promise<Order> {
    const tableId = shapeIntoMongooseObjectId(input.tableId);

    // 0. Geolocation check
    const restaurantLat = Number(process.env.RESTAURANT_LAT);
    const restaurantLng = Number(process.env.RESTAURANT_LNG);
    const maxDistance = Number(process.env.MAX_DISTANCE) || 50;

    if (restaurantLat && restaurantLng && input.location) {
      const distance = this.getDistance(
        input.location.lat,
        input.location.lng,
        restaurantLat,
        restaurantLng
      );

      console.log("--- GEOLOCATION DEBUG ---");
      console.log(`Client: lat=${input.location.lat}, lng=${input.location.lng}`);
      console.log(`Restaurant: lat=${restaurantLat}, lng=${restaurantLng}`);
      console.log(`Calculated Distance: ${distance.toFixed(2)}m`);
      console.log("--------------------------");

      if (distance > maxDistance) {
        console.warn(`Order rejected due to distance: ${distance.toFixed(2)}m (Max: ${maxDistance}m)`);
        throw new Errors(HttpCode.FORBIDDEN, `Buyurtma berish uchun restoran hududida bo'lishingiz shart (Masofa: ${distance.toFixed(0)}m).`);
      }
    } else if (restaurantLat && restaurantLng && !input.location) {
      // Enforce location if restaurant coordinates are configured
      throw new Errors(HttpCode.BAD_REQUEST, "Joylashuvingizni aniqlashga ruxsat bering.");
    }

    // 1. Get existing table info
    const table = await this.tableService.getTableById(tableId);
    if (table.status === TableStatus.PAUSE) {
      throw new Errors(HttpCode.FORBIDDEN, "Ushbu stol vaqtincha xizmat ko'rsatmayapti.");
    }
    const restaurantId = table.restaurantId;

    // 2. Calculate total amount for the items in this specific request
    const amount = input.items.reduce((acc, item) => acc + item.itemPrice * item.itemQuantity, 0);
    const orderNumber = await this.generateDailyOrderNumber(restaurantId);

    try {
      const newOrder: Order = (await this.orderModel.create({
        orderNumber: orderNumber,
        restaurantId: restaurantId,
        tableId: tableId,
        tableNumber: table.tableNumber,
        orderTotal: amount,
        orderStatus: OrderStatus.PROCESS,
        orderType: OrderType.QR_ORDER,
        memberId: memberId || null,
      })) as unknown as Order;

      const newOrderId = newOrder._id;
      await this.recordOrderItem(newOrderId, input.items);

      // 4. Update table status
      if (table.status !== TableStatus.OCCUPIED) {
        await this.tableService.updateTable(tableId, { status: TableStatus.OCCUPIED });
      }

      // 5. Notifications
      const fullNewOrder = await this.getOrderById(newOrderId.toString());
      const kitchenPayload = {
        _id: newOrderId.toString(),
        orderNumber: fullNewOrder.orderNumber,
        tableNumber: fullNewOrder.tableNumber,
        orderStatus: fullNewOrder.orderStatus,
        orderTotal: fullNewOrder.orderTotal,
        items: fullNewOrder.orderItems,
      };

      notifyKitchen(restaurantId, kitchenPayload);
      notifyServiceStaff(restaurantId, "order:new", kitchenPayload);
      emitTableUpdate(tableId, TableStatus.OCCUPIED, newOrderId);

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
          $nin: [OrderStatus.COMPLETED]
        }
      })
      .sort({ createdAt: -1 }) // Get THE LATEST active order
      .exec();

    return result as Order | null;
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
              $nin: [OrderStatus.COMPLETED]
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

    // Check if table is paused
    const table = await this.tableService.getTableById(order.tableId);
    if (table.status === TableStatus.PAUSE) {
      throw new Errors(HttpCode.FORBIDDEN, "Ushbu stol vaqtincha xizmat ko'rsatmayapti.");
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

    // If order becomes empty, mark it as COMPLETED and check table status
    if (allItems.length === 0) {
      await this.orderModel.findByIdAndUpdate(id, {
        orderTotal: 0,
        orderStatus: OrderStatus.COMPLETED
      }).exec();

      // Check if table should be cleared (no more active orders)
      const otherActiveOrders = await this.orderModel.find({
        tableId: order.tableId,
        orderStatus: { $ne: OrderStatus.COMPLETED },
        _id: { $ne: id }
      }).exec();

      if (otherActiveOrders.length === 0) {
        await this.tableService.updateTable(order.tableId, { status: TableStatus.AVAILABLE });
        emitTableUpdate(order.tableId, TableStatus.AVAILABLE);
      }

      emitOrderStatusChange(id, OrderStatus.COMPLETED, order.restaurantId, order.tableId);
    } else {
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
    }

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
      updatedTotal: fullOrder.orderTotal,
    });

    return fullOrder;
  }

  /**
   * Reduce order item quantity (Correction only)
   * Prevents increasing quantity or adding new items
   */
  public async reduceOrderItemQuantity(
    orderId: string,
    itemId: string
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);
    const itemIdObj = shapeIntoMongooseObjectId(itemId);

    // Get order and item
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    // Can only modify READY or PROCESS orders
    if (order.orderStatus !== OrderStatus.READY && order.orderStatus !== OrderStatus.PROCESS) {
      throw new Errors(HttpCode.BAD_REQUEST, "Order must be in READY or PROCESS status to modify");
    }

    const item = await this.orderItemModel.findOne({ _id: itemIdObj, orderId: id }).exec();
    if (!item) throw new Errors(HttpCode.NOT_FOUND, "Order item not found");

    // Logic: Decrement by 1
    const newQuantity = item.itemQuantity - 1;

    if (newQuantity <= 0) {
      throw new Errors(HttpCode.BAD_REQUEST, "Soni 1 dan kamayishi mumkin emas. O'chirish funksiyasidan foydalaning.");
    }

    // Update item
    item.itemQuantity = newQuantity;
    await item.save();

    // Recalculate order total
    const allItems = await this.orderItemModel.find({ orderId: id }).exec();
    const newTotal = allItems.reduce((sum, i) => sum + i.itemPrice * i.itemQuantity, 0);

    await this.orderModel.findByIdAndUpdate(id, { orderTotal: newTotal }).exec();

    const fullOrder = await this.getOrderById(orderId);

    // Notifications
    notifyKitchen(order.restaurantId, {
      _id: orderId,
      orderNumber: fullOrder.orderNumber,
      tableNumber: fullOrder.tableNumber,
      items: fullOrder.orderItems,
      event: "order:item-reduced"
    });

    notifyServiceStaff(order.restaurantId.toString(), "order:item-reduced", {
      orderId,
      orderNumber: fullOrder.orderNumber,
      tableNumber: fullOrder.tableNumber,
      updatedTotal: newTotal
    });

    return fullOrder;
  }

  /**
   * Complete an individual order (not the entire table)
   */
  public async completeIndividualOrder(
    orderId: string,
    staffId: ObjectId
  ): Promise<Order> {
    const id = shapeIntoMongooseObjectId(orderId);
    const staffIdObj = shapeIntoMongooseObjectId(staffId);

    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    if (order.orderStatus === OrderStatus.COMPLETED) {
      throw new Errors(HttpCode.BAD_REQUEST, "Order is already completed");
    }

    // Update status
    const result = await this.orderModel.findByIdAndUpdate(
      id,
      {
        orderStatus: OrderStatus.COMPLETED,
        completedBy: staffIdObj,
        completedAt: new Date(),
      },
      { new: true }
    ).exec();

    // Check if table should be cleared (no more active orders)
    const otherActiveOrders = await this.orderModel.find({
      tableId: order.tableId,
      orderStatus: { $ne: OrderStatus.COMPLETED },
      _id: { $ne: id }
    }).exec();

    if (otherActiveOrders.length === 0) {
      await this.tableService.updateTable(order.tableId, { status: TableStatus.AVAILABLE });
      emitTableUpdate(order.tableId, TableStatus.AVAILABLE);
    }

    emitOrderStatusChange(id, OrderStatus.COMPLETED, order.restaurantId, order.tableId);

    return await this.getOrderById(orderId);
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

    // 1. Find ALL active (non-completed) orders for this table
    const activeOrders = await this.orderModel.find({
      tableId: order.tableId,
      orderStatus: { $ne: OrderStatus.COMPLETED }
    }).exec();

    const activeOrderIds = activeOrders.map((o: any) => o._id);

    // 2. Update all active orders to COMPLETED (Bulk Update)
    const result = await this.orderModel.updateMany(
      { _id: { $in: activeOrderIds } },
      {
        orderStatus: OrderStatus.COMPLETED,
        completedBy: staffIdObj,
        completedAt: new Date(),
      }
    ).exec();

    if (result.matchedCount === 0) {
      throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
    }

    // 3. Since we completed all active orders, the table is now definitely AVAILABLE
    await this.tableService.updateTable(order.tableId, { status: TableStatus.AVAILABLE });
    emitTableUpdate(order.tableId, TableStatus.AVAILABLE);

    // 4. Notify staff and owner about the bulk completion
    // We emit status change for the primarily triggered order
    emitOrderStatusChange(
      id,
      OrderStatus.COMPLETED,
      order.restaurantId,
      order.tableId
    );

    // Get full updated order to return
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

    // Get the current order to find associated tableId
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    // Check if order can be cancelled
    if (order.orderStatus === OrderStatus.COMPLETED) {
      throw new Errors(HttpCode.BAD_REQUEST, "Cannot cancel completed order");
    }

    // 1. Find ALL active (non-completed) orders for this table
    const activeOrders = await this.orderModel.find({
      tableId: order.tableId,
      orderStatus: { $ne: OrderStatus.COMPLETED }
    }).exec();

    const activeOrderIds = activeOrders.map((o: any) => o._id);

    // 2. Delete all items associated with these active orders
    await this.orderItemModel.deleteMany({
      orderId: { $in: activeOrderIds }
    }).exec();

    // 3. Delete all active orders from the table (Hard Delete)
    await this.orderModel.deleteMany({
      _id: { $in: activeOrderIds }
    }).exec();

    // 4. Since we deleted all active orders, the table is now definitely AVAILABLE
    await this.tableService.updateTable(order.tableId, { status: TableStatus.AVAILABLE });
    emitTableUpdate(order.tableId, TableStatus.AVAILABLE);

    // 5. Notify staff and owner about the bulk cancellation
    emitOrderStatusChange(
      id,
      "CANCELLED" as any,
      order.restaurantId,
      order.tableId
    );

    notifyServiceStaff(order.restaurantId.toString(), "order:cancelled", {
      orderId: id.toString(),
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      orderStatus: "DELETED",
      message: "Tushunmovchilik oldini olish uchun stoldagi barcha faol zakazlar o'chirildi.",
      reason: reason || "Cancelled and table cleared by staff",
    });

    return order as unknown as Order;
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

  /**
   * Get daily sales statistics
   * Returns: daily revenue, total products sold, and counts by category (DISH, SALAD, DESSERT, DRINK)
   */
  public async getDailyStatistics(
    restaurantId: ObjectId | string
  ): Promise<{
    dailyRevenue: number;
    totalProductsSold: number;
    dishItemsSold: number;
    saladItemsSold: number;
    dessertItemsSold: number;
    drinkItemsSold: number;
  }> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all completed orders for today
    const todayOrders = await this.orderModel
      .find({
        restaurantId: id,
        orderStatus: OrderStatus.COMPLETED,
        createdAt: {
          $gte: today,
          $lt: tomorrow,
        },
      })
      .exec();

    const orderIds = todayOrders.map((order: any) => order._id);

    // Calculate daily revenue
    const dailyRevenue = todayOrders.reduce((sum: number, order: any) => {
      return sum + (order.orderTotal || 0);
    }, 0);

    // Get all order items for today's completed orders with product details
    const orderItemsStats = await this.orderItemModel
      .aggregate([
        {
          $match: {
            orderId: { $in: orderIds },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: "$product.productCollection",
            totalQuantity: { $sum: "$itemQuantity" },
          },
        },
      ])
      .exec();

    // Calculate statistics by category
    let totalProductsSold = 0;
    let dishItemsSold = 0;
    let saladItemsSold = 0;
    let dessertItemsSold = 0;
    let drinkItemsSold = 0;

    orderItemsStats.forEach((stat: any) => {
      const quantity = stat.totalQuantity || 0;
      totalProductsSold += quantity;

      switch (stat._id) {
        case ProductCollection.DISH:
          dishItemsSold += quantity;
          break;
        case ProductCollection.SALAD:
          saladItemsSold += quantity;
          break;
        case ProductCollection.DESSERT:
          dessertItemsSold += quantity;
          break;
        case ProductCollection.DRINK:
          drinkItemsSold += quantity;
          break;
      }
    });

    return {
      dailyRevenue,
      totalProductsSold,
      dishItemsSold,
      saladItemsSold,
      dessertItemsSold,
      drinkItemsSold,
    };
  }

  /**
   * Get weekly sales statistics
   * Returns: total revenue, orders count, products sold by category, top selling dish, most ordered table
   */
  public async getWeeklyStatistics(
    restaurantId: ObjectId | string
  ): Promise<{
    totalRevenue: number;
    ordersCount: number;
    dishItemsSold: number;
    saladItemsSold: number;
    dessertItemsSold: number;
    drinkItemsSold: number;
    topSellingDish: {
      productNameUz: string;
      productNameKr: string;
      quantity: number;
    } | null;
    mostOrderedTable: {
      tableNumber: number;
      orderCount: number;
    } | null;
  }> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    // Get this week's date range (Monday to Sunday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return await this.getPeriodStatistics(id, weekStart, weekEnd);
  }

  /**
   * Get monthly sales statistics
   * Returns: total revenue, orders count, products sold by category, top selling dish, most ordered table
   */
  public async getMonthlyStatistics(
    restaurantId: ObjectId | string
  ): Promise<{
    totalRevenue: number;
    ordersCount: number;
    dishItemsSold: number;
    saladItemsSold: number;
    dessertItemsSold: number;
    drinkItemsSold: number;
    topSellingDish: {
      productNameUz: string;
      productNameKr: string;
      quantity: number;
    } | null;
    mostOrderedTable: {
      tableNumber: number;
      orderCount: number;
    } | null;
  }> {
    const id = shapeIntoMongooseObjectId(restaurantId);

    // Get this month's date range
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    monthEnd.setHours(0, 0, 0, 0);

    return await this.getPeriodStatistics(id, monthStart, monthEnd);
  }

  /**
   * Helper method to get statistics for a given period
   */
  private async getPeriodStatistics(
    restaurantId: ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    ordersCount: number;
    dishItemsSold: number;
    saladItemsSold: number;
    dessertItemsSold: number;
    drinkItemsSold: number;
    topSellingDish: {
      productNameUz: string;
      productNameKr: string;
      quantity: number;
    } | null;
    mostOrderedTable: {
      tableNumber: number;
      orderCount: number;
    } | null;
  }> {
    // Get all completed orders for the period
    const orders = await this.orderModel
      .find({
        restaurantId: restaurantId,
        orderStatus: OrderStatus.COMPLETED,
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
      })
      .exec();

    const orderIds = orders.map((order: any) => order._id);
    const ordersCount = orders.length;

    // Calculate total revenue
    const totalRevenue = orders.reduce((sum: number, order: any) => {
      return sum + (order.orderTotal || 0);
    }, 0);

    // Get order items statistics by category
    const orderItemsStats = await this.orderItemModel
      .aggregate([
        {
          $match: {
            orderId: { $in: orderIds },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: "$product.productCollection",
            totalQuantity: { $sum: "$itemQuantity" },
          },
        },
      ])
      .exec();

    // Calculate statistics by category
    let dishItemsSold = 0;
    let saladItemsSold = 0;
    let dessertItemsSold = 0;
    let drinkItemsSold = 0;

    orderItemsStats.forEach((stat: any) => {
      const quantity = stat.totalQuantity || 0;

      switch (stat._id) {
        case ProductCollection.DISH:
          dishItemsSold += quantity;
          break;
        case ProductCollection.SALAD:
          saladItemsSold += quantity;
          break;
        case ProductCollection.DESSERT:
          dessertItemsSold += quantity;
          break;
        case ProductCollection.DRINK:
          drinkItemsSold += quantity;
          break;
      }
    });

    // Get top selling dish (only DISH category)
    const topSellingDishResult = await this.orderItemModel
      .aggregate([
        {
          $match: {
            orderId: { $in: orderIds },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            "product.productCollection": ProductCollection.DISH,
          },
        },
        {
          $group: {
            _id: "$productId",
            productNameUz: { $first: "$product.productNameUz" },
            productNameKr: { $first: "$product.productNameKr" },
            totalQuantity: { $sum: "$itemQuantity" },
          },
        },
        {
          $sort: { totalQuantity: -1 },
        },
        {
          $limit: 1,
        },
      ])
      .exec();

    const topSellingDish =
      topSellingDishResult && topSellingDishResult.length > 0
        ? {
            productNameUz: topSellingDishResult[0].productNameUz || "",
            productNameKr: topSellingDishResult[0].productNameKr || "",
            quantity: topSellingDishResult[0].totalQuantity || 0,
          }
        : null;

    // Get most ordered table
    const mostOrderedTableResult = await this.orderModel
      .aggregate([
        {
          $match: {
            restaurantId: restaurantId,
            orderStatus: OrderStatus.COMPLETED,
            createdAt: {
              $gte: startDate,
              $lt: endDate,
            },
          },
        },
        {
          $group: {
            _id: "$tableNumber",
            orderCount: { $sum: 1 },
          },
        },
        {
          $sort: { orderCount: -1 },
        },
        {
          $limit: 1,
        },
      ])
      .exec();

    const mostOrderedTable =
      mostOrderedTableResult && mostOrderedTableResult.length > 0
        ? {
            tableNumber: mostOrderedTableResult[0]._id || 0,
            orderCount: mostOrderedTableResult[0].orderCount || 0,
          }
        : null;

    return {
      totalRevenue,
      ordersCount,
      dishItemsSold,
      saladItemsSold,
      dessertItemsSold,
      drinkItemsSold,
      topSellingDish,
      mostOrderedTable,
    };
  }

  /**
   * Get weekly daily breakdown - products sold per day of the week
   * Returns: array of daily statistics with day number and products sold count
   */
  public async getWeeklyDailyBreakdown(
    restaurantId: ObjectId | string
  ): Promise<
    Array<{
      dayOfWeek: number; // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
      dayName: string; // "Monday", "Tuesday", etc.
      productsSold: number;
    }>
  > {
    const id = shapeIntoMongooseObjectId(restaurantId);

    // Get this week's date range (Monday to Sunday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Get all completed orders for the week
    const orders = await this.orderModel
      .find({
        restaurantId: id,
        orderStatus: OrderStatus.COMPLETED,
        createdAt: {
          $gte: weekStart,
          $lt: weekEnd,
        },
      })
      .exec();

    const orderIds = orders.map((order: any) => order._id);

    // Get order items grouped by day of week
    const dailyStats = await this.orderItemModel
      .aggregate([
        {
          $match: {
            orderId: { $in: orderIds },
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        {
          $unwind: {
            path: "$order",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            itemQuantity: 1,
            orderDate: "$order.createdAt",
          },
        },
        {
          $group: {
            _id: {
              $dayOfWeek: "$orderDate", // 1 = Sunday, 2 = Monday, ..., 7 = Saturday
            },
            totalQuantity: { $sum: "$itemQuantity" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ])
      .exec();

    // Map MongoDB dayOfWeek (1=Sunday, 2=Monday, ..., 7=Saturday) to our format (1=Monday, 7=Sunday)
    const dayNames = [
      "Sunday", // 0
      "Monday", // 1
      "Tuesday", // 2
      "Wednesday", // 3
      "Thursday", // 4
      "Friday", // 5
      "Saturday", // 6
    ];

    // MongoDB $dayOfWeek: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
    // Our format: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday

    // Initialize all days with 0
    const result: Array<{
      dayOfWeek: number;
      dayName: string;
      productsSold: number;
    }> = [];

    // Our format: 1=Monday, 2=Tuesday, ..., 7=Sunday
    for (let i = 1; i <= 7; i++) {
      // Convert our format to MongoDB format
      // Our 1 (Monday) = MongoDB 2
      // Our 2 (Tuesday) = MongoDB 3
      // ...
      // Our 6 (Saturday) = MongoDB 7
      // Our 7 (Sunday) = MongoDB 1
      const mongoDayOfWeek = i === 7 ? 1 : i + 1;
      const stat = dailyStats.find((s: any) => s._id === mongoDayOfWeek);
      
      // Get day name: our 1=Monday (index 1), our 7=Sunday (index 0)
      const dayNameIndex = i === 7 ? 0 : i;
      
      result.push({
        dayOfWeek: i,
        dayName: dayNames[dayNameIndex],
        productsSold: stat ? stat.totalQuantity : 0,
      });
    }

    return result;
  }

  /**
   * Get monthly daily breakdown - products sold per day of the month
   * Returns: array of daily statistics with day number and products sold count
   */
  public async getMonthlyDailyBreakdown(
    restaurantId: ObjectId | string
  ): Promise<
    Array<{
      day: number; // 1, 2, 3, ..., 31
      productsSold: number;
    }>
  > {
    const id = shapeIntoMongooseObjectId(restaurantId);

    // Get this month's date range
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    monthEnd.setHours(0, 0, 0, 0);

    // Get all completed orders for the month
    const orders = await this.orderModel
      .find({
        restaurantId: id,
        orderStatus: OrderStatus.COMPLETED,
        createdAt: {
          $gte: monthStart,
          $lt: monthEnd,
        },
      })
      .exec();

    const orderIds = orders.map((order: any) => order._id);

    // Get order items grouped by day of month
    const dailyStats = await this.orderItemModel
      .aggregate([
        {
          $match: {
            orderId: { $in: orderIds },
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        {
          $unwind: {
            path: "$order",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            itemQuantity: 1,
            orderDate: "$order.createdAt",
          },
        },
        {
          $group: {
            _id: {
              $dayOfMonth: "$orderDate",
            },
            totalQuantity: { $sum: "$itemQuantity" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ])
      .exec();

    // Get number of days in current month
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate();

    // Initialize all days with 0
    const result: Array<{
      day: number;
      productsSold: number;
    }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const stat = dailyStats.find((s: any) => s._id === day);
      result.push({
        day: day,
        productsSold: stat ? stat.totalQuantity : 0,
      });
    }

    return result;
  }
}

export default OrderService;
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { ExtendedSocket } from "./socket.types";
import { MemberRole } from "../enums/member.enum";
import { OrderStatus, PaymentStatus } from "../enums/order.enum";
import { TableStatus } from "../enums/table.enum";
import { ObjectId } from "mongoose";

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.io server
 */
export const initializeSocket = (httpServer: HTTPServer): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    return io;
};

/**
 * Get Socket.io instance
 */
export const getIO = (): SocketIOServer => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};

/**
 * Handle socket connection
 */
export const handleConnection = (socket: ExtendedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join rooms based on user role and restaurant
    socket.on("join-rooms", async () => {
        if (!socket.member) {
            socket.emit("error", { message: "Not authenticated" });
            return;
        }

        const member = socket.member;
        // Determine restaurantId: OWNER uses their own _id, STAFF/CHEFF use their restaurantId field
        let restaurantId: string;
        if (member.memberRole === MemberRole.OWNER) {
            restaurantId = member._id.toString();
        } else if (member.restaurantId) {
            restaurantId = member.restaurantId.toString();
        } else {
            socket.emit("error", { message: "Staff member missing restaurantId" });
            return;
        }

        // Join restaurant room
        socket.join(`restaurant:${restaurantId}`);

        // Join role-specific rooms
        if (member.memberRole === MemberRole.CHEFF) {
            socket.join(`kitchen:${restaurantId}`);
            console.log(`Kitchen staff joined: ${socket.id}`);
        }

        if (member.memberRole === MemberRole.STAFF || member.memberRole === MemberRole.OWNER) {
            socket.join(`service:${restaurantId}`);
            console.log(`Service staff joined: ${socket.id}`);
        }

        socket.emit("rooms-joined", { success: true });
    });

    // Join order room (for customer tracking)
    socket.on("join-order", (orderId: string) => {
        socket.join(`order:${orderId}`);
        console.log(`Client joined order room: ${orderId}`);
    });

    // Join table room
    socket.on("join-table", (tableId: string) => {
        socket.join(`table:${tableId}`);
        console.log(`Client joined table room: ${tableId}`);
    });

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
};

/**
 * Emit order update to specific order room
 */
export const emitOrderUpdate = (orderId: string | ObjectId, event: string, data: any) => {
    if (!io) return;

    const orderIdStr = orderId.toString();
    io.to(`order:${orderIdStr}`).emit(event, data);
    console.log(`Emitted ${event} to order:${orderIdStr}`);
};

/**
 * Notify kitchen of new order
 */
export const notifyKitchen = (restaurantId: string | ObjectId, order: any) => {
    if (!io) return;

    const restaurantIdStr = restaurantId.toString();
    io.to(`kitchen:${restaurantIdStr}`).emit("order:new", order);
    console.log(`Notified kitchen of new order: ${order._id}`);
};

/**
 * Notify service staff
 */
export const notifyServiceStaff = (restaurantId: string | ObjectId, event: string, data: any) => {
    if (!io) return;

    const restaurantIdStr = restaurantId.toString();
    io.to(`service:${restaurantIdStr}`).emit(event, data);
    console.log(`Notified service staff: ${event}`);
};

/**
 * Notify customer
 */
export const notifyCustomer = (orderId: string | ObjectId, event: string, data: any) => {
    if (!io) return;

    const orderIdStr = orderId.toString();
    io.to(`order:${orderIdStr}`).emit(event, data);
    console.log(`Notified customer: ${event} for order:${orderIdStr}`);
};

/**
 * Emit table status update
 */
export const emitTableUpdate = (tableId: string | ObjectId, status: TableStatus, orderId?: string | ObjectId) => {
    if (!io) return;

    const tableIdStr = tableId.toString();
    io.to(`table:${tableIdStr}`).emit("table:status-changed", {
        tableId: tableIdStr,
        status: status,
        orderId: orderId?.toString(),
    });
    console.log(`Emitted table status update: ${tableIdStr} -> ${status}`);
};

/**
 * Emit order status change to all relevant rooms
 */
export const emitOrderStatusChange = (
    orderId: string | ObjectId,
    orderStatus: OrderStatus,
    paymentStatus: PaymentStatus,
    restaurantId: string | ObjectId,
    tableId: string | ObjectId
) => {
    if (!io) return;

    const orderIdStr = orderId.toString();
    const data = {
        orderId: orderIdStr,
        orderStatus: orderStatus,
        paymentStatus: paymentStatus,
    };

    // Notify customer
    notifyCustomer(orderIdStr, "order:status-changed", data);

    // Notify kitchen if order is confirmed or preparing
    if (orderStatus === OrderStatus.CONFIRMED || orderStatus === OrderStatus.PREPARING) {
        notifyKitchen(restaurantId, { ...data, _id: orderIdStr });
    }

    // Notify service staff
    if (orderStatus === OrderStatus.PENDING || orderStatus === OrderStatus.READY) {
        notifyServiceStaff(restaurantId, "order:needs-attention", data);
    }

    // Notify table room
    emitTableUpdate(tableId, orderStatus === OrderStatus.COMPLETED ? TableStatus.AVAILABLE : TableStatus.OCCUPIED, orderIdStr);
};


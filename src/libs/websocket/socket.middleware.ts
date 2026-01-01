import { Socket } from "socket.io";
import AuthService from "../../models/Auth.service";
import Errors from "../Errors";
import { ExtendedSocket } from "./socket.types";

const authService = new AuthService();

/**
 * Authenticate WebSocket connection using JWT token
 * Allows anonymous connections (for QR customers) - they won't have member set
 */
export const authenticateSocket = async (socket: Socket, next: Function) => {
    try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.query.token as string ||
                     socket.handshake.headers.cookie?.split('accessToken=')[1]?.split(';')[0];

        if (!token) {
            // Allow anonymous connections (for QR customers without tokens)
            // They can join order rooms but not staff rooms
            next();
            return;
        }

        const member = await authService.checkAuth(token);
        (socket as ExtendedSocket).member = member;

        next();
    } catch (err) {
        console.log("WebSocket authentication error:", err);
        // Allow anonymous connections even if token is invalid (for QR customers)
        // They can join order rooms but not staff rooms
        next();
    }
};


import { Socket } from "socket.io";
import AuthService from "../../models/Auth.service";
import Errors from "../Errors";
import { ExtendedSocket } from "./socket.types";

const authService = new AuthService();

/**
 * Authenticate WebSocket connection using JWT token
 */
export const authenticateSocket = async (socket: Socket, next: Function) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('accessToken=')[1]?.split(';')[0];

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        const member = await authService.checkAuth(token);
        (socket as ExtendedSocket).member = member;

        next();
    } catch (err) {
        console.log("WebSocket authentication error:", err);
        next(new Error("Authentication error: Invalid token"));
    }
};


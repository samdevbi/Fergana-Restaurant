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
        const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('accessToken=')[1]?.split(';')[0];

        if (!token) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ccfc49ab-4340-4773-be36-87b0c39da0bf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'socket.middleware.ts:16', message: 'WebSocket auth - no token (allowing anonymous)', data: { socketId: socket.id, hasAuthToken: !!socket.handshake.auth.token, hasCookie: !!socket.handshake.headers.cookie }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
            // #endregion
            // Allow anonymous connections (for QR customers without tokens)
            // They can join order rooms but not staff rooms
            next();
            return;
        }

        const member = await authService.checkAuth(token);
        (socket as ExtendedSocket).member = member;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ccfc49ab-4340-4773-be36-87b0c39da0bf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'socket.middleware.ts:25', message: 'WebSocket auth - authenticated', data: { socketId: socket.id, memberRole: member.memberRole, memberId: member._id.toString() }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
        // #endregion

        next();
    } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ccfc49ab-4340-4773-be36-87b0c39da0bf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'socket.middleware.ts:30', message: 'WebSocket auth - invalid token (allowing anonymous)', data: { socketId: socket.id, error: err instanceof Error ? err.message : 'unknown' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
        // #endregion
        console.log("WebSocket authentication error:", err);
        // Allow anonymous connections even if token is invalid (for QR customers)
        // They can join order rooms but not staff rooms
        next();
    }
};


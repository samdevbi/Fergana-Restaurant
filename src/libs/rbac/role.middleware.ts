import { NextFunction, Response, Request } from "express";
import { ExtendedRequest } from "../types/member";
import Errors, { HttpCode, Message } from "../Errors";
import { MemberRole } from "../enums/member.enum";

/**
 * Verify user has KITCHEN role
 * Allows: CHEFF
 */
export const verifyKitchenStaff = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const extendedReq = req as ExtendedRequest;
        if (!extendedReq.member) {
            throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
        }

        if (extendedReq.member.memberRole !== MemberRole.CHEFF) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ccfc49ab-4340-4773-be36-87b0c39da0bf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'role.middleware.ts:22', message: 'Permission denied - wrong role', data: { memberRole: extendedReq.member.memberRole, expected: MemberRole.CHEFF }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
            // #endregion
            throw new Errors(HttpCode.FORBIDDEN, Message.INSUFFICIENT_PERMISSIONS);
        }

        next();
    } catch (err) {
        console.log("Error, verifyKitchenStaff:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Verify user has SERVICE or OWNER role
 * Allows: STAFF (service staff), OWNER
 */
export const verifyServiceStaff = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const extendedReq = req as ExtendedRequest;
        if (!extendedReq.member) {
            throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
        }

        // Allow STAFF (service staff) or OWNER
        if (extendedReq.member.memberRole !== MemberRole.STAFF && extendedReq.member.memberRole !== MemberRole.OWNER) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ccfc49ab-4340-4773-be36-87b0c39da0bf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'role.middleware.ts:50', message: 'Permission denied - wrong role', data: { memberRole: extendedReq.member.memberRole, expected: 'STAFF or OWNER' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
            // #endregion
            throw new Errors(HttpCode.FORBIDDEN, Message.INSUFFICIENT_PERMISSIONS);
        }

        next();
    } catch (err) {
        console.log("Error, verifyServiceStaff:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/**
 * Verify user has OWNER role
 * Allows: OWNER only
 */
export const verifyOwner = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const extendedReq = req as ExtendedRequest;
        if (!extendedReq.member) {
            throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
        }

        if (extendedReq.member.memberRole !== MemberRole.OWNER) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ccfc49ab-4340-4773-be36-87b0c39da0bf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'role.middleware.ts:77', message: 'Permission denied - wrong role', data: { memberRole: extendedReq.member.memberRole, expected: MemberRole.OWNER }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
            // #endregion
            throw new Errors(HttpCode.FORBIDDEN, Message.INSUFFICIENT_PERMISSIONS);
        }

        next();
    } catch (err) {
        console.log("Error, verifyOwner:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};


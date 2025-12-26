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
            throw new Errors(HttpCode.FORBIDDEN, Message.NOT_AUTHENTICATED);
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
            throw new Errors(HttpCode.FORBIDDEN, Message.NOT_AUTHENTICATED);
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
            throw new Errors(HttpCode.FORBIDDEN, Message.NOT_AUTHENTICATED);
        }

        next();
    } catch (err) {
        console.log("Error, verifyOwner:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};


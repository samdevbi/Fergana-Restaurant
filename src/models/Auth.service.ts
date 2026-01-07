import Errors, { HttpCode, Message } from "../libs/Errors";
import { AUTH_TIMER } from "../libs/config";
import { Member } from "../libs/types/member";
import jwt from "jsonwebtoken";

class AuthService {
    private readonly secretToken: string;

    constructor() {
        const token = process.env.SECRET_TOKEN;
        if (!token) {
            console.error("ERROR: SECRET_TOKEN environment variable is not set!");
            process.exit(1);
        }
        this.secretToken = token;
    }

    public async createToken(payload: Member) {
        return new Promise((resolve, reject) => {
            const duration = `${AUTH_TIMER}h`;
            jwt.sign(payload, process.env.SECRET_TOKEN as string, {
                expiresIn: duration,
            }, (err: Error | null, token: string | undefined) => {
                if (err) reject(new Errors(HttpCode.UNAUTHORIZED, Message.TOKEN_CREATION_FAILED)
                );
                else resolve(token as string);
            });
        });
    }

    public async createOrderToken(tableId: string) {
        return new Promise((resolve, reject) => {
            const duration = `10m`; // 10 minutes session for customer
            const payload = { tableId, role: 'CUSTOMER' };
            jwt.sign(payload, process.env.SECRET_TOKEN as string, {
                expiresIn: duration,
            }, (err: Error | null, token: string | undefined) => {
                if (err) reject(new Errors(HttpCode.UNAUTHORIZED, Message.TOKEN_CREATION_FAILED)
                );
                else resolve(token as string);
            });
        });
    }

    public async checkAuth(token: string): Promise<Member> {
        const result: Member = (await jwt.verify(
            token,
            this.secretToken
        )) as Member;
        return result;
    }

    public async verifyOrderToken(token: string): Promise<{ tableId: string, role: string } | null> {
        try {
            const result: any = await jwt.verify(token, this.secretToken);
            if (result && result.role === 'CUSTOMER' && result.tableId) {
                return result;
            }
            return null;
        } catch (err) {
            return null;
        }
    }
}

export default AuthService;
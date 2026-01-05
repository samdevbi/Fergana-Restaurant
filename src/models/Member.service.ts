import MemberModel from "../schema/Member.model";
import { MemberInput, Member, LoginInput, MemberUpdateInput } from "../libs/types/member";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { MemberStatus, MemberRole } from "../libs/enums/member.enum";
import * as bcrypt from "bcryptjs";
import { shapeIntoMongooseObjectId } from "../libs/config";
import { ObjectId } from "mongoose";

class MemberService {
    private readonly memberModel;

    constructor() {
        this.memberModel = MemberModel;
    }
    // SPA => User
    public async signup(input: MemberInput): Promise<Member> {
        // Validate required fields
        if (!input.memberPassword) {
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }
        if (!input.memberName) {
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }

        const salt = await bcrypt.genSalt();
        input.memberPassword = await bcrypt.hash(input.memberPassword, salt);

        try {
            const result = await this.memberModel.create(input);
            result.memberPassword = "";
            return result.toJSON();
        } catch (err) {
            console.error("Error, model:signup", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.USED_NICK_PHONE);
        }
    }

    public async login(input: LoginInput): Promise<Member> {
        //  TODO: Consider member status later
        const member = await this.memberModel
            .findOne(
                {
                    memberName: input.memberName,
                    memberStatus: { $ne: MemberStatus.DELETE },
                },
                { memberName: 1, memberStatus: 1, memberPassword: 1 }
            )
            .exec();

        if (!member) throw new Errors(HttpCode.NOT_FOUND, Message.NO_MEMBER_NICK);
        else if (member.memberStatus === MemberStatus.BLOCK) {
            throw new Errors(HttpCode.FORBIDDEN, Message.BLOCKED_USER);
        }

        const isMatch = await bcrypt.compare(
            input.memberPassword,
            member.memberPassword
        );
        if (!isMatch) {
            throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);
        }

        return await this.memberModel.findById(member._id)
            .lean()
            .exec();
    }

    public async getRestaurant(): Promise<Member> {
        const result = await this.memberModel.findOne({ memberRole: MemberRole.OWNER })
            .lean()
            .exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result;
    }

    public async getMemberDetail(member: Member): Promise<Member> {
        const memberId = shapeIntoMongooseObjectId(member._id);
        const result = await this.memberModel.findOne({ _id: memberId, memberStatus: MemberStatus.ACTIVE })
            .exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result;
    }

    public async getMemberById(memberId: ObjectId | string): Promise<Member> {
        const id = shapeIntoMongooseObjectId(memberId);
        const result = await this.memberModel.findById(id).exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result;
    }

    public async updateMember(member: Member, input: MemberUpdateInput): Promise<Member> {
        const memberId = shapeIntoMongooseObjectId(member._id);

        if (input.memberPassword) {
            const salt = await bcrypt.genSalt();
            input.memberPassword = await bcrypt.hash(input.memberPassword, salt);
        }

        const result = await this.memberModel.findOneAndUpdate({ _id: memberId }, input, { new: true })
            .exec();
        if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);

        return result;
    }

    public async getUsers(): Promise<Member[]> {
        const result = await this.memberModel.find({
            memberRole: { $in: [MemberRole.STAFF, MemberRole.CHEFF] }
        }).exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result;
    }

}



export default MemberService;
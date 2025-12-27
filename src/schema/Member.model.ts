import mongoose, { Schema } from "mongoose";
import { MemberStatus, MemberRole } from "../libs/enums/member.enum";

const memberSchema = new Schema(
    {
        memberRole: {
            type: String,
            enum: MemberRole,
            default: MemberRole.STAFF,
        },

        memberStatus: {
            type: String,
            enum: MemberStatus,
            default: MemberStatus.ACTIVE,
        },

        memberName: {
            type: String,
            index: { unique: true, sparse: true },
            required: true,
        },

        memberPassword: {
            type: String,
            select: false,
            required: true,
        },

        memberImages: {
            type: String,
        },

        restaurantId: {
            type: Schema.Types.ObjectId,
            ref: "Member",
            required: false,
        },
    },
    { timestamps: true }   // CreatedAt and UpdatedAt
);



export default mongoose.model("Member", memberSchema);
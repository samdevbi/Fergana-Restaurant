import express, { Request } from "express";
import { ObjectId } from "mongoose";
import { MemberStatus, MemberRole } from "../enums/member.enum";
import { Session } from "express-session";


export interface Member {
    _id: ObjectId;
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    memberName: string;
    memberPassword: string;
    memberImage?: string;
    restaurantId?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}


export interface MemberInput {
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    memberName: string;
    memberPassword: string;
    memberImage?: string;
    restaurantId?: ObjectId;
}

export interface LoginInput {
    memberName: string;
    memberPassword: string;
}

export interface MemberUpdateInput {
    _id: ObjectId;
    memberStatus?: MemberStatus;
    memberRole?: MemberRole;
    memberName?: string;
    memberPassword?: string;
    memberImage?: string;
}

export interface ExtendedRequest extends express.Request {
    member: Member;
    file?: Express.Multer.File;
    files?: Express.Multer.File[];
}

export interface AdminRequest extends express.Request {
    member: Member;
    session: Session & { member: Member };
    file?: Express.Multer.File;
    files?: Express.Multer.File[];
}


import express from "express";
import { ObjectId }  from "mongoose";  
import { MemberStatus, MemberRole } from "../enums/member.enum";
import { Request } from "express";
import { Session } from "express-session";


export interface Member {
    _id: ObjectId;
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    memberNick: string;
    memberPhone: string;
    memberPassword?: string;
    memberAdress?: string;
    memberDesc?: string;
    memberimage?: string;
    memberPoints: number;
    restaurantId?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}


export interface MemberInput {
    memberRole?: MemberRole;
    memberStatus?: MemberStatus;
    memberNick: string;
    memberPhone: string;
    memberPassword: string;
    memberAdress?: string;
    memberDesc?: string;
    memberImage?: string;
    memberPoints?: number;
    restaurantId?: ObjectId;
}

export interface LoginInput {
    memberNick: string;
    memberPassword: string;
}

export interface MemberUpdateInput {
    _id: ObjectId;
    memberStatus?: MemberStatus;
    memberNick?: string;
    memberPhone?: string;
    memberPassword?: string;
    memberAdress?: string;
    memberDesc?: string;
    memberImage?: string;
}

export interface ExtendedRequest extends Request {
    member: Member;
    file: Express.Multer.File;
    files: Express.Multer.File[];
}



export interface AdminRequest extends Request {
    member: Member;
    session: Session & {member: Member};
    file: Express.Multer.File;
    files: Express.Multer.File[];
}


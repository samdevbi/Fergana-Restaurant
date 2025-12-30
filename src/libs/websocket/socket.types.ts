import { Socket } from "socket.io";
import { Member } from "../types/member";

export interface ExtendedSocket extends Socket {
    member?: Member;
}




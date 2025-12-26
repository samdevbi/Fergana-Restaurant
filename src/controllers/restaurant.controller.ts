import { NextFunction, Request, Response, response } from "express";
import { T } from "../libs/types/common";
import MemberService from "../models/Member.service";
import { AdminRequest, MemberInput } from "../libs/types/member";
import { MemberRole } from "../libs/enums/member.enum";
import { LoginInput } from "../libs/types/member";
import Errors, { HttpCode, Message } from "../libs/Errors";

// BSSR: EJS Project

const memberService = new MemberService();

const restaurantController: T = {};
restaurantController.goHome = (req: Request, res: Response) => {
    try {
        console.log("goHome");
        res.render("Home");
        // send | json | redirect | render
    } catch (err) {
        console.log("Error on Home Page:", err);
        res.redirect("/admin");
    }
};

restaurantController.getSignup = (req: Request, res: Response) => {
    try {
        console.log("getSignup");
        res.render("Signup");
    } catch (err) {
        console.log("Error on Signup Page:", err);
        res.redirect("/admin");
    }
};

restaurantController.getLogin = (req: Request, res: Response) => {
    try {
        console.log("getLogin");
        res.render("Login");
    } catch (err) {
        console.log("Error on Login Page:", err);
        res.redirect("/admin");
    }
};

restaurantController.processSignup = async (req: AdminRequest, res: Response) => {
    try {
        console.log("processSignup");
        const file = req.file;
        if (!file) throw new Errors(HttpCode.BAD_REQUEST, Message.SOMETHING_WENT_WRONG);


        const newMember: MemberInput = req.body;
        newMember.memberImage = file?.path.replace(/\\/g, "/");;
        newMember.memberRole = MemberRole.OWNER;
        const result = await memberService.processSignup(newMember);

        req.session.member = result;
        req.session.save(function () {
            res.redirect("/admin/product/all");
        });


    } catch (err) {
        console.log("Error on processSignup Page:", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.send(`<script> alert("${message}"); window.location.replace("/admin/signup") </script>`);
    }
};

restaurantController.processLogin = async (req: AdminRequest, res: Response) => {
    try {
        console.log("processLogin");
        const input: LoginInput = req.body;
        const result = await memberService.processLogin(input);

        req.session.member = result;
        req.session.save(function () {
            res.redirect("/admin/product/all");

        });



    } catch (err) {
        console.log("Error on processLogin Page:", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.send(`<script> alert("${message}"); window.location.replace("/admin/login") </script>`);
    }
};

restaurantController.logout = async (req: AdminRequest, res: Response) => {
    try {
        console.log("LogOut");
        req.session.destroy(function () {
            res.redirect("/admin");
        })
    } catch (err) {
        console.log("Error on Login Page:", err);
        res.redirect("/admin");
    }
};

restaurantController.getUsers = async (req: Request, res: Response) => {
    try {
        console.log("getUsers");
        const result = await memberService.getUsers();
        console.log(result);
        res.render("users", { users: result });
    } catch (err) {
        console.log("Error on GetUsers:", err);
        res.redirect("/admin/login");
    }
};

restaurantController.updateChosenUser = async (req: Request, res: Response) => {
    try {
        console.log("updateChosenUser");
        const result = await memberService.updateChosenUser(req.body);

        res.status(HttpCode.OK).json({ data: result });
    } catch (err) {
        console.log("Error on updateChosenUser:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

restaurantController.checkAuthSession = async (req: AdminRequest, res: Response) => {
    try {
        console.log("checkAuthsession");
        if (req.session?.member) res.send(`<script> alert("Hi, ${req.session.member.memberName}") </script>`);
        else res.send(`<script> alert("${Message.NOT_AUTHENTICATED}") </script>`);



    } catch (err) {
        console.log("Error, checkAuthSession:", err);
        res.send(err);
    }
};

restaurantController.verifyRestaurant = (
    req: AdminRequest,
    res: Response,
    next: NextFunction
) => {
    if (req.session?.member?.memberRole === MemberRole.OWNER) {
        req.member = req.session.member;
        next();
    } else {
        const message = Message.NOT_AUTHENTICATED;
        res.send(`<script> alert("${message}"); window.location.replace('/admin/login') </script>`);
    }
}

export default restaurantController;
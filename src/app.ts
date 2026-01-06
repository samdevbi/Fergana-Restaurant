import express from "express";
import router from "./router";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import { MORGAN_FORMAT } from "./libs/config";

/** 1 - ENTRANCE**/
const app = express();

// CORS configuration - allow all origins
app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(MORGAN_FORMAT));

/** 2 - ROUTERS**/
app.use("/", router);            // API Routes 



export default app;

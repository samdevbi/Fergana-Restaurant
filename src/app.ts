import express from "express";
import path from 'path';
import router from "./router";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { MORGAN_FORMAT } from "./libs/config";

/** 1 - ENTRANCE**/
const app = express();
app.use("/uploads", express.static("./uploads"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(MORGAN_FORMAT));

/** 2 - ROUTERS**/
app.use("/", router);            // API Routes 



export default app;    // module.exports = app;  bu holat ayni commanJsda ishlatardik, lekin ESJS da export default qilib ishlatamiz

import express from "express";
const router = express.Router();
import memberController from "./controllers/member.controller";
import makeUploader from "./libs/utils/uploader";
import productController from "./controllers/product.controller";
import orderController from "./controllers/order.controller";
import qrController from "./controllers/qr.controller";
import kitchenController from "./controllers/kitchen.controller";
import serviceController from "./controllers/service.controller";
import adminController from "./controllers/admin.controller";
import { verifyKitchenStaff, verifyServiceStaff, verifyOwner } from "./libs/rbac/role.middleware";
import { qrOrderRateLimiter } from "./libs/middleware/rateLimiter";

/* Health Check */
router.get("/health", (req: express.Request, res: express.Response) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "Fergana Backend API"
    });
});

/* Member */
router.post("/member/signup", memberController.signup);
router.post("/member/login", memberController.login);
router.post(
    "/member/logout",
    memberController.verifyAuth,
    memberController.logout
);
router.get(
    "/member/detail",
    memberController.verifyAuth,
    memberController.getMemberDetail
);

router.post(
    "/member/update",
    memberController.verifyAuth,
    makeUploader("members").single("memberImage"),
    memberController.updateMember
);




/* QR Customer Routes (Public - No Authentication) */
router.get("/qr/:tableId/getMenu", qrController.getMenu);
router.post("/qr/:tableId/createOrder", qrOrderRateLimiter, qrController.createOrder);

/* Kitchen Staff Routes (JWT + KITCHEN role) */
router.get(
    "/staff/kitchen/getOrders",
    memberController.verifyAuth,
    verifyKitchenStaff,
    kitchenController.getOrders
);
router.get(
    "/staff/kitchen/getOrder/:id",
    memberController.verifyAuth,
    verifyKitchenStaff,
    kitchenController.getOrder
);



/* Service Staff Routes (JWT + SERVICE/OWNER role) */
router.get(
    "/staff/table/:tableId/activeOrder",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.getTableActiveOrder
);

router.post(
    "/staff/order/update",
    memberController.verifyAuth,
    verifyServiceStaff,
    orderController.updateOrder
);

/* Owner/Admin Routes (JWT + OWNER role) */

router.get(
    "/admin/service/table/:tableId/activeOrder",
    memberController.verifyAuth,
    verifyOwner,
    serviceController.getTableActiveOrder
);

/* Admin - Products */
router.post(
    "/admin/products/create",
    memberController.verifyAuth,
    verifyOwner,
    makeUploader("products").single("productImage"),
    productController.createNewProduct
);
router.get(
    "/admin/products",
    memberController.verifyAuth,
    verifyOwner,
    productController.getProducts
);
router.get(
    "/admin/products/all",
    memberController.verifyAuth,
    verifyOwner,
    productController.getAllProduct
);
router.get(
    "/admin/products/:id",
    memberController.verifyAuth,
    verifyOwner,
    productController.getProduct
);
router.put(
    "/admin/products/:id",
    memberController.verifyAuth,
    verifyOwner,
    productController.updateChosenProduct
);
router.delete(
    "/admin/products/:id",
    memberController.verifyAuth,
    verifyOwner,
    productController.deleteProduct
);

/* Admin - Tables */
router.get(
    "/admin/tables",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getTables
);
router.post(
    "/admin/tables",
    memberController.verifyAuth,
    verifyOwner,
    adminController.createTable
);
router.put(
    "/admin/tables/:id",
    memberController.verifyAuth,
    verifyOwner,
    adminController.updateTable
);
router.delete(
    "/admin/tables/:id",
    memberController.verifyAuth,
    verifyOwner,
    adminController.deleteTable
);

/* Admin - Staff */
router.get(
    "/admin/staff",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getStaff
);
router.post(
    "/admin/staff",
    memberController.verifyAuth,
    verifyOwner,
    adminController.createStaff
);
router.put(
    "/admin/staff/:id",
    memberController.verifyAuth,
    verifyOwner,
    adminController.updateStaff
);

/* Admin - Analytics */
router.get(
    "/admin/analytics/dashboard",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getDashboard
);
router.get(
    "/admin/analytics/revenue",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getRevenue
);
router.get(
    "/admin/analytics/popular-items",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getPopularItems
);

export default router;
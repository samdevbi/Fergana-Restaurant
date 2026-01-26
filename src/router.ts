import express from "express";
const router = express.Router();
import memberController from "./controllers/member.controller";
import productController from "./controllers/product.controller";
import orderController from "./controllers/order.controller";
import qrController from "./controllers/qr.controller";
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
    memberController.updateMember
);




/* QR Customer Routes (Public - No Authentication) */
router.get("/qr/:tableId/getMenu", qrController.getMenu);
router.post("/qr/:tableId/createOrder", qrOrderRateLimiter, qrController.createOrder);

/* Kitchen Staff Routes (JWT + KITCHEN role) */
router.get(
    "/kitchen/getOrders",
    memberController.verifyAuth,
    verifyKitchenStaff,
    orderController.getOrdersByKitchen
);
router.get(
    "/kitchen/getOrder/:id",
    memberController.verifyAuth,
    verifyKitchenStaff,
    orderController.getOrderByKitchen
);
router.post(
    "/kitchen/order/:id/markReady",
    memberController.verifyAuth,
    verifyKitchenStaff,
    orderController.markOrderReadyByKitchen
);



/*  Staff Routes (JWT + SERVICE/OWNER role) */
router.get(
    "/staff/order/:tableId/activeOrder",
    memberController.verifyAuth,
    verifyServiceStaff,
    orderController.getOrderByStaff
);

router.post(
    "/staff/order/:tableId/createOrder",
    memberController.verifyAuth,
    verifyServiceStaff,
    qrController.createOrder
);

router.delete(
    "/orders/:id/items/:itemId",
    memberController.verifyAuth,
    verifyServiceStaff,
    orderController.deleteOrderItem
);

router.patch(
    "/orders/:id/items/:itemId",
    memberController.verifyAuth,
    verifyServiceStaff,
    orderController.reduceOrderItemQuantity
);

router.post(
    "/orders/:id/complete",
    memberController.verifyAuth,
    verifyServiceStaff,
    orderController.completeOrder
);

router.post(
    "/orders/:id/complete-individual",
    memberController.verifyAuth,
    verifyServiceStaff,
    orderController.completeIndividualOrder
);

router.post(
    "/orders/:id/cancel",
    memberController.verifyAuth,
    verifyServiceStaff,
    orderController.cancelOrder
);

/* Owner order Routes (JWT + OWNER role) */

router.get(
    "/admin/order/:tableId/activeOrder",
    memberController.verifyAuth,
    verifyOwner,
    orderController.getOrderByStaff
);

router.post("/admin/order/:tableId/createOrder",
    memberController.verifyAuth,
    verifyOwner,
    qrController.createOrder);

router.delete(
    "/admin/orders/:id/items/:itemId/delete",
    memberController.verifyAuth,
    verifyOwner,
    orderController.deleteOrderItem
);

router.patch(
    "/admin/orders/:id/items/:itemId/reduce",
    memberController.verifyAuth,
    verifyOwner,
    orderController.reduceOrderItemQuantity
);

router.post(
    "/admin/orders/:id/complete",
    memberController.verifyAuth,
    verifyOwner,
    orderController.completeOrder
);

router.post(
    "/admin/orders/:id/complete-individual",
    memberController.verifyAuth,
    verifyOwner,
    orderController.completeIndividualOrder
);

router.post(
    "/admin/orders/:id/cancel",
    memberController.verifyAuth,
    verifyOwner,
    orderController.cancelOrder
);

/* Admin - Order History & Management */
router.get(
    "/admin/orders/history",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getAllOrders
);
router.get(
    "/admin/orders/history/:id",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getOrderDetail
);

/* Admin - Products */
router.post(
    "/admin/products/create",
    memberController.verifyAuth,
    verifyOwner,
    productController.createNewProduct
);
router.get(
    "/admin/products",
    memberController.verifyAuth,
    verifyOwner,
    productController.getProducts
);

router.get(
    "/admin/products/:id",
    memberController.verifyAuth,
    verifyOwner,
    productController.getProduct
);
router.put(
    "/admin/product/update/:id",
    memberController.verifyAuth,
    verifyOwner,
    productController.updateChosenProduct
);
router.delete(
    "/admin/product/delete/:id",
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
    "/admin/createTable",
    memberController.verifyAuth,
    verifyOwner,
    adminController.createTable
);
router.put(
    "/admin/updateTable/:id",
    memberController.verifyAuth,
    verifyOwner,
    adminController.updateTable
);
router.delete(
    "/admin/deleteTable/:id",
    memberController.verifyAuth,
    verifyOwner,
    adminController.deleteTable
);

/* Admin - Staff */
router.get(
    "/admin/getStaff",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getStaff
);
router.post(
    "/admin/createStaff",
    memberController.verifyAuth,
    verifyOwner,
    adminController.createStaff
);
router.put(
    "/admin/updateStaff/:id",
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
router.get(
    "/admin/analytics/weekly",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getWeeklyStatistics
);
router.get(
    "/admin/analytics/monthly",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getMonthlyStatistics
);
router.get(
    "/admin/analytics/weekly/daily-breakdown",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getWeeklyDailyBreakdown
);
router.get(
    "/admin/analytics/monthly/daily-breakdown",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getMonthlyDailyBreakdown
);

export default router;
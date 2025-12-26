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

/* Member */
router.get("/member/restaurant", memberController.getRestaurant)
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

router.get("/member/top-users", memberController.getTopUsers);



/* Product */
router.get(
    "/product/all",
    productController.getProducts
);

router.get(
    "/product/:id",
    memberController.retrieveAuth,
    productController.getProduct
);



/* Order */

router.post(
    "/order/create",
    memberController.verifyAuth,
    orderController.createOrder
);

router.get(
    "/order/all",
    memberController.verifyAuth,
    orderController.getMyOrders
);

router.post(
    "/order/update",
    memberController.verifyAuth,
    orderController.updateOrder
);

/* QR Customer Routes (Public - No Authentication) */
router.get("/qr/:tableId/menu", qrController.getMenu);
router.post("/qr/:tableId/order", qrController.createOrder);
router.get("/qr/order/:orderId/status", qrController.getOrderStatus);
router.get("/qr/order/:orderId/details", qrController.getOrderDetails);

/* Kitchen Staff Routes (JWT + KITCHEN role) */
router.get(
    "/staff/kitchen/orders",
    memberController.verifyAuth,
    kitchenController.getOrders
);
router.get(
    "/staff/kitchen/order/:id",
    memberController.verifyAuth,
    kitchenController.getOrder
);

/* Service Staff Routes (JWT + SERVICE/OWNER role) */
router.get(
    "/staff/service/orders",
    memberController.verifyAuth,
    serviceController.getOrders
);
router.get(
    "/staff/service/order/:id",
    memberController.verifyAuth,
    serviceController.getOrder
);
router.post(
    "/staff/service/order/:id/verify-payment",
    memberController.verifyAuth,
    serviceController.verifyPayment
);
router.post(
    "/staff/service/order/:id/complete",
    memberController.verifyAuth,
    serviceController.completeOrder
);
router.post(
    "/staff/service/order/:id/cancel",
    memberController.verifyAuth,
    serviceController.cancelOrder
);
router.put(
    "/staff/service/order/:id/items",
    memberController.verifyAuth,
    serviceController.modifyOrderItems
);
router.get(
    "/staff/service/tables",
    memberController.verifyAuth,
    serviceController.getTables
);

/* Owner/Admin Routes (JWT + OWNER role) */
router.get(
    "/admin/analytics/dashboard",
    memberController.verifyAuth,
    adminController.getDashboard
);
router.get(
    "/admin/analytics/revenue",
    memberController.verifyAuth,
    adminController.getRevenue
);
router.get(
    "/admin/analytics/items",
    memberController.verifyAuth,
    adminController.getPopularItems
);
router.get(
    "/admin/tables",
    memberController.verifyAuth,
    adminController.getTables
);
router.post(
    "/admin/tables",
    memberController.verifyAuth,
    adminController.createTable
);
router.put(
    "/admin/tables/:id",
    memberController.verifyAuth,
    adminController.updateTable
);
router.get(
    "/admin/staff",
    memberController.verifyAuth,
    adminController.getStaff
);
router.post(
    "/admin/staff",
    memberController.verifyAuth,
    adminController.createStaff
);
router.put(
    "/admin/staff/:id",
    memberController.verifyAuth,
    adminController.updateStaff
);

export default router;
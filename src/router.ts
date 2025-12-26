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
    verifyKitchenStaff,
    kitchenController.getOrders
);
router.get(
    "/staff/kitchen/order/:id",
    memberController.verifyAuth,
    verifyKitchenStaff,
    kitchenController.getOrder
);

/* Service Staff Routes (JWT + SERVICE/OWNER role) */
router.get(
    "/staff/service/orders",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.getOrders
);
router.get(
    "/staff/service/order/:id",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.getOrder
);
router.post(
    "/staff/service/order/:id/verify-payment",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.verifyPayment
);
router.post(
    "/staff/service/order/:id/complete",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.completeOrder
);
router.post(
    "/staff/service/order/:id/cancel",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.cancelOrder
);
router.put(
    "/staff/service/order/:id/items",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.modifyOrderItems
);
router.get(
    "/staff/service/tables",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.getTables
);

/* Owner/Admin Routes (JWT + OWNER role) */
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
    "/admin/analytics/items",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getPopularItems
);
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

export default router;
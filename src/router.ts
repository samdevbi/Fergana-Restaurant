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



/* Product */
router.post(
    "/product/createProduct",
    memberController.verifyAuth,
    verifyOwner,
    productController.createNewProduct
);

router.get(
    "/product/getAllProducts",
    memberController.verifyAuth,
    verifyOwner,
    productController.getProducts
);

router.get(
    "/product/:id",
    memberController.verifyAuth,
    verifyOwner,
    productController.getProduct
);

/* QR Customer Routes (Public - No Authentication) */
router.get("/qr/:tableId/getMenu", qrController.getMenu);
router.post("/qr/:tableId/createOrder", qrController.createOrder);
router.get("/qr/order/:orderId/getOrderStatus", qrController.getOrderStatus);
router.get("/qr/order/:orderId/getOrderDetails", qrController.getOrderDetails);

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
    "/staff/service/getOrders",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.getOrders
);
router.get(
    "/staff/service/getOrder/:id",
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
    "/staff/service/order/:id/modifyItems",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.modifyOrderItems
);
router.get(
    "/staff/service/getTables",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.getTables
);
router.get(
    "/staff/service/table/:tableId/history",
    memberController.verifyAuth,
    verifyServiceStaff,
    serviceController.getTableWithHistory
);

/* Owner/Admin Routes (JWT + OWNER role) */
router.get(
    "/admin/analytics/getDashboard",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getDashboard
);
router.get(
    "/admin/analytics/getRevenue",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getRevenue
);
router.get(
    "/admin/analytics/getPopularitems",
    memberController.verifyAuth,
    verifyOwner,
    adminController.getPopularItems
);
router.get(
    "/admin/getTables",
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
    "/admin/updateTables/:id",
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

export default router;
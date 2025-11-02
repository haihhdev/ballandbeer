const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { verifyToken, requireAdmin } = require("../middlewares/authMiddleware");

router.post("/", verifyToken, orderController.createOrder);
router.get("/my-orders", verifyToken, orderController.getMyOrders);
router.get("/all", verifyToken, requireAdmin, orderController.getAllOrders);
router.get(
  "/statistics",
  verifyToken,
  requireAdmin,
  orderController.getOrderStatistics
);
router.patch(
  "/:orderId/status",
  verifyToken,
  requireAdmin,
  orderController.updateOrderStatus
);
router.delete(
  "/:orderId",
  verifyToken,
  requireAdmin,
  orderController.deleteOrder
);
router.put("/:orderId", verifyToken, orderController.updateOrder);
module.exports = router;

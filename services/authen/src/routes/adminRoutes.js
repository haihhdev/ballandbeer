const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  updateUserStatus,
  updateAdminStatus,
  deleteUser,
  getAllOrders,
  getOrderStatistics,
  updateOrderStatus,
  deleteOrder,
} = require("../controllers/adminController");
const {
  authenticateToken,
  requireAdmin,
} = require("../middlewares/authMiddleware");

// All admin routes require authentication and admin privileges
router.use(authenticateToken, requireAdmin);

router.get("/users", getAllUsers);
router.get("/orders", getAllOrders);
router.get("/orders/statistics", getOrderStatistics);
router.patch("/users/:userId/status", updateUserStatus);
router.patch("/users/:userId/admin", updateAdminStatus);
router.delete("/users/:userId", deleteUser);
router.patch("/orders/:orderId/status", updateOrderStatus);
router.delete("/orders/:orderId", deleteOrder);

module.exports = router;

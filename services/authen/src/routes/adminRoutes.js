const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  updateUserStatus,
  updateAdminStatus,
  deleteUser,
} = require("../controllers/adminController");
const { authenticateToken, requireAdmin } = require("../middlewares/authMiddleware");

// All admin routes require authentication and admin privileges
router.use(authenticateToken, requireAdmin);

router.get("/users", getAllUsers);
router.patch("/users/:userId/status", updateUserStatus);
router.patch("/users/:userId/admin", updateAdminStatus);
router.delete("/users/:userId", deleteUser);

module.exports = router;

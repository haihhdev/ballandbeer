const express = require("express");
const router = express.Router();
const {
  register,
  login,
  changePassword,
  loginWithGoogle,
} = require("../controllers/authController"); // Thêm loginWithGoogle
const authenticateToken = require("../middlewares/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/change-password", authenticateToken, changePassword);
router.post("/google", loginWithGoogle);

module.exports = router;

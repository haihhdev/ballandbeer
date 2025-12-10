// Load .env file (cho local development)
require("dotenv").config();
// Load Vault secrets (cho production)
require("dotenv").config({ path: "/vault/secrets/env" });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const loadSecrets = require("./vaultClient");
const { verifyToken, requireAdmin } = require("./middlewares/authMiddleware");
const orderController = require("./controllers/orderController");
const paymentController = require("./controllers/paymentController");
const orderService = require("./services/orderService");
const runOrderConsumer = require("./consumers/orderConsumer");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// READ API
app.get("/api/orders/my-orders", verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("req.user is missing:", req.user);
      return res
        .status(401)
        .json({ message: "Unauthorized – missing user info" });
    }

    const userId = req.user.id;
    console.log("Fetching orders for userId:", userId, "Type:", typeof userId);
    const result = await orderService.getOrdersByUser(userId);

    if (result.status !== 200) {
      console.error("Error from getOrdersByUser:", result.message);
      return res.status(result.status).json(result);
    }

    res.status(result.status).json(result);
  } catch (err) {
    console.error("Error in /my-orders:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

app.get("/api/orders/all", verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await orderService.getAllOrders();
    res.status(result.status).json(result);
  } catch (err) {
    console.error("Error in /all:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get(
  "/api/orders/statistics",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await orderService.getOrderStatistics();
      res.status(result.status).json(result);
    } catch (err) {
      console.error("Error in /statistics:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// WRITE API
app.post("/api/orders", verifyToken, orderController.createOrder);
app.post(
  "/api/orders/booking",
  verifyToken,
  orderController.createBookingOrder
); // Tạo booking order cho VNPay
app.put("/api/orders/:orderId", verifyToken, orderController.updateOrder);

// PAYMENT API
app.post(
  "/api/payment/create-url",
  verifyToken,
  paymentController.createPaymentUrl
);
app.get("/api/payment/callback", paymentController.handlePaymentCallback);
app.get(
  "/api/payment/status/:orderId",
  verifyToken,
  paymentController.checkPaymentStatus
);

// ADMIN API
app.patch(
  "/api/orders/:orderId/status",
  verifyToken,
  requireAdmin,
  orderController.updateOrderStatus
);
app.delete(
  "/api/orders/:orderId",
  verifyToken,
  requireAdmin,
  orderController.deleteOrder
);

const start = async () => {
  await loadSecrets();

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    await runOrderConsumer();
    console.log("Kafka consumer running");

    const port = process.env.PORT || 4002;
    app.listen(port, () => {
      console.log(`Order API + Kafka running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start unified server:", err);
    process.exit(1);
  }
};

start();

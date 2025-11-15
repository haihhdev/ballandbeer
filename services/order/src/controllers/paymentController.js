const paymentService = require("../services/paymentService");
const orderService = require("../services/orderService");
const Order = require("../models/orderModel");

/**
 * Tạo URL thanh toán VNPay
 */
exports.createPaymentUrl = async (req, res) => {
  try {
    const { orderId, bankCode } = req.body;
    const userId = req.user.id;

    // Kiểm tra order có tồn tại và thuộc về user không
    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ message: "Order is not pending" });
    }

    // Lấy IP từ request và convert IPv6 localhost thành IPv4
    let clientIp = req.ip || req.connection.remoteAddress || "127.0.0.1";
    // VNPay không chấp nhận IPv6, convert ::1 thành 127.0.0.1
    if (clientIp === "::1" || clientIp === "::ffff:127.0.0.1") {
      clientIp = "127.0.0.1";
    }

    // Đảm bảo orderId là string và format đúng cho VNPay
    const orderIdStr = orderId.toString();

    // Log để debug
    console.log("\n>>> Payment Controller - Request Info <<<");
    console.log("User ID:", userId);
    console.log("Order ID (raw):", orderId);
    console.log("Order ID (string):", orderIdStr);
    console.log("Order Amount:", order.totalAmount);
    console.log("Bank Code:", bankCode);
    console.log("Client IP:", clientIp);
    console.log("Order Status:", order.status);

    // Tạo payment URL
    const paymentUrl = paymentService.createPaymentUrl(
      orderIdStr,
      order.totalAmount,
      bankCode,
      `Thanh toan don hang ${orderIdStr}`,
      clientIp
    );

    res.json({
      success: true,
      paymentUrl: paymentUrl,
      orderId: orderId,
    });
  } catch (error) {
    console.error("Error creating payment URL:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Xử lý callback từ VNPay
 */
exports.handlePaymentCallback = async (req, res) => {
  try {
    const vnpParams = req.query;

    // Xác thực callback
    const paymentResult = paymentService.verifyPaymentCallback(vnpParams);

    if (!paymentResult.isValid) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment/callback?success=false&message=Invalid signature`
      );
    }

    if (paymentResult.isSuccess) {
      // Tìm order và cập nhật
      const order = await Order.findById(paymentResult.orderId);
      if (order) {
        order.status = "complete";
        order.paymentTransaction = {
          transactionId: paymentResult.transactionId,
          bankCode: paymentResult.bankCode,
          paymentDate: new Date(),
          vnpResponseCode: paymentResult.responseCode,
        };
        order.paymentMethod = paymentResult.bankCode || "VNPay";
        await order.save();

        return res.redirect(
          `${
            process.env.FRONTEND_URL || "http://localhost:3000"
          }/payment/callback?success=true&orderId=${paymentResult.orderId}`
        );
      }
    }

    // Thanh toán thất bại
    return res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/payment/callback?success=false&message=Payment failed&orderId=${
        paymentResult.orderId
      }`
    );
  } catch (error) {
    console.error("Error handling payment callback:", error);
    return res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/payment/callback?success=false&message=Internal server error`
    );
  }
};

/**
 * Kiểm tra trạng thái thanh toán
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Kiểm tra order
    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Kiểm tra trạng thái từ VNPay
    const statusResult = await paymentService.queryTransactionStatus(orderId);

    res.json({
      success: true,
      orderStatus: order.status,
      paymentTransaction: order.paymentTransaction,
      vnpayStatus: statusResult,
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

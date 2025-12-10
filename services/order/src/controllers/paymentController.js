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

    // Tạo payment URL (không có dấu cách, dùng underscore)
    const paymentResult = paymentService.createPaymentUrl(
      orderIdStr,
      order.totalAmount,
      bankCode,
      `Thanh_toan_don_hang_${orderIdStr}`,
      clientIp
    );

    // Lưu TxnRef vào order để có thể tìm lại khi callback
    order.vnpTxnRef = paymentResult.txnRef;
    await order.save();

    console.log("Saved TxnRef to order:", paymentResult.txnRef);

    res.json({
      success: true,
      paymentUrl: paymentResult.paymentUrl,
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
    console.log("\n>>> VNPay Callback Received <<<");
    console.log("Query params:", JSON.stringify(req.query, null, 2));

    // Copy query params vào plain object để tránh lỗi hasOwnProperty
    const vnpParams = { ...req.query };
    console.log("VNP Params (copied):", JSON.stringify(vnpParams, null, 2));

    // Xác thực callback
    const paymentResult = paymentService.verifyPaymentCallback(vnpParams);
    console.log(
      "Payment verification result:",
      JSON.stringify(paymentResult, null, 2)
    );

    if (!paymentResult.isValid) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment/callback?success=false&message=Invalid signature`
      );
    }

    // Tìm order theo TxnRef (vnp_TxnRef là mã duy nhất cho mỗi lần thanh toán)
    const txnRef = paymentResult.orderId; // vnp_TxnRef được trả về trong orderId
    console.log("Looking for order with vnpTxnRef:", txnRef);

    const order = await Order.findOne({ vnpTxnRef: txnRef });

    if (!order) {
      console.log("Order not found with TxnRef:", txnRef);
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment/callback?success=false&message=Order not found`
      );
    }

    if (paymentResult.isSuccess) {
      // Cập nhật order thành công
      order.status = "complete";
      order.paymentTransaction = {
        transactionId: paymentResult.transactionId,
        bankCode: paymentResult.bankCode,
        paymentDate: new Date(),
        vnpResponseCode: paymentResult.responseCode,
      };
      order.paymentMethod = paymentResult.bankCode || "VNPay";
      await order.save();

      console.log("Payment successful, order updated:", order._id);

      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment/callback?success=true&orderId=${order._id}`
      );
    }

    // Thanh toán thất bại
    console.log("Payment failed for order:", order._id);
    return res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/payment/callback?success=false&message=Payment failed&orderId=${
        order._id
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

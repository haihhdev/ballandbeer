const orderService = require("../services/orderService");
const { sendEvent } = require("../producers/orderProducer");
const Order = require("../models/orderModel");

/**
 * Tạo đơn hàng đặt sân (booking order)
 * Trả về orderId để frontend dùng cho VNPay payment
 */
exports.createBookingOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookings, totalPrice } = req.body;

    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
      return res.status(400).json({ message: "Booking info is required" });
    }

    if (!totalPrice || totalPrice <= 0) {
      return res.status(400).json({ message: "Invalid total price" });
    }

    // Tạo booking order
    const order = new Order({
      userId,
      orderType: "booking",
      bookingInfo: { bookings },
      totalAmount: totalPrice,
      status: "pending",
      paymentMethod: "VNPay",
    });

    await order.save();

    console.log("Created booking order:", order._id);

    res.status(201).json({
      success: true,
      message: "Booking order created",
      orderId: order._id,
      totalAmount: order.totalAmount,
    });
  } catch (error) {
    console.error("Error creating booking order:", error);
    res.status(500).json({ message: "Failed to create booking order" });
  }
};

exports.createOrder = async (req, res) => {
  const userId = req.user.id;
  const orderData = {
    ...req.body,
    userId,
  };

  try {
    await sendEvent("order-topic", "CREATE_ORDER", orderData);
    res.status(202).json({ message: "Order creation event sent" });
  } catch (err) {
    console.error("Failed to send Kafka event:", err);
    res.status(500).json({ message: "Failed to send Kafka event" });
  }
};

exports.updateOrder = async (req, res) => {
  const { orderId } = req.params;
  const { products, status } = req.body;

  const payload = {
    orderId,
    products,
    status,
  };

  try {
    await sendEvent("order-topic", "UPDATE_ORDER", payload);
    res.status(202).json({ message: "Order update event sent" });
  } catch (err) {
    console.error("Failed to send Kafka event:", err);
    res.status(500).json({ message: "Failed to send Kafka event" });
  }
};

exports.getMyOrders = async (req, res) => {
  const userId = req.user.id;
  const result = await orderService.getOrdersByUser(userId);
  res.status(result.status).json(result);
};

exports.getAllOrders = async (req, res) => {
  const result = await orderService.getAllOrders();
  res.status(result.status).json(result);
};

exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const result = await orderService.updateOrder(orderId, null, status);
  res.status(result.status).json(result);
};

exports.deleteOrder = async (req, res) => {
  const { orderId } = req.params;

  const result = await orderService.deleteOrder(orderId);
  res.status(result.status).json(result);
};

exports.getOrderStatistics = async (req, res) => {
  const result = await orderService.getOrderStatistics();
  res.status(result.status).json(result);
};

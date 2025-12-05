const Product = require("../models/productModel");
const Order = require("../models/orderModel");
const mongoose = require("mongoose");

exports.createOrder = async (orderData) => {
  try {
    const itemsWithPrice = [];
    let totalAmount = 0;

    for (const item of orderData.products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return { status: 404, message: `Product ${item.productId} not found` };
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      itemsWithPrice.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const order = await Order.create({
      userId: orderData.userId,
      products: itemsWithPrice,
      totalAmount,
      status: "pending",
    });

    return { status: 201, data: order };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

exports.getOrdersByUser = async (userId) => {
  try {
    // Convert userId to ObjectId if it's a string
    // Mongoose 8.x uses mongoose.Types.ObjectId.isValid() and new mongoose.Types.ObjectId()
    let userIdObjectId = userId;

    if (typeof userId === "string") {
      // Check if it's a valid ObjectId string
      if (mongoose.Types.ObjectId.isValid(userId)) {
        userIdObjectId = new mongoose.Types.ObjectId(userId);
      } else {
        console.error("Invalid ObjectId format:", userId);
        return { status: 400, message: "Invalid user ID format" };
      }
    }

    const orders = await Order.find({ userId: userIdObjectId });
    return { status: 200, data: orders };
  } catch (err) {
    console.error("Error in getOrdersByUser:", err);
    console.error("UserId received:", userId, "Type:", typeof userId);
    console.error("Error details:", err.message, err.stack);
    return { status: 500, message: err.message };
  }
};

exports.getAllOrders = async () => {
  try {
    // Don't populate - just return raw data
    const orders = await Order.find();
    return { status: 200, data: orders };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

exports.updateOrder = async (orderId, products, status) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return { status: 404, message: "Order not found" };
    }

    if (products) {
      const itemsWithPrice = [];
      let totalAmount = 0;

      for (const item of products) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return {
            status: 404,
            message: `Product ${item.productId} not found`,
          };
        }

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        itemsWithPrice.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        });
      }

      order.products = itemsWithPrice;
      order.totalAmount = totalAmount;
    }

    if (status) {
      if (status !== "pending" && status !== "complete") {
        return { status: 400, message: "Invalid status value" };
      }
      order.status = status;
    }
    console.log("before order updated:", order);
    await order.save();
    console.log("after order updated:", order);
    return { status: 200, data: order };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

exports.deleteOrder = async (orderId) => {
  try {
    const order = await Order.findByIdAndDelete(orderId);
    if (!order) {
      return { status: 404, message: "Order not found" };
    }
    return { status: 200, message: "Order deleted successfully" };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

exports.getOrderStatistics = async () => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    // Tổng số đơn hàng
    const totalOrders = await Order.countDocuments();

    // Tổng doanh thu theo tháng
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          status: "complete",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    // Tổng doanh thu theo tuần
    const weeklyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek },
          status: "complete",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    // Số khách hàng đã mua
    const uniqueCustomers = await Order.distinct("userId");

    // Tỷ lệ đơn hoàn thành
    const completedOrders = await Order.countDocuments({ status: "complete" });
    const pendingOrders = await Order.countDocuments({ status: "pending" });
    const completionRate =
      totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Sản phẩm bán chạy nhất
    const topProducts = await Order.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          totalQuantity: { $sum: "$products.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$products.quantity", "$products.price"] },
          },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    return {
      status: 200,
      data: {
        totalOrders,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        weeklyRevenue: weeklyRevenue[0]?.total || 0,
        uniqueCustomers: uniqueCustomers.length,
        completionRate: Math.round(completionRate * 100) / 100,
        pendingOrders,
        completedOrders,
        topProducts,
      },
    };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

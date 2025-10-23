const User = require("../models/userModel");
const axios = require("axios");

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update user status (enable/disable)
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    // Prevent admin from disabling themselves
    if (userId === req.userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot disable your own account",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: `User ${isActive ? "enabled" : "disabled"} successfully`,
      data: user,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update user admin status
exports.updateAdminStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;

    // Prevent admin from removing their own admin status
    if (userId === req.userId && !isAdmin) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove your own admin privileges",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isAdmin },
      { new: true }
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: `User ${
        isAdmin ? "promoted to" : "removed from"
      } admin successfully`,
      data: user,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all orders (admin only)
exports.getAllOrders = async (req, res) => {
  try {
    console.log("Admin getAllOrders called");

    // Get the authorization header from the request
    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader ? "Present" : "Missing");

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Authorization header missing",
      });
    }

    // Make request to order service
    console.log("Making request to order service...");
    const response = await axios.get("http://localhost:4002/api/orders/all", {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    console.log("Order service response status:", response.status);
    console.log("Order service response data:", response.data);

    if (!response.data || !response.data.data) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Transform the response to match frontend expectations
    const orders = await Promise.all(
      response.data.data.map(async (order) => {
        // Fetch user info from database
        let userInfo = { username: "Unknown", email: "Unknown" };
        try {
          const user = await User.findById(order.userId).select(
            "username email"
          );
          if (user) {
            userInfo = { username: user.username, email: user.email };
          }
        } catch (err) {
          console.log("Error fetching user info:", err.message);
        }

        // Fetch product info for each item
        const itemsWithProductInfo = await Promise.all(
          order.products.map(async (item) => {
            try {
              // Fetch product info from product service
              const productResponse = await axios.get(
                `http://localhost:4003/api/products/${item.productId}`,
                { timeout: 5000 }
              );
              const product = productResponse.data;

              return {
                productId: item.productId,
                name: product.name || `Product ${item.productId}`,
                image: product.image
                  ? `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${product.image}`
                  : null,
                quantity: item.quantity,
                price: item.price,
                category: product.category || "Unknown",
              };
            } catch (err) {
              console.log(
                `Error fetching product ${item.productId}:`,
                err.message
              );
              return {
                productId: item.productId,
                name: `Product ${item.productId}`,
                image: null,
                quantity: item.quantity,
                price: item.price,
                category: "Unknown",
              };
            }
          })
        );

        return {
          _id: order._id,
          user: userInfo,
          items: itemsWithProductInfo,
          totalPrice: order.totalAmount,
          status: order.status,
          paymentMethod: order.paymentMethod || "Cash",
          createdAt: order.createdAt,
        };
      })
    );

    res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    console.error("Error fetching orders:", err.message);
    console.error("Error details:", err.response?.data);
    console.error("Error status:", err.response?.status);

    // Handle different types of errors
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        error:
          "Order service is not available. Please ensure it's running on port 4002.",
      });
    }

    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed with order service",
      });
    }

    res.status(500).json({
      success: false,
      error:
        err.response?.data?.message || err.message || "Unknown error occurred",
    });
  }
};

// Get order statistics (admin only)
exports.getOrderStatistics = async (req, res) => {
  try {
    console.log("Admin getOrderStatistics called");

    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader ? "Present" : "Missing");

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Authorization header missing",
      });
    }

    console.log("Making request to order service for statistics...");
    const response = await axios.get(
      "http://localhost:4002/api/orders/statistics",
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("Order service statistics response status:", response.status);
    console.log("Order service statistics response data:", response.data);

    res.json({
      success: true,
      data: response.data.data,
    });
  } catch (err) {
    console.error("Error fetching order statistics:", err.message);
    console.error("Error details:", err.response?.data);
    console.error("Error status:", err.response?.status);

    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        error:
          "Order service is not available. Please ensure it's running on port 4002.",
      });
    }

    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed with order service",
      });
    }

    res.status(500).json({
      success: false,
      error:
        err.response?.data?.message || err.message || "Unknown error occurred",
    });
  }
};

// Update order status (admin only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const authHeader = req.headers.authorization;

    const response = await axios.patch(
      `http://localhost:4002/api/orders/${orderId}/status`,
      { status },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: response.data,
    });
  } catch (err) {
    console.error("Error updating order status:", err.message);
    res.status(500).json({
      success: false,
      error:
        err.response?.data?.message || err.message || "Unknown error occurred",
    });
  }
};

// Get order statistics (admin only)
exports.getOrderStatistics = async (req, res) => {
  try {
    console.log("Admin getOrderStatistics called");

    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader ? "Present" : "Missing");

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Authorization header missing",
      });
    }

    console.log("Making request to order service for statistics...");
    const response = await axios.get(
      "http://localhost:4002/api/orders/statistics",
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("Order service statistics response status:", response.status);
    console.log("Order service statistics response data:", response.data);

    res.json({
      success: true,
      data: response.data.data,
    });
  } catch (err) {
    console.error("Error fetching order statistics:", err.message);
    console.error("Error details:", err.response?.data);
    console.error("Error status:", err.response?.status);

    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        error:
          "Order service is not available. Please ensure it's running on port 4002.",
      });
    }

    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed with order service",
      });
    }

    res.status(500).json({
      success: false,
      error:
        err.response?.data?.message || err.message || "Unknown error occurred",
    });
  }
};

// Delete order (admin only)
exports.deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const authHeader = req.headers.authorization;

    const response = await axios.delete(
      `http://localhost:4002/api/orders/${orderId}`,
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    res.json({
      success: true,
      message: "Order deleted successfully",
      data: response.data,
    });
  } catch (err) {
    console.error("Error deleting order:", err.message);
    res.status(500).json({
      success: false,
      error:
        err.response?.data?.message || err.message || "Unknown error occurred",
    });
  }
};

// Get order statistics (admin only)
exports.getOrderStatistics = async (req, res) => {
  try {
    console.log("Admin getOrderStatistics called");

    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader ? "Present" : "Missing");

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Authorization header missing",
      });
    }

    console.log("Making request to order service for statistics...");
    const response = await axios.get(
      "http://localhost:4002/api/orders/statistics",
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("Order service statistics response status:", response.status);
    console.log("Order service statistics response data:", response.data);

    res.json({
      success: true,
      data: response.data.data,
    });
  } catch (err) {
    console.error("Error fetching order statistics:", err.message);
    console.error("Error details:", err.response?.data);
    console.error("Error status:", err.response?.status);

    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        error:
          "Order service is not available. Please ensure it's running on port 4002.",
      });
    }

    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed with order service",
      });
    }

    res.status(500).json({
      success: false,
      error:
        err.response?.data?.message || err.message || "Unknown error occurred",
    });
  }
};

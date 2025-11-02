const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access token is missing or invalid" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded; // Include full user info for admin checks
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    // Use admin info from token instead of database query for better performance
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }
    next();
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

module.exports = { authenticateToken, requireAdmin };

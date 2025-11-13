const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    if (!decoded.id) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    req.userId = decoded.id;
    req.user = decoded; // Include full user info for admin checks
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "Access Denied: Admin privileges required" });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
};

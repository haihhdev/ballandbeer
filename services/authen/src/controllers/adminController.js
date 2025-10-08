const User = require("../models/userModel");

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
        message: "Cannot disable your own account" 
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true, 
      message: `User ${isActive ? 'enabled' : 'disabled'} successfully`,
      data: user 
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
        message: "Cannot remove your own admin privileges" 
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isAdmin },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true, 
      message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin successfully`,
      data: user 
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
        message: "Cannot delete your own account" 
      });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true, 
      message: "User deleted successfully" 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

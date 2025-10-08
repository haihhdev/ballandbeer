const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");

exports.register = async (req, res) => {
  const { email, password, username } = req.body;

  try {
    const emailExists = await User.findOne({ email });
    if (emailExists)
      return res.status(400).json({ message: "Email already exists" });

    const usernameExists = await User.findOne({ username });
    if (usernameExists)
      return res.status(400).json({ message: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, username });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if account is active
    if (!user.isActive) return res.status(403).json({ message: "Account has been disabled" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid password" });

    const token = generateToken(user._id);
    res.json({
      message: "Login successful",
      token,
      data: {
        _id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar || "",
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Old password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.loginWithGoogle = async (req, res) => {
  const { email, username, avatar } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      let uniqueUsername = username;
      let count = 1;
      while (await User.findOne({ username: uniqueUsername })) {
        uniqueUsername = username + count;
        count++;
      }
      user = new User({
        email,
        username: uniqueUsername,
        avatar,
        password: "google_oauth_no_password",
      });
      await user.save();
    }
    
    // Check if account is active
    if (!user.isActive) return res.status(403).json({ message: "Account has been disabled" });
    
    const token = generateToken(user._id);
    res.json({
      message: "Login with Google successful",
      token,
      data: {
        _id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar || "",
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

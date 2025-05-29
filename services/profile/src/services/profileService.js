const User = require("../models/profileModel");
const mongoose = require("mongoose");

exports.getProfileById = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { status: 400, message: "Invalid user ID" };
    }

    const user = await User.findById(id);
    if (!user) return { status: 404, message: "User not found" };
    const userObj = user.toObject();
    if (userObj.name && !userObj.fullname) userObj.fullname = userObj.name;
    delete userObj.name;
    return { status: 200, data: userObj };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

exports.updateProfileById = async (id, data) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { status: 400, message: "Invalid user ID" };
    }

    const user = await User.findByIdAndUpdate(id, data, { new: true });
    if (!user) return { status: 404, message: "User not found" };
    const userObj = user.toObject();
    if (userObj.name && !userObj.fullname) userObj.fullname = userObj.name;
    delete userObj.name;
    return { status: 200, data: userObj };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

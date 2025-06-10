const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  fullname: { type: String, default: '' },
  avatar: { type: String, default: '' },
  // Thêm các trường khác nếu cần
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

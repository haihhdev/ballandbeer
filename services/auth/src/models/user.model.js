const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

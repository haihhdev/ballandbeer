const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  hour: { type: Number, required: true }, // 6 -> 23
  isBooked: { type: Boolean, default: false },
  userId: { type: String, default: null }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  fieldId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  slots: [slotSchema]
}, { timestamps: true });

bookingSchema.index({ fieldId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Booking", bookingSchema);

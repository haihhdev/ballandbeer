const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    // Loại đơn hàng: product (mua hàng) hoặc booking (đặt sân)
    orderType: {
      type: String,
      enum: ["product", "booking"],
      default: "product",
    },
    // Thông tin sản phẩm (cho đơn hàng product)
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        quantity: { type: Number },
        price: { type: Number },
      },
    ],
    // Thông tin đặt sân (cho đơn hàng booking)
    bookingInfo: {
      bookings: [
        {
          courtName: { type: String },
          courtImage: { type: String },
          date: { type: String },
          times: [{ type: String }],
          price: { type: Number },
        },
      ],
    },
    totalAmount: { type: Number, required: true },
    status: { type: String, default: "pending" },
    paymentMethod: { type: String, default: "Cash" },
    paymentTransaction: {
      transactionId: { type: String },
      bankCode: { type: String },
      paymentDate: { type: Date },
      vnpResponseCode: { type: String },
    },
    vnpTxnRef: { type: String }, // Lưu TxnRef duy nhất cho mỗi lần thanh toán VNPay
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);

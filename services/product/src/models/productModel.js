const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  category: String,
  available: { type: Boolean, default: true },
  image: { type: String, default: '' },
  desc: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);

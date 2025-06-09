const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  hearts: {
    type: Number,
    default: 0
  },
  heartedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  image: {
    type: String,
    default: null
  },
  isEdited: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema); 
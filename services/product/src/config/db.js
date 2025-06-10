const mongoose = require('mongoose');

// Require models to ensure they are registered with mongoose
require('../models/userModel');
require('../models/commentModel');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;

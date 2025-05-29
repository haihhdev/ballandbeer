require('dotenv').config({ path: '/vault/secrets/env' });
const express = require('express');
const mongoose = require('mongoose');
const verifyToken = require('./middlewares/authMiddleware');
const orderService = require('./services/orderService');
const loadSecrets = require('./vaultClient');
const app = express();
app.use(express.json());

// GET /api/orders/my-orders
app.get('/api/orders/my-orders', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await orderService.getOrdersByUser(userId);
    res.status(result.status).json(result);
  } catch (err) {
    console.error('Error in /my-orders:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start read-only API server
const start = async () => {
  await loadSecrets();

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected (read-only)');

    const port = process.env.PORT || 4002;
    app.listen(port, () => {
      console.log(`Read-only Order API listening on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start read server:', err);
    process.exit(1);
  }
};

start();

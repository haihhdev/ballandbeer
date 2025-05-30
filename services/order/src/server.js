require('dotenv').config({ path: '/vault/secrets/env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const loadSecrets = require('./vaultClient');
const verifyToken = require('./middlewares/authMiddleware');
const orderController = require('./controllers/orderController');
const orderService = require('./services/orderService');
const runOrderConsumer = require('./consumers/orderConsumer');

const app = express();
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// READ API
app.get('/api/orders/my-orders', verifyToken, async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        console.error('req.user is missing:', req.user);
        return res.status(401).json({ message: 'Unauthorized – missing user info' });
      }
  
      const userId = req.user.id;
      const result = await orderService.getOrdersByUser(userId);
      res.status(result.status).json(result);
    } catch (err) {
      console.error('Error in /my-orders:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

// WRITE API
app.post('/api/orders', verifyToken, orderController.createOrder);
app.put('/api/orders/:orderId', verifyToken, orderController.updateOrder);

const start = async () => {
  await loadSecrets();

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    await runOrderConsumer();
    console.log('Kafka consumer running');

    const port = process.env.PORT || 4002;
    app.listen(port, () => {
      console.log(`Order API + Kafka running on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start unified server:', err);
    process.exit(1);
  }
};

start();

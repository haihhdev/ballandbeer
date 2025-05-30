const orderService = require('../services/orderService');
const { sendEvent } = require('../producers/orderProducer');

exports.createOrder = async (req, res) => {
  const userId = req.user.id;
  const orderData = {
    ...req.body,
    userId,
  };

  try {
    await sendEvent('order-topic', 'CREATE_ORDER', orderData);
    res.status(202).json({ message: 'Order creation event sent' });
  } catch (err) {
    console.error('Failed to send Kafka event:', err);
    res.status(500).json({ message: 'Failed to send Kafka event' });
  }
};

exports.updateOrder = async (req, res) => {
  const { orderId } = req.params;
  const { products, status } = req.body;

  const payload = {
    orderId,
    products,
    status,
  };

  try {
    await sendEvent('order-topic', 'UPDATE_ORDER', payload);
    res.status(202).json({ message: 'Order update event sent' });
  } catch (err) {
    console.error('Failed to send Kafka event:', err);
    res.status(500).json({ message: 'Failed to send Kafka event' });
  }
};


exports.getMyOrders = async (req, res) => {
  const userId = req.user.id;
  const result = await orderService.getOrdersByUser(userId);
  res.status(result.status).json(result);
};
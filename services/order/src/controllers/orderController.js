const orderService = require('../services/orderService');

exports.createOrder = async (req, res) => {
  const userId = req.user.id;
  const orderData = {
    ...req.body,
    userId,
  };
  const result = await orderService.createOrder(orderData);
  res.status(result.status).json(result);
};

exports.getMyOrders = async (req, res) => {
  const userId = req.user.id;
  const result = await orderService.getOrdersByUser(userId);
  res.status(result.status).json(result);
};

const Product = require('../models/productModel');
const Order = require('../models/orderModel');

exports.createOrder = async (orderData) => {
  try {
    const itemsWithPrice = [];
    let totalAmount = 0;

    for (const item of orderData.products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return { status: 404, message: `Product ${item.productId} not found` };
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      itemsWithPrice.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const order = await Order.create({
      userId: orderData.userId,
      products: itemsWithPrice,
      totalAmount,
      status: 'pending',
    });

    return { status: 201, data: order };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

exports.getOrdersByUser = async (userId) => {
  try {
    const orders = await Order.find({ userId });
    return { status: 200, data: orders };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

exports.updateOrder = async (orderId, products, status) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return { status: 404, message: 'Order not found' };
    }

    if (products) {
      const itemsWithPrice = [];
      let totalAmount = 0;

      for (const item of products) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return { status: 404, message: `Product ${item.productId} not found` };
        }

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        itemsWithPrice.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        });
      }

      order.products = itemsWithPrice;
      order.totalAmount = totalAmount;
    }

    if (status) {
      if (status !== 'pending' && status !== 'complete') {
        return { status: 400, message: 'Invalid status value' };
      }
      order.status = status;
    }
    console.log("before order updated:", order);
    await order.save();
    console.log("after order updated:", order);
    return { status: 200, data: order };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};
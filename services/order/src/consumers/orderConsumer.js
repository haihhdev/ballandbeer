const createKafkaClient = require('../config/kafka');
const kafka = createKafkaClient();
const orderService = require('../services/orderService'); 

const consumer = kafka.consumer({ groupId: 'order-service-group' });

const runOrderConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order-topic', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const { type, payload } = JSON.parse(message.value.toString());

        switch (type) {
          case 'CREATE_ORDER':
            await orderService.createOrder(payload);
            break;
          case 'UPDATE_ORDER':
            await orderService.updateOrder(payload.orderId, payload.products, payload.status);
            break;
          default:
            console.warn(`Unknown event type: ${type}`);
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    }
  });
};

module.exports = runOrderConsumer;

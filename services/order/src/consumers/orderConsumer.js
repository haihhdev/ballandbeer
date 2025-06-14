const createKafkaClient = require("../config/kafka");
const orderService = require("../services/orderService");

const runOrderConsumer = async () => {
  const kafka = createKafkaClient();
  const consumer = kafka.consumer({ groupId: "order-service-group" });

  await consumer.connect();
  await consumer.subscribe({ topic: "order-topic", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(
        "[Kafka] Received message:",
        message.value.toString(),
        "from topic:", topic,
        "partition:", partition
      );
      try {
        const { type, payload } = JSON.parse(message.value.toString());

        switch (type) {
          case "CREATE_ORDER":
            await orderService.createOrder(payload);
            break;
          case "UPDATE_ORDER":
            console.log("update order");
            await orderService.updateOrder(
              payload.orderId,
              payload.products,
              payload.status
            );
            break;
          default:
            console.warn(`Unknown event type: ${type}`);
        }
      } catch (err) {
        console.error("Error handling message:", err);
      }
    },
  });
};

module.exports = runOrderConsumer;

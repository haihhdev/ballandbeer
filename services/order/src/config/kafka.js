const { Kafka } = require('kafkajs');

const createKafkaClient = () => {
  const broker = process.env.KAFKA_BROKER;
  console.log('[KafkaJS] Using broker from env:', broker);
  return new Kafka({
    clientId: 'order-service',
    brokers: [broker]
  });
};

module.exports = createKafkaClient;

const { Kafka } = require('kafkajs');

const createKafkaClient = () => {
  const broker = process.env.KAFKA_BROKER || 'localhost:9092';
  console.log('[KafkaJS] Using broker from env:', broker);
  return new Kafka({
    clientId: 'order-service',
    brokers: [broker]
  });
};

module.exports = createKafkaClient;

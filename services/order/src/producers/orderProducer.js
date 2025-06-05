const createKafkaClient = require("../config/kafka");

const sendEvent = async (topic, type, payload) => {
  const kafka = createKafkaClient();
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({
    topic,
    messages: [
      {
        value: JSON.stringify({ type, payload }),
      },
    ],
  });
  await producer.disconnect();
};

module.exports = { sendEvent };

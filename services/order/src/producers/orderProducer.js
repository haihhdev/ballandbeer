const kafka = require('../config/kafka');

const producer = kafka.producer();

const sendEvent = async (topic, type, payload) => {
  await producer.connect();
  await producer.send({
    topic,
    messages: [
      {
        value: JSON.stringify({ type, payload })
      }
    ]
  });
  await producer.disconnect();
};

module.exports = { sendEvent };

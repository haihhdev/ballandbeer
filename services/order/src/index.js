const loadSecrets = require('./vaultClient');

const start = async () => {
  try {
    await loadSecrets();
    console.log('Kafka broker:', process.env.KAFKA_BROKER);

    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const runOrderConsumer = require('./consumers/orderConsumer');
    await runOrderConsumer();
    console.log('Kafka consumer running');

    const PORT = process.env.PORT;
    console.log(`Order service running on port ${PORT}`);
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
};

start();

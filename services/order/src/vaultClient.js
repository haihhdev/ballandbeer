const vault = require('node-vault')({
    apiVersion: 'v1',
    endpoint: 'http://vault.ballandbeer.svc.cluster.local:8200',
    token: 'root' // Only for dev/test
  });
  
  const loadSecrets = async () => {
    try {
      const res = await vault.read('secret/data/order-service');
      const data = res.data.data;
  
      process.env.MONGO_URI = data.MONGO_URI;
      process.env.PORT = data.PORT;
      process.env.JWT_SECRET = data.JWT_SECRET;
      process.env.KAFKA_BROKER = data.KAFKA_BROKER;
      
      console.log('Vault secrets loaded');
    } catch (err) {
      console.error('Failed to load secrets from Vault:', err.message);
      process.exit(1);
    }
  };
  
  module.exports = loadSecrets;
  
// Support both K8s (vault.ballandbeer.svc.cluster.local) and local docker-compose (vault)
const vaultEndpoint = process.env.VAULT_ADDR || "http://vault:8200";
const vaultToken = process.env.VAULT_TOKEN || "root";

const vault = require("node-vault")({
  apiVersion: "v1",
  endpoint: vaultEndpoint,
  token: vaultToken,
});

const loadSecrets = async () => {
  try {
    console.log(`Connecting to Vault at: ${vaultEndpoint}`);
    const res = await vault.read("secret/data/order-service");
    const data = res.data.data;

    process.env.MONGO_URI = data.MONGO_URI;
    process.env.PORT = data.PORT;
    process.env.JWT_SECRET = data.JWT_SECRET;
    process.env.KAFKA_BROKER = data.KAFKA_BROKER;

    // Load VNPay config từ Vault nếu có, nếu không thì dùng .env hoặc default
    if (data.VNPAY_TMN_CODE) process.env.VNPAY_TMN_CODE = data.VNPAY_TMN_CODE;
    if (data.VNPAY_SECRET_KEY)
      process.env.VNPAY_SECRET_KEY = data.VNPAY_SECRET_KEY;
    if (data.VNPAY_RETURN_URL)
      process.env.VNPAY_RETURN_URL = data.VNPAY_RETURN_URL;
    if (data.FRONTEND_URL) process.env.FRONTEND_URL = data.FRONTEND_URL;

    console.log("Vault secrets loaded successfully");
  } catch (err) {
    console.error("Failed to load secrets from Vault:", err.message);
    process.exit(1);
  }
};

module.exports = loadSecrets;

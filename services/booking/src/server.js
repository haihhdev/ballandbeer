require("dotenv").config({ path: "/vault/secrets/env" });
const app = require("./app");
const connectDB = require("./config/db");
const loadSecrets = require("./vaultClient");

const start = async () => {
  await loadSecrets();

  try {
    await connectDB();
    const port = process.env.PORT || 4001;
    app.listen(port, () => {
      console.log(`Booking Service is running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

start();

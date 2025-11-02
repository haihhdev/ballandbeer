require("dotenv").config({ path: "/vault/secrets/env" });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const loadSecrets = require("./vaultClient");

const app = express();
app.use(cors());
app.use(express.json());

const profileRoutes = require("./routes/profileRoutes");
app.use("/api/profile", profileRoutes);

const start = async () => {
  await loadSecrets();

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const port = process.env.PORT || 4004;
    app.listen(port, () => {
      console.log(`User Profile service running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

start();

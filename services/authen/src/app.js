require("dotenv").config({ path: "/vault/secrets/env" });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const loadSecrets = require("./vaultClient");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

const start = async () => {
  await loadSecrets();

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas");

    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`Auth service running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

start();

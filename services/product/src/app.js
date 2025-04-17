const express = require("express");
const productRoutes = require("./routes/productRoutes");
const cors = require("cors");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/products", productRoutes);

module.exports = app;
